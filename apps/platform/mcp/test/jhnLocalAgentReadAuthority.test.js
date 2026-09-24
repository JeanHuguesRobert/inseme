import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  createEventSourcedExecutionBudgetLedger,
  recordExecutionBudgetGrant,
} from "../../../../packages/cop-core/src/execution-budget.js";
import {
  evaluateMandate,
  recordMandateControl,
  recordMandateDeclaration,
  resolveMandate,
} from "../../../../packages/cop-core/src/governed-act.js";
import {
  bootstrapJhnLocalCopAuthority,
  bootstrapJhnLocalTransportAuthority,
} from "../../scripts/bootstrap-jhn-cop-local.js";
import { migrateJhnLocalAgentReadAuthorityDirectory } from "../../scripts/migrate-jhn-local-agent-read-authority.js";
import { repairJhnLocalAgentAuthority } from "../../scripts/repair-jhn-local-agent-authority.js";
import { verifyJhnLocalCopAuthority } from "../../scripts/verify-jhn-cop-local.js";
import { acpStdioRuntime, createHostRuntimeClient } from "../cop/hostRuntimeClient.js";
import {
  JHN_AGENT_ACP_PROMPT_TIMEOUT_MS,
  JHN_AGENT_BUDGET_ID,
  JHN_AGENT_BUDGET_LIMITS,
  JHN_AGENT_LOGICAL_AGENT_REF,
  JHN_AGENT_MANDATE_REF,
  JHN_AGENT_PRINCIPAL_REF,
  JHN_AGENT_TURN_DEMAND,
  JHN_AGENT_V1_ALLOWED_CAPABILITIES,
  JHN_AGENT_V1_BUDGET_AUTHORITY_VERSION,
  JHN_AGENT_V1_BUDGET_LIMITS,
  JHN_AGENT_V1_MANDATE_VERSION,
  JHN_TRANSPORT_MANDATE_REF,
} from "../cop/jhnLocalAgentAuthority.js";
import { createSqliteCopRuntimeStore } from "../cop/sqliteRuntimeStore.js";

const execFileAsync = promisify(execFile);
const migrationScript = fileURLToPath(
  new URL("../../scripts/migrate-jhn-local-agent-read-authority.js", import.meta.url)
);

async function temporaryState(label) {
  return mkdtemp(path.join(os.tmpdir(), `jhn-read-authority-${label}-`));
}

async function removeState(stateDirectory) {
  await rm(stateDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}

function withStore(stateDirectory, fn) {
  const database = new DatabaseSync(path.join(stateDirectory, "cop-runtime.sqlite"));
  try {
    return fn(database, createSqliteCopRuntimeStore(database).eventStore);
  } finally {
    database.close();
  }
}

function replay(stateDirectory) {
  return withStore(stateDirectory, (_database, store) => store.replay());
}

function kindCount(events, kind) {
  return events.filter((event) => event.payload?.kind === kind).length;
}

function transportRow(stateDirectory) {
  return withStore(stateDirectory, (database) =>
    database
      .prepare(
        "SELECT mandate_ref, version, status, issuer_ref, grantee_ref, permissions FROM cop_mandates WHERE mandate_ref = ?"
      )
      .get(JHN_TRANSPORT_MANDATE_REF)
  );
}

function recordCanonicalV1(store) {
  recordMandateDeclaration(store, {
    mandate_id: JHN_AGENT_MANDATE_REF,
    version: JHN_AGENT_V1_MANDATE_VERSION,
    principal_ref: JHN_AGENT_PRINCIPAL_REF,
    logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
    status: "active",
    scope: {
      allowed_actions: [...JHN_AGENT_V1_ALLOWED_CAPABILITIES],
      forbidden_actions: [],
    },
  });
  recordExecutionBudgetGrant(store, {
    budget_id: JHN_AGENT_BUDGET_ID,
    mandate_ref: JHN_AGENT_MANDATE_REF,
    principal_ref: JHN_AGENT_PRINCIPAL_REF,
    limits: { ...JHN_AGENT_V1_BUDGET_LIMITS },
    authority_version: JHN_AGENT_V1_BUDGET_AUTHORITY_VERSION,
    reason: "historical v1 fixture",
  });
}

async function fixtureCanonicalV1(stateDirectory) {
  await bootstrapJhnLocalTransportAuthority({ stateDirectory });
  withStore(stateDirectory, (_database, store) => {
    recordCanonicalV1(store);
  });
}

function assertSparseBudget(snapshot) {
  for (const view of ["limits", "reserved", "settled", "available"]) {
    assert.deepEqual(Object.keys(snapshot[view]).sort(), ["max_elapsed_ms", "max_steps"]);
  }
  assert.deepEqual(snapshot.limits, { ...JHN_AGENT_BUDGET_LIMITS });
  assert.equal(snapshot.authority_version, 2);
}

function budgetSnapshot(stateDirectory) {
  return withStore(stateDirectory, (_database, store) =>
    createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: JHN_AGENT_BUDGET_ID,
      require_authority_grant: true,
    }).snapshot()
  );
}

