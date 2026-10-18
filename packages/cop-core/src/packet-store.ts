import type { CognitivePacket, PacketPlacement } from "./packet.js";

/**
 * Common interface for storage backends capable of holding Cognitive Packets.
 */
export function primaryPacketPlacement(
  packet: Pick<CognitivePacket, "packet_id" | "placements">,
  options: { required?: boolean } = {}
): PacketPlacement | null {
  const placements = packet.placements || [];
  const primaries = placements.filter((placement) => placement.is_primary === true);

  if (primaries.length > 1) {
    throw new Error(
      `Packet ${packet.packet_id} has ambiguous primary placements: ${primaries
        .map((placement) => placement.store_id)
        .join(", ")}`
    );
  }

  if (primaries.length === 0) {
    if (options.required) {
      throw new Error(`Packet ${packet.packet_id} has no primary placement`);
    }
    return null;
  }

  return primaries[0];
}

export interface PacketStore {
  readonly store_id: string;
  readonly store_kind: "sqlite" | "postgres" | "github" | "object_storage" | "memory";

  /**
   * Saves or updates a Cognitive Packet in this store.
   * Returns an updated PacketPlacement reflecting the store locator.
   */
  savePacket(packet: CognitivePacket): Promise<PacketPlacement>;

  /**
   * Retrieves a Cognitive Packet by its canonical packet_id.
   */
  getPacket(packet_id: string): Promise<CognitivePacket | null>;

  /**
   * Lists packets matching optional criteria.
   */
  listPackets(filter?: { status?: string; mandate_id?: string }): Promise<CognitivePacket[]>;

  /**
   * Checks if a packet exists in this store.
   */
  hasPacket(packet_id: string): Promise<boolean>;

  /**
   * Deletes a packet from this store (e.g. after archiving or migration).
   */
  deletePacket(packet_id: string): Promise<boolean>;
}

/**
 * Transfers a Cognitive Packet from a source store to a target store,
 * recording both placements in the packet's placement manifest.
 */
export async function transferPacket(
  packet_id: string,
  sourceStore: PacketStore,
  targetStore: PacketStore,
  options: { setTargetPrimary?: boolean } = {}
): Promise<{
  packet: CognitivePacket;
  sourcePlacement: PacketPlacement;
  targetPlacement: PacketPlacement;
}> {
  const packet = await sourceStore.getPacket(packet_id);
  if (!packet) {
    throw new Error(`Packet ${packet_id} not found in source store ${sourceStore.store_id}`);
  }

  const setPrimary = options.setTargetPrimary ?? true;

  const currentPrimary = primaryPacketPlacement(packet);
  if (currentPrimary && currentPrimary.store_id !== sourceStore.store_id) {
    throw new Error(
      `Packet ${packet_id} primary placement is ${currentPrimary.store_id}, not source store ${sourceStore.store_id}`
    );
  }

  // Save in target store
  const targetPlacement = await targetStore.savePacket({
    ...packet,
    placements: [
      ...(packet.placements || []).map((p) => (setPrimary ? { ...p, is_primary: false } : p)),
      {
        store_id: targetStore.store_id,
        store_kind: targetStore.store_kind,
        locator: `${targetStore.store_id}#${packet.packet_id}`,
        synchronized_at: new Date().toISOString(),
        is_primary: setPrimary,
      },
    ],
  });

  // Re-fetch the updated packet with all placement traces
  const updatedPacket = (await targetStore.getPacket(packet_id))!;

  const originalSourcePlacement = packet.placements?.find(
    (p) => p.store_id === sourceStore.store_id
  );
  const sourcePlacement: PacketPlacement = {
    ...(originalSourcePlacement || {
      store_id: sourceStore.store_id,
      store_kind: sourceStore.store_kind,
      locator: `${sourceStore.store_id}#${packet.packet_id}`,
    }),
    is_primary: setPrimary ? false : (originalSourcePlacement?.is_primary ?? true),
  };

  return {
    packet: updatedPacket,
    sourcePlacement,
    targetPlacement,
  };
}

function extractPacketId(packet: any): string {
  const id = packet.packet_id || packet.id || packet.envelope?.id;
  if (!id) {
    throw new Error("CognitivePacket is missing packet_id or id");
  }
  return id;
}

/**
 * In-Memory / Ephemeral Packet Store implementation.
 */
