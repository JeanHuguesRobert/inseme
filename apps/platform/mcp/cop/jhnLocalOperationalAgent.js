import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createEventSourcedExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";
import { createJhnDelegatingAgent } from "./jhnDelegatingAgent.js";
import { createSqliteCopRuntimeStore } from "./sqliteRuntimeStore.js";
import { readJhnConversationState } from "./jhnConversationState.js";
import { decideJhnHandlerAssist } from "./jhnHandlerAssistDecider.js";
import {
  JHN_AGENT_BUDGET_ID,
  JHN_AGENT_LOGICAL_AGENT_REF,
  JHN_AGENT_MANDATE_REF,
  JHN_AGENT_PRINCIPAL_REF,
  JHN_AGENT_TURN_DEMAND,
} from "./jhnLocalAgentAuthority.js";

const DEFAULT_IDENTITY = Object.freeze({
  principal_ref: JHN_AGENT_PRINCIPAL_REF,
  mandate_ref: JHN_AGENT_MANDATE_REF,
  logical_agent_ref: JHN_AGENT_LOGICAL_AGENT_REF,
});

/**
 * Read the already-declared local budget grant. This does not create one.
 * Without a matching ExecutionBudgetGrant the ledger fails closed.
 */
function eventSourcedAgentBudget(store) {
  return {
    budget_id: JHN_AGENT_BUDGET_ID,
    demand: JHN_AGENT_TURN_DEMAND,
    ledger: createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: JHN_AGENT_BUDGET_ID,
      require_authority_grant: true,
    }),
  };
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

/**
 * Shared local operational turn runner (Inseme #96).
 *
 * Binds the governed `jhnDelegatingAgent` (Inseme #33/#93/#95) directly to
 * the durable local SQLite COP event store, in-process, so `chat:jhn:local`,
 * `repl:jhn:local` and `console:jhn:local` share one orchestration path
 * instead of three parallel integrations.
 *
 * `jhnDelegatingAgent` calls `store.append(...)` synchronously and inspects
 * the result without awaiting it. The existing local SQLite event store
 * (`sqliteRuntimeStore.js`) already satisfies that contract in-process.
 *
 * Local trust boundary (Inseme #97): these same-host surfaces open the
 * SQLite file in-process. The transport ACL (`mandate:jhn:runtime:1`, signed
 * capabilities, `localRuntimeServer.js`) does not mediate those calls. The
 * process is inside the trusted host boundary and can read the state file
 * directly. COP normative Mandate and budget checks still mediate
 * consequential handler Acts. Do not generalize this assumption to a
 * deployed or public runtime.
 *
 * This factory references `mandate:jhn:agent:1`. It does not create, renew,
 * widen, or repair that mandate or its budget grant.
 */
export function createJhnLocalOperationalAgent({
  stateDirectory,
  reasoner,
  handler,
  decideHandlerAssist = decideJhnHandlerAssist,
  shouldDelegate,
  identity = DEFAULT_IDENTITY,
  execution_budget,
  cogentia,
  store,
} = {}) {
  if (!reasoner || typeof reasoner.respond !== "function") {
    throw new TypeError("reasoner.respond is required");
  }

  let database = null;
  let eventStore = store;
  let resolvedStateDirectory = null;
  if (!eventStore) {
    resolvedStateDirectory = path.resolve(requireText(stateDirectory, "stateDirectory"));
    database = new DatabaseSync(path.join(resolvedStateDirectory, "cop-runtime.sqlite"));
    eventStore = createSqliteCopRuntimeStore(database).eventStore;
  }

  const delegatingAgent = createJhnDelegatingAgent({
    store: eventStore,
    reasoner,
    handler,
    identity,
    decideHandlerAssist,
    shouldDelegate,
    execution_budget: execution_budget || eventSourcedAgentBudget(eventStore),
    cogentia,
  });

  return {
    identity: delegatingAgent.identity,
    cogentia: delegatingAgent.cogentia,

    /** Principal -> John turn; auto-loads durable history unless supplied. */
    async turn({ message, conversationId = "john", history, turnId } = {}) {
      const resolvedHistory =
        history ||
        (resolvedStateDirectory
          ? readJhnConversationState({ stateDirectory: resolvedStateDirectory, conversationId })
              .history
          : []);
      return delegatingAgent.turn({ message, conversationId, history: resolvedHistory, turnId });
    },

    close() {
      database?.close();
    },
  };
}
