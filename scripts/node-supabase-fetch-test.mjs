import "dotenv/config";

// Ce script teste l'accès à Supabase via l'API REST standard et fetch() natif.
// Cela permet de :
// 1. Vérifier la connectivité réseau bas niveau (hors client supabase-js).
// 2. Valider que les URL et Clés sont correctes.
// 3. Servir de modèle pour une implémentation "light" dans les Edge Functions (Deno) si la lib pose problème.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Erreur: SUPABASE_URL ou SUPABASE_KEY manquants dans l'environnement (.env)");
  process.exit(1);
}

console.log("---------------------------------------------------------");
console.log("TEST SUPABASE REST API (FETCH)");
console.log("URL:", SUPABASE_URL);
console.log("Key (prefix):", SUPABASE_KEY.substring(0, 6) + "...");
console.log("---------------------------------------------------------\n");

async function testFetch() {
  const table = "instance_config";
  // Endpoint REST standard Supabase: /rest/v1/<table_name>
  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5`;

  console.log(`📡 GET ${endpoint}`);

  const start = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const duration = Date.now() - start;
    console.log(`⏱️  Durée: ${duration}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Erreur réponse:", text);
      return;
    }

    const data = await response.json();
    console.log(`✅ Succès! ${data.length} enregistrements récupérés.`);
    if (data.length > 0) {
      console.log("📝 Exemple (premier item):", data[0]);
    } else {
      console.log("⚠️ Table vide.");
    }

  } catch (error) {
    console.error("❌ Exception lors du fetch:", error);
    if (error.cause) console.error("   Cause:", error.cause);
  }
}

testFetch();
