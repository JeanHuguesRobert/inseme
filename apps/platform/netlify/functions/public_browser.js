import { PublicStorageService } from "@inseme/cop-host/backend";

/*
  Netlify Function (ESM) - public browser
  Refactorisé pour utiliser PublicStorageService de @inseme/cop-host
*/

const storage = new PublicStorageService();

function jsonResponse(status, body) {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  const q = event.queryStringParameters || {};
  
  try {
    const result = await storage.handleRequest(q);
    
    // Si c'est un téléchargement direct (cas readFile avec download: true)
    if (result.file && (q.download === "1" || q.download === "true")) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": result.mime,
          "Content-Disposition": `attachment; filename="${result.name}"`,
        },
        body: result.body,
        isBase64Encoded: result.base64,
      };
    }

    return jsonResponse(200, result);
  } catch (e) {
    if (e.message.includes("Path not found")) {
      return jsonResponse(404, { 
        error: "Not found", 
        message: `Le chemin demandé est introuvable.` 
      });
    }
    if (e.message.includes("Security Error")) {
      return jsonResponse(400, { 
        error: "Security Error", 
        message: "Accès refusé." 
      });
    }
    
    console.error("[public_browser] error:", e);
    return jsonResponse(500, {
      error: String(e.message || e),
      message: "Erreur serveur lors de l'accès aux fichiers.",
    });
  }
}
