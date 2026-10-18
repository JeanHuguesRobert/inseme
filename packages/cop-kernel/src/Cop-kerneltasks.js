// File: src/tasks.js
// Description:
//   Task & step helpers

import { getStorage } from "./storage.js";

// Optional bus integration for genericity (events as the packet layer).
// Load it lazily: Netlify Edge bundles target ES2020, where top-level await is
// unavailable. Task APIs are already asynchronous, so resolving the optional
// dependency at the point of use preserves the same best-effort behaviour.
let defaultBus = null;
let defaultBusLoad = null;

function loadDefaultBus() {
  if (!defaultBusLoad) {
    defaultBusLoad = import("./bus.js")
      .then((busMod) => {
        defaultBus = busMod.defaultBus || null;
        return defaultBus;
      })
      .catch(() => null);
  }
  return defaultBusLoad;
}

function nowIso() {
  return new Date().toISOString();
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}


function unwrapStorageResult(result, entityKeys = []) {
  if (!result || typeof result !== "object") return result;
  if (result.ok === false) {
    const error = new Error(result.error || result.code || "storage operation failed");
    error.code = result.code || "STORAGE_OPERATION_FAILED";
    throw error;
  }
  for (const key of ["data", ...entityKeys]) {
    if (result[key] !== undefined) return result[key];
  }
  return result;
}

function unwrapStorageList(result, entityKeys = []) {
  const value = unwrapStorageResult(result, entityKeys);
  return Array.isArray(value) ? value : [];
}

/**
 * Internal helper to emit a COP event via the bus when available.
 * This is the key genericity mechanism: Task/Step lifecycles become first-class observable events
 * that the Scheduler, other handlers, JobScheduler, and audit can react to without app-level glue.
 */
async function emitTaskEvent(busOrScheduler, eventType, payload) {
  let targetBus = busOrScheduler;

  // Support passing a scheduler directly (common pattern)
  if (busOrScheduler && typeof busOrScheduler.getBusForTopic === "function") {
    const topicId = payload.topicId || payload.taskId || payload.data?.topicId;
    targetBus = busOrScheduler.getBusForTopic(topicId);
  } else if (!targetBus) {
    targetBus = defaultBus || (await loadDefaultBus());
  }

  if (!targetBus || typeof targetBus.publish !== "function") return;

  try {
    const eventData = { ...payload };
    // Further cop.packet.* wrapping of task events (as follow-up): include projection
    // when the payload looks like a continuation/task with resume info. This allows
    // routers/handlers to subscribe uniformly to cop.packet.* alongside cop.task.*
    if (payload && (payload.continuationId || payload.resumeTo || payload.waitForEvents)) {
      eventData.packet = asCognitivePacket({
        envelope: { packetKind: "task", taskId: payload.taskId, stepId: payload.stepId },
        payload,
        kind: "task",
      });
    }
    await targetBus.publish({
      type: `cop.task.${eventType}`,
      source: "cop-kernel/tasks",
      data: eventData,
      timestamp: nowIso(),
    });
  } catch (error) {
    console.warn(`[cop-kernel/tasks] Failed to emit event ${eventType}:`, error.message);
  }
}