export function createMemoryPacketStore(store_id = "memory:default"): PacketStore {
  const storage = new Map<string, string>();

  return {
    store_id,
    store_kind: "memory",

    async savePacket(packet: CognitivePacket): Promise<PacketPlacement> {
      const packetId = extractPacketId(packet);
      const locator = `${store_id}#${packetId}`;
      const existingPlacements = packet.placements || [];
      const updatedPlacements: PacketPlacement[] = [
        ...existingPlacements.filter((p) => p.store_id !== store_id),
        {
          store_id,
          store_kind: "memory",
          locator,
          synchronized_at: new Date().toISOString(),
          is_primary:
            existingPlacements.length === 0 ||
            existingPlacements.some((p) => p.store_id === store_id && p.is_primary),
        },
      ];

      const toStore: CognitivePacket = {
        ...packet,
        packet_id: packetId,
        placements: updatedPlacements,
      };

      storage.set(packetId, JSON.stringify(toStore));
      return updatedPlacements.find((p) => p.store_id === store_id)!;
    },

    async getPacket(packet_id: string): Promise<CognitivePacket | null> {
      const raw = storage.get(packet_id);
      return raw ? JSON.parse(raw) : null;
    },

    async listPackets(filter = {}): Promise<CognitivePacket[]> {
      const results: CognitivePacket[] = [];
      for (const raw of storage.values()) {
        const p: CognitivePacket = JSON.parse(raw);
        if (filter.status && p.status !== filter.status) continue;
        if (filter.mandate_id && p.mandate_id !== filter.mandate_id) continue;
        results.push(p);
      }
      return results;
    },

    async hasPacket(packet_id: string): Promise<boolean> {
      return storage.has(packet_id);
    },

    async deletePacket(packet_id: string): Promise<boolean> {
      return storage.delete(packet_id);
    },
  };
}

/**
 * SQLite / Local node store implementation wrapper.
 */
export function createSqlitePacketStore(
  store_id: string,
  options: {
    executeSql?: (query: string, params: unknown[]) => Promise<any>;
    inMemoryMap?: Map<string, string>;
  } = {}
): PacketStore {
  // Use in-memory map or provided SQL execution abstraction
  const localMap = options.inMemoryMap || new Map<string, string>();

  return {
    store_id,
    store_kind: "sqlite",

    async savePacket(packet: CognitivePacket): Promise<PacketPlacement> {
      const packetId = extractPacketId(packet);
      const locator = `sqlite://${store_id}/packets/${packetId}`;
      const existingPlacements = packet.placements || [];
      const updatedPlacements: PacketPlacement[] = [
        ...existingPlacements.filter((p) => p.store_id !== store_id),
        {
          store_id,
          store_kind: "sqlite",
          locator,
          synchronized_at: new Date().toISOString(),
          is_primary:
            existingPlacements.length === 0 ||
            existingPlacements.some((p) => p.store_id === store_id && p.is_primary),
        },
      ];

      const toStore: CognitivePacket = {
        ...packet,
        packet_id: packetId,
        placements: updatedPlacements,
      };

      localMap.set(packetId, JSON.stringify(toStore));
      return updatedPlacements.find((p) => p.store_id === store_id)!;
    },

    async getPacket(packet_id: string): Promise<CognitivePacket | null> {
      const raw = localMap.get(packet_id);
      return raw ? JSON.parse(raw) : null;
    },

    async listPackets(filter = {}): Promise<CognitivePacket[]> {
      const results: CognitivePacket[] = [];
      for (const raw of localMap.values()) {
        const p: CognitivePacket = JSON.parse(raw);
        if (filter.status && p.status !== filter.status) continue;
        if (filter.mandate_id && p.mandate_id !== filter.mandate_id) continue;
        results.push(p);
      }
      return results;
    },

    async hasPacket(packet_id: string): Promise<boolean> {
      return localMap.has(packet_id);
    },

    async deletePacket(packet_id: string): Promise<boolean> {
      return localMap.delete(packet_id);
    },
  };
}

/**
 * PostgreSQL / Supabase store implementation wrapper.
 */
