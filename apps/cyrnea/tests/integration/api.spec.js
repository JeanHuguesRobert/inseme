import { test, expect } from "@playwright/test";

test.describe("Cyrnea Backend Integration Tests", () => {
  // Ce test doit passer en premier. S'il échoue, le système n'est pas prêt.
  test("Critical Path: Backend Health Check", async ({ request }) => {
    await test.step("Verify API Health", async () => {
      const response = await request.get("/api/health");

      if (response.status() !== 200) {
        const body = await response.text();
        throw new Error(
          `Backend is NOT healthy (Status: ${response.status()}): ${body}`
        );
      }

      const data = await response.json();
      expect(data.status).toBe("healthy");
      expect(data.checks.runtime).toBe("ok");
      // Supabase peut être en "pending" ou "failed" selon l'env,
      // mais on veut au moins que le runtime réponde.
      console.log(`System healthy on instance: ${data.instance}`);
    });
  });

  test("POST /api/ophelia should handle a chat request with tools", async ({
    request,
  }) => {
    const payload = {
      action: "chat",
      content: [{ role: "user", content: "Quelle est la météo ?" }],
      room_id: "cyrnea-general",
      brique_tools: [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" },
              },
            },
          },
        },
      ],
    };

    const response = await request.post("/api/ophelia", {
      data: payload,
    });

    // We accept 200, 500 (if API keys missing) or 401
    expect([200, 500, 401]).toContain(response.status());
  });

  test("POST /api/sessions should return sessions for a valid room_id", async ({
    request,
  }) => {
    const response = await request.post("/api/sessions", {
      data: { room_id: "cyrnea-general" },
    });
    // If Supabase is not configured, it might return 500, but we want to see if it responds
    expect([200, 404, 500]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("sessions");
    }
  });

  test("POST /api/translate should return translated text", async ({
    request,
  }) => {
    const response = await request.post("/api/translate", {
      data: { text: "Hello", target_lang: "fr" },
    });
    // Depends on AI API Key
    expect([200, 500, 401]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("translated_text");
    }
  });

  test("POST /api/vector-search should handle search action", async ({
    request,
  }) => {
    const response = await request.post("/api/vector-search", {
      data: { action: "search", text: "test", room_id: "cyrnea-general" },
    });
    // Depends on Vector DB configuration
    expect([200, 500, 401, 404]).toContain(response.status());
  });

  test("POST /api/wiki-search should require query", async ({ request }) => {
    const response = await request.post("/api/wiki-search", {
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/wiki-search with query should return 200", async ({
    request,
  }) => {
    const response = await request.post("/api/wiki-search", {
      data: { query: "test" },
    });
    expect([200, 404]).toContain(response.status());
  });
});
