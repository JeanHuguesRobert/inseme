#!/usr/bin/env node
import { initRunner, init, opheliaAgent } from "./ws-runner.js";
import process from "node:process";

if (import.meta.env?.argv?.[2] === "--quick-test") {
  (async () => {
    await init();
    await opheliaAgent?.onEvent?.(
      {
        id: "ev-quick",
        type: "user_message",
        topic_id: "t-topic",
        payload: { text: "test quick" },
      },
      { store: undefined, bus: undefined }
    );
    console.log("quick test: done");
    if (typeof process !== "undefined") {
      process.exit(0);
    }
  })();
} else {
  initRunner().catch((e) => {
    console.error("initRunner failure", e);
    if (typeof process !== "undefined") {
      process.exit(1);
    }
  });
}
