import http from "http";
import { createClient } from "@supabase/supabase-js";
import createBus from "./cop/bus.js";
import store from "./cop/supabaseStore.js";
import opheliaAgent from "./agents/opheliaAgent.js";
import ragAgent from "./agents/ragAgent.js";
import process from "node:process";

let running = true;
let subs = [];
let processed = 0;
let failed = 0;
let lastHeartbeat = new Date().toISOString();
let workers = [];
let readClient = null;
let bus = null;

async function init() {
  // Allow switching bus implementation via env var COP_BUS
  bus = createBus({ type: import.meta.env?.COP_BUS || "supabase" });
  await bus.initBus();
  await store.initStore();
  // local read client for subscription wildcard
  readClient = createClient(
    import.meta.env?.SUPABASE_URL,
    import.meta.env?.SUPABASE_ANON_KEY ||
      import.meta.env?.SUPABASE_SERVICE_KEY ||
      import.meta.env?.VITE_SUPABASE_ANON_KEY
  );
}

function simpleMetrics() {
  return `# HELP cop_ws_runner_processed Tasks processed\n# TYPE cop_ws_runner_processed counter\n# HELP cop_ws_runner_failed Task process failures\n# HELP cop_ws_runner_last_heartbeat Last heartbeat UNIX timestamp\n# TYPE cop_ws_runner_last_heartbeat gauge\ncop_ws_runner_last_heartbeat ${Math.floor(new Date(lastHeartbeat).getTime() / 1000)}\n`;
}

async function subscribeAllTopics() {
  // For demonstration we subscribe to *all* topics where the runtime supports per-topic filter
  // SUPABASE Channels per-topic are configured in bus.subscribe

  // If you prefer to subscribe to a set of topics, enumerate them and call bus.subscribe({ topicId }, handler)
  // Here we'll set up a wildcard-like behavior by subscribing to no filter and handling events for interested type

  const handler = async (payload) => {
    try {
      lastHeartbeat = new Date().toISOString();
      if (!payload || !payload.type) return;

      // Directly forward to agent onEvent so that write-ahead and task creation behavior is preserved.
      await opheliaAgent.onEvent(payload, { bus, store });
      await ragAgent.onEvent(payload, { bus, store });
    } catch (e) {
      console.error("ws-runner event handler error", e.message || e);
    }
  };

  // TODO: If Supabase client channel wildcard isn't present, you'll need to subscribe explicitly to topic channels.
  // Here, experiment with a single subscription to a special 'all topics' channel if available; otherwise, consider enumerating active topics.

  try {
    // Use our readClient to subscribe to all `cop_event` inserts and avoid per-topic tedium; this subscribes to the public table and will deliver all events
    const channel = readClient
      .channel("cop-all-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cop_event" },
        (payload) => handler(payload.new || payload)
      )
      .subscribe();
    subs.push(() => {
      try {
        readClient.removeChannel(channel);
      } catch (e) {}
    });

    // attach simple reconnection handlers
    channel.on("reconnect", () => console.log("ws-runner: realtime client reconnected"));
    channel.on("close", () => console.warn("ws-runner: realtime client closed, will resubscribe"));
  } catch (e) {
    console.warn("subscribeAllTopics failed", e.message || e);
    throw e;
  }
}

