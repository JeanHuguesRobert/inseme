import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REQUEST_SCHEMA = "cop.compute-request/v1";
const RESULT_SCHEMA = "cop.compute-result/v1";
const COMPUTATION_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const GIT_SHA_RE = /^[0-9a-f]{40}$/i;

export function parseComputeRequestComment(body, {
  expectedRepository,
  expectedIssue,
} = {}) {
  if (typeof body !== "string") throw new TypeError("comment body is required");

  const blocks = [...body.matchAll(/```json\s*([\s\S]*?)```/gi)];
  let request = null;

  for (const match of blocks) {
    let value;
    try {
      value = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (value?.schema === REQUEST_SCHEMA) {
      if (request) throw new Error("multiple_compute_requests");
      request = value;
    }
  }

  if (!request) {
    try {
      const value = JSON.parse(body.trim());
      if (value?.schema === REQUEST_SCHEMA) request = value;
    } catch {
      // The comment may contain prose or malformed JSON; preserve the canonical error below.
    }
  }

  if (!request) throw new Error("compute_request_not_found");
  validateRequest(request, { expectedRepository, expectedIssue });
  return request;
}

export function validateRequest(request, {
  expectedRepository,
  expectedIssue,
} = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("request must be an object");
  }
  if (request.schema !== REQUEST_SCHEMA) throw new Error("unsupported_schema");
  if (!COMPUTATION_ID_RE.test(request.computation_id ?? "")) {
    throw new Error("invalid_computation_id");
  }
  if (request.capability !== "compute.batch") throw new Error("unsupported_capability");

  const repository = request.repository;
  if (!repository || typeof repository !== "object") throw new Error("repository_required");
  if (repository.name !== expectedRepository) throw new Error("repository_mismatch");
  if (!GIT_SHA_RE.test(repository.ref ?? "")) throw new Error("exact_git_ref_required");

  const operation = request.operation;
  if (!operation || typeof operation !== "object") throw new Error("operation_required");
  if (operation.kind !== "sha256-file") throw new Error("unsupported_operation");
  validateRelativePath(operation.path);

  const limits = request.limits;
  if (!limits || typeof limits !== "object") throw new Error("limits_required");
  if (!Number.isInteger(limits.timeout_seconds) ||
      limits.timeout_seconds < 1 ||
      limits.timeout_seconds > 300) {
    throw new Error("invalid_timeout");
  }
  if (limits.network !== false) throw new Error("network_must_be_false");
  if (limits.repository_write !== false) throw new Error("repository_write_must_be_false");

  const returnSpec = request.return;
  if (!returnSpec || typeof returnSpec !== "object") throw new Error("return_required");
  if (!Number.isInteger(returnSpec.github_issue)) throw new Error("github_issue_required");
  if (expectedIssue !== undefined && returnSpec.github_issue !== Number(expectedIssue)) {
    throw new Error("return_issue_mismatch");
  }
  if (returnSpec.structured_result !== true) throw new Error("structured_result_required");

  return true;
}

export function executeSha256Request(request, {
  workspace = process.cwd(),
  runId = process.env.GITHUB_RUN_ID ?? "local",
  runUrl = process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
} = {}) {
  validateRequest(request, {
    expectedRepository: request.repository.name,
    expectedIssue: request.return.github_issue,
  });

  const relativePath = validateRelativePath(request.operation.path);
  const absolutePath = path.resolve(workspace, relativePath);
  const root = path.resolve(workspace) + path.sep;
  if (!absolutePath.startsWith(root)) throw new Error("path_escapes_workspace");

  const bytes = fs.readFileSync(absolutePath);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");

  const binding = Object.freeze({
    schema: "magistral.execution-binding/v1",
    requirement_ref: `requirement:compute-request:${request.computation_id}`,
    offer_id: "offer:github-actions:typed-compute-v1",
    runtime_id: "runtime:github-actions:ubuntu-latest",
    handler_instance_ref: `handler:github-actions:${runId}`,
    execution_surface: "batch",
    provider_ref: "provider:github-actions",
    provider_execution_id: String(runId),
  });

  const receipt = Object.freeze({
    schema: "magistral.execution-receipt/v1",
    binding,
    status: "completed",
    terminal: true,
    artifact_refs: [],
    result_refs: [
      `git:${request.repository.ref}#${relativePath}`,
      `sha256:${digest}`,
    ],
    log_refs: runUrl ? [`github-actions-run:${runId}`, runUrl] : [],
    error: null,
  });

  return Object.freeze({
    schema: RESULT_SCHEMA,
    computation_id: request.computation_id,
    source: Object.freeze({
      repository: request.repository.name,
      ref: request.repository.ref,
      path: relativePath,
    }),
    result: Object.freeze({
      algorithm: "sha256",
      digest,
      bytes: bytes.length,
    }),
    execution_binding: binding,
    execution_receipt: receipt,
  });
}

export function formatResultComment(result) {
  if (!result || result.schema !== RESULT_SCHEMA) throw new Error("invalid_result");
  return [
    `<!-- cop-compute-result:${result.computation_id} -->`,
    "## COP compute result",
    "",
    "```json",
    JSON.stringify(result, null, 2),
    "```",
  ].join("\n");
}

function validateRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("operation_path_required");
  if (value.includes("\\") || value.startsWith("/") || value.includes("\0")) {
    throw new Error("invalid_operation_path");
  }
  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("invalid_operation_path");
  }
  if (normalized !== value) throw new Error("operation_path_must_be_normalized");
  return normalized;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = {};
  for (let i = 0; i < rest.length; i += 2) {
    args[rest[i]] = rest[i + 1];
  }
  return { command, args };
}

function appendGithubOutput(file, values) {
  const body = Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join("");
  fs.appendFileSync(file, body);
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (command === "parse-event") {
    const eventPath = args["--event"];
    const outputPath = args["--github-output"];
    const requestFile = args["--request-file"];
    if (!eventPath || !outputPath || !requestFile) throw new Error("missing_parse_event_argument");

    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    const request = parseComputeRequestComment(event.comment?.body, {
      expectedRepository: process.env.GITHUB_REPOSITORY,
      expectedIssue: event.issue?.number,
    });
    fs.writeFileSync(requestFile, JSON.stringify(request, null, 2));
    appendGithubOutput(outputPath, {
      computation_id: request.computation_id,
      ref: request.repository.ref,
      issue: request.return.github_issue,
      timeout_seconds: request.limits.timeout_seconds,
    });
    return;
  }

  if (command === "execute") {
    const requestFile = args["--request-file"];
    const resultFile = args["--result-file"];
    if (!requestFile || !resultFile) throw new Error("missing_execute_argument");
    const request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
    const result = executeSha256Request(request);
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    return;
  }

  if (command === "format-result") {
    const resultFile = args["--result-file"];
    const commentFile = args["--comment-file"];
    if (!resultFile || !commentFile) throw new Error("missing_format_argument");
    const result = JSON.parse(fs.readFileSync(resultFile, "utf8"));
    fs.writeFileSync(commentFile, formatResultComment(result));
    return;
  }

  throw new Error("unknown_command");
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
