/**
 * GitHub Webhook Ingress & Normalizer for COP Append-Only Event Log (Issue #29)
 *
 * HMAC verification, delivery normalize, allowlist, event subscription set,
 * mapper → cop.event/v1, activity-kind classification hooks.
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { recognizeMappedContinuationResults } from "./continuation-result.js";

/** Explicit subscription set from Inseme #29. */
export const GITHUB_EVENT_SUBSCRIPTIONS = Object.freeze([
  "ping",
  "push",
  "create",
  "delete",
  "issues",
  "issue_comment",
  "discussion",
  "discussion_comment",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "check_run",
  "workflow_run",
  "release",
  "repository",
  "branch_protection_rule",
  "dependabot_alert",
  "code_scanning_alert",
  "secret_scanning_alert",
  "installation",
  "installation_repositories",
]);

/**
 * Activity feed categories for the mandant projection (#29).
 * observation | work_proposal | human_decision | publication | security | governance | system
 */
export const ACTIVITY_KINDS = Object.freeze([
  "observation",
  "work_proposal",
  "human_decision",
  "publication",
  "security",
  "governance",
  "system",
]);

export function verifyGithubHmacSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret || !rawBody) {
    return false;
  }

  const parts = signatureHeader.trim().split("=");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "sha256") {
    return false;
  }

  const expectedHash = parts[1];
  const hmac = createHmac("sha256", webhookSecret);
  hmac.update(rawBody);
  const calculatedHash = hmac.digest("hex");

  try {
    const expectedBuf = Buffer.from(expectedHash, "hex");
    const calculatedBuf = Buffer.from(calculatedHash, "hex");
    if (expectedBuf.length !== calculatedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, calculatedBuf);
  } catch {
    return false;
  }
}

export function normalizeGithubDelivery(headers, payload, rawBody) {
  const deliveryId = String(
    headers["x-github-delivery"] || headers["X-GitHub-Delivery"] || ""
  ).trim();
  const eventName = String(headers["x-github-event"] || headers["X-GitHub-Event"] || "").trim();
  const signature = String(
    headers["x-hub-signature-256"] || headers["X-Hub-Signature-256"] || ""
  ).trim();
  const action = payload?.action || null;
  const repositoryName = payload?.repository?.full_name || null;
  const installationId = payload?.installation?.id ? Number(payload.installation.id) : null;
  const senderLogin = payload?.sender?.login || null;

  const payloadSha256 = createHash("sha256")
    .update(
      typeof rawBody === "string" || Buffer.isBuffer(rawBody)
        ? rawBody
        : JSON.stringify(payload || {})
    )
    .digest("hex");

  return {
    delivery_id: deliveryId,
    event_name: eventName,
    action,
    repository_name: repositoryName,
    installation_id: installationId,
    sender_login: senderLogin,
    signature_sha256: signature,
    payload_sha256: payloadSha256,
    processing_state: "received",
    received_at: new Date().toISOString(),
  };
}

/**
 * @param {string} repositoryName
 * @param {string[]} allowlist empty = deny all when enforceStrict; empty = allow all when not strict
 * @param {{ strict?: boolean }} [opts] strict default true for production ingress
 */
export function isRepositoryAllowed(repositoryName, allowlist = [], opts = {}) {
  const strict = opts.strict !== false;
  if (!repositoryName) {
    // installation / ping may have no repository
    return !strict;
  }
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    // Empty allowlist: legacy open for unit tests; production should pass strict+list
    return opts.allowEmptyList !== false;
  }
  const repoLower = repositoryName.trim().toLowerCase();
  return allowlist.some((item) => String(item).trim().toLowerCase() === repoLower);
}

export function isEventSubscribed(eventName, subscriptions = GITHUB_EVENT_SUBSCRIPTIONS) {
  if (!eventName) return false;
  return subscriptions.includes(eventName);
}

/**
 * Classify for private activity feed (not legal identity).
 */
export function classifyActivityKind(eventName, action, epistemicStatus) {
  if (
    eventName === "dependabot_alert" ||
    eventName === "code_scanning_alert" ||
    eventName === "secret_scanning_alert"
  ) {
    return "security";
  }
  if (eventName === "installation" || eventName === "installation_repositories") {
    return "governance";
  }
  if (eventName === "ping") return "system";
  if (eventName === "release" || eventName === "workflow_run" || eventName === "check_run") {
    return "publication";
  }
  if (
    (eventName === "pull_request" && (action === "closed" || action === "merged")) ||
    epistemicStatus === "decided"
  ) {
    return "human_decision";
  }
  if (
    eventName === "pull_request" ||
    eventName === "issues" ||
    eventName === "pull_request_review" ||
    epistemicStatus === "proposed"
  ) {
    return "work_proposal";
  }
  return "observation";
}

/**
 * Map a GitHub delivery into one or more normalized partials for cop.event/v1.
 * Returns at least one event for unhandled types (never silent discard).
 */
