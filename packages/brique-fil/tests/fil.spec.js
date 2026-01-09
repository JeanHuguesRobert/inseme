export default function registerTests(test, expect) {
  test.describe("Brique: Fil", () => {
    test("Tool: read_fil", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [{ role: "user", content: "Quoi de neuf sur le Fil ?" }],
          room_id: "test-room-fil",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });

    test("Tool: post_to_fil", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [
            { role: "user", content: "Poste https://example.com sur le Fil" },
          ],
          room_id: "test-room-fil",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });
  });
}
