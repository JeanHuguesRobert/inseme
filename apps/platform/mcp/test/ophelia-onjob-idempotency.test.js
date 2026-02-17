import assert from "assert";
import * as opheliaAgent from "../agents/opheliaAgent.js";

(async () => {
  const stepsDb = [
    {
      id: "step-1",
      task_id: "task-1",
      name: "compose",
      status: "pending",
      input: { text: "input text" },
    },
  ];
  const artifacts = [];
  const mockStore = {
    getTask: async (_taskId) => ({ id: _taskId, topic_id: "t1", status: "running" }),
    getSteps: async (taskId) => stepsDb,
    saveStep: async (s) => {
      const idx = stepsDb.findIndex((x) => x.id === s.id);
      if (idx >= 0) stepsDb[idx] = { ...stepsDb[idx], ...s };
      return stepsDb[idx];
    },
    saveArtifact: async (a) => {
      const existing = artifacts.find(
        (x) =>
          x.source_task_id === a.source_task_id &&
          x.source_step_id === a.source_step_id &&
          x.type === a.type
      );
      if (existing) return existing;
      const newArt = { id: "art-" + (artifacts.length + 1), ...a };
      artifacts.push(newArt);
      return newArt;
    },
    listArtifacts: async () => artifacts,
    saveTask: async (task) => task,
    getNextPendingStep: async (taskId) => {
      return stepsDb.find((s) => s.task_id === taskId && s.status === "pending");
    },
  };
  const mockBus = { publish: async (e) => publishes.push(e) };
  const publishes = [];

  const task = { id: "task-1", type: "deep_reply", topic_id: "t1" };
  await opheliaAgent.onTask(task, { store: mockStore, bus: mockBus });
  await opheliaAgent.onTask(task, { store: mockStore, bus: mockBus });

  assert.strictEqual(artifacts.length, 1, "Expected only one artifact");
  assert.strictEqual(stepsDb[0].status, "done");

  console.log("onTask idempotency test passed");
})();
