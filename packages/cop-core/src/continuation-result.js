/**
 * Continuation result recognition (Inseme #113).
 *
 * Pure profile function. It consumes an already-normalized COP event and
 * proposes lifecycle events. It does not persist, resolve, or assimilate.
 *
 * Entity admission test: no new core noun. A candidate result is payload on
 * cop.event/v1 under profile `cop.continuation-result/v1`. Continuation stays
 * an artifact. GitHub, email, and other surfaces stay adapters that normalize
 * into COP events before this function runs.
 *
 * Existing kernel signals `cop.continuation.resume`, `resolved`, and
 * `assimilated` are intentionally not emitted. `returned` here means a
 * correlated result came back. It does not invoke a handler.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const CONTINUATION_RESULT_PROFILE = "cop.continuation-result/v1";
export const STEP_RESULT_PROTOCOL = "cogentia.step_result/v1";

/** Issue #113's illustration used a hyphen. The corpus id remains underscore. */
const STEP_RESULT_ALIASES = new Set([STEP_RESULT_PROTOCOL, "cogentia.step-result/v1"]);

const RESULT_STATUSES = new Set(["answered", "declined", "failed", "needs_input"]);
const TERMINAL_LIFECYCLE = new Set(["returned", "resolved", "assimilated"]);
const MAX_TEXT_CHARS = 65536;

export const CONTINUATION_RESULT_ADMISSION = Object.freeze({
  new_core_entity: false,
  profile: CONTINUATION_RESULT_PROFILE,
  reused: Object.freeze(["cop.event/v1", "cop/continuation artifact", "normalized adapter event"]),
  not_emitted: Object.freeze(["cop.continuation.resume", "resolved", "assimilated"]),
  residue: Object.freeze([
    "A later edit of the same external comment does not revise an already recorded observation.",
    "cognitive_producer_verified is never inferred from the surface actor or from the result's own claim.",
    "The challenge correlates a packet. It is omitted from proposed events and grants no authority.",
    "YAML block scalars are not parsed. Use a single-line answer or a JSON fence.",
    "Live webhook configuration and a conversational-agent round trip are outside this slice.",
  ]),
});

const NO_MATCH = Object.freeze({
  matched: false,
  idempotent: false,
  progresses: false,
  progression: "none",
  continuation_id: null,
  observation_key: null,
  correlation: Object.freeze({ valid: false, basis: Object.freeze([]) }),
  candidate_result: null,
  provenance: null,
  validation: Object.freeze({
    valid: false,
    schema_valid: false,
    provenance_sufficient: false,
    errors: Object.freeze([]),
  }),
  proposed_events: Object.freeze([]),
});

/**
 * @param {object} event normalized COP event
 * @param {object} [context]
 * @param {Record<string, object>|Map<string, object>} [context.continuations]
 * @param {string[]|Set<string>} [context.seen_observation_keys]
 * @param {string[]|Set<string>} [context.progressed_continuation_ids]
 * @param {{ require_verified_cognitive_producer?: boolean }} [context.policy]
 */
