// File: src/tasks.js
// Description:
//   Task & step helpers

import { getStorage } from "./storage.js";

function nowIso() {
  return new Date().toISOString();
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

/**
 * Crée un task.
 *
 * @param {Object} params
 * @param {string} params.taskType
 * @param {string} params.workerAgentName
 * @param {string} [params.rootCorrelationId]
 * @param {string} [params.channel]
 * @param {string} [params.sourceEntityId]
 * @param {string} [params.sourceEntityType]
 * @param {string} [params.idempotencyHash]
 * @param {number} [params.priority=0]
 * @param {Object} [params.metadata]
 * @returns {Promise<object>} task créé (row renvoyée par storage)
 */
export async function createTask(params) {
  const storage = getStorage();
  const {
    taskType,
    workerAgentName,
    rootCorrelationId = null,
    channel = null,
    sourceEntityId = null,
    sourceEntityType = null,
    idempotencyHash = null,
    priority = 0,
    metadata = {},
  } = params || {};

  if (!taskType) {
    throw new Error("createTask: 'taskType' is required");
  }
  if (!workerAgentName) {
    throw new Error("createTask: 'workerAgentName' is required");
  }

  const createdAt = nowIso();

  const row = {
    id: genId(),
    task_type: taskType,
    worker_agent_name: workerAgentName,
    root_correlation_id: rootCorrelationId,
    channel,
    source_entity_id: sourceEntityId,
    source_entity_type: sourceEntityType,
    idempotency_hash: idempotencyHash,
    status: "pending",
    retry_count: 0,
    priority,
    metadata,
    created_at: createdAt,
    updated_at: createdAt,
    started_at: null,
    completed_at: null,
    error_message: null,
  };

  const inserted = await storage.tasks.upsert(row);
  return inserted;
}

/**
 * Crée une étape de task.
 *
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.name
 * @param {number} [params.indexInTask=0]
 * @param {string} [params.inputHash]
 * @returns {Promise<object>} step
 */
export async function createTaskStep(params) {
  const storage = getStorage();
  const { taskId, name, indexInTask = 0, inputHash = null } = params || {};

  if (!taskId) {
    throw new Error("createTaskStep: 'taskId' is required");
  }
  if (!name) {
    throw new Error("createTaskStep: 'name' is required");
  }

  const createdAt = nowIso();

  const row = {
    id: genId(),
    task_id: taskId,
    name,
    index_in_task: indexInTask,
    input_hash: inputHash,
    status: "pending",
    created_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    error_message: null,
  };

  const inserted = await storage.steps.upsert(row);
  return inserted;
}

// --- Changement d'état des tasks ---

export async function markTaskStarted(taskId) {
  const storage = getStorage();
  const patch = {
    status: "running",
    started_at: nowIso(),
    updated_at: nowIso(),
  };
  return storage.tasks.update(taskId, patch);
}

export async function markTaskCompleted(taskId) {
  const storage = getStorage();
  const patch = {
    status: "completed",
    completed_at: nowIso(),
    updated_at: nowIso(),
  };
  return storage.tasks.update(taskId, patch);
}

export async function markTaskFailed(taskId, errorMessage) {
  const storage = getStorage();
  const patch = {
    status: "failed",
    error_message: errorMessage || null,
    updated_at: nowIso(),
  };
  return storage.tasks.update(taskId, patch);
}

// --- Changement d'état des steps ---

export async function markTaskStepCompleted(stepId) {
  const storage = getStorage();
  const completedAt = nowIso();
  // storage.steps.update(taskId, stepId, patch) → on doit récupérer le taskId d'abord
  const step = await storage.steps.upsert({ id: stepId }); // ATTENTION : à adapter selon ton impl.
  const taskId = step.task_id;
  const patch = {
    status: "completed",
    completed_at: completedAt,
    updated_at: completedAt,
  };
  return storage.steps.update(taskId, stepId, patch);
}

export async function markTaskStepFailed(stepId, errorMessage) {
  const storage = getStorage();
  const updatedAt = nowIso();
  const step = await storage.steps.upsert({ id: stepId }); // idem, voir remarque
  const taskId = step.task_id;
  const patch = {
    status: "failed",
    error_message: errorMessage || null,
    updated_at: updatedAt,
  };
  return storage.steps.update(taskId, stepId, patch);
}
