/**
 * Real reason-bearing handler-assist decider for the local JHN operational
 * runner (Inseme #96/#99, production frontier of #93/#95).
 *
 * Deterministic and provider-neutral: it classifies the request and states
 * an actual textual reason for the classification. This is not the legacy
 * `/code|implement|fix|review/` availability heuristic relabeled — that
 * heuristic remains untouched in `jhnDelegatingAgent.js` as
 * `legacy_heuristic` with `rationale.summary = null`. This decider always
 * emits a non-null rationale, which is what makes it reason-bearing rather
 * than a renamed Boolean.
 *
 * Capability vocabulary (Inseme #99): COP has no capability hierarchy.
 * Inspection/review of existing code may request the already-existing
 * `coding.assist.read`. Mutating work keeps the generic unresolved
 * `coding.assist` requirement. Do not invent `coding.assist.write` as an
 * available capability, and do not silently map mutation onto read.
 */

const CODING_SIGNAL =
  /\b(code|implement|refactor|debug|patch|bug|pull request|\bpr\b|repository|repo|commit|test suite|function|module|script)\b/i;

const MUTATING_SIGNAL =
  /\b(implement|patch|commit|refactor|edit|modif(?:y|ying|ication)|write|apply|land|merge|fix)\b/i;

const READ_ONLY_SIGNAL =
  /\b(review|inspect|analy[sz]e|explain|understand|read-only|readonly)\b|without\s+chang(?:ing|es)|without\s+modif(?:ying|ication)|do\s+not\s+(?:change|modify|edit)|don't\s+(?:change|modify|edit)|no\s+file\s+changes/i;

/**
 * @param {object} input
 * @param {string} input.message
 * @returns {object} a decision object suitable for `decideHandlerAssist`
 */
export function decideJhnHandlerAssist({ message } = {}) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!CODING_SIGNAL.test(text)) {
    return {
      selected_path: "local_only",
      capability_requirement: null,
      rationale: {
        summary:
          "The message does not describe bounded coding or repository work; John can answer from local conversation alone.",
      },
    };
  }
  if (MUTATING_SIGNAL.test(text)) {
    return {
      selected_path: "handler_assisted",
      capability_requirement: { capability: "coding.assist" },
      rationale: {
        summary:
          "The message describes coding or repository mutation that a bounded external coding capability is expected to perform better than John's local reasoner alone.",
      },
    };
  }
  if (READ_ONLY_SIGNAL.test(text)) {
    return {
      selected_path: "handler_assisted",
      capability_requirement: { capability: "coding.assist.read" },
      rationale: {
        summary:
          "The message asks for inspection or review of existing code without mutation, which matches the existing coding.assist.read capability vocabulary.",
      },
    };
  }
  return {
    selected_path: "handler_assisted",
    capability_requirement: { capability: "coding.assist" },
    rationale: {
      summary:
        "The message describes coding or repository work that a bounded external coding capability is expected to perform better than John's local reasoner alone.",
    },
  };
}
