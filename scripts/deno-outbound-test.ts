// scripts/deno-outbound-test.ts
console.log("---------------------------------------------------------");
console.log("TEST DENO OUTBOUND CONNECTIVITY");
console.log("Trying to fetch https://www.google.com");
console.log("---------------------------------------------------------\n");

try {
  const start = Date.now();
  const response = await fetch("https://www.google.com");
  const duration = Date.now() - start;

  console.log(`✅ Succès ! Status: ${response.status} ${response.statusText}`);
  console.log(`⏱️  Durée: ${duration}ms`);
} catch (error) {
  console.error("❌ Echec de connexion vers Google:");
  console.error(error);
}

console.log("\n---------------------------------------------------------");
console.log("Trying to fetch https://api.github.com");
console.log("---------------------------------------------------------\n");

try {
  const start = Date.now();
  const response = await fetch("https://api.github.com", {
    headers: { "User-Agent": "Deno-Test-Script" },
  });
  const duration = Date.now() - start;

  console.log(`✅ Succès! Status: ${response.status} ${response.statusText}`);
  console.log(`⏱️  Durée: ${duration}ms`);
} catch (error) {
  console.error("❌ Echec de connexion vers GitHub:");
  console.error(error);
}
