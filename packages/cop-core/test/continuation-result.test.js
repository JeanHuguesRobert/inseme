import { describe, expect, it } from "vitest";
import {
  CONTINUATION_RESULT_ADMISSION,
  CONTINUATION_RESULT_PROFILE,
  observeContinuationResult,
  projectContinuationForExternalHandler,
  recognizeMappedContinuationResults,
} from "../src/continuation-result.js";
import { evaluateGithubIngress, mapDeliveryToCopEvent } from "../src/github-ingress.js";

const CHALLENGE = "chal-unpredictable-113";
const ANSWER = "The recognizer proposes events and does not resolve.";

function continuation(overrides = {}) {
  return {
    continuation_id: "ctn_demo",
    requiredCapabilities: ["cognitive.judgment"],
    state: {
      question: "May an external comment progress a suspended continuation?",
    },
    expected_result: { schema: "cogentia.step_result/v1" },
    correlation: { challenge: CHALLENGE },
    lifecycle: "suspended",
    expected_observation: {
      surface: "github",
      repository: "JeanHuguesRobert/inseme",
      resource: "issue:113",
      continuation_id: "ctn_demo",
    },
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    continuations: { ctn_demo: continuation() },
    ...overrides,
  };
}

function yamlResult(fields = {}) {
  const body = {
    protocol: "cogentia.step_result/v1",
    continuation_id: "ctn_demo",
    challenge: CHALLENGE,
    status: "answered",
    cognitive_producer: "ChatGPT",
    ...fields,
  };
  const lines = ["```yaml"];
  for (const [key, value] of Object.entries(body)) {
    if (key === "result") continue;
    lines.push(`${key}: ${value}`);
  }
  const answer = Object.prototype.hasOwnProperty.call(fields, "answer") ? fields.answer : ANSWER;
  if (answer !== undefined) {
    lines.push("result:");
    lines.push(`  answer: ${answer}`);
  }
  lines.push("```");
  return lines.join("\n");
}

function commentEvent({ body, commentId = 1001, deliveryId = "deliv-1", action = "created" } = {}) {
  return {
    topic_id: "github:JeanHuguesRobert/inseme",
    event_type: "cop.event/v1",
    actor_id: "github:octocat",
    origin_ref: `github:delivery:${deliveryId}`,
    idempotency_key: `github:${deliveryId}:issue_comment`,
    visibility: "restricted",
    epistemic_status: "observed",
    payload: {
      github_event: "issue_comment",
      action,
      repository: "JeanHuguesRobert/inseme",
      summary: `Comment on issue #113 ${action} by octocat`,
      details: {
        issue_number: 113,
        comment_id: commentId,
        comment_body: body,
        correlation: "issue:JeanHuguesRobert/inseme#113",
      },
      attribution: { github_login: "octocat", legal_actor_resolved: false },
    },
    meta: { delivery_id: deliveryId },
  };
}

function phasesOf(report) {
  return report.proposed_events.map((event) => event.payload.phase);
}

