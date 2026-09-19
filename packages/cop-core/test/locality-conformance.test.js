import { describe, it, expect } from "vitest";
import { createCopEventEnvelope } from "../src/cop-event-envelope.js";

/**
 * Locality conformance fixture for Inseme #80.
 *
 * The fixture deliberately uses only existing COP primitives:
 * - Topic-local sequence numbers for local history,
 * - parent_event_ids / correlation_id for explicit cross-topic relation,
 * - reconstructible derived indexes.
 *
 * No Locality entity or locality_id is introduced.
 */

function event({
  id,
  topic,
  seq,
  type,
  recordedAt,
  parents = [],
  correlationId = null,
  payload = {},
}) {
  return createCopEventEnvelope({
    event_id: id,
    event_type: type,
    topic_id: topic,
    topic_seq: seq,
    recorded_at: recordedAt,
    parent_event_ids: parents,
    correlation_id: correlationId,
    payload,
  });
}

function reconstructTopic(events, topicId) {
  return events
    .filter((e) => e.topic.id === topicId)
    .sort((a, b) => a.topic.seq - b.topic.seq)
    .map((e) => ({
      event_id: e.event_id,
      topic_id: e.topic.id,
      topic_seq: e.topic.seq,
      payload: structuredClone(e.payload),
    }));
}

function buildDiscoveryIndex(events) {
  return new Map(
    events.map((e) => [
      e.event_id,
      {
        topic_id: e.topic.id,
        topic_seq: e.topic.seq,
        parent_event_ids: [...e.parent_event_ids],
      },
    ])
  );
}

describe("COP locality conformance (Issue #80)", () => {
  const a1 = event({
    id: "evt:a:1",
    topic: "topic:a",
    seq: 1,
    type: "LocalFactRecorded",
    recordedAt: "2026-09-19T10:00:00.000Z",
    payload: { value: "A1" },
  });

  const b1 = event({
    id: "evt:b:1",
    topic: "topic:b",
    seq: 1,
    type: "LocalFactRecorded",
    recordedAt: "2026-09-19T09:59:00.000Z",
    payload: { value: "B1" },
  });

  const a2 = event({
    id: "evt:a:2",
    topic: "topic:a",
    seq: 2,
    type: "LocalFactRecorded",
    recordedAt: "2026-09-19T10:02:00.000Z",
    payload: { value: "A2" },
  });

  const b2 = event({
    id: "evt:b:2",
    topic: "topic:b",
    seq: 2,
    type: "LocalFactRecorded",
    recordedAt: "2026-09-19T10:01:00.000Z",
    payload: { value: "B2" },
  });

  const actX = event({
    id: "evt:act:x",
    topic: "topic:act:x",
    seq: 1,
    type: "CrossTopicActRecorded",
    recordedAt: "2026-09-19T10:03:00.000Z",
    parents: [a2.event_id, b2.event_id],
    correlationId: "act:x",
    payload: {
      kind: "Act",
      relates_topics: ["topic:a", "topic:b"],
    },
  });

  const authoritativeEvents = [b1, a1, b2, a2, actX];

  it("keeps local histories independently reconstructible; correlation is explicit", () => {
    const topicAFromWhole = reconstructTopic(authoritativeEvents, "topic:a");
    const topicAAlone = reconstructTopic([a2, a1], "topic:a");
    const topicBFromWhole = reconstructTopic(authoritativeEvents, "topic:b");

    expect(topicAFromWhole).toEqual(topicAAlone);
    expect(topicAFromWhole.map((x) => x.event_id)).toEqual(["evt:a:1", "evt:a:2"]);
    expect(topicBFromWhole.map((x) => x.event_id)).toEqual(["evt:b:1", "evt:b:2"]);

    // The same topicSeq values are valid in different Topics.
    expect(a1.topic.seq).toBe(1);
    expect(b1.topic.seq).toBe(1);

    // Wall-clock order across Topics is not a hidden global sequence.
    expect(Date.parse(b1.time.recorded_at)).toBeLessThan(Date.parse(a1.time.recorded_at));
    expect(reconstructTopic(authoritativeEvents, "topic:a")[0].event_id).toBe("evt:a:1");

    // The cross-topic relation exists only because it is declared.
    expect(actX.parent_event_ids).toEqual(["evt:a:2", "evt:b:2"]);
    expect(actX.correlation_id).toBe("act:x");

    // Removing unrelated Topic B and the correlating Act does not impair A reconstruction.
    const withoutBOrAct = authoritativeEvents.filter((e) => e.topic.id === "topic:a");
    expect(reconstructTopic(withoutBOrAct, "topic:a")).toEqual(topicAFromWhole);
  });

  it("treats a global discovery index as disposable derived state", () => {
    const sourceSnapshot = structuredClone(authoritativeEvents);
    const firstIndex = buildDiscoveryIndex(authoritativeEvents);

    expect(firstIndex.get("evt:a:2")).toEqual({
      topic_id: "topic:a",
      topic_seq: 2,
      parent_event_ids: [],
    });
    expect(firstIndex.get("evt:act:x")?.parent_event_ids).toEqual(["evt:a:2", "evt:b:2"]);

    // Corrupt and then destroy the derived global structure.
    firstIndex.set("evt:fake", {
      topic_id: "topic:global",
      topic_seq: 999,
      parent_event_ids: [],
    });
    firstIndex.clear();

    // Authoritative local source material is unchanged.
    expect(authoritativeEvents).toEqual(sourceSnapshot);

    // The discovery structure can be rebuilt from authoritative Events.
    const rebuilt = buildDiscoveryIndex(authoritativeEvents);
    expect(rebuilt.has("evt:fake")).toBe(false);
    expect(rebuilt.size).toBe(authoritativeEvents.length);
    expect(rebuilt.get("evt:a:1")?.topic_id).toBe("topic:a");
    expect(rebuilt.get("evt:b:1")?.topic_id).toBe("topic:b");
  });
});
