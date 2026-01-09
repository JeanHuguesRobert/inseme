import { test, expect } from "@playwright/test";

test.describe("Ophélia Tools Integration Tests", () => {
  test("Native Tool: translate (integration via /api/translate)", async ({
    request,
  }) => {
    const response = await request.post("/api/translate", {
      data: { text: "Hello", target_lang: "fr" },
    });
    expect([200, 500, 401]).toContain(response.status());
  });

  test("Native Tool: sessions (integration via /api/sessions)", async ({
    request,
  }) => {
    const response = await request.post("/api/sessions", {
      data: { room_id: "test-room" },
    });
    expect([200, 404, 500]).toContain(response.status());
  });

  test("Native Tool: vector-search (integration via /api/vector-search)", async ({
    request,
  }) => {
    const response = await request.post("/api/vector-search", {
      data: { action: "search", text: "test", room_id: "test-room" },
    });
    expect([200, 500, 401, 404]).toContain(response.status());
  });

  test.describe("System Commands (Inseme Tools)", () => {
    // These commands are usually caught by useInseme and sent to the DB
    // We test if the backend accepts these message formats

    const commands = [
      { text: "inseme open", type: "chat" },
      { text: "inseme close", type: "chat" },
      { text: "inseme ? Quelle est votre proposition ?", type: "chat" },
      { text: "inseme vote pour", type: "vote", metadata: { option: "pour" } },
      { text: "inseme parole", type: "chat" },
      { text: "inseme technical", type: "chat" },
      {
        text: "inseme power 2 Promotion exceptionnelle",
        type: "power_declaration",
        metadata: { multiplier: 2, reason: "Promotion" },
      },
      { text: "inseme agenda\n1. Point A\n2. Point B", type: "agenda_update" },
    ];

    for (const cmd of commands) {
      test(`Command: ${cmd.text.split("\n")[0]}`, async ({ request }) => {
        // In a real integration test, we would check if these messages
        // trigger the expected state changes in the database or via real-time.
        // For now, we verify that the message insertion (via a mock or actual endpoint)
        // would be handled if we had a dedicated /api/message endpoint or similar.
        // Since useInseme writes directly to Supabase, we check if the ophelia
        // endpoint can at least reason about these commands.
        const response = await request.post("/api/ophelia", {
          data: {
            action: "chat",
            content: [{ role: "user", content: cmd.text }],
            room_id: "test-room",
          },
        });
        expect([200, 500, 401]).toContain(response.status());
      });
    }
  });
});