test("A - fresh bootstrap records canonical v2 directly", async () => {
  const stateDirectory = await temporaryState("a");
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory });
    const events = replay(stateDirectory);
    const declarations = events.filter((event) => event.payload?.kind === "MandateDeclaration");
    const grants = events.filter((event) => event.payload?.kind === "ExecutionBudgetGrant");
    assert.equal(declarations.length, 1);
    assert.equal(declarations[0].payload.version, "v2");
    assert.deepEqual(declarations[0].payload.scope.allowed_actions, ["coding.assist.read"]);
    assert.equal(declarations[0].payload.metadata.supersedes_version, undefined);
    assert.equal(grants.length, 1);
    assert.equal(grants[0].payload.authority_version, 2);
    assert.deepEqual(grants[0].payload.limits, { max_steps: 8, max_elapsed_ms: 480_000 });
    assert.equal(
      events.some(
        (event) => event.payload?.version === "v1" && event.payload?.kind === "MandateDeclaration"
      ),
      false
    );
    assertSparseBudget(budgetSnapshot(stateDirectory));
    const transport = transportRow(stateDirectory);
    assert.equal(transport.status, "active");
    assert.equal(transport.version, 1);
    await verifyJhnLocalCopAuthority({ stateDirectory });

    const migration = await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    assert.equal(migration.ok, true);
    assert.equal(migration.changed, false);
    assert.equal(kindCount(replay(stateDirectory), "MandateDeclaration"), 1);
  } finally {
    await removeState(stateDirectory);
  }
});

test("B - exact v1 migration appends v2 and keeps the predecessor", async () => {
  const stateDirectory = await temporaryState("b");
  try {
    await fixtureCanonicalV1(stateDirectory);
    const privateBefore = await readFile(path.join(stateDirectory, "cop-capability-private.jwk"));
    const publicBefore = await readFile(
      path.join(stateDirectory, "cop-capability-public-keys.json")
    );
    const transportBefore = transportRow(stateDirectory);
    const before = replay(stateDirectory);
    const repair = await repairJhnLocalAgentAuthority({ stateDirectory });
    assert.equal(repair.ok, false);
    assert.equal(repair.changed, false);
    assert.equal(repair.error, "predecessor_requires_explicit_migration");
    assert.equal(replay(stateDirectory).length, before.length);

    const migrated = await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    assert.equal(migrated.ok, true);
    assert.equal(migrated.changed, true);
    assert.equal(migrated.normative_mandate.action, "declared");
    assert.equal(migrated.budget.action, "granted");
    assert.equal(migrated.keys_preserved, true);
    assert.equal(migrated.transport.preserved, true);

    const after = replay(stateDirectory);
    assert.equal(kindCount(after, "MandateDeclaration"), 2);
    assert.equal(kindCount(after, "ExecutionBudgetGrant"), 2);
    const declarations = after.filter((event) => event.payload?.kind === "MandateDeclaration");
    assert.equal(declarations[0].payload.version, "v1");
    assert.deepEqual(declarations[0].payload.scope.allowed_actions, ["coding.assist"]);
    assert.equal(declarations[1].payload.version, "v2");
    assert.equal(declarations[1].payload.metadata.supersedes_version, "v1");
    assert.equal(declarations[1].payload.metadata.approved_by, JHN_AGENT_PRINCIPAL_REF);
    const grants = after.filter((event) => event.payload?.kind === "ExecutionBudgetGrant");
    assert.equal(grants[0].payload.authority_version, 1);
    assert.deepEqual(grants[0].payload.limits, { ...JHN_AGENT_V1_BUDGET_LIMITS });
    assert.equal(grants[1].payload.authority_version, 2);
    assertSparseBudget(budgetSnapshot(stateDirectory));
    const resolved = withStore(stateDirectory, (_database, store) =>
      resolveMandate(store, JHN_AGENT_MANDATE_REF)
    );
    assert.equal(resolved.version, "v2");
    assert.deepEqual(transportRow(stateDirectory), transportBefore);
    assert.equal(
      Buffer.compare(
        privateBefore,
        await readFile(path.join(stateDirectory, "cop-capability-private.jwk"))
      ),
      0
    );
    assert.equal(
      Buffer.compare(
        publicBefore,
        await readFile(path.join(stateDirectory, "cop-capability-public-keys.json"))
      ),
      0
    );
    await verifyJhnLocalCopAuthority({ stateDirectory });
  } finally {
    await removeState(stateDirectory);
  }
});

