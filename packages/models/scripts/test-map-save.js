import fetch from "node-fetch";

const BASE_URL = process.env.AI_URL || "http://localhost:8880";

async function testMapSave() {
  console.log(`Saving Magistral map to disk...`);
  try {
    const res = await fetch(`${BASE_URL}/magistral/map/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log("Map saved successfully!");
    console.log("Saved to:", data.path);
  } catch (err) {
    console.error("Map save failed:", err.message);
    process.exit(1);
  }
}

testMapSave();