/**
 * Crée un task.
 *
 * @param {Object} params
 * @param {string} params.taskType
 * @param {string} params.workerHandlerName
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
  const storage = await getStorage();
  const {
    taskType,
    workerHandlerName,
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
  if (!workerHandlerName) {
    throw new Error("createTask: 'workerHandlerName' is required");
  }

  const createdAt = nowIso();

  const row = {
    id: genId(),
    task_type: taskType,
    worker_handler_name: workerHandlerName,
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

  const inserted = unwrapStorageResult(await storage.tasks.upsert(row), ["task"]);

  await emitTaskEvent(null, "created", {
    taskId: inserted.id,
    taskType,
    workerHandlerName,
    rootCorrelationId,
    channel,
  });

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
  const storage = await getStorage();
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

  const inserted = unwrapStorageResult(await storage.steps.upsert(row), ["step"]);

  await emitTaskEvent(null, "step.created", {
    taskId,
    stepId: inserted.id,
    name,
    indexInTask,
  });

  return inserted;
}

// --- Changement d'état des tasks ---

export async function markTaskStarted(taskId) {
  const storage = await getStorage();
  const patch = {
    status: "running",
    started_at: nowIso(),
    updated_at: nowIso(),
  };
  const result = unwrapStorageResult(await storage.tasks.update(taskId, patch), ["task"]);

  await emitTaskEvent(null, "started", { taskId });

  return result;
}

export async function markTaskCompleted(taskId) {
  const storage = await getStorage();
  const patch = {
    status: "completed",
    completed_at: nowIso(),
    updated_at: nowIso(),
  };
  const result = unwrapStorageResult(await storage.tasks.update(taskId, patch), ["task"]);

  await emitTaskEvent(null, "completed", { taskId });

  return result;
}

export async function markTaskFailed(taskId, errorMessage) {
  const storage = await getStorage();
  const patch = {
    status: "failed",
    error_message: errorMessage || null,
    updated_at: nowIso(),
  };
  const result = unwrapStorageResult(await storage.tasks.update(taskId, patch), ["task"]);

  await emitTaskEvent(null, "failed", { taskId, errorMessage });

  return result;
}

// --- Changement d'état des steps (fixed & generic) ---

export async function markTaskStepCompleted(stepId) {
  const storage = await getStorage();
  const completedAt = nowIso();

  // Robust lookup: prefer direct get if available, fallback to list filter
  let step = null;
  if (typeof storage.steps.get === "function") {
    step = unwrapStorageResult(await storage.steps.get(stepId), ["step"]);
  } else if (typeof storage.steps.list === "function") {
    const all = unwrapStorageList(await storage.steps.list({ limit: 1000 }), ["steps"]);
    step = all.find((s) => s.id === stepId);
  }

  if (!step || !step.task_id) {
    throw new Error(`markTaskStepCompleted: could not resolve task_id for step ${stepId}`);
  }

  const patch = {
    status: "completed",
    completed_at: completedAt,
    updated_at: completedAt,
  };
  const result = unwrapStorageResult(
    await storage.steps.update(step.task_id, stepId, patch),
    ["step"]
  );

  await emitTaskEvent(null, "step.completed", { taskId: step.task_id, stepId });

  return result;
}

export async function markTaskStepFailed(stepId, errorMessage) {
  const storage = await getStorage();
  const updatedAt = nowIso();

  let step = null;
  if (typeof storage.steps.get === "function") {
    step = unwrapStorageResult(await storage.steps.get(stepId), ["step"]);
  } else if (typeof storage.steps.list === "function") {
    const all = unwrapStorageList(await storage.steps.list({ limit: 1000 }), ["steps"]);
    step = all.find((s) => s.id === stepId);
  }

  if (!step || !step.task_id) {
    throw new Error(`markTaskStepFailed: could not resolve task_id for step ${stepId}`);
  }

  const patch = {
    status: "failed",
    error_message: errorMessage || null,
    updated_at: updatedAt,
  };
  const result = unwrapStorageResult(
    await storage.steps.update(step.task_id, stepId, patch),
    ["step"]
  );

  await emitTaskEvent(null, "step.failed", { taskId: step.task_id, stepId, errorMessage });

  return result;
}

// --- Generic high-level orchestration helpers (genericity layer) ---
// CognitivePacket is the primary work identity. Task / Step / Job shapes below
// are optional projections or runtime scheduling views around that Packet.

/**
 * Create a CognitivePacket together with its initial durable Continuation.
 *
 * The Packet is the canonical work identity. The Continuation is a resumable
 * state bound to that Packet. Scheduling identifiers are runtime projections
 * and MUST NOT become competing work identities.
 */
