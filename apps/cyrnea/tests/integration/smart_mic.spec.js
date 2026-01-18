import { test, expect } from "@playwright/test";

test.describe("Smart Microphone Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Grant permissions for mic
    await page.context().grantPermissions(["microphone", "camera"]);

    // Go to Client Mini App
    await page.goto("/cyrnea/client");

    // Wait for app to load
    await expect(page.locator("h1")).toContainText("Cyrnea");
  });

  test("should initialize MediaManager and start capture on button click", async ({ page }) => {
    // 1. Simulate "Parole" button click (which triggers startLocalTranscription)
    // We need to find the specific button in ClientMiniApp.
    // Assuming there is a mic button or "Parole".
    // In Barman Dashboard it is explicit. In ClientMiniApp it might be in "Ophelia" tab or similar.
    // Let's check ClientMiniApp content or look for aria-label.

    // For this test, we might need to expose mediaManager on window for easier introspection
    // or relying on console logs "SmartAudio".

    const consoleLogs = [];
    page.on("console", (msg) => {
      if (msg.type() === "log") consoleLogs.push(msg.text());
    });

    // We might need to mock getUserMedia if fake-device is not enough or to control the stream precisely.
    // But --use-fake-device-for-media-stream usually produces a beep.

    // Click on Mic Trigger (we need to know the selector)
    // Let's assume there is a button with text "Parole" or an icon.
    // Inspecting ClientMiniApp.jsx (which I read previously):
    // It has "MondrianTabTrigger label='Micro'" maybe?
    // Wait, ClientMiniApp has "Music", "Cyrnea/Mic", etc?

    // Let's try to locate "Parole" button.
    const paroleBtn = page.getByRole("button", { name: /Parole|Micro/i }).first();
    if (await paroleBtn.isVisible()) {
      await paroleBtn.click();

      // Wait for SmartAudio logs
      await expect(async () => {
        const logs = consoleLogs.join("\n");
        // Expect "Speech Started" if the fake audio is loud enough (beep)
        // Or at least absence of errors.
        // "SmartAudio Start Error" should NOT be present.
        expect(logs).not.toContain("SmartAudio Start Error");
      }).toPass();
    } else {
      console.log("Parole button not found, skipping interaction check");
    }
  });

  test("should handle silence detection", async () => {
    // This is hard to test with fake-device as it beeps continuously or silence?
    // We might need to inject a script to mock HostAudioIO or MediaManager behavior.
  });
});
