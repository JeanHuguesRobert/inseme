import assert from "assert";
import * as runner from "../ws-runner.js";
import store from "../cop/supabaseStore.js";

(async () => {
  let saved = [];
  const originalList = store.listTasks;
  const originalSave = store.saveTask;
  try {
    store.listTasks = async ({ _status }) => {
      return [
        {
          id: "task-1",
          status: "running",
          lease_expires_at: new Date(Date.now() - 1000).toISOString(),
          worker_id: "ws-runner-1",
        },
      ];
    };
    store.saveTask = async (j) => {
      saved.push(j);
      return j;
    };

    await runner.reclaimStaleLeases();

    assert.strictEqual(saved.length, 1, "Expect one task to be reclaimed");
    assert.strictEqual(saved[0].id, "task-1");
    assert.strictEqual(saved[0].worker_id, null);

    console.log("reclaimer test passed");
  } finally {
    store.listTasks = originalList;
    store.saveTask = originalSave;
  }
  process.exit(0);
})();
