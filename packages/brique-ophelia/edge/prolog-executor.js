import { defineFunction } from "@inseme/cop-host/runtime/function.js";
import { createPrologEngine } from "@inseme/cop-prolog";

/**
 * Netlify Function: prolog-executor
 * --------------------------------
 * Receives Prolog facts and a query, executes them using Tau Prolog (Node.js),
 * and returns the results.
 */
export default defineFunction(async (request, context) => {
  const { debug } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const bodyText = await request.text();
    const { facts, query } = JSON.parse(bodyText);

    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    debug.log("Creating Prolog engine (Tau Prolog)");
    debug.startTimer("createPrologEngine");
    const engine = await createPrologEngine();
    debug.stopTimer("createPrologEngine");

    if (facts && facts.length > 0) {
      debug.log("Consulting facts", {
        count: Array.isArray(facts) ? facts.length : 1,
      });
      await engine.consult(facts);
    }

    debug.log("Executing query", { query });
    await engine.query(query);

    debug.startTimer("findAllAnswers");
    const answers = await engine.findAllAnswers();
    debug.stopTimer("findAllAnswers");

    return new Response(JSON.stringify({ answers }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    debug.error("Prolog Executor Error", error);
    console.error("Prolog Executor Error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