export async function createPacketWithInitialContinuation(params) {
  const {
    packetId = `pkt-${genId()}`,
    packetKind = "work",
    packetEnvelope = {},
    placements = [],
    ithaca = null,
    status = "draft",
    resumeTo,
    resumeIntent,
    state = {},
    waitForEvents = [],
    resumeAfter = null,
    resumeBefore = null,
    retry = null,
    taskId = null,
    stepId = null,
    rootCorrelationId = null,
    meta = {},
    bus = null,
    emit = true,
  } = params || {};

  if (!resumeTo) {
    throw new Error("createPacketWithInitialContinuation: resumeTo is required");
  }

  const placementWitness = Array.isArray(placements)
    ? structuredClone(placements)
    : [];

  const { createContinuationDescriptor } = await import("./continuation.js");
  const continuation = createContinuationDescriptor({
    resumeTo,
    resumeIntent,
    taskId,
    stepId,
    state,
    waitForEvents,
    resumeAfter,
    resumeBefore,
    retry,
    correlationId: rootCorrelationId || undefined,
    packetRef: packetId,
    packetPlacementWitness: placementWitness.length > 0 ? placementWitness : null,
    meta: {
      ...meta,
      source: meta.source || "createPacketWithInitialContinuation",
    },
  });

  const packet = asCognitivePacket({
    kind: packetKind,
    envelope: {
      ...packetEnvelope,
      id: packetId,
      status,
      ithaca: ithaca ?? packetEnvelope.ithaca ?? undefined,
      placements: placementWitness,
    },
    payload: continuation,
    bus,
    emit,
  });

  return {
    packet,
    continuation: packet.payload,
    scheduleHint: {
      jobId: `packet-${packetId}`,
      type: "continuation",
      packetRef: packetId,
      continuation: packet.payload,
      schedule: retry ? { type: "exponentialBackoff", ...retry } : undefined,
    },
  };
}

/**
 * Compatibility facade: create a Task projection around a Packet-first
 * orchestration result. Existing callers keep their Task/Continuation shape,
 * but the Packet is the canonical work identity.
 */
export async function createTaskWithInitialContinuation(params) {
  const {
    taskType,
    workerHandlerName,
    resumeTo,
    resumeIntent,
    state = {},
    waitForEvents = [],
    resumeAfter = null,
    resumeBefore = null,
    retry = null,
    rootCorrelationId = null,
    channel = null,
    taskMetadata = {},
    packetId = `pkt-${genId()}`,
    packetKind = taskType || "work",
    packetEnvelope = {},
    placements = [],
    ithaca = null,
    packetStatus = "draft",
    bus = null,
    emit = true,
  } = params || {};

  if (!taskType || !workerHandlerName || !resumeTo) {
    throw new Error(
      "createTaskWithInitialContinuation: taskType, workerHandlerName and resumeTo are required"
    );
  }

  let task = null;
  try {
    task = await createTask({
      taskType,
      workerHandlerName,
      rootCorrelationId,
      channel,
      metadata: {
        ...taskMetadata,
        packet_ref: packetId,
        projection_of: "cognitive-packet",
      },
    });
  } catch (_error) {
    task = {
      id: genId(),
      task_type: taskType,
      worker_handler_name: workerHandlerName,
      status: "pending",
      metadata: {
        ...taskMetadata,
        packet_ref: packetId,
        projection_of: "cognitive-packet",
      },
      synthetic: true,
      note: "Task compatibility projection created in degraded mode (no persistent storage)",
    };
  }

  const packetFirst = await createPacketWithInitialContinuation({
    packetId,
    packetKind,
    packetEnvelope,
    placements,
    ithaca,
    status: packetStatus,
    resumeTo,
    resumeIntent,
    state,
    waitForEvents,
    resumeAfter,
    resumeBefore,
    retry,
    taskId: task?.id || null,
    rootCorrelationId,
    meta: {
      source: "createTaskWithInitialContinuation",
      taskSynthetic: !!task?.synthetic,
      taskProjectionId: task?.id || null,
    },
    bus,
    emit,
  });

  await emitTaskEvent(null, "orchestrated", {
    taskId: task?.id,
    packetId: packetFirst.packet.packet_id,
    continuationId: packetFirst.continuation.continuationId,
    syntheticTask: !!task?.synthetic,
  });

  return {
    task,
    packet: packetFirst.packet,
    continuation: packetFirst.continuation,
    scheduleHint: {
      ...packetFirst.scheduleHint,
      // Preserve the historical compatibility identifier for current callers.
      // packetRef remains the canonical work identity.
      jobId: `task-${task?.id || "synthetic"}`,
      taskId: task?.id || null,
      packetRef: packetFirst.packet.packet_id,
    },
  };
}

