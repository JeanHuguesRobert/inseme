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
