#!/usr/bin/env node

/**
 * Fail closed before a linked Supabase deployment.
 *
 * This guard prevents an audited/superseded migration from re-entering the
 * deployment path and makes pending migrations an explicit operator choice.
 * It never writes to Supabase.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const platformDirectory = path.resolve(scriptDirectory, "..");
const supabaseDirectory = path.join(platformDirectory, "supabase");
const migrationsDirectory = path.join(supabaseDirectory, "migrations");
const policyPath = path.join(supabaseDirectory, "deployment-policy.json");

export function migrationVersion(fileName) {
  const match = String(fileName).match(/^(\d{14})_/);
  return match?.[1] || null;
}

export function parseMigrationList(output) {
  const text = String(output);
  const start = text.indexOf('{"migrations"');
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Supabase migration list did not return its JSON payload.");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed.migrations)) {
    throw new Error("Supabase migration list JSON has no migrations array.");
  }
  return parsed.migrations;
}

export function assessMigrationPlan({
  policy,
  localMigrationFiles,
  remoteMigrations,
  allowedPending,
}) {
  const superseded = new Set(policy.superseded_migration_versions || []);
  const localVersions = new Set(localMigrationFiles.map(migrationVersion).filter(Boolean));
  const remoteVersions = new Set(remoteMigrations.filter(Boolean));
  const allowed = new Set(allowedPending || []);
  const violations = [];

  for (const version of superseded) {
    if (localVersions.has(version)) {
      violations.push(`Superseded migration ${version} is present in supabase/migrations.`);
    }
    if (remoteVersions.has(version)) {
      violations.push(
        `Superseded migration ${version} is already recorded remotely; stop for reconciliation.`
      );
    }
  }

  const pending = [...localVersions].filter((version) => !remoteVersions.has(version)).sort();
  for (const version of pending) {
    if (!allowed.has(version)) {
      violations.push(`Pending migration ${version} needs explicit --allow-pending=${version}.`);
    }
  }

  for (const version of allowed) {
    if (!pending.includes(version)) {
      violations.push(`--allow-pending=${version} does not name a locally pending migration.`);
    }
  }

  return { pending, violations };
}

function parseArguments(argv) {
  const allowedPending = [];
  for (const argument of argv) {
    if (argument.startsWith("--allow-pending=")) {
      allowedPending.push(...argument.slice("--allow-pending=".length).split(",").filter(Boolean));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return allowedPending;
}

function main() {
  const allowedPending = parseArguments(process.argv.slice(2));
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  const localMigrationFiles = readdirSync(migrationsDirectory).filter((name) =>
    name.endsWith(".sql")
  );
  const supabaseOutput = execFileSync(
    "supabase",
    ["migration", "list", "--linked", "--output", "json"],
    {
      cwd: platformDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      maxBuffer: 1_000_000,
    }
  );
  const migrations = parseMigrationList(supabaseOutput);
  const remoteMigrations = migrations.map((entry) => entry.remote).filter(Boolean);
  const result = assessMigrationPlan({
    policy,
    localMigrationFiles,
    remoteMigrations,
    allowedPending,
  });

  if (result.violations.length) {
    throw new Error(`Supabase migration preflight failed:\n- ${result.violations.join("\n- ")}`);
  }

  console.log(JSON.stringify({ ok: true, pending: result.pending }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}
