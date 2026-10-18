import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_TASK_WORKERS_ENV,
  legacyTaskWorkersEnabled,
} from "../cop/legacyTaskRuntime.js";
import MCPscheduler from "../scheduler.js";
import store from "../cop/supabaseStore.js";

test("legacy Task workers are disabled unless explicitly opted in", () => {
  assert.equal(legacyTaskWorkersEnabled({}), false);
  assert.equal(legacyTaskWorkersEnabled({ [LEGACY_TASK_WORKERS_ENV]: "0" }), false);
  assert.equal(legacyTaskWorkersEnabled({ [LEGACY_TASK_WORKERS_ENV]: "1" }), true);
});

test("MCPscheduler does not touch legacy claimTask when workers are disabled", async () => {
  const originalClaimTask = store.claimTask;
  let calls = 0;
  store.claimTask = async () => {
    calls += 1;
    throw new Error("legacy claim path should not be touched");
  };

  try {
    const scheduler = new MCPscheduler({
      agents: [],
      enableLegacyTaskWorkers: false,
    });
    await scheduler.processTicks();
    assert.equal(calls, 0);
  } finally {
    store.claimTask = originalClaimTask;
  }
});
