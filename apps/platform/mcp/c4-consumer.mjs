import assert from "node:assert/strict";
import { readFile, appendFile } from "node:fs/promises";
import { createCapabilityCatalog } from "@inseme/magistral/capabilities";
import { COPBus } from "../../../packages/cop-kernel/src/bus.js";
import { COPScheduler } from "../../../packages/cop-kernel/src/scheduler.js";
import { createMagistralCapabilityResolver } from "./cop/magistralCapabilityResolver.js";

const dir = process.argv[2] || "c4-artifact";
const journal = dir + "/routing-events.jsonl";
const saved = (await readFile(journal, "utf8")).trim().split("\n").map(JSON.parse);
const origin = saved.find(e => e.type === "cop.continuation.resume");
const failure = saved.find(e => e.type === "cop.continuation.execution_failed");
assert.ok(origin && failure, "original attempt not reconstructible");
assert.equal(origin.data.continuationId, failure.data.continuationId);
assert.match(failure.data.reason, /no executable handler/);
const offer = {
  id: "capability:c4:simulated", runtime_id: "runtime:c4:simulated",
  host_ref: "host:c4", handler_instance_ref: "handler:c4",
  capability: "validate.frontmatter", execution_surface: "simulated",
  context_inheritance: "none",
};
let invokes = 0;
const bus = new COPBus({ name: "c4-consumer" });
bus.subscribeAll(e => appendFile(journal, JSON.stringify(e) + "\n"));
const scheduler = new COPScheduler(bus, {
  handlerResolver: createMagistralCapabilityResolver({
    capabilityCatalog: createCapabilityCatalog({ offers: [offer] }),
    hostRuntimeClient: {
      list: () => [{ id: offer.runtime_id, host_ref: offer.host_ref,
        handler_instance_ref: offer.handler_instance_ref,
        execution_surface: "simulated", capabilities: ["validate.frontmatter"] }],
      invoke: async () => { invokes++; return { status: "completed", text: "synthetic success" }; },
    },
  }),
});
const receipt = await scheduler.execute({
  continuationId: origin.data.continuationId,
  resumeTo: origin.data.resumeTo,
  state: origin.data.state,
});
scheduler.stop();
assert.equal(invokes, 1);
assert.equal(receipt.continuation.continuationId, origin.data.continuationId);
assert.equal(receipt.execution.result.execution_receipt.status, "completed");
const final = (await readFile(journal, "utf8")).trim().split("\n").map(JSON.parse);
assert.equal(final.filter(e => e.type === "cop.continuation.resume").length, 2);
assert.equal(final.filter(e => e.type === "cop.continuation.execution_failed").length, 1);
console.log("C4 CONSUMER", origin.data.continuationId, process.env.GITHUB_RUN_ID || "local");