test("C - a second migration appends nothing", async () => {
  const stateDirectory = await temporaryState("c");
  try {
    await fixtureCanonicalV1(stateDirectory);
    const first = await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    assert.equal(first.changed, true);
    const count = replay(stateDirectory).length;
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      migrationScript,
      "--state-dir",
      stateDirectory,
    ]);
    const privateText = await readFile(
      path.join(stateDirectory, "cop-capability-private.jwk"),
      "utf8"
    );
    assert.match(stdout, /already_present/);
    assert.equal(stdout.includes(privateText), false);
    assert.equal(stderr.includes(privateText), false);
    assert.doesNotMatch(`${stdout}\n${stderr}`, /Bearer [A-Za-z0-9_-]{8,}/);
    assert.equal(replay(stateDirectory).length, count);
    assert.equal(kindCount(replay(stateDirectory), "MandateDeclaration"), 2);
    assert.equal(kindCount(replay(stateDirectory), "ExecutionBudgetGrant"), 2);
  } finally {
    await removeState(stateDirectory);
  }
});

test("D - a v1 pin is stale and the unpinned mandate resolves v2", async () => {
  const stateDirectory = await temporaryState("d");
  try {
    await fixtureCanonicalV1(stateDirectory);
    await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    const verdicts = withStore(stateDirectory, (_database, store) => ({
      stale: evaluateMandate(store, {
        mandate_ref: `${JHN_AGENT_MANDATE_REF}@v1`,
        version_pin: "v1",
        expected_principal_ref: JHN_AGENT_PRINCIPAL_REF,
        expected_actor_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        capability: "coding.assist.read",
      }),
      active: evaluateMandate(store, {
        mandate_ref: JHN_AGENT_MANDATE_REF,
        expected_principal_ref: JHN_AGENT_PRINCIPAL_REF,
        expected_actor_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        capability: "coding.assist.read",
      }),
      resolved: resolveMandate(store, JHN_AGENT_MANDATE_REF),
    }));
    assert.equal(verdicts.stale.granted, false);
    assert.equal(verdicts.stale.error, "mandate_version_stale");
    assert.equal(verdicts.active.granted, true);
    assert.equal(verdicts.active.mandate_version, "v2");
    assert.equal(verdicts.resolved.version, "v2");
  } finally {
    await removeState(stateDirectory);
  }
});

