/**
 * Real reason-bearing handler-assist decider for the local JHN operational
 * runner (Inseme #96, production frontier of #93/#95).
 *
 * Deterministic and provider-neutral: it classifies the request and states
 * an actual textual reason for the classification. This is not the legacy
 * `/code|implement|fix|review/` availability heuristic relabeled — that
 * heuristic remains untouched in `jhnDelegatingAgent.js` as
 * `legacy_heuristic` with `rationale.summary = null`. This decider always
 * emits a non-null rationale, which is what makes it reason-bearing rather
 * than a renamed Boolean.
 */

const CODING_SIGNAL =
  /\b(code|implement|refactor|debug|patch|bug|pull request|\bpr\b|repository|repo|commit|test suite|function|module|script)\b/i;

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
  return {
    selected_path: "handler_assisted",
    capability_requirement: { capability: "coding.assist" },
    rationale: {
      summary:
        "The message describes coding or repository work that a bounded external coding capability is expected to perform better than John's local reasoner alone.",
    },
  };
}
