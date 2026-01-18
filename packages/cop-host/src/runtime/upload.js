import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3";

/**
 * Gère l'upload de fichiers vers un stockage compatible S3 (R2, Backblaze, AWS S3, Supabase Storage, etc.)
 * Utilisable par n'importe quelle Edge Function.
 *
 * Note: Pour Supabase Storage, utilisez les credentials S3 fournis par Supabase (Settings -> Storage -> S3 Connection).
 * L'endpoint sera de la forme: https://<project_ref>.supabase.co/storage/v1/s3
 *
 * @param {Request} request
 * @param {Object} runtime - Le runtime injecté par cop-host (contient getConfig, error, json)
 */
export async function handleUpload(request, runtime) {
  const { error, json, getConfig } = runtime;

  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const key = formData.get("key"); // Path in bucket
    const contentType = formData.get("contentType") || file.type;
    const bucketType = formData.get("bucketType") || "media"; // 'media' | 'proof' | 'tmp'

    if (!file || !key) return error("Missing file or key", 400);

    // Config Selection based on Type
    let prefix = "R2_MEDIA";
    if (bucketType === "proof") prefix = "R2_PROOF";
    if (bucketType === "tmp") prefix = "R2_TMP";

    // Fallback to generic R2_ if specific not found (backward compatibility)
    const getConf = (suffix) => getConfig(`${prefix}_${suffix}`) || getConfig(`R2_${suffix}`);

    const bucket = getConf("BUCKET");
    const accessKeyId = getConf("ACCESS_KEY_ID");
    const secretAccessKey = getConf("SECRET_ACCESS_KEY");
    const endpoint = getConf("ENDPOINT");
    const publicBaseUrl = getConf("PUBLIC_DOMAIN") || getConf("PUBLIC_URL_BASE");

    if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
      return error(`Configuration missing for ${bucketType} storage`, 500);
    }

    // Official S3 Client (Works with R2/Backblaze)
    const s3 = new S3Client({
      endpoint,
      region: "auto",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const fileBuffer = await file.arrayBuffer();

    // Upload using standard SDK
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new Uint8Array(fileBuffer),
        ContentType: contentType,
      })
    );

    // Construct Public URL
    let finalUrl = "";
    if (publicBaseUrl) {
      // Ensure https:// prefix
      const baseUrl = publicBaseUrl.startsWith("http") ? publicBaseUrl : `https://${publicBaseUrl}`;
      finalUrl = `${baseUrl}/${key}`;
    } else {
      // Fallback
      finalUrl = `${endpoint}/${bucket}/${key}`;
    }

    return json({
      success: true,
      url: finalUrl,
      path: key,
      type: bucketType,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    return error(err.message, 500);
  }
}