test("E - coding.assist.read is authorized and coding.assist is not", async () => {
  const stateDirectory = await temporaryState("e");
  try {
    await fixtureCanonicalV1(stateDirectory);
    await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    const verdicts = withStore(stateDirectory, (_database, store) => ({
      read: evaluateMandate(store, {
        mandate_ref: JHN_AGENT_MANDATE_REF,
        expected_principal_ref: JHN_AGENT_PRINCIPAL_REF,
        expected_actor_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        capability: "coding.assist.read",
      }),
      generic: evaluateMandate(store, {
        mandate_ref: JHN_AGENT_MANDATE_REF,
        expected_principal_ref: JHN_AGENT_PRINCIPAL_REF,
        expected_actor_ref: JHN_AGENT_LOGICAL_AGENT_REF,
        capability: "coding.assist",
      }),
    }));
    assert.equal(verdicts.read.granted, true);
    assert.equal(verdicts.generic.granted, false);
    assert.equal(verdicts.generic.error, "capability_out_of_scope");
  } finally {
    await removeState(stateDirectory);
  }
});

test("F - the projected budget exposes only the sparse hard dimensions", async () => {
  const stateDirectory = await temporaryState("f");
  try {
    await fixtureCanonicalV1(stateDirectory);
    await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    const snapshot = budgetSnapshot(stateDirectory);
    assertSparseBudget(snapshot);
    assert.deepEqual(snapshot.reserved, { max_steps: 0, max_elapsed_ms: 0 });
    assert.deepEqual(snapshot.settled, { max_steps: 0, max_elapsed_ms: 0 });
    assert.equal(Object.hasOwn(snapshot.limits, "max_tool_calls"), false);
    assert.equal(Object.hasOwn(snapshot.limits, "max_subagents"), false);
    assert.equal(Object.hasOwn(snapshot.limits, "max_external_effects"), false);
  } finally {
    await removeState(stateDirectory);
  }
});

test("G - eight full reserved turns exhaust the sparse grant and a ninth does not", async () => {
  const stateDirectory = await temporaryState("g");
  try {
    await bootstrapJhnLocalCopAuthority({ stateDirectory });
    assert.deepEqual(JHN_AGENT_TURN_DEMAND, { max_steps: 1, max_elapsed_ms: 60_000 });
    withStore(stateDirectory, (_database, store) => {
      const ledger = createEventSourcedExecutionBudgetLedger({
        store,
        budget_id: JHN_AGENT_BUDGET_ID,
        require_authority_grant: true,
      });
      let snapshot = ledger.snapshot();
      for (let index = 0; index < 8; index += 1) {
        const reserved = ledger.reserve({
          idempotency_key: `turn-${index}`,
          expected_version: snapshot.version,
          demand: { ...JHN_AGENT_TURN_DEMAND },
        });
        assert.equal(reserved.ok, true, reserved.error || reserved.reason);
        const settled = ledger.settle({
          reservation_id: reserved.reservation.reservation_id,
          expected_version: reserved.snapshot.version,
          usage: { ...reserved.reservation.demand },
        });
        assert.equal(settled.ok, true, settled.error || settled.reason);
        snapshot = settled.snapshot;
      }
      assert.deepEqual(snapshot.settled, { max_steps: 8, max_elapsed_ms: 480_000 });
      assert.deepEqual(snapshot.available, { max_steps: 0, max_elapsed_ms: 0 });
      assert.deepEqual(snapshot.reserved, { max_steps: 0, max_elapsed_ms: 0 });
      const ninth = ledger.reserve({
        idempotency_key: "turn-9",
        expected_version: snapshot.version,
        demand: { ...JHN_AGENT_TURN_DEMAND },
      });
      assert.equal(ninth.ok, false);
      assert.equal(ninth.error, "budget_exhausted");
    });
  } finally {
    await removeState(stateDirectory);
  }
});

