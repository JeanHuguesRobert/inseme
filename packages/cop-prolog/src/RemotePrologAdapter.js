import { PrologEngineAdapter } from "./PrologEngineAdapter.js";

/**
 * RemotePrologAdapter
 * -------------------
 * Delegates Prolog execution to a remote HTTP endpoint (Node.js function).
 * This is used in Edge Functions where Tau Prolog is not compatible.
 */
export class RemotePrologAdapter extends PrologEngineAdapter {
  constructor(endpointUrl = "/.netlify/functions/prolog-executor") {
    super();
    this.endpointUrl = endpointUrl;
    this.facts = [];
    this.goal = null;
  }

  async consult(facts) {
    if (Array.isArray(facts)) {
      this.facts.push(...facts);
    } else {
      this.facts.push(facts);
    }
  }

  async query(goal) {
    this.goal = goal;
  }

  async findAllAnswers() {
    if (!this.goal) {
      throw new Error("No query (goal) specified.");
    }

    try {
      // Netlify Edge Functions can use relative URLs for internal functions
      const response = await fetch(new URL(this.endpointUrl, "http://localhost:8888"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facts: this.facts,
          query: this.goal,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Remote Prolog error: ${errText}`);
      }

      const data = await response.json();
      return data.answers || [];
    } catch (e) {
      console.error("RemotePrologAdapter failed:", e);
      throw e;
    }
  }

  // Other methods would need implementation if used, but for now we focus on the main flow
  answers(callback) {
    throw new Error("Streaming answers() not supported in RemotePrologAdapter. Use findAllAnswers().");
  }
}
