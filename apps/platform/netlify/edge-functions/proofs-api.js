import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfig } from "../../src/common/config/instanceConfig.backend.js";

const PROOF_TYPE_MAP = {
  "SCREENSHOT": "CAPTURE_WEB",
  "PDF": "ACTE_PDF",
  "EMAIL": "EMAIL",
  "AR": "AR_LRAR",
  "PHOTO": "CAPTURE_WEB",
  "VIDEO": "AUTRE",
  "AUTRE": "AUTRE"
};

export default async (request, context) => {
  const supabaseUrl = getConfig("SUPABASE_URL");
  const supabaseAnonKey = getConfig("SUPABASE_ANON_KEY");
  const STORAGE_BUCKET = "proofs";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const url = new URL(request.url);
  const method = request.method;

  try {
    if (method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      const type = formData.get("type");
      const label = formData.get("label");
      const date_constat = formData.get("date_constat");
      const url_source = formData.get("url_source");
      const hash_sha256 = formData.get("hash_sha256");
      const metadataStr = formData.get("metadata");
      const metadata = metadataStr ? JSON.parse(metadataStr) : {};

      if (!file) {
        return new Response(JSON.stringify({ error: "Missing file" }), { status: 400, headers });
      }

      // 1. Upload to Storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        // Fallback to 'public-documents' if 'proofs' doesn't exist
        const { data: uploadData2, error: uploadError2 } = await supabase.storage
          .from("public-documents")
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false
          });
        
        if (uploadError2) throw uploadError2;
        
        // Use public-documents if successful
        const { data: { publicUrl } } = supabase.storage.from("public-documents").getPublicUrl(fileName);
        
        // 2. Insert into DB
        const dbProofType = PROOF_TYPE_MAP[type] || "AUTRE";
        const { data: proof, error: dbError } = await supabase
          .from("proof")
          .insert({
            type: dbProofType,
            source_org: "CITOYEN", // Default
            date_emission: date_constat,
            hash_sha256: hash_sha256 || "0000000000000000000000000000000000000000000000000000000000000000", // placeholder if missing
            storage_url: publicUrl,
            original_filename: file.name,
            file_size_bytes: file.size,
            mime_type: file.type,
            metadata: { ...metadata, label },
            created_by: user.id
          })
          .select()
          .single();

        if (dbError) throw dbError;
        return new Response(JSON.stringify(proof), { status: 201, headers });
      }

      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

      // 2. Insert into DB
      const dbProofType = PROOF_TYPE_MAP[type] || "AUTRE";
      const { data: proof, error: dbError } = await supabase
        .from("proof")
        .insert({
          type: dbProofType,
          source_org: "CITOYEN",
          date_emission: date_constat,
          hash_sha256: hash_sha256 || "0000000000000000000000000000000000000000000000000000000000000000",
          storage_url: publicUrl,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          metadata: { ...metadata, label },
          created_by: user.id
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return new Response(JSON.stringify(proof), { status: 201, headers });
    }

    if (method === "DELETE") {
      const id = url.pathname.split("/").pop();
      if (!id || id === "proofs-api") {
        return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
      }

      // Get proof to get storage_url
      const { data: proof, error: fetchError } = await supabase
        .from("proof")
        .select("storage_url")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Delete links first
      await supabase.from("proof_link").delete().eq("proof_id", id);

      // Delete from DB
      const { error: deleteError } = await supabase.from("proof").delete().eq("id", id);
      if (deleteError) throw deleteError;

      // Delete from Storage (extract path from URL)
      if (proof.storage_url) {
        try {
          const path = proof.storage_url.split("/").slice(-2).join("/"); // simple heuristic
          await supabase.storage.from(STORAGE_BUCKET).remove([path]);
          await supabase.storage.from("public-documents").remove([path]);
        } catch (e) {
          console.error("Error deleting file from storage:", e);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    console.error("[PROOFS-API] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
