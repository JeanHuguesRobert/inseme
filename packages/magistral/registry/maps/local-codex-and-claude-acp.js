import process from "node:process";
import { createLocalCodexAcpMap } from "./local-codex-acp.js";
import { createLocalClaudeAcpMap } from "./local-claude-acp.js";

/**
 * Composite host-local ACP map: Codex as the primary coding-agent node,
 * Claude Code as an independent-provider fallback (see inseme#105 for the
 * incident that motivated this — a single-provider quota outage should
 * degrade to a second provider, not straight to extractive_fallback).
 *
 * A launcher can only load one named map per pilot process, so provider
 * composition happens here rather than by passing multiple --map flags.
 * Each provider's own factory stays independently testable; this file only
 * concatenates their output and must not duplicate their validation logic.
 */
export function createLocalCodexAndClaudeAcpMap(env = process.env, platform = process.platform) {
  const nodes = [];
  if (env.CODEX_ACP_COMMAND) nodes.push(...createLocalCodexAcpMap(env, platform));
  if (env.CLAUDE_ACP_COMMAND) nodes.push(...createLocalClaudeAcpMap(env, platform));
  if (nodes.length === 0) {
    throw new Error(
      "local-codex-and-claude-acp requires at least one of CODEX_ACP_COMMAND or CLAUDE_ACP_COMMAND"
    );
  }
  return nodes;
}

// Guarded like the individual provider maps: importing this module without
// either provider configured (e.g. from a test) must not throw.
export default process.env.CODEX_ACP_COMMAND || process.env.CLAUDE_ACP_COMMAND
  ? createLocalCodexAndClaudeAcpMap(process.env, process.platform)
  : [];
