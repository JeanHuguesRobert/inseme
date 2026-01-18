// packages/cop-host/src/lib/storage.js
import { getSupabase } from "../client/supabase.js";
import { getConfig } from "../config/instanceConfig.client.js";

/**
 * Shared Storage Utility for Inseme & Platform
 * Handles file uploads to Supabase Storage or Cloudflare R2 (via Edge Functions)
 */

export const storage = {
  /**
   * General upload method.
   * Options:
   * - contentType: MIME type
   * - bucketType: 'supabase' | 'media' | 'proof' | 'tmp'
   */
  async upload(bucket, path, file, options = {}) {
    let bucketType = options.bucketType;
    let useR2 = false;

    if (bucketType === "media" || bucketType === "proof" || bucketType === "tmp") {
      let prefix = "R2_MEDIA";
      if (bucketType === "proof") prefix = "R2_PROOF";
      if (bucketType === "tmp") prefix = "R2_TMP";

      useR2 = !!(getConfig(`${prefix}_BUCKET`) || getConfig("R2_BUCKET"));
    }

    // Detect environment to handle FormData differences
    const isBrowser = typeof window !== "undefined";

    if (useR2) {
      try {
        // Use Edge Function proxy to R2/S3
        const formData = new FormData();
        formData.append("file", file);
        formData.append("key", path);
        formData.append("bucketType", bucketType);

        if (options.contentType) {
          formData.append("contentType", options.contentType);
        }

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Upload Failed: ${errText}`);
        }

        return await res.json();
      } catch (error) {
        console.error("R2 upload failed, falling back to Supabase:", error);
        // Fallback to Supabase if R2 upload fails
        const supabase = getSupabase();
        if (!supabase) throw new Error("Supabase client not initialized");

        const { data, error: sbError } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: options.contentType,
        });

        if (sbError) throw sbError;

        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);

        return {
          path: data.path,
          url: publicUrlData.publicUrl,
          type: "supabase",
        };
      }
    } else {
      // Fallback: Supabase Storage
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not initialized");

      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: options.contentType,
      });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);

      return {
        path: data.path,
        url: publicUrlData.publicUrl,
        type: "supabase",
      };
    }
  },

  async getPublicUrl(bucket, path) {
    const supabase = getSupabase();
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async remove(bucket, paths) {
    const supabase = getSupabase();
    return await supabase.storage.from(bucket).remove(paths);
  },

  async archiveSession(roomId, sessionData) {
    const jsonStr = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const fileName = `sessions/${roomId}/${new Date().toISOString()}_session.json`;

    // Archives are PROOFS -> R2 Proofs (if avail) or Supabase
    return await this.upload("public-documents", fileName, blob, {
      contentType: "application/json",
      bucketType: "proof",
    });
  },

  async uploadVocal(roomId, blob, customFileName = null) {
    const fileName = customFileName || `temp/${roomId}/vocal_${Date.now()}.webm`;

    // Vocals are MEDIA (Ephemeral)
    const { url } = await this.upload("public-documents", fileName, blob, {
      contentType: "audio/webm",
      bucketType: "media",
    });
    return url;
  },

  /**
   * Uploads an ephemeral media (image/video) to temporary storage.
   * Target path: ephemeral/{roomId}/{timestamp}_{random}.ext
   */
  async uploadEphemeral(roomId, file, options = {}) {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `ephemeral/${roomId}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;

    // Ephemeral -> MEDIA
    const { url } = await this.upload("public-documents", fileName, file, {
      contentType: file.type || "image/jpeg",
      bucketType: "media",
      ...options,
    });
    return url;
  },

  /**
   * Uploads a working file (scratchpad).
   * Target path: tmp/{roomId}/{random}.ext
   */
  async uploadTemp(roomId, file, options = {}) {
    const ext = file.name.split(".").pop() || "tmp";
    const fileName = `tmp/${roomId}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;

    // Tmp -> TMP
    const { url } = await this.upload("public-documents", fileName, file, {
      contentType: file.type || "application/octet-stream",
      bucketType: "tmp",
      ...options,
    });
    return url;
  },

  /**
   * Uploads a proof/legal document.
   * Target path: proofs/{roomId}/{date}_{filename}
   */
  async uploadProof(roomId, file, options = {}) {
    const datePrefix = new Date().toISOString().split("T")[0];
    const fileName = `proofs/${roomId}/${datePrefix}_${file.name}`;

    // Proof -> PROOF
    const { url } = await this.upload("public-documents", fileName, file, {
      contentType: file.type || "application/pdf",
      bucketType: "proof",
      ...options,
    });
    return url;
  },
};
