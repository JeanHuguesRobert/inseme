import pl from "tau-prolog";
import { TauPrologAdapter } from "./TauPrologAdapter.js";

export * from "./index.core.js";

/**
 * Factory function to create a Prolog engine for Node.js.
 */
export async function createPrologEngine(options = {}) {
  return new TauPrologAdapter(pl);
}
