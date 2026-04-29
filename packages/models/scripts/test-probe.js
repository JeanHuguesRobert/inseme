import fetch from "node-fetch";

const BASE_URL = process.env.AI_URL || "http://localhost:8880";
const PROVIDER_URL = process.argv[2] || "https://api.groq.com/openai/v1";
const API_KEY = process.env.GROQ_API_KEY || process.argv[3];

if (!API_KEY) {
  console.error("Usage: node test-probe.js [provider_url] [api_key]");
  console.error("Or set GROQ_API_KEY env var");
  process.exit(1);
}

async function testProbe() {
  console.log(`Probing ${PROVIDER_URL}...`);
  try {
    const res = await fetch(`${BASE_URL}/magistral/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: PROVIDER_URL,
        apiKey: API_KEY,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log("Probe successful!");
    console.log("Models found:", data.data?.length || 0);
    if (data.data && data.data.length > 0) {
      console.log("First model:", data.data[0].id);
    }
  } catch (err) {
    console.error("Probe failed:", err.message);
    process.exit(1);
  }
}

testProbe();
