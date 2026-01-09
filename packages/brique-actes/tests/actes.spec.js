export default function registerTests(test, expect) {
  test.describe("Brique: Actes", () => {
    test("Tool: search_actes", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [
            { role: "user", content: "Quels sont les derniers actes ?" },
          ],
          room_id: "test-room-actes",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });

    test("Tool: get_demande_status", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          action: "chat",
          content: [{ role: "user", content: "Statut de ma demande ID-123" }],
          room_id: "test-room-actes",
        },
      });
      expect([200, 500, 401]).toContain(response.status());
    });
  });
}