export function observeContinuationResult(event, context = {}) {
  if (event?.payload?.profile === CONTINUATION_RESULT_PROFILE) return NO_MATCH;

  const candidate = extractCandidate(event);
  if (!candidate) return NO_MATCH;

  const observationKey = observationKeyFor(event, candidate);
  const continuationId = stringOrNull(candidate.continuation_id);
  const record = loadContinuation(context, continuationId);
  const continuation =
    record && (record.continuation_id == null || record.continuation_id === continuationId)
      ? record
      : null;

  const correlation = correlate(continuation, candidate);
  const schema = validateStepResult(candidate, continuation?.expected_result?.schema);
  const provenance = qualifyProvenance(event, candidate, correlation.valid);
  const requireVerified = context.policy?.require_verified_cognitive_producer === true;
  const provenanceSufficient = !requireVerified || provenance.cognitive_producer_verified === true;
  const late = isLate(continuation, continuationId, context);

  const decision = decide({
    continuation,
    correlation,
    schema,
    provenanceSufficient,
    late,
  });

  const proposed = decision.phases.map((phase, index) =>
    phaseEvent({
      source: event,
      continuationId,
      observationKey,
      phase,
      reason: phase === "rejected" ? decision.reason : null,
      correlationValid: correlation.valid,
      schemaValid: schema.schema_valid,
      provenance,
      candidate,
      previousKey:
        index === 0 ? null : `continuation-result:${observationKey}:${decision.phases[index - 1]}`,
    })
  );

  const report = {
    matched: true,
    idempotent: false,
    progresses: decision.progresses,
    progression: decision.progression,
    continuation_id: continuationId,
    observation_key: observationKey,
    correlation,
    candidate_result: stripChallenge(candidate),
    provenance,
    validation: {
      valid: decision.progresses,
      schema_valid: schema.schema_valid,
      provenance_sufficient: provenanceSufficient,
      errors: schema.errors,
    },
    proposed_events: proposed,
    profile: CONTINUATION_RESULT_PROFILE,
  };

  if (toSet(context.seen_observation_keys).has(observationKey)) {
    return {
      ...report,
      idempotent: true,
      progresses: false,
      progression: "already_recorded",
      proposed_events: [],
    };
  }

  return report;
}

/**
 * Fold a batch of normalized events. Earlier events in the batch count as
 * already seen, so a webhook event and a later reconciliation of the same
 * comment cannot both progress the continuation.
 *
 * @param {object[]} events
 * @param {object} [context]
 */
export function recognizeMappedContinuationResults(events, context = {}) {
  const seen = toSet(context.seen_observation_keys);
  const progressed = toSet(context.progressed_continuation_ids);
  const reports = [];
  const proposed = [];

  for (const event of events || []) {
    const report = observeContinuationResult(event, {
      ...context,
      seen_observation_keys: [...seen],
      progressed_continuation_ids: [...progressed],
    });
    reports.push(report);
    if (report.matched && report.observation_key && !report.idempotent) {
      seen.add(report.observation_key);
    }
    if (report.progresses && report.continuation_id) {
      progressed.add(report.continuation_id);
    }
    for (const item of report.proposed_events || []) proposed.push(item);
  }

  return {
    reports,
    proposed_events: proposed,
    seen_observation_keys: [...seen],
    progressed_continuation_ids: [...progressed],
  };
}

/**
 * Human-readable projection an ordinary conversational agent can answer
 * without a Cogentia MCP, ACP, or A2A endpoint.
 *
 * @param {object} continuation
 * @param {{ return_paths?: object[] }} [options]
 */
export function projectContinuationForExternalHandler(continuation, options = {}) {
  const continuationId = stringOrNull(continuation?.continuation_id);
  const challenge = stringOrNull(continuation?.correlation?.challenge);
  if (!continuationId) throw new Error("continuation_id is required");
  if (!challenge) throw new Error("correlation.challenge is required");

  const schema = continuation?.expected_result?.schema || STEP_RESULT_PROTOCOL;
  const question = textOf(continuation?.state?.question ?? continuation?.question);
  const constraints = continuation?.state?.constraints ?? continuation?.constraints ?? null;
  const capabilities = Array.isArray(continuation?.requiredCapabilities)
    ? continuation.requiredCapabilities.map(String)
    : [];
  const returnPaths = listReturnPaths(continuation, options);

  const lines = [
    `# Continuation ${continuationId}`,
    "",
    "This is a portable projection of a suspended COP continuation.",
    "An ordinary conversational agent can answer it. No Cogentia MCP server, ACP endpoint, or A2A endpoint is required.",
    "",
    "## Requested work",
    "",
    question || "(no question text)",
    "",
  ];

  if (capabilities.length) {
    lines.push("## Required capabilities", "", ...capabilities.map((item) => `- ${item}`), "");
  }
  if (constraints) {
    lines.push("## Constraints", "", textOf(constraints) || String(constraints), "");
  }

  lines.push("## Return paths", "");
  if (returnPaths.length === 0) {
    lines.push("- No return path was declared on this projection.", "");
  } else {
    for (const path of returnPaths) lines.push(`- ${formatReturnPath(path)}`);
    lines.push("");
  }

  lines.push(
    "Post one fenced block on a declared return path. The challenge correlates this packet with the continuation. It does not grant authority for any other COP act.",
    "",
    "```yaml",
    `protocol: ${schema}`,
    `continuation_id: ${continuationId}`,
    `challenge: ${challenge}`,
    "status: answered",
    "result:",
    "  answer:",
    "```",
    ""
  );

  return {
    media_type: "text/markdown",
    continuation_id: continuationId,
    schema,
    return_paths: returnPaths,
    body: lines.join("\n"),
  };
}