describe("continuation result recognizer", () => {
  it("records no new core entity", () => {
    expect(CONTINUATION_RESULT_ADMISSION.new_core_entity).toBe(false);
    expect(CONTINUATION_RESULT_ADMISSION.not_emitted).toContain("cop.continuation.resume");
  });

  it("ignores an unrelated GitHub comment", () => {
    const report = observeContinuationResult(
      commentEvent({ body: "Looks good to me." }),
      context()
    );
    expect(report.matched).toBe(false);
    expect(report.proposed_events).toEqual([]);
    expect(report.progresses).toBe(false);
  });

  it("turns a matching continuation id and challenge into a returned result", () => {
    const event = commentEvent({ body: yamlResult() });
    const report = observeContinuationResult(event, context());
    expect(report.matched).toBe(true);
    expect(report.progresses).toBe(true);
    expect(report.progression).toBe("returned");
    expect(report.correlation).toEqual({
      valid: true,
      basis: ["continuation_loaded", "challenge_match"],
    });
    expect(phasesOf(report)).toEqual(["observed", "correlated", "accepted", "returned"]);
    expect(report.candidate_result.result.answer).toBe(ANSWER);
    expect(report.candidate_result.challenge).toBeUndefined();
    expect(report.provenance).toMatchObject({
      delivery_verified: true,
      surface: "github",
      surface_actor: "github:octocat",
      correlation_verified: true,
      cognitive_producer_claimed: "ChatGPT",
      cognitive_producer_verified: false,
    });
    const returned = report.proposed_events.at(-1);
    expect(returned.event_type).toBe("cop.event/v1");
    expect(returned.payload.profile).toBe(CONTINUATION_RESULT_PROFILE);
    expect(returned.payload.candidate_result.result.answer).toBe(ANSWER);
    expect(returned.meta.admits_new_core_entity).toBe(false);
    expect(JSON.stringify(report.proposed_events)).not.toContain(CHALLENGE);
    expect(report.proposed_events.map((item) => item.idempotency_key)).toEqual([
      `continuation-result:${report.observation_key}:observed`,
      `continuation-result:${report.observation_key}:correlated`,
      `continuation-result:${report.observation_key}:accepted`,
      `continuation-result:${report.observation_key}:returned`,
    ]);
  });

  it("accepts the hyphenated protocol alias used in the issue illustration", () => {
    const report = observeContinuationResult(
      commentEvent({ body: yamlResult({ protocol: "cogentia.step-result/v1" }) }),
      context()
    );
    expect(report.progresses).toBe(true);
    expect(report.validation.schema_valid).toBe(true);
  });

  it("rejects a wrong challenge without accepting the result", () => {
    const report = observeContinuationResult(
      commentEvent({ body: yamlResult({ challenge: "other-token" }) }),
      context()
    );
    expect(report.matched).toBe(true);
    expect(report.progresses).toBe(false);
    expect(report.correlation.valid).toBe(false);
    expect(report.validation.schema_valid).toBe(true);
    expect(phasesOf(report)).toEqual(["observed", "rejected"]);
    expect(report.proposed_events.at(-1).payload.reason).toBe("challenge_mismatch");
  });

  it("rejects a malformed step result after a valid correlation", () => {
    const report = observeContinuationResult(
      commentEvent({
        body: [
          "```yaml",
          "protocol: cogentia.step_result/v1",
          `continuation_id: ctn_demo`,
          `challenge: ${CHALLENGE}`,
          "status: answered",
          "::: not yaml",
          "```",
        ].join("\n"),
      }),
      context()
    );
    expect(report.correlation.valid).toBe(true);
    expect(report.validation.schema_valid).toBe(false);
    expect(report.validation.errors).toContain("missing_answer");
    expect(phasesOf(report)).toEqual(["observed", "correlated", "rejected"]);
    expect(report.proposed_events.at(-1).payload.reason).toBe("schema_invalid");
  });

  it("rejects an unknown continuation id", () => {
    const report = observeContinuationResult(
      commentEvent({ body: yamlResult({ continuation_id: "ctn_missing" }) }),
      context()
    );
    expect(report.continuation_id).toBe("ctn_missing");
    expect(report.correlation.basis).toContain("continuation_absent");
    expect(report.proposed_events.at(-1).payload.reason).toBe("unknown_continuation");
    expect(report.progresses).toBe(false);
  });

  it("is idempotent for a duplicate observation", () => {
    const event = commentEvent({ body: yamlResult() });
    const first = observeContinuationResult(event, context());
    const second = observeContinuationResult(event, {
      ...context(),
      seen_observation_keys: [first.observation_key],
    });
    expect(second.idempotent).toBe(true);
    expect(second.progresses).toBe(false);
    expect(second.progression).toBe("already_recorded");
    expect(second.proposed_events).toEqual([]);
  });

  it("does not progress twice when the same event is replayed in one batch", () => {
    const event = commentEvent({ body: yamlResult() });
    const batch = recognizeMappedContinuationResults([event, event], context());
    expect(batch.reports[1].idempotent).toBe(true);
    expect(
      batch.proposed_events.filter((event) => event.payload.phase === "returned")
    ).toHaveLength(1);
  });

  it("rejects a second distinct comment after the continuation has returned", () => {
    const first = commentEvent({ body: yamlResult(), commentId: 1, deliveryId: "a" });
    const second = commentEvent({
      body: yamlResult({ answer: "a different answer" }),
      commentId: 2,
      deliveryId: "b",
    });
    const batch = recognizeMappedContinuationResults([first, second], context());
    expect(batch.reports[0].progresses).toBe(true);
    expect(batch.reports[1].idempotent).toBe(false);
    expect(batch.reports[1].proposed_events.at(-1).payload.reason).toBe("late_result");
    expect(
      batch.proposed_events.filter((event) => event.payload.phase === "returned")
    ).toHaveLength(1);
  });

  it("rejects a late result after resolution", () => {
    const report = observeContinuationResult(commentEvent({ body: yamlResult() }), {
      continuations: { ctn_demo: continuation({ lifecycle: "resolved" }) },
    });
    expect(report.proposed_events.at(-1).payload.reason).toBe("late_result");
    expect(phasesOf(report)).toEqual(["observed", "correlated", "rejected"]);
  });

  it("rejects a schema-valid result when verified producer provenance is required", () => {
    const report = observeContinuationResult(commentEvent({ body: yamlResult() }), {
      ...context(),
      policy: { require_verified_cognitive_producer: true },
    });
    expect(report.validation.schema_valid).toBe(true);
    expect(report.provenance.cognitive_producer_verified).toBe(false);
    expect(report.proposed_events.at(-1).payload.reason).toBe("insufficient_provenance");
    expect(report.progresses).toBe(false);
  });

  it("still accepts a later comment when an earlier distinct comment was only rejected", () => {
    const bad = commentEvent({
      body: yamlResult({ challenge: "wrong" }),
      commentId: 1,
      deliveryId: "a",
    });
    const good = commentEvent({ body: yamlResult(), commentId: 2, deliveryId: "b" });
    const batch = recognizeMappedContinuationResults([bad, good], context());
    expect(batch.reports[0].progression).toBe("rejected");
    expect(batch.reports[1].progresses).toBe(true);
  });

  it("recognizes a structured result on a non-GitHub surface", () => {
    const report = observeContinuationResult(
      {
        event_type: "cop.event/v1",
        actor_id: "email:person@example.test",
        origin_ref: "email:msg-1",
        idempotency_key: "email:msg-1",
        topic_id: "email:inbox",
        payload: {
          surface: "email",
          observation_id: "msg-1",
          candidate_result: {
            protocol: "cogentia.step_result/v1",
            continuation_id: "ctn_demo",
            challenge: CHALLENGE,
            status: "answered",
            result: { answer: ANSWER },
          },
        },
      },
      context()
    );
    expect(report.progresses).toBe(true);
    expect(report.observation_key).toBe("observation:msg-1");
    expect(report.provenance.surface).toBe("email");
    expect(report.provenance.cognitive_producer_verified).toBe(false);
  });

  it("does not treat its own proposed events as a new result", () => {
    const first = observeContinuationResult(commentEvent({ body: yamlResult() }), context());
    const echo = observeContinuationResult(first.proposed_events.at(-1), context());
    expect(echo.matched).toBe(false);
  });

  it("does not mutate the event or the continuation", () => {
    const event = commentEvent({ body: yamlResult() });
    const record = continuation();
    Object.freeze(event);
    Object.freeze(event.payload);
    Object.freeze(event.payload.details);
    Object.freeze(record);
    expect(() =>
      observeContinuationResult(event, { continuations: { ctn_demo: record } })
    ).not.toThrow();
    expect(record.lifecycle).toBe("suspended");
  });

  it("projects a portable prompt that names the GitHub return path", () => {
    const projection = projectContinuationForExternalHandler(continuation());
    expect(projection.media_type).toBe("text/markdown");
    expect(projection.body).toContain("May an external comment progress a suspended continuation?");
    expect(projection.body).toContain("No Cogentia MCP server");
    expect(projection.body).toContain("GitHub issue comment on JeanHuguesRobert/inseme #113");
    expect(projection.body).toContain(CHALLENGE);
    expect(projection.body).toContain("does not grant authority");
    expect(projection.body).toContain("cognitive.judgment");
  });
});

