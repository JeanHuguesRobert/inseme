import { getSupabase } from "./supabase.js";
import { appendOrMergeLastModifiedBy } from "@inseme/cop-host";

const tableMap = {
  users: "users",
  posts: "posts",
  groups: "groups",
  comments: "comments",
  wiki: "wiki_pages",
  subscriptions: "content_subscriptions",
};

function tableFor(type) {
  return tableMap[type] || type;
}

export async function listEntities(type, { limit = 50 } = {}) {
  const table = tableFor(type);
  // Prefer ordering by `updated_at` if the column exists, falling back to `created_at` or no ordering.
  let res;
  try {
    res = await getSupabase()
      .from(table)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (res.error) throw res.error;
  } catch (err) {
    // If ordering by updated_at failed (maybe column doesn't exist), try created_at
    try {
      res = await getSupabase()
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (res.error) throw res.error;
    } catch (err2) {
      // Last resort: select without ordering
      const res3 = await getSupabase().from(table).select("*").limit(limit);
      if (res3.error) throw res3.error;
      res = res3;
    }
  }

  const data = res.data || [];

  // If rows reference a `user_id`, fetch those users to build a readable title.
  const userIds = Array.from(new Set(data.filter((r) => r && r.user_id).map((r) => r.user_id)));
  let usersById = {};
  if (userIds.length > 0) {
    try {
      const { data: users, error: usersErr } = await getSupabase()
        .from("users")
        .select("id, display_name, email")
        .in("id", userIds);
      if (!usersErr && users) {
        usersById = users.reduce((acc, u) => {
          acc[u.id] = u;
          return acc;
        }, {});
      }
    } catch (e) {
      console.error("Failed to fetch users for titles", e);
    }
  }

  // Attach a `title` property to make rows searchable/readable in the admin UI
  const withTitles = data.map((row) => {
    if (!row) return row;
    const out = { ...row };
    // If there's already a title or display_name, keep it.
    if (!out.title) {
      if (out.user_id && usersById[out.user_id]) {
        const u = usersById[out.user_id];
        out.title = `${(u.display_name || "").trim()} ${u.email || ""}`.trim();
      } else if (out.display_name) {
        out.title = out.display_name;
      } else if (out.name) {
        out.title = out.name;
      }
    }
    return out;
  });

  return withTitles;
}

export async function getEntity(type, id) {
  const table = tableFor(type);
  const { data, error } = await getSupabase().from(table).select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function updateEntity(type, id, patch) {
  const table = tableFor(type);
  const { data, error } = await getSupabase()
    .from(table)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    // Build a SQL-like representation of the attempted update for debugging
    try {
      const esc = (v) => {
        if (v === null) return "NULL";
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
        if (typeof v === "string") return `'${String(v).replace(/'/g, "''")}'`;
        return String(v);
      };

      const assignments = Object.keys(patch)
        .map((k) => `${k} = ${esc(patch[k])}`)
        .join(", ");

      const sql = `UPDATE ${table} SET ${assignments} WHERE id = '${id}' RETURNING *;`;
      console.error("Failed update SQL:", sql, { table, id, patch, error });
    } catch (logErr) {
      console.error("Failed to build SQL debug string", logErr, { patch });
    }

    // PostgREST error PGRST116 means the result could not be coerced to a single json
    // which commonly happens when the update matched zero rows (e.g. RLS prevented the update)
    if (error.code === "PGRST116" || /contains 0 rows/i.test(error.message || "")) {
      const hint = `Update affected 0 rows. Likely causes: row-level security (RLS) prevented the update, you're editing the wrong table (e.g. updating public.users vs auth.users), or the client key lacks privileges. Use a server-side function with the Supabase service role key to perform admin updates.`;
      const e = new Error(error.message + " — " + hint);
      e.original = error;
      throw e;
    }
    throw error;
  }

  return data;
}

// Fallback: call server-side admin endpoint to perform update using service role
export async function updateEntityAsAdmin(type, id, patch) {
  const adminUrl = import.meta.env.VITE_ADMIN_UPDATE_URL || "/api/admin-update";

  // Always delegate to the backend. Provide the current authenticated user's UUID
  // as `requestorId` so the backend can validate the caller.
  const { data: userData, error: userErr } = await getSupabase().auth.getUser();
  if (userErr || !userData || !userData.user) {
    throw new Error("Not authenticated: cannot determine requestor id");
  }
  const requestorId = userData.user.id;

  const payload = { type, id, patch, requestorId };
  try {
    console.log("admin update request (client)", { type, id, requestorId });
  } catch (e) {}

  const res = await fetch(adminUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (e) {
    parsed = text;
  }

  try {
    console.log("admin update response (client)", { status: res.status, body: parsed });
  } catch (e) {}

  if (!res.ok) {
    throw new Error(`Admin update failed: ${res.status} ${text}`);
  }

  return parsed?.data;
}

export async function deleteEntity(type, id) {
  const table = tableFor(type);
  const { data, error } = await getSupabase().from(table).delete().eq("id", id).select().single();
  if (error) throw error;
  return data;
}
