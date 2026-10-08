import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateGitProgramDescriptor } from "./github-compute-program.js";

const hex = (v) => crypto.createHash("sha256").update(v).digest("hex");
const stamp = () => new Date().toISOString();

function run(binary, argv, { cwd, timeout, env } = {}) {
  const p = spawnSync(binary, argv, {
    cwd, env: env || process.env, timeout, encoding: "utf8", maxBuffer: 1024 * 1024,
    shell: false,
  });
  if (p.error || p.status !== 0) {
    throw new Error(`subprocess_failed:${binary}: ${p.error?.message || p.stderr?.slice(-700) || p.status}`);
  }
  return p;
}

function cloneExact(repo, ref, dest, remainingMs) {
  const url = `https://github.com/${repo}.git`;
  // Public GitHub repository clone; argv is fixed, not shell text from an issue.
  run("git", ["clone", "--quiet", "--no-checkout", url, dest], { timeout: remainingMs });
  run("git", ["checkout", "--quiet", "--detach", ref], { cwd: dest, timeout: remainingMs });
  const got = run("git", ["rev-parse", "HEAD"], { cwd: dest, timeout: remainingMs }).stdout.trim();
  if (got.toLowerCase() !== ref.toLowerCase()) throw new Error("source_ref_mismatch");
}

export function executeGitProgram(request, {
  runId = process.env.GITHUB_RUN_ID || "local",
  runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
  artifactsDir = process.env.RUNNER_TEMP
    ? path.join(process.env.RUNNER_TEMP, "compute-artifacts")
    : null,
} = {}) {
  const d = request.operation.descriptor;
  validateGitProgramDescriptor(d);
  const started = Date.now();
  const cutoff = started + Math.min(d.execution.timeout_seconds, request.limits.timeout_seconds) * 1000;
  const remaining = () => {
    const ms = cutoff - Date.now();
    if (ms <= 0) throw new Error("compute_timeout");
    return ms;
  };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "fractanet-program-"));
  const programDir = path.join(work, "program");
  const inputDir = path.join(work, "inputs");
  fs.mkdirSync(inputDir);
  const binding = {
    schema: "magistral.execution-binding/v1",
    requirement_ref: `requirement:compute-request:${request.computation_id}`,
    offer_id: "offer:github-actions:git-program-v1",
    runtime_id: "runtime:github-actions:ubuntu-latest",
    handler_instance_ref: `handler:github-actions:${runId}`,
    execution_surface: "batch",
    provider_ref: "provider:github-actions",
    provider_execution_id: String(runId),
  };
  let result = null, error = null, outputs = [], logs = [], passed = false;
  try {
    cloneExact(d.program.repository, d.program.ref, programDir, remaining());
    for (const input of d.inputs) {
      const dest = path.join(inputDir, ...input.repository.split("/"));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      cloneExact(input.repository, input.ref, dest, remaining());
    }
    // Program can use its checked-out input repositories, but is given no publishing token.
    const childEnv = { ...process.env,
      GITHUB_TOKEN: "", GH_TOKEN: "", NODE_AUTH_TOKEN: "", NPM_TOKEN: "",
      GOOGLE_APPLICATION_CREDENTIALS: "", AWS_ACCESS_KEY_ID: "", AWS_SECRET_ACCESS_KEY: "",
      FRACTANET_INPUT_ROOT: inputDir,
      FRACTANET_OUTPUT_ROOT: programDir,
    };
    for (const argv of d.commands) {
      const invocation = run(argv[0], argv.slice(1), { cwd: programDir, timeout: remaining(), env: childEnv });
      logs.push({ command: argv[0], args: argv.slice(1), stdout: invocation.stdout.slice(-3000), stderr: invocation.stderr.slice(-3000) });
    }
    const outdir = artifactsDir || path.join(work, "artifacts");
    fs.mkdirSync(outdir, { recursive: true });
    for (const rel of d.outputs) {
      const src = path.resolve(programDir, rel);
      if (!src.startsWith(programDir + path.sep)) throw new Error("output_outside_program");
      const stat = fs.lstatSync(src);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("output_must_be_regular_file");
      const data = fs.readFileSync(src);
      const filename = rel.replaceAll("/", "__");
      const dst = path.join(outdir, filename);
      fs.writeFileSync(dst, data, { flag: "wx" });
      outputs.push({ path: rel, artifact_file: filename, bytes: data.length, sha256: hex(data) });
    }
    passed = true;
    result = { operation: "git-program", passed, outputs, logs };
  } catch (e) {
    error = String(e.message || e);
    result = { operation: "git-program", passed: false, outputs, logs, error };
  }
  const receipt = {
    schema: "magistral.execution-receipt/v1", binding,
    status: passed ? "completed" : "failed", terminal: true,
    artifact_refs: outputs.map(x=>`github-actions-run:${runId}:compute-${request.computation_id}#${x.artifact_file}`),
    result_refs: outputs.map(x=>`sha256:${x.sha256}`),
    log_refs: runUrl ? [runUrl] : [],
    error, recorded_at: stamp(),
  };
  return {
    schema: "cop.compute-result/v1", computation_id: request.computation_id,
    source: { repository: request.repository.name, ref: request.repository.ref,
      program: d.program, inputs: d.inputs },
    result, execution_binding: binding, execution_receipt: receipt,
  };
}
