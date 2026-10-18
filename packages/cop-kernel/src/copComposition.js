import {
  asCognitivePacket,
  recordPacketHop,
  markPacketSolved,
  markPacketReturned,
  markPacketCancelled,
  markPacketFailed,
} from "./Cop-kerneltasks.js";

/**
 * Spawns a child CognitivePacket from a parent packet with strict lineage and Ithaca routing.
 */
export function copFork(parentPacket, params, options = {}) {
  if (!parentPacket || !parentPacket.envelope) {
    throw new Error("copFork: valid parentPacket is required");
  }

  if (!parentPacket.envelope.lineage) {
    parentPacket.envelope.lineage = {};
  }
  if (!Array.isArray(parentPacket.envelope.lineage.downstream_packet_ids)) {
    parentPacket.envelope.lineage.downstream_packet_ids = [];
  }

  if (options.maxFanOut !== undefined) {
    if (!Number.isInteger(options.maxFanOut) || options.maxFanOut < 0) {
      throw new TypeError("copFork: maxFanOut must be an integer >= 0");
    }
    if (parentPacket.envelope.lineage.downstream_packet_ids.length >= options.maxFanOut) {
      const error = new Error(
        `copFork: fan-out limit reached for ${parentPacket.envelope.id} (maxFanOut=${options.maxFanOut})`
      );
      error.code = "PACKET_FANOUT_LIMIT_REACHED";
      error.packet_ref = parentPacket.envelope.id;
      error.max_fan_out = options.maxFanOut;
      throw error;
    }
  }

  const childId = params.id || `pkt-child-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  parentPacket.envelope.lineage.downstream_packet_ids.push(childId);

  const defaultIthaca = {
    description: `Parent Context (${parentPacket.envelope.id})`,
    return_target: parentPacket.envelope.id,
    response_channel: "internal.parent.channel",
    return_conditions: ["child-yield-produced"],
  };

  const childPacket = asCognitivePacket({
    kind: params.kind || "child-task",
    envelope: {
      id: childId,
      intent: params.intent || "Subordinate task intent",
      routeTo: params.routeTo || undefined,
      requiredCapability: params.requiredCapability || undefined,
      riskLevel: params.riskLevel || parentPacket.envelope.riskLevel || "read_only",
      status: "dispatched",
      ithaca: params.ithaca || defaultIthaca,
      lineage: {
        upstream_packet_id: parentPacket.envelope.id,
        spawn_reason: params.spawnReason || "fork",
      },
      residue: [],
    },
    payload: params.payload || {},
    bus: options.bus || parentPacket.bus,
    emit: options.emit !== false,
  });

  recordPacketHop(childPacket, {
    node_id: options.nodeId || "fork-coordinator",
    instance_id: options.instanceId || "parent-coordinator",
    route_reason: `child-fork-spawned:upstream=${parentPacket.envelope.id}`,
    interface: "internal-bus",
  });

  return childPacket;
}

/**
 * Parallel Fork-Join (Promise.all equivalent): waits for all given packets to resolve.
 */
export async function copAll(packets, options = {}) {
  if (!Array.isArray(packets) || packets.length === 0) {
    return { ok: true, status: "completed", yields: [], elapsedMs: 0 };
  }

  const startTime = Date.now();
  const targetIds = new Set(packets.map((p) => p.envelope.id));
  const yieldsMap = new Map();
  const errors = [];

  for (const p of packets) {
    if (
      p.envelope.status === "solved" ||
      p.envelope.status === "returned" ||
      p.envelope.status === "assimilated"
    ) {
      yieldsMap.set(p.envelope.id, p.yield);
    }
  }

  if (yieldsMap.size === targetIds.size) {
    const yields = packets.map((p) => yieldsMap.get(p.envelope.id));
    const combinedYield =
      typeof options.combiner === "function" ? options.combiner(yields) : yields;
    return {
      ok: true,
      status: "completed",
      yields,
      combinedYield,
      elapsedMs: Date.now() - startTime,
    };
  }

  const bus = options.bus;
  if (!bus || typeof bus.subscribeAll !== "function") {
    throw new Error("copAll: a valid COOBus instance is required when packets are unresolved");
  }

  return new Promise((resolve) => {
    let timeoutTimer = null;
    let unsub = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (typeof unsub === "function") unsub();
    };

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        cleanup();
        resolve({
          ok: false,
          status: "timeout",
          yields: Array.from(yieldsMap.values()),
          error: `copAll timed out after ${options.timeoutMs}ms`,
          elapsedMs: Date.now() - startTime,
        });
      }, options.timeoutMs);
    }

    unsub = bus.subscribeAll((event) => {
      const packetId = event.data?.packetId || event.data?.packet?.envelope?.id;
      if (!targetIds.has(packetId)) return;

      if (event.type === "cop.packet.solved" || event.type === "cop.packet.returned") {
        const yieldData = event.data?.yield || event.data?.packet?.yield;
        yieldsMap.set(packetId, yieldData);

        if (yieldsMap.size === targetIds.size) {
          cleanup();
          const yields = packets.map((p) => yieldsMap.get(p.envelope.id));
          const combinedYield =
            typeof options.combiner === "function" ? options.combiner(yields) : yields;
          resolve({
            ok: true,
            status: "completed",
            yields,
            combinedYield,
            elapsedMs: Date.now() - startTime,
          });
        }
      } else if (event.type === "cop.packet.failed") {
        errors.push({ packetId, error: event.data?.error });
        if (options.failFast) {
          cleanup();
          resolve({
            ok: false,
            status: "failed",
            yields: Array.from(yieldsMap.values()),
            error: event.data?.error || "child packet failed",
            elapsedMs: Date.now() - startTime,
          });
        }
      }
    });
  });
}

/**
 * Competitive Race (Promise.race equivalent): waits for first packet to resolve, cancels competitors.
 */
export async function copRace(packets, options = {}) {
  if (!Array.isArray(packets) || packets.length === 0) {
    throw new Error("copRace requires a non-empty array of packets");
  }

  const startTime = Date.now();
  const targetIds = new Set(packets.map((p) => p.envelope.id));
  const autoCancelLosers = options.autoCancelLosers !== false;

  for (const p of packets) {
    if (p.envelope.status === "solved" || p.envelope.status === "returned") {
      if (autoCancelLosers) {
        for (const loser of packets) {
          if (
            loser.envelope.id !== p.envelope.id &&
            (loser.envelope.status === "dispatched" || loser.envelope.status === "draft")
          ) {
            markPacketCancelled(loser, { reason: "competitor_won_race", bus: options.bus });
          }
        }
      }
      return {
        ok: true,
        status: "completed",
        winnerPacketId: p.envelope.id,
        winningYield: p.yield,
        yields: [p.yield],
        elapsedMs: Date.now() - startTime,
      };
    }
  }

  const bus = options.bus;
  if (!bus || typeof bus.subscribeAll !== "function") {
    throw new Error("copRace requires a valid COPBus instance");
  }

  return new Promise((resolve) => {
    let timeoutTimer = null;
    let unsub = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (typeof unsub === "function") unsub();
    };

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        cleanup();
        resolve({
          ok: false,
          status: "timeout",
          error: `copRace timed out after ${options.timeoutMs}ms`,
          yields: [],
          elapsedMs: Date.now() - startTime,
        });
      }, options.timeoutMs);
    }

    unsub = bus.subscribeAll(async (event) => {
      const packetId = event.data?.packetId || event.data?.packet?.envelope?.id;
      if (!targetIds.has(packetId)) return;

      if (event.type === "cop.packet.solved" || event.type === "cop.packet.returned") {
        cleanup();
        const winningYield = event.data?.yield || event.data?.packet?.yield;

        if (autoCancelLosers) {
          for (const loser of packets) {
            if (
              loser.envelope.id !== packetId &&
              (loser.envelope.status === "dispatched" || loser.envelope.status === "draft")
            ) {
              await markPacketCancelled(loser, { reason: "competitor_won_race", bus });
            }
          }
        }

        resolve({
          ok: true,
          status: "completed",
          winnerPacketId: packetId,
          winningYield,
          yields: [winningYield],
          elapsedMs: Date.now() - startTime,
        });
      }
    });
  });
}

/**
 * Sequential Pipeline (Promise.then equivalent): passes yield from step i into step i+1.
 */
export async function copSequence(initialPayload, steps = [], options = {}) {
  const startTime = Date.now();
  let currentPayload = initialPayload;
  let prevPacket = null;
  const history = [];

  for (let i = 0; i < steps.length; i++) {
    const stepFn = steps[i];
    const packet = await stepFn(currentPayload, prevPacket, i);
    history.push(packet);

    if (
      packet.envelope.status !== "solved" &&
      packet.envelope.status !== "returned" &&
      packet.envelope.status !== "assimilated"
    ) {
      return {
        ok: false,
        status: packet.envelope.status || "failed",
        error: `Step ${i} failed with status ${packet.envelope.status}`,
        history,
        elapsedMs: Date.now() - startTime,
      };
    }

    currentPayload = packet.yield?.semantic_yield;
    prevPacket = packet;
  }

  return {
    ok: true,
    status: "completed",
    finalYield: currentPayload,
    history,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * Cascades cancellation from parent packet to all active downstream child packets.
 */
export async function copCascadeCancel(parentPacket, childPackets = [], options = {}) {
  const reason = options.reason || "parent_cancelled";
  const bus = options.bus;

  await markPacketCancelled(parentPacket, { reason, bus });

  const cancelledChildren = [];
  for (const child of childPackets) {
    if (child.envelope.status === "dispatched" || child.envelope.status === "draft") {
      await markPacketCancelled(child, {
        reason: `cascade_from_upstream:${parentPacket.envelope.id}`,
        bus,
      });
      cancelledChildren.push(child);
    }
  }

  return {
    parent: parentPacket,
    cancelledChildren,
    totalCancelled: 1 + cancelledChildren.length,
  };
}