describe("GitHub normalized path", () => {
  function delivery(deliveryId, commentId, body, action = "created") {
    return {
      delivery: {
        delivery_id: deliveryId,
        event_name: "issue_comment",
        action,
        repository_name: "JeanHuguesRobert/inseme",
        installation_id: 1,
        sender_login: "octocat",
        payload_sha256: "abc",
      },
      payload: {
        action,
        repository: { full_name: "JeanHuguesRobert/inseme" },
        sender: { login: "octocat" },
        issue: { number: 113 },
        comment: {
          id: commentId,
          node_id: `IC_${commentId}`,
          html_url: `https://github.com/JeanHuguesRobert/inseme/issues/113#issuecomment-${commentId}`,
          body,
          updated_at: "2026-09-27T18:40:00Z",
        },
      },
    };
  }

  it("correlates one issue comment through ingress and ignores the reconciliation rediscovery", () => {
    const body = yamlResult();
    const webhook = delivery("deliv-webhook", 555, body);
    const replay = delivery("deliv-webhook", 555, body);
    const reconciled = delivery("deliv-reconcile", 555, body);
    const webhookEvent = mapDeliveryToCopEvent(webhook.delivery, webhook.payload);
    const replayEvent = mapDeliveryToCopEvent(replay.delivery, replay.payload);
    const reconciledEvent = mapDeliveryToCopEvent(reconciled.delivery, reconciled.payload);

    expect(webhookEvent.payload.details.comment_id).toBe(555);
    expect(webhookEvent.payload.details.comment_body).toContain("cogentia.step_result/v1");
    expect(webhookEvent.idempotency_key).not.toBe(reconciledEvent.idempotency_key);

    const batch = recognizeMappedContinuationResults(
      [webhookEvent, replayEvent, reconciledEvent],
      context()
    );
    expect(batch.reports[0].progresses).toBe(true);
    expect(batch.reports[0].observation_key).toBe(batch.reports[2].observation_key);
    expect(batch.reports[1].idempotent).toBe(true);
    expect(batch.reports[2].idempotent).toBe(true);
    expect(
      batch.proposed_events.filter((event) => event.payload.phase === "returned")
    ).toHaveLength(1);
    expect(
      batch.proposed_events.some((event) => event.event_type === "cop.continuation.resume")
    ).toBe(false);
  });

  it("ignores a deleted comment and a comment with no continuation context on the ingress decision", () => {
    const deleted = delivery("deliv-deleted", 556, yamlResult(), "deleted");
    const deletedEvent = mapDeliveryToCopEvent(deleted.delivery, deleted.payload);
    expect(observeContinuationResult(deletedEvent, context()).matched).toBe(false);

    const created = delivery("deliv-live", 557, yamlResult());
    const rawBody = JSON.stringify(created.payload);
    const headers = {
      "x-github-delivery": "deliv-live",
      "x-github-event": "issue_comment",
    };
    const plain = evaluateGithubIngress({
      headers,
      payload: created.payload,
      rawBody,
      allowlist: ["JeanHuguesRobert/inseme"],
    });
    expect(plain.ok).toBe(true);
    expect(plain.continuation_recognition).toBeUndefined();
    expect(plain.events[0].payload.details.comment_body).toContain(ANSWER);

    const wired = evaluateGithubIngress({
      headers,
      payload: created.payload,
      rawBody,
      allowlist: ["JeanHuguesRobert/inseme"],
      options: { continuationContext: context() },
    });
    expect(wired.continuation_recognition.reports[0].progresses).toBe(true);
    expect(wired.continuation_recognition.proposed_events.at(-1).payload.phase).toBe("returned");
    expect(wired.persist).toBe(true);
    expect(wired.events).toHaveLength(1);
  });
});
