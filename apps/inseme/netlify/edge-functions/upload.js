// src/netlify/edge-functions/upload.js
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3";
import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";

export const config = {
  path: "/api/upload",
};

export default defineEdgeFunction(async (request, runtime, context) => {
  const { getConfig, json, error } = runtime;
  if (request.method !== "POST") {
    return error("Method not allowed", 405);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const bucket = formData.get("bucket");
    const key = formData.get("key");
    const contentType =
      formData.get("contentType") || "application/octet-stream";

    if (!file || !bucket || !key) {
      return error("Missing parameters", 400);
    }

    const R2_ACCOUNT_ID = getConfig("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = getConfig("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = getConfig("R2_SECRET_ACCESS_KEY");
    const R2_PUBLIC_DOMAIN = getConfig("R2_PUBLIC_DOMAIN");

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return error("R2 not configured on server", 500);
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const arrayBuffer = await file.arrayBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: contentType,
      })
    );

    const publicUrl = R2_PUBLIC_DOMAIN
      ? `https://${R2_PUBLIC_DOMAIN}/${key}`
      : null;

    return json({
      success: true,
      key: key,
      url: publicUrl,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    return error(err.message);
  }
});
