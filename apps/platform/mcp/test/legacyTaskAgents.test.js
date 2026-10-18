import test from "node:test";
import assert from "node:assert/strict";

import * as ragAgent from "../agents/ragAgent.js";
import * as opheliaAgent from "../agents/opheliaAgent.js";

function withLegacyEnv(value, fn) {
  const key = "COP_ENABLE_LEGACY_TASK_WORKERS";
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
}

test("RAG agent does not feed legacy Task/Step queue when workers are disabled", async () => {
  await withLegacyEnv(undefined, async () => {
    let taskWrites = 0;
    let stepWrites = 0;
    const published = [];

    const store = {
      async saveTask() {
        taskWrites += 1;
        return { id: "legacy-task" };
      },
      async saveStep() {
        stepWrites += 1;
        return { id: "legacy-step" };
      },
    };
    const bus = {
      async publish(event) {
        published.push(event);
      },
    };

    await ragAgent.onEvent(
      {
        id: "event:rag-disabled",
        type: "user_message",
        topic_id: "topic:1",
        payload: { text: "question" },
      },
      { store, bus }
    );

    assert.equal(taskWrites, 0);
    assert.equal(stepWrites, 0);
    assert.equal(published.length, 0);
  });
});

test("Ophelia preserves fast reflex without feeding disabled legacy Task/Step queue", async () => {
  await withLegacyEnv(undefined, async () => {
    let taskWrites = 0;
    let stepWrites = 0;
    const published = [];

    const store = {
      async saveTask() {
        taskWrites += 1;
        return { id: "legacy-task" };
      },
      async saveStep() {
        stepWrites += 1;
        return { id: "legacy-step" };
      },
    };
    const bus = {
      async publish(event) {
        published.push(event);
      },
    };

    await opheliaAgent.onEvent(
      {
        id: "event:ophelia-disabled",
        type: "user_message",
        topic_id: "topic:1",
        payload: { text: "Bonjour" },
      },
      { store, bus }
    );

    assert.equal(taskWrites, 0);
    assert.equal(stepWrites, 0);
    assert.equal(published.length, 1);
    assert.equal(published[0].type, "assistant_reflex");
    assert.equal(published[0].topicId, "topic:1");
  });
});

test("legacy agent queue remains available only under explicit opt-in", async () => {
  await withLegacyEnv("1", async () => {
    let taskWrites = 0;
    let stepWrites = 0;
    const published = [];

    const store = {
      async saveTask(task) {
        taskWrites += 1;
        return {
          id: "legacy-task:1",
          attempts: 0,
          created_at: "2026-10-18T00:00:00.000Z",
          updated_at: "2026-10-18T00:00:00.000Z",
          ...task,
        };
      },
      async saveStep(step) {
        stepWrites += 1;
        return { id: "legacy-step:1", ...step };
      },
    };
    const bus = {
      async publish(event) {
        published.push(event);
      },
    };

    await opheliaAgent.onEvent(
      {
        id: "event:ophelia-enabled",
        type: "user_message",
        topic_id: "topic:1",
        payload: { text: "Legacy opt-in" },
      },
      { store, bus }
    );

    assert.equal(taskWrites, 1);
    assert.equal(stepWrites, 1);
    assert.ok(published.some((event) => event.type === "assistant_reflex"));
    assert.ok(published.some((event) => event.type === "task_state_changed"));
  });
});
