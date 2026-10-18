const ACTIONS = Object.freeze({
  registerHandler: "cop.handlers.write",
  upsertLogicalAgent: "cop.logical-agents.write",
  upsertPacket: "cop.packets.write",
  upsertTask: "cop.tasks.write",
  upsertStep: "cop.steps.write",
  appendEvent: "cop.events.append",
  appendArtifact: "cop.artifacts.append",
});

export class CopAccessDeniedError extends Error {
  constructor(action, reason) {
    super(`COP access denied for ${action}: ${reason}`);
    this.name = "CopAccessDeniedError";
    this.code = "COP_ACCESS_DENIED";
  }
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function jsonText(value, fallback = {}) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function defaultIdFactory(prefix) {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("A runtime idFactory is required when crypto.randomUUID is unavailable");
  }
  return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

export function authorizeCopAction({ principal, mandate, action }) {
  const principalId = principal?.id;
  if (typeof principalId !== "string" || principalId.length === 0) {
    throw new CopAccessDeniedError(action, "missing principal identity");
  }
  if (!mandate || mandate.status !== "active") {
    throw new CopAccessDeniedError(action, "no active mandate");
  }
  if (mandate.granteeRef && mandate.granteeRef !== principalId) {
    throw new CopAccessDeniedError(action, "mandate belongs to another principal");
  }
  if (!Array.isArray(mandate.permissions) || !mandate.permissions.includes(action)) {
    throw new CopAccessDeniedError(action, "mandate does not grant this action");
  }
}

/**
 * Create the application-level COP write gateway.
 *
 * `executor.insert(table, row)` is deliberately small: a SQLite adapter, a
 * Supabase adapter, or a test adapter can supply it without changing mandate
 * evaluation. Entry adapters must authenticate their transport and pass the
 * resulting principal here; this module does not trust network location alone.
 */
export function createPortableCopRuntimeGateway({
  executor,
  authorize = authorizeCopAction,
  clock = () => new Date(),
  idFactory = defaultIdFactory,
} = {}) {
  if (!executor || typeof executor.insert !== "function") {
    throw new TypeError("executor.insert(table, row) is required");
  }

  const timestamp = () => clock().toISOString();
  const write = async (action, context, table, row) => {
    authorize({ ...context, action });
    return executor.insert(table, row);
  };
  const upsert = async (action, context, table, row, options = {}) => {
    authorize({ ...context, action });
    if (typeof executor.upsert !== "function") {
      throw new TypeError("executor.upsert(table, row, options) is required for mutable projections");
    }
    return executor.upsert(table, row, options);
  };

  return {
    async registerHandler(context, handler) {
      const now = timestamp();
      return write(ACTIONS.registerHandler, context, "cop_handlers", {
        handler_name: requireText(handler.handler_name ?? handler.handlerName, "handler_name"),
        handler_kind: requireText(handler.handler_kind ?? handler.handlerKind, "handler_kind"),
        module_ref: handler.module_ref ?? handler.moduleRef ?? null,
        enabled: handler.enabled === false ? 0 : 1,
        metadata: jsonText(handler.metadata),
        created_at: handler.created_at ?? now,
        updated_at: now,
      });
    },

    async upsertLogicalAgent(context, identity) {
      const now = timestamp();
      return write(ACTIONS.upsertLogicalAgent, context, "cop_logical_agents", {
        logical_agent_id: requireText(identity.logical_agent_id, "logical_agent_id"),
        logical_agent_name: requireText(identity.logical_agent_name, "logical_agent_name"),
        status: identity.status ?? "declared",
        twin_root_ref: identity.twin_root_ref ?? null,
        active_mandate_ref: identity.active_mandate_ref ?? null,
        metadata: jsonText(identity.metadata),
        created_at: identity.created_at ?? now,
        updated_at: now,
      });
    },

    async upsertPacket(context, packet) {
      const now = timestamp();
      const packetId = requireText(
        packet.packet_id ?? packet.id ?? packet.envelope?.id,
        "packet.packet_id"
      );
      const normalized = {
        ...packet,
        packet_id: packetId,
      };
      return upsert(ACTIONS.upsertPacket, context, "cop_packets", {
        id: packetId,
        status: packet.status ?? packet.envelope?.status ?? "draft",
        mandate_id: packet.mandate_id ?? packet.envelope?.mandate_id ?? null,
        packet_json: jsonText(normalized),
        created_at: packet.created_at ?? packet.envelope?.createdAt ?? now,
        updated_at: now,
      }, { conflictColumns: ["id"], preserveColumns: ["created_at"] });
    },

    async upsertTask(context, task) {
      const now = timestamp();
      return write(ACTIONS.upsertTask, context, "cop_tasks", {
        id: requireText(task.id, "task.id"),
        name: requireText(task.name, "task.name"),
        status: task.status ?? "pending",
        version: task.version ?? 1,
        input: task.input === undefined ? null : jsonText(task.input),
        output: task.output === undefined ? null : jsonText(task.output),
        metadata: jsonText(task.metadata),
        created_at: task.created_at ?? now,
        updated_at: now,
      });
    },

    async upsertStep(context, step) {
      const now = timestamp();
      return write(ACTIONS.upsertStep, context, "cop_steps", {
        id: requireText(step.id, "step.id"),
        task_id: requireText(step.task_id, "step.task_id"),
        name: requireText(step.name, "step.name"),
        status: step.status ?? "pending",
        input: step.input === undefined ? null : jsonText(step.input),
        output: step.output === undefined ? null : jsonText(step.output),
        metadata: jsonText(step.metadata),
        created_at: step.created_at ?? now,
        updated_at: now,
      });
    },

    async appendEvent(context, event) {
      const now = timestamp();
      return write(ACTIONS.appendEvent, context, "cop_events", {
        id: event.id ?? idFactory("event"),
        topic_id: event.topic_id ?? null,
        task_id: event.task_id ?? null,
        type: requireText(event.type, "event.type"),
        payload: jsonText(event.payload),
        metadata: jsonText(event.metadata ?? event.meta),
        occurred_at: event.occurred_at ?? now,
        recorded_at: now,
      });
    },

    async appendArtifact(context, artifact) {
      const now = timestamp();
      return write(ACTIONS.appendArtifact, context, "cop_artifacts", {
        id: artifact.id ?? idFactory("artifact"),
        topic_id: artifact.topic_id ?? null,
        correlation_id: artifact.correlation_id ?? null,
        message_id: artifact.message_id ?? null,
        event_id: artifact.event_id ?? null,
        task_id: artifact.task_id ?? null,
        task_step_id: artifact.task_step_id ?? null,
        network_id: artifact.network_id ?? null,
        node_id: artifact.node_id ?? null,
        instance_id: artifact.instance_id ?? null,
        handler_name: artifact.handler_name ?? null,
        artifact_type: requireText(artifact.artifact_type, "artifact.artifact_type"),
        artifact_kind: requireText(artifact.artifact_kind, "artifact.artifact_kind"),
        stability_level: artifact.stability_level ?? null,
        derives_from_artifact_id: artifact.derives_from_artifact_id ?? null,
        is_compacted: artifact.is_compacted ? 1 : 0,
        media_type: artifact.media_type ?? null,
        content_ref: artifact.content_ref ?? null,
        retention_policy: artifact.retention_policy ?? null,
        retention_expires_at: artifact.retention_expires_at ?? null,
        legal_hold: artifact.legal_hold ? 1 : 0,
        cache_key: artifact.cache_key ?? null,
        content: artifact.content === undefined ? null : jsonText(artifact.content),
        metadata: jsonText(artifact.metadata),
        created_at: artifact.created_at ?? now,
      });
    },
  };
}

export function createSupabasePortableExecutor(client) {
  if (!client || typeof client.from !== "function") {
    throw new TypeError("a Supabase client with from(table) is required");
  }
  return {
    async insert(table, row) {
      const { data, error } = await client.from(table).insert(row).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    async upsert(table, row, { conflictColumns = ["id"] } = {}) {
      const { data, error } = await client
        .from(table)
        .upsert(row, { onConflict: conflictColumns.join(",") })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export { ACTIONS };