function decide({ continuation, correlation, schema, provenanceSufficient, late }) {
  if (!continuation) {
    return {
      phases: ["observed", "rejected"],
      reason: "unknown_continuation",
      progression: "rejected",
      progresses: false,
    };
  }
  if (!correlation.valid) {
    return {
      phases: ["observed", "rejected"],
      reason: "challenge_mismatch",
      progression: "rejected",
      progresses: false,
    };
  }
  if (late) {
    return {
      phases: ["observed", "correlated", "rejected"],
      reason: "late_result",
      progression: "rejected",
      progresses: false,
    };
  }
  if (!schema.schema_valid) {
    return {
      phases: ["observed", "correlated", "rejected"],
      reason: "schema_invalid",
      progression: "rejected",
      progresses: false,
    };
  }
  if (!provenanceSufficient) {
    return {
      phases: ["observed", "correlated", "rejected"],
      reason: "insufficient_provenance",
      progression: "rejected",
      progresses: false,
    };
  }
  return {
    phases: ["observed", "correlated", "accepted", "returned"],
    reason: null,
    progression: "returned",
    progresses: true,
  };
}

function correlate(continuation, candidate) {
  if (!continuation) {
    return { valid: false, basis: ["continuation_absent"] };
  }
  const expected = continuation.correlation?.challenge;
  if (typeof expected !== "string" || expected.length === 0) {
    return { valid: false, basis: ["continuation_loaded", "expected_challenge_absent"] };
  }
  if (!challengesMatch(expected, candidate.challenge)) {
    return { valid: false, basis: ["continuation_loaded", "challenge_mismatch"] };
  }
  return { valid: true, basis: ["continuation_loaded", "challenge_match"] };
}

function validateStepResult(candidate, expectedSchema) {
  const errors = [];
  if (candidate.malformed) errors.push("malformed_step_result");
  const protocol = stringOrNull(candidate.protocol);
  if (!protocol || !STEP_RESULT_ALIASES.has(protocol)) errors.push("unknown_protocol");
  if (expectedSchema && !sameStepResultSchema(protocol, expectedSchema)) {
    errors.push("unexpected_schema");
  }
  if (!stringOrNull(candidate.continuation_id)) errors.push("missing_continuation_id");
  if (!stringOrNull(candidate.challenge)) errors.push("missing_challenge");
  if (!RESULT_STATUSES.has(candidate.status)) errors.push("invalid_status");
  if (candidate.status === "answered") {
    const answer = candidate.result?.answer;
    if (typeof answer !== "string" || answer.trim().length === 0) errors.push("missing_answer");
  }
  return { schema_valid: errors.length === 0, errors };
}

function sameStepResultSchema(left, right) {
  const canonicalLeft = STEP_RESULT_ALIASES.has(left) ? STEP_RESULT_PROTOCOL : left;
  const canonicalRight = STEP_RESULT_ALIASES.has(right) ? STEP_RESULT_PROTOCOL : right;
  return Boolean(canonicalLeft) && canonicalLeft === canonicalRight;
}

function isLate(continuation, continuationId, context) {
  if (!continuation) return false;
  const lifecycle = String(continuation.lifecycle || continuation.status || "suspended");
  if (TERMINAL_LIFECYCLE.has(lifecycle)) return true;
  return toSet(context.progressed_continuation_ids).has(continuationId);
}

