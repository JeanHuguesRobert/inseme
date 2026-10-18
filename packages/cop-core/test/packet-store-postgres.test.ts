import { describe, expect, it } from "vitest";
import { createPostgresPacketStore } from "../src/packet-store.js";

function createSupabasePacketClient() {
  const rows = new Map<string, any>();
  return {
    rows,
    client: {
      from(table: string) {
        if (table !== "cop_packets") throw new Error("unexpected table");
        return {
          async upsert(row: any) {
            rows.set(row.id, { ...row });
            return { data: row, error: null };
          },
          select(columns: string, options?: any) {
            if (options?.head) {
              return {
                eq(_column: string, id: string) {
                  return Promise.resolve({ count: rows.has(id) ? 1 : 0, error: null });
                },
              };
            }
            const state: { status?: string } = {};
            return {
              eq(column: string, value: string) {
                if (column === "id") {
                  return {
                    async maybeSingle() {
                      const row = rows.get(value);
                      return {
                        data: row ? { packet_json: row.packet_json } : null,
                        error: null,
                      };
                    },
                  };
                }
                if (column === "status") state.status = value;
                return this;
              },
              then(resolve: (value: any) => void) {
                const data = [...rows.values()]
                  .filter((row) => !state.status || row.status === state.status)
                  .map((row) => ({ packet_json: row.packet_json }));
                resolve({ data, error: null });
              },
            };
          },
          delete() {
            return {
              async eq(_column: string, id: string) {
                rows.delete(id);
                return { error: null };
              },
            };
          },
        };
      },
    },
  };
}

describe("Postgres PacketStore portable cop_packets projection", () => {
  it("serializes packet_json as portable text and round-trips it", async () => {
    const supabase = createSupabasePacketClient();
    const store = createPostgresPacketStore("postgres:test", {
      supabaseClient: supabase.client,
    });

    await store.savePacket({
      packet_id: "packet:postgres:1",
      status: "dispatched",
      mandate_id: "mandate:test:1",
      created_at: "2026-10-19T00:00:00.000Z",
      placements: [],
      payload: { objective: "portable round-trip" },
    } as any);

    const stored = supabase.rows.get("packet:postgres:1");
    expect(typeof stored.packet_json).toBe("string");
    expect(stored.created_at).toBe("2026-10-19T00:00:00.000Z");
    expect(stored.mandate_id).toBe("mandate:test:1");

    const fetched = await store.getPacket("packet:postgres:1");
    expect(fetched?.packet_id).toBe("packet:postgres:1");
    expect(fetched?.placements?.[0]?.store_id).toBe("postgres:test");

    const listed = await store.listPackets({ status: "dispatched" });
    expect(listed).toHaveLength(1);
    expect(listed[0].packet_id).toBe("packet:postgres:1");
  });

  it("accepts an historical JSON-object packet_json projection on read", async () => {
    const supabase = createSupabasePacketClient();
    supabase.rows.set("packet:historical", {
      id: "packet:historical",
      status: "draft",
      packet_json: {
        packet_id: "packet:historical",
        status: "draft",
        placements: [],
      },
    });

    const store = createPostgresPacketStore("postgres:test", {
      supabaseClient: supabase.client,
    });
    const packet = await store.getPacket("packet:historical");
    expect(packet?.packet_id).toBe("packet:historical");
  });
});
