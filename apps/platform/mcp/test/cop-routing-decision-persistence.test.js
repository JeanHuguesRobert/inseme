import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCapabilityCatalog } from "@inseme/magistral/capabilities";
import { COPBus } from "../../../../packages/cop-kernel/src/bus.js";
import { COPScheduler } from "../../../../packages/cop-kernel/src/scheduler.js";
import { createContinuationDescriptor } from "../../../../packages/cop-kernel/src/continuation.js";
import {
  createMagistralCapabilityResolver,
  MAGISTRAL_CAPABILITY_RESOLUTION,
} from "../cop/magistralCapabilityResolver.js";

// C2 Reality Test: persistence is supplied explicitly by the host, not
// incorrectly attributed to COPBus's in-memory eventLog.
test("C2: an unavailable route is observed and reconstructible after the scheduler disappears", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cop-c2-routing-"));
  const journal = join(directory, "routing-events.jsonl");
  try {
    const bus = new COPBus({ name: "c2-experimental-router" });
    bus.subscribeAll(async (event) => {
      await appendFile(journal, JSON.stringify(event) + "\n", "utf8");
    });
    let invoked = 0;
    const runtimeClient = {
      list: () => [],
      invoke: async () => { invoked++; throw new Error("unexpected handler invocation"); },
    };
    const scheduler = new COPScheduler(bus, {
      handlerResolver: createMagistralCapabilityResolver({
        capabilityCatalog: createCapabilityCatalog({ offers: [] }),
        hostRuntimeClient: runtimeClient,
      }),
    });
    const continuation = createContinuationDescriptor({
      resumeTo: MAGISTRAL_CAPABILITY_RESOLUTION,
      state: {
        capability_request: {
          requirement: { capability: "validate.frontmatter" },
          prompt: "Inspect frontmatter without effects",
          working_directory: process.cwd(),
        },
      },
    });

    await assert.rejects(
      () => scheduler.execute(continuation),
      /no executable handler for magistral:capability-resolution/
    );
    assert.equal(invoked, 0);
    scheduler.stop();

    // Simulate a cold independent observer: re-open ONLY the durable artifact,
    // with no access to the original bus, scheduler, catalogue or resolver.
    const reconstructed = (await readFile(journal, "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line));
    const resume = reconstructed.find((event) =>
      event.type === "cop.continuation.resume" &&
      event.data?.continuationId === continuation.continuationId
    );
    const failure = reconstructed.find((event) =>
      event.type === "cop.continuation.execution_failed" &&
      event.data?.continuationId === continuation.continuationId
    );
    assert.ok(resume, "cold observer recovers the original continuation resume");
    assert.ok(failure, "cold observer recovers the failed route decision");
    assert.equal(failure.data.resumeTo, MAGISTRAL_CAPABILITY_RESOLUTION);
    assert.match(failure.data.reason, /no executable handler/);
    assert.equal(resume.data.state.capability_request.requirement.capability, "validate.frontmatter");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("C3: a cold handler retries the same continuation when a capability becomes available", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cop-c3-routing-"));
  const journal = join(directory, "routing-events.jsonl");
  const observe = (bus) => bus.subscribeAll(async (event) => {
    await appendFile(journal, JSON.stringify(event) + "\n", "utf8");
  });
  const readEvents = async () => (await readFile(journal, "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  const continuation = createContinuationDescriptor({
    resumeTo: MAGISTRAL_CAPABILITY_RESOLUTION,
    state: {
      capability_request: {
        requirement: { capability: "validate.frontmatter" },
        prompt: "Validate frontmatter (simulated, no external effect)",
        working_directory: process.cwd(),
      },
    },
  });
  try {
    const firstBus = new COPBus({ name: "c3-first-attempt" });
    observe(firstBus);
    const firstRuntime = {
      list: () => [],
      invoke: async () => { throw new Error("must not invoke unavailable runtime"); },
    };
    const first = new COPScheduler(firstBus, {
      handlerResolver: createMagistralCapabilityResolver({
        capabilityCatalog: createCapabilityCatalog({ offers: [] }),
        hostRuntimeClient: firstRuntime,
      }),
    });
    await assert.rejects(() => first.execute(continuation), /no executable handler/);
    first.stop();

    // Independent process analogue: reconstruct the Continuation only from the
    // host-persisted first attempt; do not reuse the scheduler or bus.
    const prior = await readEvents();
    const failed = prior.find((e) =>
      e.type === "cop.continuation.execution_failed" &&
      e.data?.continuationId === continuation.continuationId);
    const resumed = prior.find((e) =>
      e.type === "cop.continuation.resume" &&
      e.data?.continuationId === continuation.continuationId);
    assert.ok(failed);
    assert.ok(resumed);
    const recovered = {
      continuationId: resumed.data.continuationId,
      resumeTo: resumed.data.resumeTo,
      state: resumed.data.state,
    };
    assert.equal(recovered.continuationId, continuation.continuationId);

    let invocations = 0;
    const offer = {
      id: "capability:test:frontmatter",
      runtime_id: "runtime:test:frontmatter",
      host_ref: "host:test",
      handler_instance_ref: "handler:test:frontmatter",
      provider_ref: "provider:test",
      capability: "validate.frontmatter",
      execution_surface: "simulated",
      context_inheritance: "none",
      dependencies: [],
      recovery: "replay",
    };
    const runtime = {
      id: offer.runtime_id,
      host_ref: offer.host_ref,
      handler_instance_ref: offer.handler_instance_ref,
      execution_surface: offer.execution_surface,
      capabilities: ["validate.frontmatter"],
    };
    const nextClient = {
      list: () => [runtime],
      invoke: async (input) => {
        invocations++;
        assert.equal(input.runtime_id, offer.runtime_id);
        return { status: "completed", text: "synthetic validation success" };
      },
    };
    const nextBus = new COPBus({ name: "c3-second-attempt" });
    observe(nextBus);
    const next = new COPScheduler(nextBus, {
      handlerResolver: createMagistralCapabilityResolver({
        capabilityCatalog: createCapabilityCatalog({ offers: [offer] }),
        hostRuntimeClient: nextClient,
      }),
    });
    const receipt = await next.execute(recovered, { reason: "c3-cold-retry" });
    next.stop();
    assert.equal(invocations, 1);
    assert.equal(receipt.continuation.continuationId, continuation.continuationId);
    assert.equal(receipt.execution.result.capability_resolution.offer_id, offer.id);
    assert.equal(receipt.execution.result.execution_receipt.status, "completed");

    const all = await readEvents();
    assert.equal(all.filter((e) =>
      e.type === "cop.continuation.resume" &&
      e.data?.continuationId === continuation.continuationId).length, 2);
    assert.equal(all.filter((e) =>
      e.type === "cop.continuation.execution_failed" &&
      e.data?.continuationId === continuation.continuationId).length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