function qualifyProvenance(event, candidate, correlationValid) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const surface = payload.surface || (payload.github_event ? "github" : "unspecified");
  return {
    delivery_verified: Boolean(event?.origin_ref || event?.meta?.delivery_id),
    surface,
    surface_actor: event?.actor_id || event?.actor_ref || null,
    correlation_verified: correlationValid === true,
    cognitive_producer_claimed: stringOrNull(candidate.cognitive_producer ?? candidate.producer),
    cognitive_producer_verified: false,
  };
}

function phaseEvent({
  source,
  continuationId,
  observationKey,
  phase,
  reason,
  correlationValid,
  schemaValid,
  provenance,
  candidate,
  previousKey,
}) {
  const causal = [];
  if (source?.idempotency_key) causal.push(source.idempotency_key);
  else if (source?.origin_ref) causal.push(source.origin_ref);
  if (previousKey) causal.push(previousKey);

  const terminal = phase === "returned" || phase === "rejected";
  return {
    event_type: "cop.event/v1",
    topic_id: source?.topic_id || `continuation:${continuationId || "unknown"}`,
    actor_id: "cop:continuation-result-recognizer",
    subject_ref: `continuation:${continuationId || "unknown"}`,
    epistemic_status: epistemicFor(phase),
    origin_ref: source?.origin_ref || null,
    causal_refs: causal,
    visibility: source?.visibility || "restricted",
    payload: {
      profile: CONTINUATION_RESULT_PROFILE,
      phase,
      continuation_id: continuationId,
      observation_key: observationKey,
      reason,
      correlation_valid: correlationValid,
      schema_valid: schemaValid,
      provenance,
      candidate_result: terminal ? stripChallenge(candidate) : null,
    },
    idempotency_key: `continuation-result:${observationKey}:${phase}`,
    meta: {
      profile: CONTINUATION_RESULT_PROFILE,
      admits_new_core_entity: false,
    },
  };
}

function epistemicFor(phase) {
  if (phase === "accepted" || phase === "returned") return "decided";
  if (phase === "observed") return "observed";
  return "computed";
}

function extractCandidate(event) {
  const payload = event?.payload;
  if (!payload || typeof payload !== "object") return null;
  if (payload.profile === CONTINUATION_RESULT_PROFILE) return null;
  if (payload.retracted === true || payload.action === "deleted") return null;

  const details = payload.details && typeof payload.details === "object" ? payload.details : {};
  const structured =
    asCandidateObject(payload.candidate_result) || asCandidateObject(details.candidate_result);
  if (structured) return structured;

  const text = [payload.text, payload.body, details.comment_body, details.body, details.text]
    .filter((item) => typeof item === "string" && item.length > 0)
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);
  if (!text) return null;

  for (const block of candidateBlocks(text)) {
    const parsed = parseCandidateBlock(block);
    if (parsed) return parsed;
  }
  return null;
}

function asCandidateObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!STEP_RESULT_ALIASES.has(value.protocol)) return null;
  return { ...value, malformed: false };
}

function candidateBlocks(text) {
  const fenced = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = fence.exec(text))) fenced.push(match[2]);
  if (fenced.length) return fenced;

  const bare = [];
  const re = /(?:^|\n)(protocol:\s*cogentia\.step[-_]result\/v1[^\n]*(?:\n[^\n]+)*)/g;
  while ((match = re.exec(text))) bare.push(match[1]);
  return bare;
}

function parseCandidateBlock(block) {
  const trimmed = String(block || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const value = JSON.parse(trimmed);
      return (
        asCandidateObject(value) || (sniffsProtocol(trimmed) ? malformedCandidate(trimmed) : null)
      );
    } catch {
      return sniffsProtocol(trimmed) ? malformedCandidate(trimmed) : null;
    }
  }
  const yaml = parseMinimalYaml(trimmed);
  if (yaml && STEP_RESULT_ALIASES.has(yaml.protocol)) return { ...yaml, malformed: false };
  if (sniffsProtocol(trimmed)) return malformedCandidate(trimmed);
  return null;
}