test("H - a coding.assist.read ACP fixture enforces the 60000 ms ceiling without a provider", async () => {
  let spawned = 0;
  function runtimeAt(timeout) {
    return acpStdioRuntime({
      id: `runtime:test:jhn-read:${timeout}`,
      command: "codex-acp",
      handler_instance_ref: "handler:test:jhn-read",
      capabilities: ["coding.assist.read"],
      invoke_timeout_ms: timeout,
    });
  }
  const canonical = runtimeAt(JHN_AGENT_ACP_PROMPT_TIMEOUT_MS);
  const tooSlow = runtimeAt(JHN_AGENT_ACP_PROMPT_TIMEOUT_MS + 1);
  const client = createHostRuntimeClient({
    runtimes: [canonical, tooSlow],
    spawnImpl() {
      spawned += 1;
      throw new Error("real provider must not be spawned");
    },
  });
  const accepted = client
    .asHandler(canonical.id, { capability: "coding.assist.read" })
    .preflightExecutionBudget({ demand: { ...JHN_AGENT_TURN_DEMAND } });
  const exceeded = client
    .asHandler(tooSlow.id, { capability: "coding.assist.read" })
    .preflightExecutionBudget({ demand: { ...JHN_AGENT_TURN_DEMAND } });
  const zeroToolCalls = client
    .asHandler(canonical.id, { capability: "coding.assist.read" })
    .preflightExecutionBudget({
      demand: { ...JHN_AGENT_TURN_DEMAND, max_tool_calls: 0 },
    });
  assert.equal(canonical.capabilities[0], "coding.assist.read");
  assert.equal(accepted.ok, true);
  assert.equal(exceeded.ok, false);
  assert.equal(exceeded.dimension, "max_elapsed_ms");
  assert.equal(exceeded.runtime_bound, 60_001);
  assert.equal(zeroToolCalls.ok, false);
  assert.equal(zeroToolCalls.dimension, "max_tool_calls");
  assert.equal(spawned, 0);
});

test("I - divergent, partial, consumed, and controlled authority appends nothing", async () => {
  const cases = [
    [
      "divergent-v1",
      (store) => {
        recordMandateDeclaration(store, {
          mandate_id: JHN_AGENT_MANDATE_REF,
          version: "v1",
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
          status: "active",
          scope: {
            allowed_actions: ["coding.assist", "coding.assist.read"],
            forbidden_actions: [],
          },
        });
        recordExecutionBudgetGrant(store, {
          budget_id: JHN_AGENT_BUDGET_ID,
          mandate_ref: JHN_AGENT_MANDATE_REF,
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          limits: { ...JHN_AGENT_V1_BUDGET_LIMITS },
          authority_version: 1,
        });
      },
    ],
    [
      "divergent-v2",
      (store) => {
        recordMandateDeclaration(store, {
          mandate_id: JHN_AGENT_MANDATE_REF,
          version: "v2",
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
          status: "active",
          scope: { allowed_actions: ["coding.assist"], forbidden_actions: [] },
        });
        recordExecutionBudgetGrant(store, {
          budget_id: JHN_AGENT_BUDGET_ID,
          mandate_ref: JHN_AGENT_MANDATE_REF,
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          limits: { ...JHN_AGENT_BUDGET_LIMITS },
          authority_version: 2,
        });
      },
    ],
    [
      "unexpected-version",
      (store) => {
        recordCanonicalV1(store);
        recordMandateDeclaration(store, {
          mandate_id: JHN_AGENT_MANDATE_REF,
          version: "v2",
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
          status: "active",
          scope: { allowed_actions: ["coding.assist.read"], forbidden_actions: [] },
        });
        recordExecutionBudgetGrant(store, {
          budget_id: JHN_AGENT_BUDGET_ID,
          mandate_ref: JHN_AGENT_MANDATE_REF,
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          limits: { ...JHN_AGENT_BUDGET_LIMITS },
          authority_version: 3,
        });
      },
    ],
    [
      "partial",
      (store) => {
        recordMandateDeclaration(store, {
          mandate_id: JHN_AGENT_MANDATE_REF,
          version: "v1",
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
          status: "active",
          scope: { allowed_actions: ["coding.assist"], forbidden_actions: [] },
        });
      },
    ],
    [
      "controlled",
      (store) => {
        recordCanonicalV1(store);
        recordMandateControl(store, {
          principal_ref: JHN_AGENT_PRINCIPAL_REF,
          mandate_ref: JHN_AGENT_MANDATE_REF,
          logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
          action: "suspend",
          reason: "reality-test",
        });
      },
    ],
  ];

  const directories = [];
  try {
    for (const [label, write] of cases) {
      const stateDirectory = await temporaryState(label);
      directories.push(stateDirectory);
      await bootstrapJhnLocalTransportAuthority({ stateDirectory });
      withStore(stateDirectory, (_database, store) => write(store));
      const before = replay(stateDirectory).length;
      const result = await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
      assert.equal(result.ok, false, label);
      assert.equal(result.changed, false, label);
      assert.equal(result.error, "normative_authority_conflict", label);
      assert.equal(replay(stateDirectory).length, before, label);
    }

    const consumed = await temporaryState("consumed");
    directories.push(consumed);
    await fixtureCanonicalV1(consumed);
    withStore(consumed, (_database, store) => {
      const ledger = createEventSourcedExecutionBudgetLedger({
        store,
        budget_id: JHN_AGENT_BUDGET_ID,
        limits: { ...JHN_AGENT_V1_BUDGET_LIMITS },
        require_authority_grant: true,
      });
      const snapshot = ledger.snapshot();
      const reserved = ledger.reserve({
        idempotency_key: "already-consumed",
        expected_version: snapshot.version,
        demand: {
          max_steps: 1,
          max_tool_calls: 0,
          max_subagents: 0,
          max_elapsed_ms: 1_000,
          max_external_effects: 0,
        },
      });
      assert.equal(reserved.ok, true);
    });
    const consumedBefore = replay(consumed).length;
    const consumedResult = await migrateJhnLocalAgentReadAuthorityDirectory({
      stateDirectory: consumed,
    });
    assert.equal(consumedResult.ok, false);
    assert.equal(consumedResult.changed, false);
    assert.match(consumedResult.conflicts.join("\n"), /reservation, settlement, or release/);
    assert.equal(replay(consumed).length, consumedBefore);

    const absent = await temporaryState("absent");
    directories.push(absent);
    await bootstrapJhnLocalTransportAuthority({ stateDirectory: absent });
    const absentBefore = replay(absent).length;
    const absentResult = await migrateJhnLocalAgentReadAuthorityDirectory({
      stateDirectory: absent,
    });
    assert.equal(absentResult.ok, false);
    assert.equal(absentResult.error, "normative_authority_absent");
    assert.equal(replay(absent).length, absentBefore);
  } finally {
    for (const stateDirectory of directories) await removeState(stateDirectory);
  }
});

