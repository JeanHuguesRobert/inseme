// src/netlify/edge-functions/cleanup-storage.js
import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";

export const config = {
  path: "/api/admin/cleanup-storage",
};

export default defineEdgeFunction(async (request, runtime, context) => {
  const { getConfig, json, error, newSupabase } = runtime;
  // This function can be triggered via a Cron Job (Netlify Scheduled Functions)
  // or manually via a webhook.

  const authHeader = request.headers.get("Authorization");
  const secret = getConfig("CLEANUP_SECRET");

  // Simple security check if secret is configured
  if (secret && authHeader !== `Bearer ${secret}`) {
    return error("Unauthorized", 401);
  }

  const supabase = newSupabase(true);
  if (!supabase) {
    return error("Supabase configuration missing", 500);
  }

  const BUCKET_NAME = "public-documents";
  const TTL_DAYS = 30; // Protect files for 30 days
  const MIN_FILES_PER_ROOM = 10; // Always keep the last 10 files per room

  try {
    // 1. List all files in 'temp'
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("temp", { limit: 1000 }); // Increase limit to see more files

    if (listError) throw listError;

    if (!files || files.length === 0) {
      return json({ message: "No files to cleanup" });
    }

    const now = new Date();
    const filesByRoom = {};

    // Group files by room (based on filename prefix)
    files.forEach((file) => {
      // New format: roomid_timestamp_random.webm
      // Old format: vocal_timestamp_random.webm
      const parts = file.name.split("_");
      const roomName = parts.length > 2 ? parts[0] : "legacy";

      if (!filesByRoom[roomName]) filesByRoom[roomName] = [];
      filesByRoom[roomName].push(file);
    });

    const filesToDelete = [];

    Object.keys(filesByRoom).forEach((room) => {
      const roomFiles = filesByRoom[room];

      // Sort by creation date (newest first)
      roomFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      roomFiles.forEach((file, index) => {
        const created = new Date(file.created_at);
        const ageDays = (now - created) / (1000 * 60 * 60 * 24);

        // Delete if older than TTL AND not within the "protected" last N files
        if (ageDays > TTL_DAYS && index >= MIN_FILES_PER_ROOM) {
          filesToDelete.push(`temp/${file.name}`);
        }
      });
    });

    if (filesToDelete.length === 0) {
      return json({
        message: "No expired files found (protected by TTL or Min Count)",
      });
    }

    // 2. Delete expired files
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filesToDelete);

    if (deleteError) throw deleteError;

    return json({
      message: `Cleanup successful`,
      deleted_count: filesToDelete.length,
      files: filesToDelete,
    });
  } catch (err) {
    return error(err.message);
  }
});
