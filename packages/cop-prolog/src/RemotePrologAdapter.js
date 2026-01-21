import { PrologEngineAdapter } from "./PrologEngineAdapter.js";

export class RemotePrologAdapter extends PrologEngineAdapter {
  constructor(endpointUrl) {
    super();
    this.endpointUrl = endpointUrl || "/.netlify/functions/gen-ophelia-prolog-executor";
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

    const response = await fetch(this.endpointUrl, {
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
  }

  answers() {
    throw new Error(
      "Streaming answers() not supported in RemotePrologAdapter. Use findAllAnswers()."
    );
  }
}
