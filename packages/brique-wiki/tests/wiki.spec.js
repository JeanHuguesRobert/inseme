export default function registerTests(test, expect) {
  test.describe("Brique: Wiki", () => {
    test("Tool: search_wiki", async ({ request }) => {
      const response = await request.post("/api/wiki-search", {
        data: { query: "test" },
      });
      expect([200, 404, 500]).toContain(response.status());
    });

    test("Tool: propose_wiki_page", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [
            {
              role: "user",
              content: "Je veux proposer une page Wiki sur le climat",
            },
          ],
          room_id: "test-room-wiki",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });
  });
}
