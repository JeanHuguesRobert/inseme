import { getSupabase } from "./supabase.js";
import { getConfig } from "@inseme/cop-host";

/**
 * Detect gazette names linked to a group.
 * Returns an array containing "global" when the group is the global editor team,
 * plus any gazette name matching the group name when posts already reference it.
 *
 * @param {Object} group - Group record with at least a `name` field.
 * @returns {Promise<string[]>}
 */
export async function detectGazetteAssignments(group) {
  if (!group?.name) return [];

  const assignments = [];
  const groupName = group.name.trim();
  const globalEditorName = getConfig("global_gazette_editor_group", "La Gazette");

  if (groupName === globalEditorName) {
    assignments.push("global");
  }

  try {
    const { data } = await getSupabase()
      .from("posts")
      .select("id")
      .eq("metadata->>gazette", groupName)
      .limit(1);

    if (data && data.length > 0) {
      assignments.push(groupName);
    }
  } catch (err) {
    console.error("Error detecting gazette assignments:", err);
  }

  return Array.from(new Set(assignments));
}
