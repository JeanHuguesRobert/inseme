const DEFAULT_SOURCE_URL =
  "https://raw.githubusercontent.com/JeanHuguesRobert/barons-Mariani/main/research/senatoriales-2026/review-pdf/66f34d0cb32e94509988b6f83a87c8a215b3fb81/requete-conseil-constitutionnel-REVIEW.pdf";

export async function handler(event) {
  if (String(event.httpMethod || "GET").toUpperCase() !== "GET") {
    return {
      statusCode: 405,
      headers: { Allow: "GET", "Cache-Control": "no-store" },
      body: "Method not allowed",
    };
  }

  const source = process.env.CC_PETITION_PDF_SOURCE_URL || DEFAULT_SOURCE_URL;

  try {
    const res = await fetch(source, {
      headers: { "User-Agent": "jhn-canonical-cc-pdf/1.0" },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error("cc-petition-pdf upstream", res.status, source);
      return {
        statusCode: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
        body: "PDF temporarily unavailable",
      };
    }

    const bytes = Buffer.from(await res.arrayBuffer());

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": 'inline; filename="requete-conseil-constitutionnel-haute-corse-2026.pdf"',
        "Cache-Control": "no-store, max-age=0",
        "X-Canonical-Artifact": "cc-petition-haute-corse-2026",
        "X-Artifact-State": "REVIEW",
      },
      body: bytes.toString("base64"),
    };
  } catch (error) {
    console.error("cc-petition-pdf error", error?.message || error);
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: "PDF temporarily unavailable",
    };
  }
}
