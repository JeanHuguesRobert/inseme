// File: packages/cop-kernel/src/agentContext.js
// Description:
//   High-level helpers for implementing COP agents.

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
import { callAgentWithContinuation, resumeContinuationAndSend } from "./call.js";
import { postCopMessage } from "./transport.js";
import { COP_VERSION } from "./message.js";

/**
 * Create an AgentContext bound to a single COP_MESSAGE.
 *
 * @param {Object} params
 * @param {Object} params.msg
 * @param {string} [params.baseUrl]
 * @param {string} [params.endpoint]
 */
export function createAgentContext(params) {
  const { msg, baseUrl = null, endpoint = null } = params || {};
  if (!msg || typeof msg !== "object") {
    throw new Error("createAgentContext: 'msg' is required");
  }

  const correlationId = msg.correlation_id || msg.message_id || null;
  const fromAddr = msg.from || null;
  const toAddr = msg.to || null;

  async function log(stage, direction, payload, extraMetadata) {
    const metadata = {
      ...(extraMetadata || {}),
      agent_from: fromAddr,
      agent_to: toAddr,
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
      workerAgentName,
      sourceEntityId,
      sourceEntityType,
      idempotencyHash,
      channel,
      rootCorrelationId,
      priority,
      markStarted = true,
    } = options || {};

    const task = await createTask({
      taskType,
      workerAgentName,
      rootCorrelationId: rootCorrelationId || correlationId,
      channel: channel || msg.channel || null,
      sourceEntityId: sourceEntityId || null,
      sourceEntityType: sourceEntityType || null,
      idempotencyHash: idempotencyHash || null,
      priority: priority != null ? priority : 0,
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
    return createTaskStep({
      taskId: task.id,
      name,
      indexInTask,
      inputHash,
    });
  }

  async function completeTask(task, step) {
    if (step && step.id) {
      await markTaskStepCompleted(step.id);
    }
    if (task && task.id) {
      await markTaskCompleted(task.id);
    }
  }

  async function failTask(task, step, err) {
    const msgText = err && err.message ? err.message : String(err);
    if (step && step.id) {
      await markTaskStepFailed(step.id, msgText);
    }
    if (task && task.id) {
      await markTaskFailed(task.id, msgText);
    }
    await log("error", "internal", { error: msgText });
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
      agent: {
        networkId: null,
        nodeId: null,
        instanceId: null,
        agentName: toAddr,
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

  async function callAgent(options) {
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

    if (!to) throw new Error("callAgent: 'to' is required");
    if (!intent) throw new Error("callAgent: 'intent' is required");
    if (!resumeIntent) throw new Error("callAgent: 'resumeIntent' is required");

    return callAgentWithContinuation({
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
    callAgent,
    resumeContinuation,
  };
}
