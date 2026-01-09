import { createPrologEngine } from "./index.js";
import { toPrologFacts } from "../../brique-kudocracy/src/governance.js";

async function test() {
  console.log("--- Test Inseme Prolog Engine ---");
  const engine = await createPrologEngine();
  const facts = toPrologFacts();

  console.log("Loading governance facts...");
  await engine.consult(facts);
  console.log("Facts loaded length:", facts.length);

  console.log("Querying: All models");
  await engine.query("governance_model(Id, Name, _).");

  engine.answers((answer) => {
    console.log("Model:", answer);
  });

  await new Promise((r) => setTimeout(r, 500));

  console.log("\nQuerying: Which roles can vote in 'association_loi_1901'?");
  await engine.query(
    "role('association_loi_1901', RoleId, _), property(RoleId, 'can_vote', true)."
  );

  engine.answers((answer) => {
    console.log("Result:", answer);
  });
}

test().catch(console.error);