export function createPostgresPacketStore(
  store_id: string,
  options: {
    supabaseClient?: any;
    inMemoryFallback?: Map<string, string>;
  } = {}
): PacketStore {
  const fallback = options.inMemoryFallback || new Map<string, string>();

  return {
    store_id,
    store_kind: "postgres",

    async savePacket(packet: CognitivePacket): Promise<PacketPlacement> {
      const packetId = extractPacketId(packet);
      const locator = `postgres://${store_id}/public.cop_packets/${packetId}`;
      const existingPlacements = packet.placements || [];
      const updatedPlacements: PacketPlacement[] = [
        ...existingPlacements.filter((p) => p.store_id !== store_id),
        {
          store_id,
          store_kind: "postgres",
          locator,
          synchronized_at: new Date().toISOString(),
          is_primary:
            existingPlacements.length === 0 ||
            existingPlacements.some((p) => p.store_id === store_id && p.is_primary),
        },
      ];

      const toStore: CognitivePacket = {
        ...packet,
        packet_id: packetId,
        placements: updatedPlacements,
      };

      if (options.supabaseClient) {
        await options.supabaseClient.from("cop_packets").upsert({
          id: packetId,
          packet_json: toStore,
          status: packet.status || "draft",
          updated_at: new Date().toISOString(),
        });
      } else {
        fallback.set(packetId, JSON.stringify(toStore));
      }

      return updatedPlacements.find((p) => p.store_id === store_id)!;
    },

    async getPacket(packet_id: string): Promise<CognitivePacket | null> {
      if (options.supabaseClient) {
        const { data } = await options.supabaseClient
          .from("cop_packets")
          .select("packet_json")
          .eq("id", packet_id)
          .maybeSingle();
        return data?.packet_json || null;
      }
      const raw = fallback.get(packet_id);
      return raw ? JSON.parse(raw) : null;
    },

    async listPackets(filter = {}): Promise<CognitivePacket[]> {
      if (options.supabaseClient) {
        let query = options.supabaseClient.from("cop_packets").select("packet_json");
        if (filter.status) query = query.eq("status", filter.status);
        const { data } = await query;
        return (data || []).map((row: any) => row.packet_json);
      }
      const results: CognitivePacket[] = [];
      for (const raw of fallback.values()) {
        const p: CognitivePacket = JSON.parse(raw);
        if (filter.status && p.status !== filter.status) continue;
        if (filter.mandate_id && p.mandate_id !== filter.mandate_id) continue;
        results.push(p);
      }
      return results;
    },

    async hasPacket(packet_id: string): Promise<boolean> {
      if (options.supabaseClient) {
        const { count } = await options.supabaseClient
          .from("cop_packets")
          .select("id", { count: "exact", head: true })
          .eq("id", packet_id);
        return Boolean(count && count > 0);
      }
      return fallback.has(packet_id);
    },

    async deletePacket(packet_id: string): Promise<boolean> {
      if (options.supabaseClient) {
        const { error } = await options.supabaseClient
          .from("cop_packets")
          .delete()
          .eq("id", packet_id);
        return !error;
      }
      return fallback.delete(packet_id);
    },
  };
}

/**
 * GitHub / Git Tree store implementation wrapper (Phase 4).
 * Stores packet representations as Git blobs/files or issue projections.
 */
export function createGithubPacketStore(
  store_id: string,
  options: {
    repo?: string;
    branch?: string;
    inMemoryFallback?: Map<string, string>;
  } = {}
): PacketStore {
  const fallback = options.inMemoryFallback || new Map<string, string>();
  const repo = options.repo || "JeanHuguesRobert/inseme";
  const branch = options.branch || "main";

  return {
    store_id,
    store_kind: "github",

    async savePacket(packet: CognitivePacket): Promise<PacketPlacement> {
      const locator = `github://${repo}/${branch}/packets/${packet.packet_id}.json`;
      const existingPlacements = packet.placements || [];
      const updatedPlacements: PacketPlacement[] = [
        ...existingPlacements.filter((p) => p.store_id !== store_id),
        {
          store_id,
          store_kind: "github",
          locator,
          synchronized_at: new Date().toISOString(),
          is_primary:
            existingPlacements.length === 0 ||
            existingPlacements.some((p) => p.store_id === store_id && p.is_primary),
        },
      ];

      const toStore: CognitivePacket = {
        ...packet,
        placements: updatedPlacements,
      };

      fallback.set(packet.packet_id, JSON.stringify(toStore));
      return updatedPlacements.find((p) => p.store_id === store_id)!;
    },

    async getPacket(packet_id: string): Promise<CognitivePacket | null> {
      const raw = fallback.get(packet_id);
      return raw ? JSON.parse(raw) : null;
    },

    async listPackets(filter = {}): Promise<CognitivePacket[]> {
      const results: CognitivePacket[] = [];
      for (const raw of fallback.values()) {
        const p: CognitivePacket = JSON.parse(raw);
        if (filter.status && p.status !== filter.status) continue;
        if (filter.mandate_id && p.mandate_id !== filter.mandate_id) continue;
        results.push(p);
      }
      return results;
    },

    async hasPacket(packet_id: string): Promise<boolean> {
      return fallback.has(packet_id);
    },

    async deletePacket(packet_id: string): Promise<boolean> {
      return fallback.delete(packet_id);
    },
  };
}