/**
 * Associate (or re-associate) an existing Continuation to a Task/Step.
 * Useful for generic resumption routing across RAIX/mesh nodes.
 */
export async function associateContinuationToTask(continuationId, taskId, stepId = null) {
  // In a fuller implementation this would emit a linking Event or update a join table.
  // For now, return a normalized descriptor that higher layers can use.
  // Future: persist via storage.tasks_continuations or equivalent.
  return {
    continuationId,
    taskId,
    stepId,
    associatedAt: nowIso(),
  };
}

/**
 * Thin helper to produce a "cognitive packet" style structure (envelope + payload)
 * around a Continuation or Task event, for alignment with the Cognitive Packet Switching
 * framing (see cogentia/research/cognitive_packet_switching.md and the continuation_packet_routing doc).
 *
 * The envelope is the routable part (inspectable by a "Cogentia router" / bus / scheduler
 * without full payload interpretation). The payload is the cognitive content (here the
 * continuation descriptor or task state).
 *
 * This is a convenience projection; the underlying COP model (Events + Artifacts + Bus publish
 * of typed events on (per-topic) sub-buses + federation) already provides the switching.
 * Routers subscribe to specific event types or use topic sub-buses / propagateInterest.
 *
 * Improvements (clean follow-up):
 * - Generates id + timestamp in envelope if absent (better defaults).
 * - Optional emission of `cop.packet.created` (and `cop.packet.routed` etc. by callers)
 *   so external "Cogentia router handlers" can subscribe uniformly without knowing
 *   internal task/job event shapes.
 * - Basic shape validation (warns on obvious misuse).
 */
export function asCognitivePacket({
  envelope = {},
  payload = {},
  kind = "continuation",
  bus = null,
  emit = true,
} = {}) {
  if (!payload || typeof payload !== "object") {
    console.warn("[asCognitivePacket] payload should be an object (continuation or task state)");
  }

  const now = nowIso();
  const id =
    envelope.id ||
    envelope.packet_id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "pkt-" + Date.now() + "-" + Math.random().toString(16).slice(2));

  const ithaca = envelope.ithaca || payload.ithaca || null;
  const status = envelope.status || "draft";
  const hops = envelope.hops ? [...envelope.hops] : [];
  const residue = envelope.residue ? [...envelope.residue] : [];
  const placements = Array.isArray(envelope.placements)
    ? structuredClone(envelope.placements)
    : Array.isArray(payload.placements)
      ? structuredClone(payload.placements)
      : [];

  const packagedPayload =
    payload && typeof payload === "object"
      ? structuredClone(payload)
      : payload;

  if (packagedPayload?.continuationId) {
    packagedPayload.packetRef = packagedPayload.packetRef || id;
    if (!packagedPayload.packetPlacementWitness && placements.length > 0) {
      packagedPayload.packetPlacementWitness = structuredClone(placements);
    }
  }

  const packet = {
    packet_id: id,
    placements,
    packetKind: kind,
    envelope: {
      protocol: "cognitive_packet.v0",
      packetKind: kind,
      id,
      createdAt: envelope.createdAt || now,
      status,
      ithaca,
      hops,
      residue,
      ...envelope,
      trace: envelope.trace || {
        correlationId: payload.correlationId || payload.continuationId || payload.id,
      },
    },
    payload: packagedPayload,
  };

  if (envelope.yield || payload.yield) {
    packet.yield = envelope.yield || payload.yield;
  }

  // Optional emission for uniform router subscription point.
  // Callers (or the bac-à-sable ctx wrapper) can pass a bus (e.g. topic-scoped).
  // Falls back to the module's defaultBus if available (same pattern as emitTaskEvent).
  if (emit) {
    const publish = (targetBus) => {
      if (!targetBus || typeof targetBus.publish !== "function") return;
      // Fire and forget; don't block the caller on router emission.
      targetBus
        .publish({
          type: "cop.packet.created",
          source: "cop-kernel/asCognitivePacket",
          data: { packet, kind },
          timestamp: now,
        })
        .catch((e) => console.warn("[asCognitivePacket] emit failed:", e.message));
    };
    const targetBus = bus || defaultBus;
    if (targetBus && typeof targetBus.publish === "function") {
      publish(targetBus);
    } else if (!bus) {
      void loadDefaultBus().then(publish);
    }
  }

  return packet;
}

