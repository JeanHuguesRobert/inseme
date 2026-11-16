import type {
  CognitivePacket,
  PacketYield,
  PacketHop,
  ProvisionalSpending,
  IthacaTarget,
} from "./packet.js";

export interface CopForkParams {
  id?: string;
  kind: string;
  intent: string;
  routeTo?: string;
  requiredCapability?: string;
  payload: Record<string, unknown>;
  ithaca?: IthacaTarget;
  spawnReason?: string;
  mandate_id?: string;
}

export interface CopSettledItem {
  packetId: string;
  status: "solved" | "failed" | "cancelled" | "timeout";
  yield?: PacketYield;
  error?: string;
  spending?: ProvisionalSpending[];
  elapsedMs: number;
}

export interface CopCompositionResult<T = unknown> {
  ok: boolean;
  status: "completed" | "cancelled" | "failed" | "timeout";
  yields: PacketYield[];
  winnerPacketId?: string;
  winningYield?: PacketYield;
  combinedYield?: T;
  settledItems?: CopSettledItem[];
  residue?: Array<Record<string, unknown>>;
  totalSpending?: ProvisionalSpending[];
  error?: string;
  elapsedMs: number;
}

export type PacketExecutionHandler = (
  packet: CognitivePacket,
  signal?: { aborted: boolean }
) => Promise<{
  status: "solved" | "failed" | "cancelled";
  yield?: PacketYield;
  error?: string;
  spending?: ProvisionalSpending[];
}>;

/**
 * Creates child packets linked to the parent packet via lineage.
 */
export function forkChildPackets(
  parentPacket: CognitivePacket,
  forkDefs: CopForkParams[]
): CognitivePacket[] {
  const children: CognitivePacket[] = [];
  const childIds: string[] = [];

  for (let i = 0; i < forkDefs.length; i++) {
    const def = forkDefs[i];
    const childId = def.id || `${parentPacket.packet_id}:child:${i + 1}`;
    childIds.push(childId);

    children.push({
      packet_id: childId,
      status: "dispatched",
      created_at: new Date().toISOString(),
      mandate_id: def.mandate_id || parentPacket.mandate_id,
      hops: [
        {
          hop_index: 0,
          node_id: "composition-manager",
          instance_id: "cop:combinator",
          route_reason: def.spawnReason || "forked-child",
          timestamp: new Date().toISOString(),
        },
      ],
      payload: def.payload,
      ithaca: def.ithaca || parentPacket.ithaca,
      lineage: {
        upstream_packet_id: parentPacket.packet_id,
        spawn_reason: def.spawnReason || "forked-child",
      },
    });
  }

  // Update parent lineage
  parentPacket.lineage = {
    ...parentPacket.lineage,
    downstream_packet_ids: [...(parentPacket.lineage?.downstream_packet_ids || []), ...childIds],
  };

  return children;
}

/**
 * Parallel composition: all must succeed. Fails fast on first error/cancellation.
 */
export async function copAll(
  parentPacket: CognitivePacket,
  children: CognitivePacket[],
  executor: PacketExecutionHandler,
  options: { cancelRemaining?: boolean } = {}
): Promise<CopCompositionResult<PacketYield[]>> {
  const startTime = Date.now();
  const spendingList: ProvisionalSpending[] = [];
  const yieldsByIndex: Array<PacketYield | undefined> = new Array(children.length);
  const partial: PacketYield[] = [];
  let cancelled = false;

  try {
    const promises = children.map(async (child, index) => {
      const res = await executor(child, {
        get aborted() {
          return options.cancelRemaining === true && cancelled;
        },
      });
      if (res.spending) spendingList.push(...res.spending);

      if (res.status !== "solved") {
        cancelled = true;
        throw new Error(res.error || `Child ${child.packet_id} ended with status ${res.status}`);
      }
      if (res.yield) {
        yieldsByIndex[index] = res.yield;
        partial.push(res.yield);
      }
      return res;
    });

    await Promise.all(promises);
    const yields = yieldsByIndex.filter((y): y is PacketYield => y !== undefined);

    return {
      ok: true,
      status: "completed",
      yields,
      combinedYield: yields,
      totalSpending: spendingList,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: "failed",
      yields: partial,
      error: err.message,
      totalSpending: spendingList,
      elapsedMs: Date.now() - startTime,
    };
  }
}