async function workerIteration(workerId) {
  // This worker iteration claims a single task and processes a single step
  const wid =
    workerId ||
    `ws-runner-${typeof process !== "undefined" && process.pid ? process.pid : "unknown"}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    const task = await store.claimTask({ workerId: wid, leaseSeconds: 60 });
    if (!task) return false;

    // Lease extension timer to keep task if long processing
    let extendTimer = setInterval(async () => {
      try {
        await store.saveTask({
          id: task.id,
          lease_expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
          worker_id: wid,
        });
      } catch (e) {
        console.warn("extend lease error", e?.message || e);
      }
    }, 30000);

    // Claim a single step for this task atomically
    const step = await store
      .claimStep({ taskId: task.id, workerId: wid, leaseSeconds: 60 })
      .catch(() => null);
    if (!step) {
      // no pending steps; mark task done if no pending steps exist
      const remainingSteps = await store.getSteps(task.id);
      const hasPending = remainingSteps.some((s) => s.status === "pending");
      if (!hasPending) {
        await store.saveTask({
          id: task.id,
          status: "done",
          lease_expires_at: null,
          worker_id: null,
        });
      }
      clearInterval(extendTimer);
      processed++;
      return true;
    }

    // Dispatch to the agent's step handler if available
    const handlers = [opheliaAgent, ragAgent].filter(
      (a) => a.onStep && a.taskTypes && a.taskTypes.includes(task.type)
    );
    if (handlers.length === 0) {
      // Fallback to task-level handler
      const taskHandlers = [opheliaAgent, ragAgent].filter(
        (a) => a.taskTypes && a.taskTypes.includes(task.type)
      );
      for (const h of taskHandlers) {
        try {
          await h.onTask(task, { bus, store });
        } catch (e) {
          failed++;
          console.error("workerLoop: onTask error", e.message || e);
        }
      }
    } else {
      for (const h of handlers) {
        try {
          await h.onStep(task, step, { bus, store });
        } catch (e) {
          failed++;
          console.error("workerLoop: onStep error", e.message || e);
        }
      }
    }

    clearInterval(extendTimer);
    processed++;
    return true;
  } catch (e) {
    console.error("workerIteration error", e.message || e);
    return false;
  }
}

async function workerLoop() {
  // This worker loops calling workerIteration while running
  const workerId = `ws-runner-${typeof process !== "undefined" && process.pid ? process.pid : "unknown"}-${Math.random().toString(36).slice(2, 6)}`;
  while (running) {
    try {
      const task = await store.claimTask({ workerId, leaseSeconds: 60 });
      if (!task) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      // Lease extension timer to keep task if long processing
      let extendTimer = setInterval(async () => {
        try {
          await store.saveTask({
            id: task.id,
            lease_expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
            worker_id: workerId,
          });
        } catch (e) {
          console.warn("extend lease error", e?.message || e);
        }
      }, 30000);

      // Claim a single step for this task atomically
      const step = await store
        .claimStep({ taskId: task.id, workerId, leaseSeconds: 60 })
        .catch(() => null);
      if (!step) {
        // no pending steps; mark task done if no pending steps exist
        const remainingSteps = await store.getSteps(task.id);
        const hasPending = remainingSteps.some((s) => s.status === "pending");
        if (!hasPending) {
          await store.saveTask({
            id: task.id,
            status: "done",
            lease_expires_at: null,
            worker_id: null,
          });
        }
        clearInterval(extendTimer);
        processed++;
        continue;
      }

      // Dispatch to the agent's step handler if available
      const handlers = [opheliaAgent, ragAgent].filter(
        (a) => a.onStep && a.taskTypes && a.taskTypes.includes(task.type)
      );
      if (handlers.length === 0) {
        // Fallback to task-level handler
        const taskHandlers = [opheliaAgent, ragAgent].filter(
          (a) => a.taskTypes && a.taskTypes.includes(task.type)
        );
        for (const h of taskHandlers) {
          try {
            await h.onTask(task, { bus, store });
          } catch (e) {
            failed++;
            console.error("workerLoop: onTask error", e.message || e);
          }
        }
      } else {
        for (const h of handlers) {
          try {
            await h.onStep(task, step, { bus, store });
          } catch (e) {
            failed++;
            console.error("workerLoop: onStep error", e.message || e);
          }
        }
      }

      clearInterval(extendTimer);

      // processed
      processed++;
    } catch (e) {
      console.error("workerLoop error", e.message || e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function startWorkers(
  count = Math.max(
    1,
    typeof process !== "undefined" && process.env?.WS_RUNNER_CONCURRENCY
      ? parseInt(process.env.WS_RUNNER_CONCURRENCY, 10)
      : 2
  )
) {
  for (let i = 0; i < count; i++) {
    const spawnWorker = async () => {
      while (running) {
        try {
          await workerLoop();
          // workerLoop should not return unless stopped; if it returns, break if not running
          if (!running) break;
          console.warn("workerLoop exited unexpectedly, restarting...");
        } catch (e) {
          console.error("workerLoop crashed", e?.message || e);
          // small backoff before restart
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };
    const p = spawnWorker();
    workers.push(p);
  }
}

function startHealthServer(
  port = typeof process !== "undefined" && process.env?.WS_RUNNER_PORT
    ? process.env.WS_RUNNER_PORT
    : 8123
) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    if (req.url.startsWith("/metrics")) {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(simpleMetrics());
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });
  server.listen(port, () => console.log(`WS Runner health server listening on ${port}`));
  return server;
}

async function initRunner() {
  await init();

  // subscribe and start workers
  let backoff = 500;
  while (running) {
    try {
      await subscribeAllTopics();
      break; // subscribed successfully
    } catch (e) {
      console.warn("subscribeAllTopics retry", e.message || e);
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 60000);
    }
  }

  startWorkers();
  startHealthServer();
  // start reclaimer: scan running tasks and clear stale leases (best-effort)
  setInterval(async () => {
    try {
      await reclaimStaleLeases();
    } catch (e) {
      console.warn("reclaimer error", e?.message || e);
    }
  }, 60 * 1000);
}

export async function reclaimStaleLeases() {
  const runningTasks = await store.listTasks({ status: ["running"], limit: 200 });
  const now = new Date();
  for (const j of runningTasks) {
    if (j.lease_expires_at && new Date(j.lease_expires_at) < now) {
      console.log("reclaiming stale task lease", j.id);
      await store.saveTask({ id: j.id, lease_expires_at: null, worker_id: null });
    }
  }
}

export {
  init,
  bus,
  store,
  opheliaAgent,
  ragAgent,
  initRunner,
  startWorkers,
  workerLoop,
  workerIteration,
};
export default { initRunner, startWorkers, reclaimStaleLeases };

function gracefulShutdown(server) {
  running = false;
  console.log("WS Runner shutting down: closing subscriptions and waiting for workers...");
  try {
    subs.forEach((unsub) => unsub());
  } catch (e) {
    /* ignore */
  }

  // Attempt to wait for worker promises, but do not block indefinitely
  Promise.race([Promise.allSettled(workers), new Promise((r) => setTimeout(r, 5000))]).finally(
    () => {
      // Attempt to clear leases for worker id so other workers can pick up
      // Best-effort: requests to clear task leases could go here using RPC
      console.log("WS Runner shutdown complete");
      if (typeof process !== "undefined") {
        process.exit(0);
      }
    }
  );
}

if (typeof process !== "undefined") {
  process.on("SIGINT", () => gracefulShutdown());
  process.on("SIGTERM", () => gracefulShutdown());
}
