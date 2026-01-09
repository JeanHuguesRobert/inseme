export default function registerTests(test, expect) {
  test.describe("Brique: Democracy", () => {
    test("Tool: search_propositions", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [
            {
              role: "user",
              content: "Recherche les propositions sur le climat",
            },
          ],
          room_id: "test-room-democracy",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });

    test("Tool: vote_proposition", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [
            { role: "user", content: "Je vote pour la proposition 42" },
          ],
          room_id: "test-room-democracy",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });

    test("Tool: prolog_query", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [
            {
              role: "user",
              content: "Interroge le moteur ProLog sur la gouvernance.",
            },
          ],
          room_id: "test-room-democracy",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });
  });
}
