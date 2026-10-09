import assert from "node:assert/strict";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createCapabilityCatalog } from "@inseme/magistral/capabilities";
import { COPBus } from "../../../packages/cop-kernel/src/bus.js";
import { COPScheduler } from "../../../packages/cop-kernel/src/scheduler.js";
import { createContinuationDescriptor } from "../../../packages/cop-kernel/src/continuation.js";
import { createMagistralCapabilityResolver, MAGISTRAL_CAPABILITY_RESOLUTION } from "./cop/magistralCapabilityResolver.js";

const directory = process.argv[2] || "c4-artifact";
await mkdir(directory, { recursive: true });
const journal = directory + "/routing-events.jsonl";
const bus = new COPBus({ name: "c4-producer" });
bus.subscribeAll((event) => appendFile(journal, JSON.stringify(event) + "\n"));
const scheduler = new COPScheduler(bus, {
  handlerResolver: createMagistralCapabilityResolver({
    capabilityCatalog: createCapabilityCatalog({ offers: [] }),
    hostRuntimeClient: { list: () => [], invoke: async () => { throw Error("unexpected invoke"); } },
  }),
});
const continuation = createContinuationDescriptor({
  resumeTo: MAGISTRAL_CAPABILITY_RESOLUTION,
  state: { capability_request: {
    requirement: { capability: "validate.frontmatter" },
    prompt: "C4 synthetic read-only check", working_directory: process.cwd(),
  } },
});
await assert.rejects(scheduler.execute(continuation), /no executable handler/);
scheduler.stop();
const saved = (await readFile(journal, "utf8")).trim().split("\n").map(JSON.parse);
assert.ok(saved.some(e => e.type === "cop.continuation.execution_failed" &&
  e.data.continuationId === continuation.continuationId));
console.log("C4 PRODUCER", continuation.continuationId, process.env.GITHUB_RUN_ID || "local");