/**
 * AllSettled composition: wait for every child to complete, preserve partial yields & residue.
 */
export async function copAllSettled(
  parentPacket: CognitivePacket,
  children: CognitivePacket[],
  executor: PacketExecutionHandler
): Promise<CopCompositionResult<CopSettledItem[]>> {
  const startTime = Date.now();
  const spendingList: ProvisionalSpending[] = [];
  const settledItems: CopSettledItem[] = new Array(children.length);
  const residueByIndex: Array<Record<string, unknown> | undefined> = new Array(children.length);
  const yieldsByIndex: Array<PacketYield | undefined> = new Array(children.length);

  const promises = children.map(async (child, index) => {
    const itemStart = Date.now();
    try {
      const res = await executor(child);
      if (res.spending) spendingList.push(...res.spending);

      const item: CopSettledItem = {
        packetId: child.packet_id,
        status: res.status,
        yield: res.yield,
        error: res.error,
        spending: res.spending,
        elapsedMs: Date.now() - itemStart,
      };
      settledItems[index] = item;
      if (res.status === "solved" && res.yield) {
        yieldsByIndex[index] = res.yield;
      } else {
        residueByIndex[index] = { packetId: child.packet_id, error: res.error, status: res.status };
      }
    } catch (err: any) {
      settledItems[index] = {
        packetId: child.packet_id,
        status: "failed",
        error: err.message,
        elapsedMs: Date.now() - itemStart,
      };
      residueByIndex[index] = { packetId: child.packet_id, error: err.message, status: "failed" };
    }
  });

  await Promise.all(promises);
  const yields = yieldsByIndex.filter((y): y is PacketYield => y !== undefined);
  const residue = residueByIndex.filter((r): r is Record<string, unknown> => r !== undefined);

  return {
    ok: true,
    status: "completed",
    yields,
    settledItems,
    combinedYield: settledItems,
    residue,
    totalSpending: spendingList,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * Race composition: first terminal result wins (succeed or fail). Loser
 * cancellation is opt-in, like an extension to native Promise.race.
 */
export async function copRace(
  parentPacket: CognitivePacket,
  children: CognitivePacket[],
  executor: PacketExecutionHandler,
  options: { cancelRemaining?: boolean } = {}
): Promise<CopCompositionResult> {
  const startTime = Date.now();
  const spendingList: ProvisionalSpending[] = [];
  const residue: Array<Record<string, unknown>> = [];
  let winnerFound = false;

  return new Promise((resolve) => {
    let completedCount = 0;

    for (const child of children) {
      executor(child, {
        get aborted() {
          return options.cancelRemaining === true && winnerFound;
        },
      })
        .then((res) => {
          if (res.spending) spendingList.push(...res.spending);
          completedCount++;

          if (!winnerFound) {
            winnerFound = true;
            resolve({
              ok: res.status === "solved",
              status: res.status === "solved" ? "completed" : "failed",
              yields: res.yield ? [res.yield] : [],
              winnerPacketId: child.packet_id,
              winningYield: res.yield,
              totalSpending: spendingList,
              elapsedMs: Date.now() - startTime,
            });
          } else {
            residue.push({ packetId: child.packet_id, lateYield: res.yield, status: res.status });
          }
        })
        .catch((err) => {
          completedCount++;
          if (!winnerFound) {
            winnerFound = true;
            resolve({
              ok: false,
              status: "failed",
              yields: [],
              winnerPacketId: child.packet_id,
              error: err.message,
              totalSpending: spendingList,
              elapsedMs: Date.now() - startTime,
            });
          }
        });
    }
  });
}

/**
 * Any composition: first SUCCESSFUL yield wins.
 * Individual failures do not abort; fails only if all candidates fail.
 */
export async function copAny(
  parentPacket: CognitivePacket,
  children: CognitivePacket[],
  executor: PacketExecutionHandler,
  options: { cancelRemaining?: boolean } = {}
): Promise<CopCompositionResult> {
  const startTime = Date.now();
  const spendingList: ProvisionalSpending[] = [];
  const errors: string[] = [];
  const residue: Array<Record<string, unknown>> = [];
  let winnerFound = false;

  return new Promise((resolve) => {
    let remaining = children.length;

    if (remaining === 0) {
      return resolve({
        ok: false,
        status: "failed",
        yields: [],
        error: "copAny: no child packets provided",
        elapsedMs: 0,
      });
    }

    for (const child of children) {
      executor(child, {
        get aborted() {
          return options.cancelRemaining === true && winnerFound;
        },
      })
        .then((res) => {
          if (res.spending) spendingList.push(...res.spending);
          remaining--;

          if (res.status === "solved" && res.yield && !winnerFound) {
            winnerFound = true;
            resolve({
              ok: true,
              status: "completed",
              yields: [res.yield],
              winnerPacketId: child.packet_id,
              winningYield: res.yield,
              residue,
              totalSpending: spendingList,
              elapsedMs: Date.now() - startTime,
            });
          } else {
            if (res.status !== "solved") {
              errors.push(res.error || `Child ${child.packet_id} failed`);
            }
            residue.push({ packetId: child.packet_id, status: res.status, error: res.error });
            if (remaining === 0 && !winnerFound) {
              resolve({
                ok: false,
                status: "failed",
                yields: [],
                error: `All ${children.length} candidates failed in copAny: ${errors.join("; ")}`,
                residue,
                totalSpending: spendingList,
                elapsedMs: Date.now() - startTime,
              });
            }
          }
        })
        .catch((err) => {
          remaining--;
          errors.push(err.message);
          residue.push({ packetId: child.packet_id, status: "failed", error: err.message });
          if (remaining === 0 && !winnerFound) {
            resolve({
              ok: false,
              status: "failed",
              yields: [],
              error: `All ${children.length} candidates failed in copAny: ${errors.join("; ")}`,
              residue,
              totalSpending: spendingList,
              elapsedMs: Date.now() - startTime,
            });
          }
        });
    }
  });
}

/**
 * Quorum composition: completes as soon as threshold is met (e.g. 2 of 3).
 * Terminates early if quorum becomes mathematically impossible.
 */
export async function copQuorum(
  parentPacket: CognitivePacket,
  children: CognitivePacket[],
  quorumThreshold: number,
  executor: PacketExecutionHandler
): Promise<CopCompositionResult<PacketYield[]>> {
  const startTime = Date.now();
  const spendingList: ProvisionalSpending[] = [];
  const successfulYields: PacketYield[] = [];
  const residue: Array<Record<string, unknown>> = [];
  let isDone = false;

  const total = children.length;
  let remaining = total;
  let successes = 0;
  let failures = 0;

  return new Promise((resolve) => {
    if (quorumThreshold > total) {
      return resolve({
        ok: false,
        status: "failed",
        yields: [],
        error: `Impossible quorum: required ${quorumThreshold} but only ${total} candidates exist`,
        elapsedMs: 0,
      });
    }

    for (const child of children) {
      executor(child, {
        get aborted() {
          return isDone;
        },
      })
        .then((res) => {
          if (res.spending) spendingList.push(...res.spending);
          remaining--;

          if (res.status === "solved" && res.yield) {
            successes++;
            successfulYields.push(res.yield);
          } else {
            failures++;
            residue.push({ packetId: child.packet_id, status: res.status, error: res.error });
          }

          if (!isDone) {
            // Check if quorum reached
            if (successes >= quorumThreshold) {
              isDone = true;
              return resolve({
                ok: true,
                status: "completed",
                yields: successfulYields,
                combinedYield: successfulYields,
                residue,
                totalSpending: spendingList,
                elapsedMs: Date.now() - startTime,
              });
            }

            // Check if quorum became impossible: max possible successes < threshold
            const maxPossibleSuccesses = successes + remaining;
            if (maxPossibleSuccesses < quorumThreshold) {
              isDone = true;
              return resolve({
                ok: false,
                status: "failed",
                yields: successfulYields,
                error: `Quorum impossible: required ${quorumThreshold}, reached ${successes}, only ${remaining} remaining`,
                residue,
                totalSpending: spendingList,
                elapsedMs: Date.now() - startTime,
              });
            }
          }
        })
        .catch((err) => {
          remaining--;
          failures++;
          residue.push({ packetId: child.packet_id, status: "failed", error: err.message });

          if (!isDone) {
            const maxPossibleSuccesses = successes + remaining;
            if (maxPossibleSuccesses < quorumThreshold) {
              isDone = true;
              return resolve({
                ok: false,
                status: "failed",
                yields: successfulYields,
                error: `Quorum impossible: required ${quorumThreshold}, reached ${successes}, only ${remaining} remaining (${err.message})`,
                residue,
                totalSpending: spendingList,
                elapsedMs: Date.now() - startTime,
              });
            }
          }
        });
    }
  });
}

/**
 * Fallback composition: try primary; on failure or rejection, try alternative sequentially.
 */
export async function copFallback(
  parentPacket: CognitivePacket,
  candidates: CognitivePacket[],
  executor: PacketExecutionHandler
): Promise<CopCompositionResult> {
  const startTime = Date.now();
  const spendingList: ProvisionalSpending[] = [];
  const residue: Array<Record<string, unknown>> = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const res = await executor(candidate);
      if (res.spending) spendingList.push(...res.spending);

      if (res.status === "solved" && res.yield) {
        return {
          ok: true,
          status: "completed",
          winnerPacketId: candidate.packet_id,
          winningYield: res.yield,
          yields: [res.yield],
          residue,
          totalSpending: spendingList,
          elapsedMs: Date.now() - startTime,
        };
      }

      residue.push({
        candidate_index: i,
        packetId: candidate.packet_id,
        status: res.status,
        error: res.error,
      });
    } catch (err: any) {
      residue.push({
        candidate_index: i,
        packetId: candidate.packet_id,
        status: "failed",
        error: err.message,
      });
    }
  }

  return {
    ok: false,
    status: "failed",
    yields: [],
    error: `All ${candidates.length} fallback candidates exhausted without success`,
    residue,
    totalSpending: spendingList,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * Sequential composition / Pipe: executes packets in sequence, passing yield forward.
 */
export async function copSequence(
  parentPacket: CognitivePacket,
  steps: Array<(previousYield?: PacketYield) => CognitivePacket>,
  executor: PacketExecutionHandler
): Promise<CopCompositionResult<PacketYield>> {
  const startTime = Date.now();
  const spendingList: ProvisionalSpending[] = [];
  const yields: PacketYield[] = [];
  let currentYield: PacketYield | undefined = undefined;

  for (let i = 0; i < steps.length; i++) {
    const stepFn = steps[i];
    const packet = stepFn(currentYield);
    packet.lineage = {
      upstream_packet_id: parentPacket.packet_id,
      spawn_reason: `sequence-step-${i + 1}`,
    };

    const res = await executor(packet);
    if (res.spending) spendingList.push(...res.spending);

    if (res.status !== "solved" || !res.yield) {
      return {
        ok: false,
        status: "failed",
        yields,
        error: res.error || `Step ${i + 1} (${packet.packet_id}) failed with status ${res.status}`,
        totalSpending: spendingList,
        elapsedMs: Date.now() - startTime,
      };
    }

    currentYield = res.yield;
    yields.push(currentYield);
  }

  return {
    ok: true,
    status: "completed",
    yields,
    combinedYield: currentYield,
    totalSpending: spendingList,
    elapsedMs: Date.now() - startTime,
  };
}
