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
export async function copAll(packets,options={}) {
  if(!Array.isArray(packets)||packets.length===0)
    return {ok:true,status:"completed",yields:[],elapsedMs:0};
  const started=Date.now(),targetIds=new Set(packets.map(p=>p.envelope.id));
  if(targetIds.size!==packets.length)throw new Error('copAll duplicate packet ids');
  const yieldsMap=new Map(),terminal=new Set(),errors=[];
  const success=new Set(['solved','returned','assimilated']);
  const rejection=new Set(['failed','cancelled']);
  for(const p of packets){
    if(success.has(p.envelope.status)){
      terminal.add(p.envelope.id);yieldsMap.set(p.envelope.id,p.yield);
    }else if(rejection.has(p.envelope.status)){
      terminal.add(p.envelope.id);
      errors.push({packetId:p.envelope.id,
        error:p.failure?.error||p.cancellation?.reason||p.envelope.status});
    }
  }
  const partial=()=>packets.filter(p=>yieldsMap.has(p.envelope.id))
    .map(p=>yieldsMap.get(p.envelope.id));
  const settled=()=>{
    const yields=partial();
    return errors.length>0
      ?{ok:false,status:'failed',yields,
        error:errors.map(e=>e.error).join('; '),elapsedMs:Date.now()-started}
      :{ok:true,status:'completed',yields,
        combinedYield:typeof options.combiner==='function'?options.combiner(yields):yields,
        elapsedMs:Date.now()-started};
  };
  if(errors.length&&options.failFast!==false)return settled();
  if(terminal.size===targetIds.size)return settled();
  const bus=options.bus;
  if(!bus||typeof bus.subscribeAll!=='function')
    throw new Error('copAll: valid COPBus required for unresolved children');
  return new Promise(resolve=>{
    let timer=null,unsub=null,done=false;
    const cleanup=()=>{
      if(timer)clearTimeout(timer);
      if(typeof unsub==='function')unsub();
    };
    if(options.timeoutMs>0){
      timer=setTimeout(()=>{
        if(done)return;done=true;cleanup();
        resolve({ok:false,status:'timeout',yields:partial(),
          error:`copAll timed out after ${options.timeoutMs}ms`,elapsedMs:Date.now()-started});
      },options.timeoutMs);
    }
    unsub=bus.subscribeAll(event=>{
      const id=event.data?.packetId||event.data?.packet?.envelope?.id;
      if(!targetIds.has(id)||terminal.has(id)||done)return;
      const isSuccess=['cop.packet.solved','cop.packet.returned','cop.packet.assimilated']
        .includes(event.type);
      const isFailed=['cop.packet.failed','cop.packet.cancelled'].includes(event.type);
      if(!isSuccess&&!isFailed)return;
      terminal.add(id);
      if(isSuccess)yieldsMap.set(id,event.data?.yield||event.data?.packet?.yield);
      else errors.push({packetId:id,error:event.data?.error||event.data?.reason||
        event.data?.status||'child_failed'});
      if((isFailed&&options.failFast!==false)||terminal.size===targetIds.size){
        done=true;cleanup();resolve(settled());
      }
    });
  });
}

/**
 * Competitive Race (Promise.race equivalent): settles on first terminal
 * result, including failure. Cancelling competitors is an explicit COP
 * extension, never the default behavior of JavaScript Promise.race.
 */
export async function copRace(packets, options = {}) {
  if (!Array.isArray(packets) || packets.length === 0) {
    throw new Error("copRace requires a non-empty array of packets");
  }

  const startTime = Date.now();
  const targetIds = new Set(packets.map((p) => p.envelope.id));
  const autoCancelLosers = options.autoCancelLosers === true;

  // For packets already terminal before registration, use input order,
  // just like JS Promise.race([alreadySettledA, alreadySettledB]).
  for (const p of packets) {
    const success=["solved","returned","assimilated"].includes(p.envelope.status);
    const rejection=["failed","cancelled"].includes(p.envelope.status);
    if (success||rejection) {
      if (autoCancelLosers) {
        for (const loser of packets) {
          if (loser.envelope.id!==p.envelope.id &&
              ["dispatched","draft"].includes(loser.envelope.status)) {
            await markPacketCancelled(loser,{reason:"competitor_won_race",bus:options.bus});
          }
        }
      }
      return {
        ok:success,status:success?"completed":"failed",
        winnerPacketId:p.envelope.id,
        winningYield:success?p.yield:undefined,
        yields:success&&p.yield?[p.yield]:[],
        error:rejection?(p.failure?.error||p.cancellation?.reason||p.envelope.status):undefined,
        elapsedMs:Date.now()-startTime,
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
    let settled = false;

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

      const success=["cop.packet.solved","cop.packet.returned",
        "cop.packet.assimilated"].includes(event.type);
      const rejection=["cop.packet.failed","cop.packet.cancelled"].includes(event.type);
      if ((success||rejection)&&!settled) {
        settled=true;
        cleanup();
        const winningYield=success?(event.data?.yield||event.data?.packet?.yield):undefined;

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
          ok: success,
          status: success ? "completed" : "failed",
          winnerPacketId: packetId,
          winningYield,
          yields: success && winningYield ? [winningYield] : [],
          error: rejection ? (event.data?.error || event.data?.reason ||
            event.data?.status || "child_failed") : undefined,
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