/**
 * Archive / Cold Object Storage store implementation wrapper (Phase 6).
 */
export function createArchivePacketStore(
  store_id: string,
  options: {
    bucketName?: string;
    inMemoryFallback?: Map<string, string>;
  } = {}
): PacketStore {
  const fallback = options.inMemoryFallback || new Map<string, string>();
  const bucket = options.bucketName || "cop-cold-archive";

  return {
    store_id,
    store_kind: "object_storage",

    async savePacket(packet: CognitivePacket): Promise<PacketPlacement> {
      const locator = `s3://${bucket}/archives/${packet.packet_id}.json.gz`;
      const existingPlacements = packet.placements || [];
      const updatedPlacements: PacketPlacement[] = [
        ...existingPlacements.filter((p) => p.store_id !== store_id),
        {
          store_id,
          store_kind: "object_storage",
          locator,
          synchronized_at: new Date().toISOString(),
          is_primary: false, // Cold archive is never active primary
        },
      ];

      const toStore: CognitivePacket = {
        ...packet,
        placements: updatedPlacements,
      };

      fallback.set(packet.packet_id, JSON.stringify(toStore));
      return updatedPlacements.find((p) => p.store_id === store_id)!;
    },

    async getPacket(packet_id: string): Promise<CognitivePacket | null> {
      const raw = fallback.get(packet_id);
      return raw ? JSON.parse(raw) : null;
    },

    async listPackets(filter = {}): Promise<CognitivePacket[]> {
      const results: CognitivePacket[] = [];
      for (const raw of fallback.values()) {
        const p: CognitivePacket = JSON.parse(raw);
        if (filter.status && p.status !== filter.status) continue;
        if (filter.mandate_id && p.mandate_id !== filter.mandate_id) continue;
        results.push(p);
      }
      return results;
    },

    async hasPacket(packet_id: string): Promise<boolean> {
      return fallback.has(packet_id);
    },

    async deletePacket(packet_id: string): Promise<boolean> {
      return fallback.delete(packet_id);
    },
  };
}

/**
 * Archives an active packet: moves it to cold storage and removes the hot operational copy.
 */
export async function archivePacket(
  packet_id: string,
  activeStore: PacketStore,
  archiveStore: PacketStore
): Promise<{ archivedPacket: CognitivePacket; archivePlacement: PacketPlacement }> {
  const packet = await activeStore.getPacket(packet_id);
  if (!packet) {
    throw new Error(`Packet ${packet_id} not found in active store ${activeStore.store_id}`);
  }

  const archivePlacement = await archiveStore.savePacket(packet);
  const archivedPacket = (await archiveStore.getPacket(packet_id))!;

  // Remove hot copy
  await activeStore.deletePacket(packet_id);

  return {
    archivedPacket,
    archivePlacement,
  };
}

/**
 * Restores an archived packet from cold storage into an operational active store.
 */
export async function restorePacket(
  packet_id: string,
  archiveStore: PacketStore,
  targetActiveStore: PacketStore
): Promise<{ restoredPacket: CognitivePacket; activePlacement: PacketPlacement }> {
  const packet = await archiveStore.getPacket(packet_id);
  if (!packet) {
    throw new Error(`Packet ${packet_id} not found in archive store ${archiveStore.store_id}`);
  }

  const activePlacement = await targetActiveStore.savePacket(packet);
  const restoredPacket = (await targetActiveStore.getPacket(packet_id))!;

  return {
    restoredPacket,
    activePlacement,
  };
}

/**
 * Completes an Odyssey by returning the yield to Ithaca and marking the packet as assimilated.
 */
export async function assimilateToIthaca(
  packet_id: string,
  store: PacketStore,
  ithacaLocus: { corpus_name?: string; mandant?: string } = {}
): Promise<CognitivePacket> {
  const packet = await store.getPacket(packet_id);
  if (!packet) {
    throw new Error(`Packet ${packet_id} not found in store ${store.store_id}`);
  }

  const updated: CognitivePacket = {
    ...packet,
    status: "assimilated",
    ithaca: {
      ...packet.ithaca,
      description: ithacaLocus.corpus_name || packet.ithaca?.description || "Ithaca Home",
      return_conditions: ["odyssey_completed", "yield_assimilated"],
    },
    yield: {
      ...packet.yield,
      operational_yield: {
        ...(packet.yield?.operational_yield || {}),
        assimilated_at: new Date().toISOString(),
        assimilated_by: ithacaLocus.mandant || "twin:jhn",
      },
    },
  };

  await store.savePacket(updated);
  return (await store.getPacket(packet_id))!;
}