/**
 * Record a hop traversed by a Cognitive Packet.
 *
 * @param {Object} packet
 * @param {Object} hopData
 * @param {string} [hopData.node_id]
 * @param {string} [hopData.instance_id]
 * @param {string} [hopData.route_reason]
 * @param {string} [hopData.interface]
 * @returns {Object} recorded hop
 */
export function recordPacketHop(packet, hopData = {}) {
  if (!packet || !packet.envelope) {
    throw new Error("recordPacketHop: invalid packet");
  }
  if (!Array.isArray(packet.envelope.hops)) {
    packet.envelope.hops = [];
  }
  const hopIndex = packet.envelope.hops.length;
  const hop = {
    hop_index: hopIndex,
    node_id: hopData.node_id || "local-node",
    instance_id: hopData.instance_id || "local-instance",
    interface: hopData.interface || "local",
    timestamp: hopData.timestamp || nowIso(),
    route_reason: hopData.route_reason || undefined,
    duration_ms: hopData.duration_ms || undefined,
    spending: hopData.spending || undefined,
  };
  packet.envelope.hops.push(hop);
  return hop;
}

/**
 * Mark a packet as 'solved' (local handler completed work and produced yield).
 *
 * @param {Object} packet
 * @param {Object} params
 * @param {Object} params.yieldData - { semantic_yield, operational_yield }
 * @param {string} [params.handlerId]
 * @param {string} [params.nodeId]
 * @param {number} [params.durationMs]
 * @param {string[]} [params.residue]
 * @param {Object} [params.bus]
 * @param {boolean} [params.emit=true]
 * @returns {Promise<Object>} updated packet
 */
export async function markPacketSolved(
  packet,
  { yieldData, handlerId, nodeId, durationMs, spending, residue, bus = null, emit = true } = {}
) {
  if (!packet || !packet.envelope) {
    throw new Error("markPacketSolved: invalid packet");
  }

  const now = nowIso();
  recordPacketHop(packet, {
    node_id: nodeId || "handler-node",
    instance_id: handlerId || "handler-instance",
    route_reason: "packet-solved",
    timestamp: now,
    duration_ms: durationMs,
    spending,
  });

  packet.envelope.status = "solved";
  packet.yield = yieldData || { semantic_yield: null, operational_yield: {} };

  if (Array.isArray(residue) && residue.length > 0) {
    if (!Array.isArray(packet.envelope.residue)) {
      packet.envelope.residue = [];
    }
    packet.envelope.residue.push(...residue);
  }

  if (emit) {
    const targetBus = bus || defaultBus || (await loadDefaultBus());
    if (targetBus && typeof targetBus.publish === "function") {
      await targetBus.publish({
        type: "cop.packet.solved",
        source: "cop-kernel/tasks",
        data: {
          packetId: packet.envelope.id,
          packet,
          yield: packet.yield,
          status: "solved",
        },
        timestamp: now,
      });
    }
  }

  return packet;
}