function malformedCandidate(text) {
  const protocol = (String(text).match(/cogentia\.step[-_]result\/v1/) || [])[0] || null;
  const continuation_id = (String(text).match(/continuation_id:\s*(\S+)/) || [])[1] || null;
  const challenge = (String(text).match(/challenge:\s*["']?([^"'\s]+)/) || [])[1] || null;
  return {
    protocol,
    continuation_id,
    challenge,
    status: null,
    result: null,
    malformed: true,
  };
}

function parseMinimalYaml(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  let sawKey = false;
  for (const rawLine of String(text).split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const matched = rawLine.trim().match(/^([A-Za-z_][A-Za-z0-9_.-]*):\s*(.*)$/);
    if (!matched) {
      if (!sawKey) return null;
      break;
    }
    sawKey = true;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    const key = matched[1];
    const rest = matched[2].trim();
    if (rest === "" || rest === "|" || rest === ">") {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      parent[key] = unquote(rest);
    }
  }
  return sawKey ? root : null;
}

function unquote(value) {
  const text = String(value).trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function observationKeyFor(event, candidate) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const details = payload.details && typeof payload.details === "object" ? payload.details : {};
  const commentId = details.comment_id ?? details.comment_node_id ?? payload.comment_id ?? null;
  if (commentId != null && String(commentId).length > 0) {
    const surface = payload.surface || (payload.github_event ? "github" : "comment");
    const repo = details.repository || payload.repository || "";
    return `${surface}:${repo}:comment:${commentId}`;
  }
  const generic = details.observation_id || payload.observation_id;
  if (generic) return `observation:${generic}`;
  if (event?.idempotency_key) return `event:${event.idempotency_key}`;
  if (event?.origin_ref) return `origin:${event.origin_ref}`;
  const digest = createHash("sha256").update(stableCandidate(candidate)).digest("hex").slice(0, 16);
  return `candidate:${candidate.continuation_id || "unknown"}:${digest}`;
}

function stableCandidate(candidate) {
  return JSON.stringify({
    protocol: candidate.protocol || null,
    continuation_id: candidate.continuation_id || null,
    status: candidate.status || null,
    answer: candidate.result?.answer || null,
  });
}

function loadContinuation(context, continuationId) {
  if (!continuationId) return null;
  const table = context?.continuations;
  if (!table) return null;
  if (table instanceof Map) return table.get(continuationId) || null;
  if (typeof table === "object") return table[continuationId] || null;
  return null;
}

function listReturnPaths(continuation, options) {
  if (Array.isArray(options?.return_paths)) return options.return_paths;
  if (Array.isArray(continuation?.return_paths)) return continuation.return_paths;
  if (continuation?.expected_observation && typeof continuation.expected_observation === "object") {
    return [continuation.expected_observation];
  }
  return [];
}

function formatReturnPath(path) {
  if (!path || typeof path !== "object") return String(path || "unspecified return path");
  if (path.surface === "github") {
    const resource = String(path.resource || "");
    const issue = resource.startsWith("issue:") ? resource.slice("issue:".length) : resource;
    const where = [path.repository || "(repository)", issue ? `#${issue}` : ""]
      .filter(Boolean)
      .join(" ");
    return `GitHub issue comment on ${where}`;
  }
  return [path.surface || "surface", path.repository || "", path.resource || ""]
    .filter(Boolean)
    .join(" ");
}

function stripChallenge(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const copy = { ...candidate };
  delete copy.challenge;
  return copy;
}

function challengesMatch(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string") return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(actual, "utf8");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function toSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return new Set([...value].map(String));
  if (Array.isArray(value)) return new Set(value.map(String));
  return new Set();
}

function stringOrNull(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length ? text : null;
}

function textOf(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value))
    return value
      .map((item) => textOf(item))
      .filter(Boolean)
      .join("\n");
  return "";
}

function sniffsProtocol(text) {
  return /cogentia\.step[-_]result\/v1/.test(String(text));
}
