import fetch from "node-fetch";

const BASE_URL = process.env.AI_URL || "http://localhost:8880";
const MODEL = process.argv[2] || "magistral"; // Default to routing via magistral
const PROMPT = process.argv[3] || "Hello, are you there?";

async function testChat() {
  console.log(`Sending chat completion request to ${BASE_URL} (model: ${MODEL})...`);
  try {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer sesame", // Default auth
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: PROMPT }],
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log("Chat completion successful!");
    console.log("Response:", data.choices?.[0]?.message?.content);
    if (data.usage) {
      console.log("Usage:", data.usage);
    }
  } catch (err) {
    console.error("Chat request failed:", err.message);
    process.exit(1);
  }
}

testChat();