test("J - migrated SQLite state reopens as the same v2 mandate and sparse budget", async () => {
  const stateDirectory = await temporaryState("j");
  try {
    await fixtureCanonicalV1(stateDirectory);
    const migrated = await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    assert.equal(migrated.ok, true);
    const first = withStore(stateDirectory, (_database, store) => ({
      mandate: resolveMandate(store, JHN_AGENT_MANDATE_REF),
      budget: createEventSourcedExecutionBudgetLedger({
        store,
        budget_id: JHN_AGENT_BUDGET_ID,
        require_authority_grant: true,
      }).snapshot(),
      events: store.replay().map((event) => ({
        kind: event.payload?.kind || null,
        version: event.payload?.version || event.payload?.authority_version || null,
        limits: event.payload?.limits || null,
      })),
    }));
    const second = withStore(stateDirectory, (_database, store) => ({
      mandate: resolveMandate(store, JHN_AGENT_MANDATE_REF),
      budget: createEventSourcedExecutionBudgetLedger({
        store,
        budget_id: JHN_AGENT_BUDGET_ID,
        require_authority_grant: true,
      }).snapshot(),
      events: store.replay().map((event) => ({
        kind: event.payload?.kind || null,
        version: event.payload?.version || event.payload?.authority_version || null,
        limits: event.payload?.limits || null,
      })),
    }));
    assert.equal(first.mandate.version, "v2");
    assert.deepEqual(second.mandate, first.mandate);
    assert.deepEqual(second.budget, first.budget);
    assert.deepEqual(second.events, first.events);
    assertSparseBudget(second.budget);
    await verifyJhnLocalCopAuthority({ stateDirectory });
  } finally {
    await removeState(stateDirectory);
  }
});
