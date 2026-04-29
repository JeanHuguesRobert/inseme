#!/usr/bin/env node
import http from "http";

const args = process.argv.slice(2);
const hostArg = args.indexOf("--host") > -1 ? args[args.indexOf("--host") + 1] : "127.0.0.1";
const portArg = args.indexOf("--port") > -1 ? args[args.indexOf("--port") + 1] : "8082";

const url = `http://${hostArg}:${portArg}/v1/magistral/metrics`;

function fetchMetrics() {
  http
    .get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          renderMonitor(json);
        } catch (err) {
          console.error(`Failed to parse metrics JSON: ${err.message}`);
        }
      });
    })
    .on("error", (err) => {
      console.error(`Connection failed. Is Magistral running on ${url}?`);
    });
}

function pad(str, len) {
  const s = String(str || "");
  return s.length > len ? s.substring(0, len - 3) + "..." : s.padEnd(len, " ");
}

function renderMonitor(data) {
  // Clear console (like top)
  console.clear();
  console.log(`\x1b[36m=== MAGISTRAL PROTOCOL MONITOR ===\x1b[0m   (Polling every 2s)`);
  console.log(`Nodes: ${data.nodes.length}`);
  console.log();

  const hId = pad("NODE ID", 18);
  const hTier = pad("TIER", 10);
  const hStatus = pad("STATUS", 12);
  const hReqs = pad("REQ", 6);
  const hSucc = pad("SUCC", 6);
  const hLat = pad("LATENCY", 10);
  const hMod = pad("MODEL", 30);
  const hErr = pad("LAST ERROR", 25);

  console.log(
    `\x1b[1m${hId} | ${hTier} | ${hStatus} | ${hReqs} | ${hSucc} | ${hLat} | ${hMod} | ${hErr}\x1b[0m`
  );
  console.log("-".repeat(125));

  const nodes = data.nodes.sort((a, b) => b.weight - a.weight);

  for (const n of nodes) {
    const pId = pad(n.id, 18);
    const pTier = pad(n.tier, 10);
    const pMod = pad(n.model, 30);

    // Colored Status
    let pStatus = pad(n.status, 12);
    if (n.status === "active") pStatus = `\x1b[32m${pStatus}\x1b[0m`;
    else pStatus = `\x1b[31m${pStatus}\x1b[0m`;

    const pReq = pad(n.requests, 6);
    const pSuc = pad(n.successes, 6);
    const pLat = pad(n.avgLatencyMs > 0 ? n.avgLatencyMs + "ms" : "-", 10);
    const pErr = n.lastError ? `\x1b[31m${pad(n.lastError, 25)}\x1b[0m` : pad("-", 25);

    console.log(`${pId} | ${pTier} | ${pStatus} | ${pReq} | ${pSuc} | ${pLat} | ${pMod} | ${pErr}`);
  }
}

// Initial fetch & poll
fetchMetrics();
setInterval(fetchMetrics, 2000);
