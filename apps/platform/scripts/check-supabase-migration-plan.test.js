import assert from "node:assert/strict";
import test from "node:test";

import { assessMigrationPlan, parseMigrationList } from "./check-supabase-migration-plan.js";

const policy = { superseded_migration_versions: ["20260901110000"] };

test("migration preflight rejects a superseded migration in the local deployment directory", () => {
  const result = assessMigrationPlan({
    policy,
    localMigrationFiles: ["20260901110000_civic_wiki_and_kudocracy_baseline.sql"],
    remoteMigrations: ["20260827130000"],
    allowedPending: ["20260901110000"],
  });
  assert.match(result.violations.join("\n"), /Superseded migration 20260901110000 is present/);
});

test("migration preflight requires an explicit allow-list for a new migration", () => {
  const result = assessMigrationPlan({
    policy,
    localMigrationFiles: ["20260907045153_add_cop_event_on_behalf_instance.sql"],
    remoteMigrations: ["20260827130000"],
    allowedPending: [],
  });
  assert.deepEqual(result.pending, ["20260907045153"]);
  assert.match(result.violations.join("\n"), /needs explicit --allow-pending=20260907045153/);
});

test("migration preflight permits a specifically approved pending migration", () => {
  const result = assessMigrationPlan({
    policy,
    localMigrationFiles: ["20260907045153_add_cop_event_on_behalf_instance.sql"],
    remoteMigrations: ["20260827130000"],
    allowedPending: ["20260907045153"],
  });
  assert.deepEqual(result, { pending: ["20260907045153"], violations: [] });
});

test("migration list parser tolerates CLI preamble before JSON", () => {
  const migrations = parseMigrationList(
    'Initialising login role...\n{"migrations":[{"local":"20260720040000","remote":"20260720040000"}]}'
  );
  assert.equal(migrations[0].remote, "20260720040000");
});