export function mapDeliveryToCopEvents(delivery, payload, options = {}) {
  const instanceId = options.instanceId || "jhn-personal";
  const repoRoles = options.repoRoles || {};
  const topicId = `github:${delivery.repository_name || "global"}`;
  const actorId = delivery.sender_login ? `github:${delivery.sender_login}` : "github:anonymous";
  const repoRole =
    (delivery.repository_name && repoRoles[delivery.repository_name]) ||
    options.defaultRepoRole ||
    "observed";

  const subscribed = isEventSubscribed(delivery.event_name);
  let epistemicStatus = "observed";
  let summary = "";
  const details = {};
  let handled = true;

  switch (delivery.event_name) {
    case "ping": {
      summary = `GitHub App ping (zen) for installation/app`;
      details.zen = payload?.zen || null;
      details.hook_id = payload?.hook_id || null;
      break;
    }
    case "push": {
      const commitCount = Array.isArray(payload?.commits) ? payload.commits.length : 0;
      const ref = payload?.ref || "refs/heads/main";
      const branch = ref.replace("refs/heads/", "");
      summary = `Push of ${commitCount} commit(s) to ${branch} on ${delivery.repository_name} by ${delivery.sender_login}`;
      details.commit_count = commitCount;
      details.branch = branch;
      details.head_commit = payload?.head_commit?.id || null;
      break;
    }
    case "create":
    case "delete": {
      summary = `${delivery.event_name} ${payload?.ref_type || "ref"} ${payload?.ref || ""} on ${delivery.repository_name}`;
      details.ref = payload?.ref || null;
      details.ref_type = payload?.ref_type || null;
      break;
    }
    case "pull_request": {
      const prNumber = payload?.number;
      const prTitle = payload?.pull_request?.title || "";
      const prMerged = Boolean(payload?.pull_request?.merged);
      summary = `PR #${prNumber} "${prTitle}" ${delivery.action} on ${delivery.repository_name} by ${delivery.sender_login}`;
      details.pr_number = prNumber;
      details.title = prTitle;
      details.merged = prMerged;
      details.correlation = `pr:${delivery.repository_name}#${prNumber}`;
      epistemicStatus = prMerged
        ? "decided"
        : delivery.action === "opened"
          ? "proposed"
          : "observed";
      break;
    }
    case "pull_request_review":
    case "pull_request_review_comment": {
      const prNumber = payload?.pull_request?.number || payload?.number;
      summary = `PR review ${delivery.event_name} on #${prNumber} (${delivery.action}) by ${delivery.sender_login}`;
      details.pr_number = prNumber;
      details.correlation = `pr:${delivery.repository_name}#${prNumber}`;
      epistemicStatus = delivery.action === "submitted" ? "decided" : "observed";
      break;
    }
    case "issues": {
      const issueNumber = payload?.issue?.number;
      const issueTitle = payload?.issue?.title || "";
      summary = `Issue #${issueNumber} "${issueTitle}" ${delivery.action} on ${delivery.repository_name} by ${delivery.sender_login}`;
      details.issue_number = issueNumber;
      details.title = issueTitle;
      details.correlation = `issue:${delivery.repository_name}#${issueNumber}`;
      epistemicStatus = delivery.action === "opened" ? "proposed" : "observed";
      break;
    }
    case "issue_comment": {
      const issueNumber = payload?.issue?.number;
      summary = `Comment on issue #${issueNumber} ${delivery.action} by ${delivery.sender_login}`;
      details.issue_number = issueNumber;
      details.correlation = `issue:${delivery.repository_name}#${issueNumber}`;
      details.comment_id = payload?.comment?.id ?? null;
      details.comment_node_id = payload?.comment?.node_id ?? null;
      details.comment_url = payload?.comment?.html_url ?? null;
      details.comment_updated_at = payload?.comment?.updated_at ?? null;
      details.comment_body =
        typeof payload?.comment?.body === "string" ? payload.comment.body : null;
      break;
    }
    case "discussion":
    case "discussion_comment": {
      summary = `Discussion ${delivery.event_name} ${delivery.action} on ${delivery.repository_name}`;
      details.discussion_number = payload?.discussion?.number || null;
      break;
    }
    case "workflow_run": {
      const workflowName = payload?.workflow?.name || payload?.workflow_run?.name || "Workflow";
      const conclusion = payload?.workflow_run?.conclusion || payload?.action || "started";
      summary = `Workflow "${workflowName}" ${conclusion} on ${delivery.repository_name}`;
      details.workflow_name = workflowName;
      details.conclusion = conclusion;
      details.correlation = `workflow:${delivery.repository_name}:${workflowName}`;
      epistemicStatus = "published";
      break;
    }
    case "check_run": {
      summary = `Check run ${payload?.check_run?.name || ""} ${delivery.action} on ${delivery.repository_name}`;
      details.check_name = payload?.check_run?.name || null;
      details.conclusion = payload?.check_run?.conclusion || null;
      epistemicStatus = "published";
      break;
    }
    case "release": {
      summary = `Release ${payload?.release?.tag_name || ""} ${delivery.action} on ${delivery.repository_name}`;
      details.tag = payload?.release?.tag_name || null;
      epistemicStatus = "published";
      break;
    }
    case "repository": {
      summary = `Repository ${delivery.action} ${delivery.repository_name}`;
      epistemicStatus = "declared";
      break;
    }
    case "branch_protection_rule": {
      summary = `Branch protection ${delivery.action} on ${delivery.repository_name}`;
      details.rule_name = payload?.rule?.name || null;
      epistemicStatus = "normative";
      break;
    }
    case "dependabot_alert":
    case "code_scanning_alert":
    case "secret_scanning_alert": {
      summary = `Security Alert (${delivery.event_name}) ${delivery.action} on ${delivery.repository_name}`;
      details.alert_kind = delivery.event_name;
      break;
    }
    case "installation":
    case "installation_repositories": {
      summary = `GitHub App ${delivery.event_name} ${delivery.action}`;
      details.installation_id = delivery.installation_id;
      details.repos_added = payload?.repositories_added?.map((r) => r.full_name) || null;
      details.repos_removed = payload?.repositories_removed?.map((r) => r.full_name) || null;
      epistemicStatus = "declared";
      break;
    }
    default: {
      handled = false;
      summary = `Unhandled GitHub event "${delivery.event_name}" (${delivery.action || "no-action"}) on ${delivery.repository_name || "unknown"} — recorded, not discarded`;
      details.unhandled = true;
      details.subscribed = subscribed;
      break;
    }
  }

  const activityKind = classifyActivityKind(delivery.event_name, delivery.action, epistemicStatus);

  const event = {
    topic_id: topicId,
    event_type: "cop.event/v1",
    actor_id: actorId,
    subject_ref: `instance:${instanceId}`,
    epistemic_status: epistemicStatus,
    origin_ref: `github:delivery:${delivery.delivery_id}`,
    causal_refs: details.correlation ? [details.correlation] : [],
    visibility: "restricted",
    payload: {
      github_event: delivery.event_name,
      action: delivery.action,
      repository: delivery.repository_name,
      repository_role: repoRole,
      installation_id: delivery.installation_id,
      summary,
      details,
      activity_kind: activityKind,
      attribution: {
        github_login: delivery.sender_login,
        // GitHub author ≠ legal Principal / mandate without #30 mapping
        legal_actor_resolved: false,
      },
    },
    meta: {
      instance_id: instanceId,
      delivery_id: delivery.delivery_id,
      payload_sha256: delivery.payload_sha256,
      mapped_at: new Date().toISOString(),
      mapper: "github-ingress.v2",
      handled,
      subscribed,
    },
    idempotency_key: `github:${delivery.delivery_id}:${delivery.event_name}`,
  };

  return [event];
}

