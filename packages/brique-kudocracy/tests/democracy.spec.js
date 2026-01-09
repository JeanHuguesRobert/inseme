export default function registerTests(test, expect) {
  test.describe("Brique: Democracy", () => {
    async function getStreamContent(response) {
      const reader = response.body().then((b) => b.toString());
      return await reader;
    }

    test("Tool: search_propositions", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          messages: [
            { role: "user", content: "Cherche les propositions actives" },
          ],
          brique_tools: ["democracy"],
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await getStreamContent(response);

      // On cherche soit le debug des tool calls, soit la trace d'exécution
      expect(content).toMatch(/search_propositions/);
      expect(content).toMatch(/DEBUG ToolCalls/);
      expect(content).toMatch(/Exécution outil : search_propositions/);
    });

    test("Tool: vote_proposition", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          messages: [
            { role: "user", content: "Je vote pour la proposition prop-123" },
          ],
          brique_tools: ["democracy"],
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await getStreamContent(response);

      expect(content).toMatch(/vote_proposition/);
      expect(content).toMatch(/prop-123/);
      expect(content).toMatch(/Exécution outil : vote_proposition/);
    });

    test("Tool: manage_delegation", async ({ request }) => {
      const response = await request.post("/api/ophelia", {
        data: {
          messages: [
            {
              role: "user",
              content: "Je délègue mon vote à user-456 pour le tag #ecologie",
            },
          ],
          brique_tools: ["democracy"],
        },
      });
      expect(response.ok()).toBeTruthy();
      const content = await getStreamContent(response);

      expect(content).toMatch(/manage_delegation/);
      expect(content).toMatch(/user-456/);
      expect(content).toMatch(/ecologie/);
      expect(content).toMatch(/Exécution outil : manage_delegation/);
    });
  });
}
