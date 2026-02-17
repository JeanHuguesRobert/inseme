import bus from "../cop/supabaseBus.js";
import store from "../cop/supabaseStore.js";

// TODO: jhr, should get that from vault
const BOT_NAME = import.meta.env?.VITE_BOT_NAME || "Ophélia";

export const name = "ophelia-agent";
export const taskTypes = ["deep_reply"];

export async function onEvent(event, ctx) {
  try {
    if (!event || !event.type) return;
    const _bus = ctx?.bus || bus;
    const _store = ctx?.store || store;
    if (event.type === "user_message") {
      const topicId = event.topic_id || event.topicId || event.payload?.topicId;
      const userText = event.payload?.text || event.payload?.content || null;

      if (!topicId || !userText) return;

      // Idempotency: ensure we don't create duplicate tasks for same source event
      const sourceEventId = event.id || event.payload?.eventId || event.meta?.eventId || null;
      // Create a task for deep reply (write-ahead): persist task and step before publishing events
      const taskPayload = {
        topic_id: topicId,
        type: "deep_reply",
        status: "pending",
        created_by: null,
        source_event_id: sourceEventId,
      };
      const task = await _store.saveTask(taskPayload);
      if (!task) return;

      // Create initial step in idempotent way (task_id,name unique)
      await _store.saveStep({
        task_id: task.id,
        name: "compose",
        status: "pending",
        input: { text: userText },
        created_by: null,
      });

      // Fast reply (immediate small message) - publish *after* we persisted the intent
      const fastReply = `${BOT_NAME}: Merci — j'ai bien noté : ${userText.slice(0, 140)}`;
      await _bus.publish({
        topicId,
        type: "assistant_reflex",
        payload: { text: fastReply, kind: "fast" },
        createdBy: null,
      });

      // Publish task_state_changed event only if the task appears newly created (best-effort heuristic)
      const suggestNew =
        (task && task.status === "pending" && task.attempts === 0) ||
        (task && task.created_at && task.updated_at && task.created_at === task.updated_at);
      if (suggestNew) {
        await _bus.publish({
          topicId,
          type: "task_state_changed",
          payload: { taskId: task.id, state: task.status },
          createdBy: null,
        });
      }
    }
  } catch (e) {
    console.error("opheliaAgent.onEvent error", e.message);
  }
}

export async function onTick(_ctx) {
  // onTick does not claim or force-run tasks in distributed mode; only used for lightweight periodic work
  try {
    // Optionally handle lightweight background tasks or health checks
  } catch (e) {
    console.error("opheliaAgent.onTick error", e.message);
  }
}

export async function onTask(task, _ctx) {
  // Handle a single claimed task by delegating to onStep for sequential steps.
  try {
    if (!task || task.type !== "deep_reply") return;
    const _store = _ctx?.store || store;
    const next = await _store.getNextPendingStep(task.id);
    if (!next) {
      // no pending steps, maybe it's done
      const finalSteps = await _store.getSteps(task.id);
      const allDone = finalSteps.every((s) => s.status === "done");
      if (allDone) {
        await (_ctx?.store || store).saveTask({ id: task.id, status: "done" });
      }
      return;
    }
    // process single step via onStep
    await onStep(task, next, _ctx);
  } catch (e) {
    console.error("onTask error", e?.message || e);
    try {
      await (_ctx?.store || store).saveTask({
        id: task.id,
        status: "pending",
        last_error: e?.message || String(e),
        status_reason: "onTask failure",
      });
    } catch (_) {}
  }
}

export async function onStep(task, step, _ctx) {
  try {
    if (!task || task.type !== "deep_reply") return;
    const _bus = _ctx?.bus || bus;
    const _store = _ctx?.store || store;

    // Skip if already done (idempotency)
    const refreshed = await _store.getSteps(task.id);
    const current = refreshed.find((s) => s.id === step.id);
    if (current && current.status === "done") return;

    // mark running (write-ahead checkpoint)
    await _store.saveStep({
      id: step.id,
      task_id: task.id,
      name: step.name,
      status: "running",
      input: step.input,
    });
    await _bus.publish({
      topicId: task.topic_id,
      type: "task_step_started",
      payload: { taskId: task.id, stepId: step.id, stepName: step.name },
    });

    // process step
    const prompt = step.input?.text || "";
    const deepReply = `${BOT_NAME} (deep): Analyse complète de: ${prompt.slice(0, 200)}...`;

    // Persist artifact idempotently
    const artifact = await _store.saveArtifact({
      topic_id: task.topic_id,
      source_task_id: task.id,
      source_step_id: step.id,
      type: "final_summary",
      format: "text",
      payload: { text: deepReply },
      created_by: null,
    });

    // Save step result
    await _store.saveStep({
      id: step.id,
      task_id: task.id,
      name: step.name,
      status: "done",
      input: step.input,
      output: { text: deepReply },
      checkpoint: {},
    });

    // Publish results
    await _bus.publish({
      topicId: task.topic_id,
      type: "artifact_created",
      payload: { artifactId: artifact.id, taskId: task.id },
      createdBy: null,
    });
    await _bus.publish({
      topicId: task.topic_id,
      type: "assistant_update",
      payload: { text: deepReply, kind: "deep" },
      createdBy: null,
    });
    await _bus.publish({
      topicId: task.topic_id,
      type: "task_state_changed",
      payload: { taskId: task.id, state: "step_done" },
      createdBy: null,
    });
  } catch (e) {
    console.error("ophelia onStep error", e?.message || e);
    try {
      await (_ctx?.store || store).saveStep({
        id: step.id,
        task_id: task.id,
        status: "pending",
        attempts: (step.attempts || 0) + 1,
        checkpoint: step.checkpoint || {},
      });
    } catch (_) {}
  }
}

export default { name, taskTypes, onEvent, onTick, onTask, onStep };