/** Back-compat single-event mapper. */
export function mapDeliveryToCopEvent(delivery, payload, options = {}) {
  return mapDeliveryToCopEvents(delivery, payload, options)[0];
}

/**
 * Full ingress decision for one HTTP delivery (pure, no I/O).
 */
export function evaluateGithubIngress({
  headers,
  payload,
  rawBody,
  webhookSecret,
  allowlist = [],
  options = {},
}) {
  const signature = headers["x-hub-signature-256"] || headers["X-Hub-Signature-256"] || "";

  if (webhookSecret) {
    const ok = verifyGithubHmacSignature(rawBody, signature, webhookSecret);
    if (!ok) {
      return {
        ok: false,
        status: 401,
        error: "invalid_hmac_signature",
        persist: false,
      };
    }
  }

  const delivery = normalizeGithubDelivery(headers, payload, rawBody);
  if (!delivery.delivery_id || !delivery.event_name) {
    return { ok: false, status: 400, error: "missing_github_headers", persist: false };
  }

  // Body size guard (default 1 MiB)
  const maxBytes = options.maxBodyBytes ?? 1024 * 1024;
  const size =
    typeof rawBody === "string"
      ? Buffer.byteLength(rawBody)
      : Buffer.isBuffer(rawBody)
        ? rawBody.length
        : 0;
  if (size > maxBytes) {
    return { ok: false, status: 413, error: "body_too_large", persist: false };
  }

  const allowEmpty = options.allowEmptyAllowlist === true;
  if (
    delivery.repository_name &&
    !isRepositoryAllowed(delivery.repository_name, allowlist, {
      allowEmptyList: allowEmpty,
    })
  ) {
    return {
      ok: true,
      status: 202,
      error: null,
      persist: true,
      delivery: {
        ...delivery,
        processing_state: "ignored",
        processing_error: "repository_not_allowlisted",
      },
      events: [],
      outcome: "ignored_allowlist",
    };
  }

  const events = mapDeliveryToCopEvents(delivery, payload, options);
  const result = {
    ok: true,
    status: 202,
    persist: true,
    delivery,
    events,
    outcome: events[0]?.meta?.handled === false ? "unhandled_recorded" : "mapped",
  };
  // Recognition runs only when the caller supplies suspended continuations.
  // It proposes events. It does not append them or resolve the continuation.
  if (options.continuationContext) {
    result.continuation_recognition = recognizeMappedContinuationResults(
      events,
      options.continuationContext
    );
  }
  return result;
}
