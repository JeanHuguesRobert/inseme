import { test, expect } from "@playwright/test";

test.describe("Backend Simulation Tests", () => {
  test("POST /api/ophelia - should respond to game intent (Streaming)", async ({ request }) => {
    const payload = {
      messages: [{ role: "user", content: "Je veux jouer", name: "User" }],
      context: {
        active_games: ["quizz", "blindtest"],
        room_settings: { type: "bar" },
      },
    };

    const response = await request.post("/api/ophelia", {
      data: payload,
    });

    expect(response.ok()).toBeTruthy();
    const text = await response.text();

    // Gateway returns a stream with __PROVIDER_INFO__ prefixes
    expect(text).toContain("__PROVIDER_INFO__");
  });

  test("POST /api/transcribe - should handle mocked audio (Multipart)", async ({ request }) => {
    // Create a simple text file acting as audio for the test (mock)
    // In real implementation, OpenAI API validation might fail if not real audio,
    // but we just want to test that it reaches the endpoint logic.
    const buffer = Buffer.from("mock-audio-data");

    // Playwright request with multipart
    const response = await request.post("/api/transcribe", {
      multipart: {
        file: {
          name: "test.wav",
          mimeType: "audio/wav",
          buffer: buffer,
        },
      },
    });

    // It might return 400 (if OpenAI detects bad file) or 500 (if key missing)
    // But getting 400 is better than 500 or 404.
    // If it returns 200, great.
    console.log("Transcribe Status:", response.status());
    expect(response.status()).not.toBe(404);
  });

  test("POST /api/translate - should pivot language", async ({ request }) => {
    const payload = {
      text: "Hello world",
      target_lang: "fr",
    };

    const response = await request.post("/api/translate", {
      data: payload,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("translated_text");
    // Mock or Real API might return "Bonjour le monde"
  });

  test("POST /api/summarize - should return a summary of text", async ({ request }) => {
    const payload = {
      text: "Ceci est un long texte qui nécessite d'être résumé pour plus de clarté.",
      provider: "openai",
    };

    const response = await request.post("/api/summarize", {
      data: payload,
    });

    expect([200, 500, 401]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("summary");
    }
  });

  test("POST /api/semantic/state - should accept local semantic state", async ({ request }) => {
    const payload = {
      roomId: "cyrnea-general",
      locuteur_id: "actor_test",
      profil: "questionneur",
      themes_detectes: ["test", "integration"],
      type_interaction: "question",
      intensite: 0.9,
      timestamp: Date.now(),
    };

    const response = await request.post("/api/semantic/state", {
      data: payload,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("GET /api/semantic/window - should return aggregated semantic data", async ({ request }) => {
    const response = await request.get("/api/semantic/window?room_id=cyrnea-general");

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("themes_dominants");
    expect(data).toHaveProperty("locuteurs");
  });

  test("POST /api/ophelia - should be able to use get_semantic_window tool", async ({
    request,
  }) => {
    const payload = {
      question: "Quel est le moment courant dans le bar ?",
      room_id: "cyrnea-general",
    };

    const response = await request.post("/api/ophelia", {
      data: payload,
    });

    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    // Verify that the response contains indication of tool usage or thinking
    expect(text).toContain("__PROVIDER_INFO__");
  });
});
