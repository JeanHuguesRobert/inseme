import bus from "../cop/supabaseBus.js";
import store from "../cop/supabaseStore.js";
import process from "node:process";
import { legacyTaskWorkersEnabled } from "../cop/legacyTaskRuntime.js";

export const name = "rag-agent";
export const taskTypes = ["rag_answer"];

export async function onEvent(event, ctx) {
  // This agent still uses the historical cop_task/cop_step queue.
  // Do not populate that queue unless its legacy workers were explicitly enabled.
  if (!legacyTaskWorkersEnabled(process?.env || {})) return;

  // Optionally respond to events to create tasks
  if (event.type === "user_message") {
    const _store = ctx?.store || store;
    const _bus = ctx?.bus || bus;
    const topicId = event.topic_id || event.payload?.topicId;
    if (!topicId) return;
    const sourceEventId = event.id || event.payload?.eventId || event.meta?.eventId || null;
    // Create rag task to generate an answer (idempotent via source_event_id)
    const task = await _store.saveTask({
      topic_id: topicId,
      type: "rag_answer",
      status: "pending",
      created_by: null,
      source_event_id: sourceEventId,
    });
    if (!task) return;
    await _store.saveStep({
      task_id: task.id,
      name: "search",
      status: "pending",
      input: { text: event.payload?.text || "" },
      created_by: null,
    });
    // Optionally publish task_state_changed if new
    const suggestNew = task && task.status === "pending" && task.attempts === 0;
    if (suggestNew)
      await _bus.publish({
        topicId,
        type: "task_state_changed",
        payload: { taskId: task.id, state: "pending" },
        createdBy: null,
      });
  }
}

export async function onTask(task, ctx) {
  if (!legacyTaskWorkersEnabled(process?.env || {})) return;
  if (!task || task.type !== "rag_answer") return;
  try {
    const _store = ctx?.store || store;
    const _bus = ctx?.bus || bus;
    const taskInDb = await _store.getTask(task.id);
    if (!taskInDb) return;
    const next = await _store.getNextPendingStep(task.id);
    if (!next) {
      const finalSteps = await _store.getSteps(task.id);
      const allDone = finalSteps.every((s) => s.status === "done");
      if (allDone) await _store.saveTask({ ...taskInDb, status: "done" });
      return;
    }
    await onStep(task, next, ctx);
  } catch (e) {
    console.error("ragAgent onTask error", e?.message || e);
    await (ctx?.store || store).saveTask({ ...task, status: "failed", meta: { error: e.message } });
  }
}

export async function onStep(task, step, ctx) {
  if (!legacyTaskWorkersEnabled(process?.env || {})) return;
  const _store = ctx?.store || store;
  const _bus = ctx?.bus || bus;
  try {
    if (step.status === "done") return;
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

    if (step.name === "search") {
      const searchedDocs = [{ id: "doc1", snippet: "Extrait de document sur le sujet" }];
      await _store.saveStep({
        id: step.id,
        task_id: task.id,
        name: step.name,
        status: "done",
        output: { docs: searchedDocs },
      });
    }
    if (step.name === "compose") {
      const composed = `RAG composed answer based on previous steps`;
      await _store.saveStep({
        id: step.id,
        task_id: task.id,
        name: step.name,
        status: "done",
        output: { text: composed },
      });
      const artifact = await _store.saveArtifact({
        topic_id: task.topic_id,
        source_task_id: task.id,
        source_step_id: step.id,
        type: "rag_answer",
        format: "text",
        payload: { text: composed },
        created_by: null,
      });
      if (artifact) {
        await _bus.publish({
          topicId: task.topic_id,
          type: "artifact_created",
          payload: { artifactId: artifact.id },
          createdBy: null,
        });
        await _bus.publish({
          topicId: task.topic_id,
          type: "assistant_update",
          payload: { text: artifact.payload?.text || "" },
          createdBy: null,
        });
      }
    }
  } catch (e) {
    console.error("ragAgent onStep error", e?.message || e);
    await _store.saveStep({
      id: step.id,
      task_id: task.id,
      status: "pending",
      attempts: (step.attempts || 0) + 1,
    });
  }
}

export default { name, taskTypes, onEvent, onTask, onStep };
