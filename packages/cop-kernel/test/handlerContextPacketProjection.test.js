import test from "node:test";
import assert from "node:assert/strict";

import { createHandlerContext } from "../src/handlerContext.js";
import { setStorage } from "../src/storage.js";

function createTaskStepStorageFixture() {
  const tasks = new Map();
  const steps = new Map();

  return {
    tasks: {
      async upsert(row) {
        tasks.set(row.id, structuredClone(row));
        return structuredClone(row);
      },
      async update(id, patch) {
        const current = tasks.get(id);
        const next = { ...current, ...structuredClone(patch) };
        tasks.set(id, next);
        return structuredClone(next);
      },
      async get(id) {
        return tasks.has(id) ? structuredClone(tasks.get(id)) : null;
      },
      async list() {
        return [...tasks.values()].map((row) => structuredClone(row));
      },
    },
    steps: {
      async upsert(row) {
        steps.set(row.id, structuredClone(row));
        return structuredClone(row);
      },
      async get(id) {
        return steps.has(id) ? structuredClone(steps.get(id)) : null;
      },
      async list() {
        return [...steps.values()].map((row) => structuredClone(row));
      },
      async update(taskId, id, patch) {
        const current = steps.get(id);
        if (!current || current.task_id !== taskId) return null;
        const next = { ...current, ...structuredClone(patch) };
        steps.set(id, next);
        return structuredClone(next);
      },
    },
  };
}

test("HandlerContext keeps Step local while preserving Packet correlation through Task projection", async () => {
  setStorage(createTaskStepStorageFixture());

  try {
    const context = createHandlerContext({
      msg: {
        message_id: "message-packet-step-001",
        from: "cop://source",
        to: "cop://handler",
        intent: "packet-step-test",
      },
    });

    const task = await context.startTask({
      taskType: "packet-projected-task",
      workerHandlerName: "handler:packet-step",
      packetRef: "packet-step-001",
      markStarted: false,
    });

    const step = await context.startStep(task, {
      name: "local-step",
      indexInTask: 0,
    });

    assert.equal(task.metadata.packet_ref, "packet-step-001");
    assert.equal(task.metadata.projection_of, "cognitive-packet");
    assert.equal(step.task_id, task.id);
    assert.equal(step.packetRef, "packet-step-001");
    assert.equal(step.packet_id, undefined);
    assert.equal(step.placements, undefined);
  } finally {
    setStorage(null);
  }
});
