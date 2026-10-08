/**
 * Generic GitHub Actions compute program descriptor.
 * A descriptor states what should execute; it does NOT grant mandate authority
 * or reserve budget. COP must authorize and account before provider invocation.
 */
const SHA = /^[0-9a-f]{40}$/i;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REL = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?!.*\0)[A-Za-z0-9_.\/-]+$/;
function requirePath(p) {
  if (typeof p !== "string" || !REL.test(p) || p.startsWith("../") || p.includes("//") || p.includes("/./") || p === "." || p === "..") throw Error("invalid_relative_path");
  return p;
}
export function validateGitProgramDescriptor(d) {
  if (!d || d.schema !== "fractanet.compute-program/v1") throw Error("invalid_program_schema");
  if (!REPO.test(d.program?.repository ?? "") || !SHA.test(d.program?.ref ?? "")) throw Error("exact_program_source_required");
  if (!Array.isArray(d.commands) || !d.commands.length || d.commands.length > 8) throw Error("invalid_command_steps");
  for (const argv of d.commands) {
    if (!Array.isArray(argv) || argv.length < 1 || argv.length > 64 || argv.some(s=>typeof s !== "string" || s.length === 0 || s.length > 4096 || s.includes("\0"))) throw Error("invalid_argv");
  }
  if (!Array.isArray(d.inputs) || d.inputs.length > 8) throw Error("invalid_inputs");
  for (const input of d.inputs) {
    if (!REPO.test(input.repository ?? "") || !SHA.test(input.ref ?? "")) throw Error("exact_input_source_required");
  }
  if (!Array.isArray(d.outputs) || !d.outputs.length || d.outputs.length > 20) throw Error("invalid_outputs");
  d.outputs.forEach(requirePath);
  if (d.execution?.runtime !== "github-actions-ubuntu" || !Number.isInteger(d.execution?.timeout_seconds) || d.execution.timeout_seconds < 1 || d.execution.timeout_seconds > 21600) throw Error("invalid_runtime_request");
  // Resource request is descriptive, not an accounting reservation or authority grant.
  if (d.mandate || d.budget || d.permissions) throw Error("program_descriptor_must_not_grant_authority_or_budget");
  return true;
}
