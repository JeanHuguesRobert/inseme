/**
 * John as primary conversational surface with optional governed handler
 * delegation (Inseme #33 P1/P3).
 *
 * Provider/handler is never the conversational identity.
 * Optional Cogentia MCP client: Agent JHN (or subagent) attested write path.
 */

import { conversationTopic } from "./jhnConversationState.js";
import { loadCogentiaMcpClientFromEnv } from "./cogentiaMcpClient.js";
import {
  normalizeLegacyHandlerAssistDecision,
  normalizeReasonedHandlerAssistDecision,
  recordHandlerAssistDecision,
} from "./handlerAssistDecision.js";
import { requiredCapabilityOf, satisfiesCapabilityRequirement } from "./capabilityRequirement.js";
import { createEventSourcedExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";

function normalizeExecutionBudget(store, value) {
  if (!value || typeof value !== "object") return null;
  const ledger =
    value.ledger ||
    createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: value.budget_id,
      limits: value.limits,
      event_context: value.event_context,
    });
  for (const method of ["reserve", "settle", "release", "snapshot"]) {
    if (typeof ledger[method] !== "function") {
      throw new TypeError(`execution_budget.ledger.${method} is required`);
    }
  }
  if (!value.demand || typeof value.demand !== "object") {
    throw new TypeError("execution_budget.demand is required");
  }
  return { ledger, demand: value.demand, forecasts: value.forecasts || [] };
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

/**
 * @param {object} options
 * @param {object} options.store  local append-only COP store (memory)
 * @param {object} options.reasoner  { respond({message,history}) }
 * @param {object} [options.handler]  optional external capability { id, invoke }
 * @param {object} options.identity  principal/mandate/logical_agent refs
 * @param {(input: object) => object|Promise<object>} [options.decideHandlerAssist]
 * @param {(input: object) => boolean} [options.shouldDelegate]
 * @param {object} [options.cogentia]  createCogentiaMcpClient() or env-loaded client
 */
