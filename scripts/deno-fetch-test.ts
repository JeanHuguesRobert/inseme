// scripts/deno-fetch-test.ts
// Test minimal de connectivité Deno avec fetch() natif (sans dépendances complexes)

// Chargeur .env basique pour Deno
const envText = await Deno.readTextFile(".env").catch(() => "");
for (const line of envText.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, ""); // Enlever quotes
    if (!Deno.env.get(key)) {
      Deno.env.set(key, val);
    }
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Erreur: SUPABASE_URL ou SUPABASE_KEY manquants");
  Deno.exit(1);
}

console.log("---------------------------------------------------------");
console.log("TEST DENO FETCH (NO LIB)");
console.log("URL:", SUPABASE_URL);
console.log("---------------------------------------------------------\n");

const endpoint = `${SUPABASE_URL}/rest/v1/instance_config?select=*&limit=1`;
console.log(`📡 GET ${endpoint}`);

try {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  console.log(`Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const text = await response.text();
    console.error("❌ Erreur:", text);
  } else {
    const data = await response.json();
    console.log("✅ Succès! Données reçues:", data.length);
    console.log("Premier item:", data[0]);
  }
} catch (error) {
  console.error("❌ Exception fetch:", error);
}
