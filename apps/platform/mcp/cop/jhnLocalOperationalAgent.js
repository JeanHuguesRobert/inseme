import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createJhnDelegatingAgent } from "./jhnDelegatingAgent.js";
import { createSqliteCopRuntimeStore } from "./sqliteRuntimeStore.js";
import { readJhnConversationState } from "./jhnConversationState.js";
import { decideJhnHandlerAssist } from "./jhnHandlerAssistDecider.js";

const DEFAULT_IDENTITY = Object.freeze({
  principal_ref: "principal:jhn",
  mandate_ref: "mandate:jhn:runtime:1",
  logical_agent_ref: "agent:jhn",
});

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
 * (`sqliteRuntimeStore.js`) already satisfies that contract in-process. The
 * capability-protected HTTP write gateway (`localRuntimeServer.js`) is a
 * transport-level ACL for raw single-table writes and is orthogonal to the
 * COP Mandate/budget governance `jhnDelegatingAgent` already enforces
 * against the event log; going in-process for the local, same-host
 * conversational surfaces does not weaken that governance and avoids
 * re-deriving mandate/budget state over a new network read protocol.
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
    execution_budget,
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