export function createJhnDelegatingAgent(options = {}) {
  const { store, reasoner, handler, identity, decideHandlerAssist, shouldDelegate } = options;
  if (!store || typeof store.append !== "function") {
    throw new TypeError("store.append is required");
  }
  if (!reasoner || typeof reasoner.respond !== "function") {
    throw new TypeError("reasoner.respond is required");
  }
  requireText(identity?.principal_ref, "identity.principal_ref");
  requireText(identity?.mandate_ref, "identity.mandate_ref");
  requireText(identity?.logical_agent_ref, "identity.logical_agent_ref");
  const executionBudget = normalizeExecutionBudget(store, options.execution_budget);

  const cogentia =
    options.cogentia ||
    loadCogentiaMcpClientFromEnv({
      actor: identity.logical_agent_ref?.startsWith("agent:jhn")
        ? identity.logical_agent_ref
        : "agent:jhn",
      mandate_ref: identity.mandate_ref,
      principal_ref: identity.principal_ref,
    });

  return {
    identity: {
      conversational: "John",
      logical_agent_ref: identity.logical_agent_ref,
      principal_ref: identity.principal_ref,
      mandate_ref: identity.mandate_ref,
    },
    /** Cogentia MCP (read + JHN-attested mutate when token configured). */
    cogentia,

    /**
     * Principal → John turn. Optional handler delegation under mandate.
     */
    async turn({ message, conversationId = "john", history = [], turnId } = {}) {
      requireText(message, "message");
      const topicId = conversationTopic(conversationId);

      store.append({
        event_type: "conversation.user_message",
        topic_id: topicId,
        epistemic_status: "observed",
        actor_ref: identity.principal_ref,
        subject_ref: identity.logical_agent_ref,
        visibility: "restricted",
        payload: {
          kind: "conversation.user_message",
          message,
          conversationId,
          conversational_identity: "John",
        },
        idempotency_key: `conv:${conversationId}:user:${Date.now()}`,
      });

      let handlerReceipt = null;
      let handlerText = null;
      const decisionKey = turnId || Date.now();
      const decisionContext = {
        decisionId: `decision:handler-assist:${conversationId}:${decisionKey}`,
        decidedAt: new Date().toISOString(),
      };
      let handlerAssistDecision;
      if (typeof decideHandlerAssist === "function") {
        handlerAssistDecision = normalizeReasonedHandlerAssistDecision(
          await decideHandlerAssist({ message, history }),
          decisionContext
        );
      } else if (typeof shouldDelegate === "function") {
        handlerAssistDecision = normalizeLegacyHandlerAssistDecision({
          ...decisionContext,
          wantsDelegate: Boolean(await shouldDelegate({ message, history })),
          capability: handler?.capability || "reasoning.assist",
        });
      } else {
        handlerAssistDecision = normalizeLegacyHandlerAssistDecision({
          ...decisionContext,
          wantsDelegate: Boolean(handler && /code|implement|fix|review/i.test(message)),
          capability: handler?.capability || "reasoning.assist",
          rationaleKind: "legacy_heuristic",
        });
      }
      recordHandlerAssistDecision({
        store,
        decision: handlerAssistDecision,
        topicId,
        actorRef: identity.logical_agent_ref,
        subjectRef: identity.principal_ref,
        idempotencyKey: `conv:${conversationId}:handler-assist-decision:${decisionKey}`,
      });
      const wantsDelegate = handlerAssistDecision.selected_path === "handler_assisted";

      if (wantsDelegate && !handler) {
        store.append({
          topic_id: topicId,
          epistemic_status: "observed",
          actor_ref: identity.logical_agent_ref,
          visibility: "restricted",
          payload: {
            kind: "conversation.delegation_refused",
            reason: "required_capability_unavailable",
            mandate_ref: identity.mandate_ref,
          },
          idempotency_key: `conv:${conversationId}:capability-unavailable:${turnId || Date.now()}`,
        });
      } else if (wantsDelegate && handler) {
        const requiredCapability = requiredCapabilityOf(handlerAssistDecision);
        if (
          !satisfiesCapabilityRequirement(handlerAssistDecision.capability_requirement, handler)
        ) {
          store.append({
            topic_id: topicId,
            epistemic_status: "observed",
            actor_ref: identity.logical_agent_ref,
            visibility: "restricted",
            payload: {
              kind: "conversation.delegation_refused",
              reason: "capability_requirement_mismatch",
              mandate_ref: identity.mandate_ref,
              capability: requiredCapability,
              handler_capability: handler.capability || null,
            },
            idempotency_key: `conv:${conversationId}:capability-mismatch:${turnId || Date.now()}`,
          });
        } else {
          const { invokeGovernedCapability, isMandateActive } =
            await import("../../../../packages/cop-core/src/governed-act.js");
          if (!isMandateActive(store, identity.mandate_ref)) {
            store.append({
              topic_id: topicId,
              epistemic_status: "observed",
              actor_ref: identity.logical_agent_ref,
              visibility: "restricted",
              payload: {
                kind: "conversation.delegation_refused",
                reason: "mandate_inactive",
                mandate_ref: identity.mandate_ref,
                capability: requiredCapability,
              },
              idempotency_key: `conv:${conversationId}:refused:${Date.now()}`,
            });
          } else if (!executionBudget) {
            store.append({
              topic_id: topicId,
              epistemic_status: "observed",
              actor_ref: identity.logical_agent_ref,
              visibility: "restricted",
              payload: {
                kind: "conversation.delegation_refused",
                reason: "execution_budget_required",
                mandate_ref: identity.mandate_ref,
                capability: requiredCapability,
              },
              idempotency_key: `conv:${conversationId}:budget-required:${turnId || Date.now()}`,
            });
          } else {
            const reservationKey = `jhn-delegation:${conversationId}:${turnId || Date.now()}`;
            const invResult = await invokeGovernedCapability({
              store,
              ledger: executionBudget.ledger,
              handler,
              identity: { ...identity, topic_id: topicId },
              capability: requiredCapability,
              input: { message, history },
              demand: executionBudget.demand,
              forecasts: executionBudget.forecasts,
              idempotency_key: reservationKey,
            });

            if (!invResult.ok && !invResult.called_provider) {
              store.append({
                topic_id: topicId,
                epistemic_status: "observed",
                actor_ref: identity.logical_agent_ref,
                visibility: "restricted",
                payload: {
                  kind: "conversation.delegation_refused",
                  reason: invResult.error,
                  mandate_ref: identity.mandate_ref,
                  capability: requiredCapability,
                  budget: invResult.snapshot,
                },
                idempotency_key: `conv:${conversationId}:budget-refused:${turnId || Date.now()}`,
              });
            } else {
              handlerReceipt = invResult;
              const trace = invResult.events?.find((event) => event.payload?.kind === "Trace");
              handlerText = trace?.payload?.effect?.text || trace?.payload?.effect?.summary || null;
            }
          }
        }
      }

      const result = await reasoner.respond({
        message,
        history,
        handlerAssist: handlerText,
        identity: "John",
      });

      const invokedHandlerInstanceRef = handlerReceipt?.receipt?.handler_instance_ref || null;

      store.append({
        event_type: "conversation.assistant_message",
        topic_id: topicId,
        epistemic_status: "observed",
        actor_ref: identity.logical_agent_ref,
        subject_ref: identity.principal_ref,
        visibility: "restricted",
        payload: {
          kind: "conversation.assistant_message",
          conversationId,
          responseId: result.responseId || null,
          message: result.text,
          conversational_identity: "John",
          handler_instance_ref: invokedHandlerInstanceRef,
          governed_act_id: handlerReceipt?.act_id || null,
        },
        idempotency_key: `conv:${conversationId}:assistant:${Date.now()}`,
      });

      return {
        text: result.text,
        responseId: result.responseId || null,
        conversational_identity: "John",
        handler_instance_ref: invokedHandlerInstanceRef,
        governed_act: handlerReceipt?.receipt || null,
      };
    },
  };
}
