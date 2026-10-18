import test from "node:test";
import assert from "node:assert/strict";

import { createHandlerContext } from "../src/handlerContext.js";
import { initStorage, setStorage } from "../src/storage.js";

test("HandlerContext keeps Step local while preserving Packet correlation through Task projection", async () => {
  const storage = await initStorage({ type: "memory" });
  storage.clearCache();
  setStorage(storage);

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
