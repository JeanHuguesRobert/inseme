// File: packages/cop-kernel/src/handlerContext.js
// Description:
//   High-level helpers for implementing COP handlers.

import { logCopDebug } from "./debugLog.js";
import {
  createTask,
  createTaskStep,
  markTaskStarted,
  markTaskCompleted,
  markTaskFailed,
  markTaskStepCompleted,
  markTaskStepFailed,
} from "./Cop-kerneltasks.js";
import { emitCopArtifact } from "./artifacts.js";
import { extractContinuationFromMessage } from "./continuation.js";
import { callHandlerWithContinuation, resumeContinuationAndSend } from "./call.js";
import { postCopMessage } from "./transport.js";
import { COP_VERSION } from "./message.js";

/**
 * Create a HandlerContext bound to a single COP_MESSAGE.
 *
 * @param {Object} params
 * @param {Object} params.msg
 * @param {string} [params.baseUrl]
 * @param {string} [params.endpoint]
 */
export function createHandlerContext(params) {
  const { msg, baseUrl = null, endpoint = null } = params || {};
  if (!msg || typeof msg !== "object") {
    throw new Error("createHandlerContext: 'msg' is required");
  }

  const correlationId = msg.correlation_id || msg.message_id || null;
  const fromAddr = msg.from || null;
  const toAddr = msg.to || null;

  async function log(stage, direction, payload, extraMetadata) {
    const metadata = {
      ...(extraMetadata || {}),
      handler_from: fromAddr,
      handler_to: toAddr,
      intent: msg.intent,
    };

    await logCopDebug({
      correlation_id: correlationId,
      message_id: msg.message_id || null,
      event_id: null,
      location: toAddr,
      stage,
      direction,
      payload,
      metadata,
    });
  }

  async function startTask(options) {
    const {
      taskType,
      workerHandlerName,
      sourceEntityId,
      sourceEntityType,
      idempotencyHash,
      channel,
      rootCorrelationId,
      priority,
      packetRef = null,
      metadata = {},
      markStarted = true,
    } = options || {};

    const task = await createTask({
      taskType,
      workerHandlerName,
      rootCorrelationId: rootCorrelationId || correlationId,
      channel: channel || msg.channel || null,
      sourceEntityId: sourceEntityId || null,
      sourceEntityType: sourceEntityType || null,
      idempotencyHash: idempotencyHash || null,
      priority: priority != null ? priority : 0,
      metadata: {
        ...metadata,
        ...(packetRef
          ? { packet_ref: packetRef, projection_of: "cognitive-packet" }
          : {}),
      },
    });

    if (markStarted) {
      await markTaskStarted(task.id);
    }

    return task;
  }

  async function startStep(task, options) {
    if (!task || !task.id) {
      throw new Error("startStep: 'task' with 'id' is required");
    }
    const { name, indexInTask = 0, inputHash } = options || {};
    const step = await createTaskStep({
      taskId: task.id,
      name,
      indexInTask,
      inputHash,
    });

    // A Step is deliberately local execution detail. Preserve Packet correlation
    // when the Task is a Packet projection, but do not grant the Step independent
    // routing/locality/claim authority. Autonomous work must become a downstream Packet.
    const packetRef = task.metadata?.packet_ref || null;
    if (packetRef) {
      step.packetRef = packetRef;
    }

    // Start wall-clock and CPU timing for this step
    step._timing = {
      wallStart: Date.now(),
      cpuStart: process.cpuUsage ? process.cpuUsage() : null,
    };

    return step;
  }

  async function completeTask(task, step) {
    if (step && step.id) {
      captureStepTiming(step);
      await markTaskStepCompleted(step.id);
    }
    if (task && task.id) {
      await markTaskCompleted(task.id);
    }
  }

  async function failTask(task, step, err) {
    const msgText = err && err.message ? err.message : String(err);
    if (step && step.id) {
      captureStepTiming(step);
      await markTaskStepFailed(step.id, msgText);
    }
    if (task && task.id) {
      await markTaskFailed(task.id, msgText);
    }
    await log("error", "internal", { error: msgText });
  }

  /**
   * Captures wall-clock and CPU time for a step.
   * Attaches `performance` data to the step for later use (e.g. when producing a continuation).
   */
  function captureStepTiming(step) {
    if (!step || !step._timing) return;

    const wallEnd = Date.now();
    const wallDurationMs = wallEnd - step._timing.wallStart;

    let cpuDuration = null;
    if (step._timing.cpuStart && process.cpuUsage) {
      const cpuEnd = process.cpuUsage(step._timing.cpuStart);
      cpuDuration = {
        user: cpuEnd.user / 1000, // microseconds to ms
        system: cpuEnd.system / 1000,
      };
    }

    step.performance = {
      wallDurationMs,
      cpu: cpuDuration,
      measuredAt: new Date().toISOString(),
    };

    // Clean up internal timer
    delete step._timing;
  }

  /**
   * When creating a continuation from the current step, attach the measured
   * performance (wall time + CPU) of the step that produced it.
   */
  function attachStepPerformanceToContinuation(continuation, step) {
    if (!step || !step.performance) return continuation;

    return {
      ...continuation,
      performance: {
        ...(continuation.performance || {}),
        producingStep: {
          wallDurationMs: step.performance.wallDurationMs,
          cpu: step.performance.cpu,
        },
      },
    };
  }

  async function emitArtifact(options) {
    const {
      artifactType,
      artifactKind,
      content,
      metadata,
      task,
      step,
      emitEvent = false,
      from = null,
      eventsPath = "/cop-events",
      copVersion = COP_VERSION,
      throwOnError = true,
    } = options || {};

    return emitCopArtifact({
      artifactType,
      artifactKind,
      correlationId,
      messageId: msg.message_id || null,
      eventId: null,
      taskId: task && task.id ? task.id : null,
      taskStepId: step && step.id ? step.id : null,
      handler: {
        networkId: null,
        nodeId: null,
        instanceId: null,
        handlerName: toAddr,
      },
      content,
      metadata: {
        ...(metadata || {}),
        source_intent: msg.intent,
      },
      emitEvent,
      from: from || toAddr,
      endpoint,
      baseUrl,
      eventsPath,
      copVersion,
      throwOnError,
    });
  }

  async function reply(options) {
    const {
      intent,
      payload,
      channel = msg.channel || null,
      metadata = {},
      from = null,
      copVersion = COP_VERSION,
    } = options || {};

    if (!intent) {
      throw new Error("reply: 'intent' is required");
    }

    const response = {
      cop_version: copVersion,
      message_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      correlation_id: correlationId,
      from: from || toAddr,
      to: fromAddr,
      intent,
      channel,
      payload,
      metadata: {
        ...metadata,
        in_reply_to: msg.message_id || null,
      },
      auth: null,
    };

    const res = await postCopMessage({ message: response, endpoint, baseUrl });
    return { ok: res.ok, response: res.response, error: res.error, message: response };
  }

  /**
   * Records that human input was requested at a certain time.
   * Returns a small object that can be used later to compute reaction time.
   */
  function recordHumanInputRequested(options = {}) {
    const requestedAt = new Date().toISOString();
    return {
      requestedAt,
      requestType: options.requestType || "decision",
      correlationId,
    };
  }

  /**
   * When a human decision arrives, attach the reaction time to the decision artifact/event.
   */
  function attachHumanReactionTime(decisionArtifact, requestedInfo) {
    if (!requestedInfo || !requestedInfo.requestedAt) return decisionArtifact;

    const reactedAt = new Date().toISOString();
    const reactionTimeMs =
      new Date(reactedAt).getTime() - new Date(requestedInfo.requestedAt).getTime();

    return {
      ...decisionArtifact,
      performance: {
        ...(decisionArtifact.performance || {}),
        humanReactionTimeMs: reactionTimeMs,
        requestedAt: requestedInfo.requestedAt,
        reactedAt,
      },
    };
  }

  async function callHandler(options) {
    const {
      to,
      intent,
      payload,
      channel = msg.channel || null,
      resumeTo = toAddr,
      resumeIntent,
      task,
      step,
    } = options || {};

    if (!to) throw new Error("callHandler: 'to' is required");
    if (!intent) throw new Error("callHandler: 'intent' is required");
    if (!resumeIntent) throw new Error("callHandler: 'resumeIntent' is required");

    return callHandlerWithContinuation({
      from: toAddr,
      to,
      intent,
      payload,
      channel,
      resumeTo,
      resumeIntent,
      correlationId,
      taskId: task && task.id ? task.id : null,
      stepId: step && step.id ? step.id : null,
      endpoint,
      baseUrl,
    });
  }

  async function resumeContinuation(result) {
    const continuation = extractContinuationFromMessage(msg);
    if (!continuation) {
      throw new Error("resumeContinuation: no continuation found in message.metadata");
    }

    return resumeContinuationAndSend({
      continuation,
      payload: result,
      from: toAddr,
      endpoint,
      baseUrl,
    });
  }

  return {
    msg,
    baseUrl,
    endpoint,
    correlationId,
    fromAddr,
    toAddr,

    log,

    // orchestration
    startTask,
    startStep,
    completeTask,
    failTask,

    // artifacts
    emitArtifact,

    // messaging
    reply,
    callHandler,
    resumeContinuation,
  };
}
