import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  checkTunnel,
  printTunnelWarning,
} from "../packages/cop-host/src/utils/tunnel-connectivity.js";

// Helper to get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to .env file
const envPath = path.resolve(__dirname, "../.env");

// Simple .env parser to avoid dependency issues if dotenv isn't loaded yet
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Split on first equals
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();

      // Remove quotes if present
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.substring(1, val.length - 1);
      }

      env[key] = val;
    }
  }
  return env;
}

const env = parseEnv(envPath);
// Check specific proxy variables that affect Deno/Node
const httpProxy = env.HTTP_PROXY || process.env.HTTP_PROXY;
const httpsProxy = env.HTTPS_PROXY || process.env.HTTPS_PROXY;

const proxy = httpProxy || httpsProxy;

console.log("[check-tunnel] Checking network proxy configuration...");

if (proxy) {
  console.log(`[check-tunnel] Detected proxy configuration: ${proxy}`);
  const isReachable = await checkTunnel(proxy);
  if (isReachable) {
    console.log(`[check-tunnel] ✅ Tunnel/Proxy is reachable.`);
  } else {
    printTunnelWarning(proxy);
    console.error("[check-tunnel] 🛑 Blocking startup to prevent Deno connectivity errors.");
    console.error("[check-tunnel] Please start the tunnel or remove HTTP_PROXY from .env");
    process.exit(1);
  }
} else {
  console.log(
    "[check-tunnel] No proxy configuration detected (HTTP_PROXY/HTTPS_PROXY). Skipping tunnel check."
  );
}
process.exit(0);