/**
 * Mark a packet as 'returned' (yield reached its identifiable Ithaca).
 *
 * @param {Object} packet
 * @param {Object} params
 * @param {string} [params.returnTarget]
 * @param {Object} [params.bus]
 * @param {boolean} [params.emit=true]
 * @returns {Promise<Object>} updated packet
 */
export async function markPacketReturned(packet, { returnTarget, bus = null, emit = true } = {}) {
  if (!packet || !packet.envelope) {
    throw new Error("markPacketReturned: invalid packet");
  }

  const now = nowIso();
  packet.envelope.status = "returned";
  if (returnTarget && packet.envelope.ithaca) {
    packet.envelope.ithaca.return_target = returnTarget;
  }

  recordPacketHop(packet, {
    node_id: "ithaca-node",
    instance_id: returnTarget || packet.envelope.ithaca?.return_target || "ithaca",
    route_reason: "yield-returned-to-ithaca",
    timestamp: now,
  });

  if (emit) {
    const targetBus = bus || defaultBus || (await loadDefaultBus());
    if (targetBus && typeof targetBus.publish === "function") {
      await targetBus.publish({
        type: "cop.packet.returned",
        source: "cop-kernel/tasks",
        data: {
          packetId: packet.envelope.id,
          packet,
          ithaca: packet.envelope.ithaca,
          yield: packet.yield,
          status: "returned",
        },
        timestamp: now,
      });
    }
  }

  return packet;
}

/**
 * Mark a packet as 'assimilated' (Ithaca incorporated yield into durable cognitive state).
 *
 * @param {Object} packet
 * @param {Object} params
 * @param {string} [params.substrate] - corpus name / durable memory identifier
 * @param {Object} [params.changes] - summary of durable changes
 * @param {Object} [params.bus]
 * @param {boolean} [params.emit=true]
 * @returns {Promise<Object>} updated packet
 */
export async function markPacketAssimilated(
  packet,
  { substrate = "corpus", changes = {}, bus = null, emit = true } = {}
) {
  if (!packet || !packet.envelope) {
    throw new Error("markPacketAssimilated: invalid packet");
  }

  const now = nowIso();
  packet.envelope.status = "assimilated";
  packet.assimilated_at = now;
  packet.assimilation = {
    substrate,
    changes,
    timestamp: now,
  };

  if (emit) {
    const targetBus = bus || defaultBus || (await loadDefaultBus());
    if (targetBus && typeof targetBus.publish === "function") {
      await targetBus.publish({
        type: "cop.packet.assimilated",
        source: "cop-kernel/tasks",
        data: {
          packetId: packet.envelope.id,
          packet,
          substrate,
          changes,
          status: "assimilated",
        },
        timestamp: now,
      });
    }
  }

  return packet;
}

/**
 * Mark a packet as 'cancelled' (execution aborted by caller/parent or cascade cancel).
 *
 * @param {Object} packet
 * @param {Object} params
 * @param {string} [params.reason="aborted"] - cancellation reason
 * @param {string} [params.nodeId]
 * @param {string} [params.instanceId]
 * @param {Object} [params.bus]
 * @param {boolean} [params.emit=true]
 * @returns {Promise<Object>} updated packet
 */
export async function markPacketCancelled(
  packet,
  { reason = "aborted", nodeId, instanceId, bus = null, emit = true } = {}
) {
  if (!packet || !packet.envelope) {
    throw new Error("markPacketCancelled: invalid packet");
  }

  const now = nowIso();
  recordPacketHop(packet, {
    node_id: nodeId || "control-node",
    instance_id: instanceId || "caller",
    route_reason: `packet-cancelled:${reason}`,
    timestamp: now,
  });

  packet.envelope.status = "cancelled";
  packet.cancellation = {
    reason,
    timestamp: now,
  };

  if (emit) {
    const targetBus = bus || defaultBus || (await loadDefaultBus());
    if (targetBus && typeof targetBus.publish === "function") {
      await targetBus.publish({
        type: "cop.packet.cancelled",
        source: "cop-kernel/tasks",
        data: {
          packetId: packet.envelope.id,
          packet,
          reason,
          status: "cancelled",
        },
        timestamp: now,
      });
    }
  }

  return packet;
}

