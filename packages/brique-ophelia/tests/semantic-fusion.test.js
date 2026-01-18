/**
 * packages/brique-ophelia/tests/semantic-fusion.test.js
 *
 * Integration test for the semantic fusion module.
 */

import { handleSemanticState, getSemanticWindow } from "../edge/semantic-fusion.js";

async function runTest() {
  console.log("--- Starting Semantic Fusion Test ---");

  const roomId = "test-bar";

  // Simulate actor A speaking
  await handleSemanticState({
    roomId,
    locuteur_id: "actor_A",
    profil: "questionneur",
    themes_detectes: ["bière", "ambiance"],
    type_interaction: "question",
    intensite: 0.8,
    timestamp: Date.now(),
  });

  // Simulate actor B speaking
  await handleSemanticState({
    roomId,
    locuteur_id: "actor_B",
    profil: "intervenant",
    themes_detectes: ["musique"],
    type_interaction: "declaration",
    intensite: 0.5,
    timestamp: Date.now() + 1000,
  });

  // Get window
  const window = await getSemanticWindow(roomId);
  console.log("Semantic Window Result:", JSON.stringify(window, null, 2));

  if (window.locuteurs.length === 2 && window.themes_dominants.includes("bière")) {
    console.log("✅ Test Passed: Multiple actors and themes correctly fused.");
  } else {
    console.log("❌ Test Failed.");
  }
}

runTest().catch(console.error);
