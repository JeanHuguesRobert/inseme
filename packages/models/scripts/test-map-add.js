import fetch from "node-fetch";

const BASE_URL = process.env.AI_URL || "http://localhost:8880";

// A dummy node to add
const NODE = {
  id: `test-node-${Date.now()}`,
  url: "https://api.groq.com/openai/v1/chat/completions",
  model: "llama3-8b-8192",
  tier: "fast",
  weight: 10,
};

async function testMapAdd() {
  console.log(`Adding node ${NODE.id} to Magistral map...`);
  try {
    const res = await fetch(`${BASE_URL}/magistral/map/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node: NODE }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log("Node added successfully!");
    console.log("Response:", data);
  } catch (err) {
    console.error("Map add failed:", err.message);
    process.exit(1);
  }
}

testMapAdd();