/**
 * Mark a packet as 'failed' (handler error, timeout, or route failure).
 *
 * @param {Object} packet
 * @param {Object} params
 * @param {string|Error} params.error - error details or message
 * @param {string} [params.nodeId]
 * @param {string} [params.instanceId]
 * @param {Object} [params.bus]
 * @param {boolean} [params.emit=true]
 * @returns {Promise<Object>} updated packet
 */
export async function markPacketFailed(
  packet,
  { error, nodeId, instanceId, bus = null, emit = true } = {}
) {
  if (!packet || !packet.envelope) {
    throw new Error("markPacketFailed: invalid packet");
  }

  const now = nowIso();
  const errorMessage = error instanceof Error ? error.message : String(error || "unknown failure");

  recordPacketHop(packet, {
    node_id: nodeId || "handler-node",
    instance_id: instanceId || "handler",
    route_reason: `packet-failed:${errorMessage}`,
    timestamp: now,
  });

  packet.envelope.status = "failed";
  packet.failure = {
    error: errorMessage,
    timestamp: now,
  };

  if (emit) {
    const targetBus = bus || defaultBus || (await loadDefaultBus());
    if (targetBus && typeof targetBus.publish === "function") {
      await targetBus.publish({
        type: "cop.packet.failed",
        source: "cop-kernel/tasks",
        data: {
          packetId: packet.envelope.id,
          packet,
          error: errorMessage,
          status: "failed",
        },
        timestamp: now,
      });
    }
  }

  return packet;
}

/**
 * Mark a packet as 'paused_for_judgment' (waiting at human judgment boundary #80).
 *
 * @param {Object} packet
 * @param {Object} params
 * @param {string} [params.continuationId] - ID of the continuation ticket
 * @param {string} [params.reason="human_judgment_required"] - pause reason
 * @param {string} [params.barrier="code_modification"] - boundary barrier type
 * @param {Object} [params.pendingAction] - metadata about proposed action (e.g. diff, mandate)
 * @param {string} [params.nodeId]
 * @param {string} [params.instanceId]
 * @param {Object} [params.bus]
 * @param {boolean} [params.emit=true]
 * @returns {Promise<Object>} updated packet
 */
export async function markPacketPausedForJudgment(
  packet,
  {
    continuationId = genId(),
    reason = "human_judgment_required",
    barrier = "judgment_boundary",
    pendingAction = null,
    nodeId = "boundary-node",
    instanceId = "continuation-manager",
    bus = null,
    emit = true,
  } = {}
) {
  if (!packet || !packet.envelope) {
    throw new Error("markPacketPausedForJudgment: invalid packet");
  }

  const now = nowIso();
  recordPacketHop(packet, {
    node_id: nodeId,
    instance_id: instanceId,
    route_reason: `paused-at-judgment-barrier:${barrier}`,
    timestamp: now,
  });

  packet.envelope.status = "paused_for_judgment";
  packet.continuation = {
    continuationId,
    reason,
    barrier,
    pendingAction,
    paused_at: now,
  };

  if (emit) {
    const targetBus = bus || defaultBus || (await loadDefaultBus());
    if (targetBus && typeof targetBus.publish === "function") {
      await targetBus.publish({
        type: "cop.packet.paused",
        source: "cop-kernel/tasks",
        data: {
          packetId: packet.envelope.id,
          packet,
          continuationId,
          barrier,
          reason,
          status: "paused_for_judgment",
        },
        timestamp: now,
      });
    }
  }

  return packet;
}

/**
 * Resume a paused Cognitive Packet after continuation / human judgment resolution.
 *
 * @param {Object} packet
 * @param {Object} params
 * @param {string} [params.continuationId]
 * @param {string} [params.action="approve"] - "approve" | "reject" | "amend"
 * @param {string} [params.reviewer="human:reviewer"]
 * @param {string} [params.nodeId]
 * @param {string} [params.instanceId]
 * @param {Object} [params.bus]
 * @param {boolean} [params.emit=true]
 * @returns {Promise<Object>} updated packet
 */
export async function resumePacketFromContinuation(
  packet,
  {
    continuationId,
    action = "approve",
    reviewer = "human:reviewer",
    nodeId = "boundary-node",
    instanceId = "continuation-manager",
    bus = null,
    emit = true,
  } = {}
) {
  if (!packet || !packet.envelope) {
    throw new Error("resumePacketFromContinuation: invalid packet");
  }

  const now = nowIso();
  recordPacketHop(packet, {
    node_id: nodeId,
    instance_id: instanceId,
    route_reason: `continuation-resolved:${action}-by-${reviewer}`,
    timestamp: now,
  });

  packet.envelope.status = action === "reject" ? "cancelled" : "dispatched";
  if (!packet.continuation) {
    packet.continuation = {};
  }
  packet.continuation.resolution = {
    continuationId: continuationId || packet.continuation.continuationId,
    action,
    reviewer,
    resolved_at: now,
  };

  if (emit) {
    const targetBus = bus || defaultBus || (await loadDefaultBus());
    if (targetBus && typeof targetBus.publish === "function") {
      await targetBus.publish({
        type: "cop.packet.resumed",
        source: "cop-kernel/tasks",
        data: {
          packetId: packet.envelope.id,
          packet,
          action,
          reviewer,
          status: packet.envelope.status,
        },
        timestamp: now,
      });
    }
  }

  return packet;
}

/**
 * Reconstruct the Odyssey (complete journey trace) of a Cognitive Packet.
 *
 * @param {Object} packet - The Cognitive Packet
 * @param {Object} [opts]
 * @param {Array} [opts.events=[]] - Optional raw events recorded during the journey
 * @returns {Object} Structured Odyssey report
 */
export function reconstructOdyssey(packet, { events = [] } = {}) {
  if (!packet || !packet.envelope) {
    throw new Error("reconstructOdyssey: invalid packet");
  }

  const env = packet.envelope;
  const hops = env.hops || [];
  const status = env.status || "unknown";

  const departure = hops.length > 0 ? hops[0] : { timestamp: env.createdAt };
  const lastHop = hops.length > 0 ? hops[hops.length - 1] : null;

  return {
    packetId: env.id,
    intent: env.intent || packet.payload?.intent || packet.payload?.resumeIntent || "unspecified",
    ithaca: env.ithaca || null,
    lifecycle: {
      status,
      isSolved: status === "solved" || status === "returned" || status === "assimilated",
      isReturned: status === "returned" || status === "assimilated",
      isAssimilated: status === "assimilated",
      isPaused: status === "paused_for_judgment" || status === "paused",
      isCancelled: status === "cancelled",
      isFailed: status === "failed",
    },
    journey: {
      departureTimestamp: departure.timestamp,
      returnTimestamp:
        status === "returned" || status === "assimilated" ? lastHop?.timestamp : null,
      assimilatedTimestamp: packet.assimilated_at || null,
      hopsCount: hops.length,
      hopsChain: hops.map((h) => ({
        hopIndex: h.hop_index,
        node: h.node_id,
        instance: h.instance_id,
        reason: h.route_reason,
        timestamp: h.timestamp,
      })),
    },
    yield: packet.yield || null,
    assimilation: packet.assimilation || null,
    cancellation: packet.cancellation || null,
    failure: packet.failure || null,
    residue: env.residue || [],
    eventsCount: Array.isArray(events) ? events.length : 0,
  };
}

// --- Ergonomic aliases for higher handlers adopting COP (e.g. Ophelia "from now on") ---
// These provide the startStep/completeStep names referenced in integration code and docs,
// without introducing new implementation debt. They delegate to the storage-backed marks.

export { createTaskStep as startStep };
export { markTaskStepCompleted as completeStep };
export { markTaskStepFailed as failStep };

export { markTaskCompleted as completeTask };
export { markTaskFailed as failTask };
export { markTaskStarted as startTask };
