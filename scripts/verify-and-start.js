/**
 * @fileoverview Script de démarrage et de test pour l'écosystème Inseme/Cyrnea.
 *
 * Ce script orchestre le lancement de plusieurs services :
 * - Tunnel ngrok (pour l'accès externe)
 * - Sovereign AI (LLM + TTS local)
 * - Netlify Dev (serveur de développement)
 *
 * Il gère également :
 * - La détection des processus orphelins (baseline)
 * - La compilation des briques
 * - Les tests d'intégration Playwright
 * - La génération de rapports détaillés
 *
 * @author Inseme Team
 * @version 2.0.0
 *
 * @example
 * // Démarrage standard
 * node scripts/verify-and-start.js
 *
 * @example
 * // Mode test avec suite spécifique
 * node scripts/verify-and-start.js --test --tests api
 *
 * @example
 * // Mode manuel (garde les services actifs)
 * node scripts/verify-and-start.js --manual
 */

import fs from "fs";
import path from "path";
import net from "net";
import readline from "readline";
import { spawn, execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fetch from "node-fetch";

const ROOT_DIR = process.cwd();
const LOGS_DIR = path.join(ROOT_DIR, "logs");
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function resolveAppArg(args) {
  let app = null;
  for (const arg of args) {
    if (arg === "--platform") app = "platform";
    else if (arg === "--inseme") app = "inseme";
    else if (arg === "--cyrnea") app = "cyrnea";
    else if (arg.startsWith("--app=")) app = arg.split("=")[1];
  }
  if (!app) {
    const idx = args.indexOf("--app");
    if (idx !== -1 && args[idx + 1]) app = args[idx + 1];
  }
  if (!app) return "cyrnea";
  const normalized = app.toLowerCase();
  if (!["cyrnea", "inseme", "platform"].includes(normalized)) {
    console.log(
      `${colors.yellow}App inconnue "${app}", utilisation de 'cyrnea' par défaut.${colors.reset}`
    );
    return "cyrnea";
  }
  return normalized;
}

const START_TIME = Date.now();
const ARGS = process.argv.slice(2);
const IS_TEST_MODE = ARGS.includes("--test") || ARGS.includes("-t");
const IS_MANUAL = ARGS.includes("--manual");
const IS_INCREMENTAL = ARGS.includes("--incremental") || IS_TEST_MODE || IS_MANUAL;
const IS_DEBUG = ARGS.includes("--debug") || ARGS.includes("-d");
const NO_CACHE = ARGS.includes("--no-cache");
const IS_STOP = ARGS.includes("--stop");
const CLEAR_CACHE = ARGS.includes("--clear-cache");
const SHOW_HELP = ARGS.includes("--help") || ARGS.includes("-h");
const SET_BASELINE = ARGS.includes("--baseline");
const RESET_BASELINE = ARGS.includes("--reset-baseline");
const KEEP_NETLIFY = ARGS.includes("--keep-netlify");
const CHECK_PROCESSES = ARGS.includes("--check-processes");

let TEST_SUITE = "api";
const testsArgIndex = ARGS.indexOf("--tests");
if (testsArgIndex !== -1 && ARGS[testsArgIndex + 1]) {
  TEST_SUITE = ARGS[testsArgIndex + 1];
}

const TARGET_APP = resolveAppArg(ARGS);

const APPS_CONFIG = {
  cyrnea: {
    id: "cyrnea",
    label: "CYRNEA",
    appDir: path.join(ROOT_DIR, "apps", "cyrnea"),
    playwright: {
      enabled: true,
      filter: "@inseme/app-cyrnea",
    },
  },
  inseme: {
    id: "inseme",
    label: "INSEME",
    appDir: path.join(ROOT_DIR, "apps", "inseme"),
    playwright: {
      enabled: false,
      filter: null,
    },
  },
  platform: {
    id: "platform",
    label: "PLATFORM",
    appDir: path.join(ROOT_DIR, "apps", "platform"),
    playwright: {
      enabled: false,
      filter: null,
    },
  },
};

const CURRENT_APP = APPS_CONFIG[TARGET_APP] || APPS_CONFIG.cyrnea;
const NETLIFY_APP_DIR = CURRENT_APP.appDir;
const NETLIFY_TOML_PATH = path.join(NETLIFY_APP_DIR, "netlify.toml");

const CACHE_FILE = path.join(LOGS_DIR, ".playwright_cache");
const FUNCTIONS_CACHE_FILE = path.join(LOGS_DIR, ".functions_cache");
const BASELINE_FILE = path.join(LOGS_DIR, ".baseline_processes.json");

// --- ÉTAT GLOBAL ---
const allLogEntries = [];
const trackedProcesses = new Map(); // name -> pid
const detectedFunctions = {
  node: new Map(), // name -> { declared: bool, loaded: bool }
  edge: new Map(), // name -> { declared: bool, loaded: bool }
};
const startupConfig = {};
const processDeltaEvents = [];

const PHASES_STATUS = {
  CLEANUP: { label: "Nettoyage Processus", status: "PENDING", duration: 0 },
  SUPABASE: { label: "Vérification Supabase", status: "PENDING", duration: 0 },
  BRIQUES: { label: "Compilation Briques", status: "PENDING", duration: 0 },
  TUNNEL: { label: "Lancement Tunnel", status: "PENDING", duration: 0 },
  SOVEREIGN: {
    label: "Lancement Sovereign AI",
    status: "PENDING",
    duration: 0,
  },
  NETLIFY: { label: "Lancement Netlify (App)", status: "PENDING", duration: 0 },
  PLAYWRIGHT: {
    label: "Vérification Navigateurs (Playwright)",
    status: "PENDING",
    duration: 0,
  },
  TESTS: { label: "Tests d'Intégration", status: "PENDING", duration: 0 },
};

// ============================================================================
// SECTION: Process Snapshot & Hierarchy Management
// ============================================================================

/**
 * Captures a snapshot of all running processes on the system.
 *
 * @returns {Map<number, ProcessInfo>} Map of PID -> process info object
 * @property {number} ProcessId - The process ID
 * @property {number} ParentProcessId - Parent process ID
 * @property {string} Name - Process name
 * @property {string} CommandLine - Full command line
 */
function getProcessSnapshot() {
  try {
    const currentPid = process.pid;
    if (process.platform === "win32") {
      const output = execSync(
        `powershell -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, Name, ParentProcessId, CommandLine | ConvertTo-Json"`,
        { stdio: "pipe" }
      ).toString();
      const data = JSON.parse(output);
      return new Map((Array.isArray(data) ? data : [data]).map((p) => [p.ProcessId, p]));
    } else {
      const output = execSync("ps -ax -o pid,ppid,comm,args --no-headers", {
        stdio: "pipe",
      }).toString();
      const lines = output.trim().split("\n");
      const snapshot = new Map();
      lines.forEach((line) => {
        const [pid, ppid, comm, ...args] = line.trim().split(/\s+/);
        snapshot.set(parseInt(pid), {
          ProcessId: parseInt(pid),
          ParentProcessId: parseInt(ppid),
          Name: comm,
          CommandLine: args.join(" "),
        });
      });
      return snapshot;
    }
  } catch (e) {
    return new Map();
  }
}

let initialSnapshot = getProcessSnapshot();

// Gestion de la baseline persistée
if (RESET_BASELINE) {
  if (fs.existsSync(BASELINE_FILE)) {
    fs.unlinkSync(BASELINE_FILE);
    console.log(
      `${colors.yellow}⚠️ Baseline précédente supprimée (--reset-baseline).${colors.reset}`
    );
  }
}

if (SET_BASELINE || RESET_BASELINE) {
  const snapshotData = Object.fromEntries(initialSnapshot);
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(snapshotData, null, 2));

  // Afficher la hiérarchie pour validation immédiate
  logBaseline();

  console.log(
    `\n${colors.green}${colors.bright}✅ Baseline enregistrée dans ${BASELINE_FILE}${colors.reset}`
  );
  process.exit(0);
} else if (fs.existsSync(BASELINE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    initialSnapshot = new Map(Object.entries(data).map(([pid, info]) => [parseInt(pid), info]));
    console.log(
      `${colors.cyan}ℹ️ Utilisation de la baseline persistée (${initialSnapshot.size} processus)${colors.reset}`
    );
  } catch (e) {
    console.log(
      `${colors.yellow}⚠️ Erreur lors de la lecture de la baseline: ${e.message}${colors.reset}`
    );
  }
}

/**
 * Finds the root process (typically the IDE) that spawned this script.
 * Walks up the process tree to find a known IDE (Trae, VSCode, Cursor, etc.)
 *
 * @returns {{pid: number, name: string}} Root process info
 */
function getRootProcessInfo() {
  const currentPid = process.pid;
  const me = initialSnapshot.get(currentPid);
  if (!me) return { pid: currentPid, name: "node" };

  let current = me;
  let root = me;

  // Remonter la chaîne pour trouver le parent "ultime" qui ressemble à un IDE ou un shell stable
  while (current && current.ParentProcessId !== 0) {
    const parent = initialSnapshot.get(current.ParentProcessId);
    if (!parent) break;

    // Si on trouve un IDE connu, c'est notre racine
    const name = parent.Name.toLowerCase();
    if (
      name.includes("trae") ||
      name.includes("code") ||
      name.includes("cursor") ||
      name.includes("intellij") ||
      name.includes("webstorm")
    ) {
      root = parent;
      break;
    }

    // Sinon on continue de remonter tant qu'on est dans des shells ou des runners
    if (
      name.includes("node") ||
      name.includes("pnpm") ||
      name.includes("npm") ||
      name.includes("pwsh") ||
      name.includes("powershell") ||
      name.includes("cmd.exe") ||
      name.includes("conhost")
    ) {
      root = parent;
      current = parent;
    } else {
      // On s'arrête si on tombe sur quelque chose d'inconnu (ex: explorer.exe, svchost.exe)
      // mais on garde ce parent comme racine potentielle si c'est lui qui a lancé le shell
      root = parent;
      break;
    }
  }

  return {
    pid: root.ProcessId,
    name: root.Name,
  };
}

function logBaseline() {
  const root = getRootProcessInfo();
  addLogEntry("SYSTEM", `Baseline établie : Racine IDE détectée = ${root.name} (PID ${root.pid})`);

  // Visualiser la hiérarchie à partir de la racine
  const tree = visualizeProcessHierarchy(initialSnapshot, root.pid);
  if (tree) {
    addLogEntry("SYSTEM", "🌳 ARBRE DES PROCESSUS DE L'IDE (TRAE) :\n" + tree);
  }

  // Résumé global
  const total = initialSnapshot.size;
  const ideChildren = Array.from(initialSnapshot.values()).filter((p) =>
    isDescendantOf(initialSnapshot, p.ProcessId, root.pid)
  ).length;
  addLogEntry(
    "SYSTEM",
    `Résumé global : ${total} processus au total, dont ${ideChildren} dans l'arbre de l'IDE.`
  );
}

function isDescendantOf(snapshot, pid, rootPid) {
  let current = snapshot.get(pid);
  let depth = 0;
  while (current && current.ParentProcessId !== 0) {
    if (depth++ > 50) return false; // Safety break for cycles
    if (current.ParentProcessId === rootPid) return true;
    current = snapshot.get(current.ParentProcessId);
  }
  return pid === rootPid;
}

/**
 * Generates an ASCII tree visualization of process hierarchy.
 *
 * @param {Map<number, ProcessInfo>} snapshot - Process snapshot map
 * @param {number} rootPid - Root PID to start visualization from
 * @param {string} [indent=''] - Current indentation level
 * @param {Set<number>} [visited=new Set()] - Visited PIDs to prevent cycles
 * @returns {string} Formatted tree string with ANSI colors
 */
function visualizeProcessHierarchy(snapshot, rootPid, indent = "", visited = new Set()) {
  if (visited.has(rootPid)) return "";
  visited.add(rootPid);

  const root = snapshot.get(rootPid);
  if (!root) return "";

  // On essaie de raccourcir les CommandLine trop longues pour la lisibilité
  const cmd = root.CommandLine
    ? root.CommandLine.trim().substring(0, 60) + (root.CommandLine.length > 60 ? "..." : "")
    : "";
  const info = cmd ? ` [${cmd}]` : "";

  let result = `${indent}└─ ${colors.bright}${root.Name}${colors.reset} (${root.ProcessId})${colors.gray}${info}${colors.reset}\n`;

  const children = Array.from(snapshot.values())
    .filter((p) => p.ParentProcessId === rootPid)
    .sort((a, b) => a.ProcessId - b.ProcessId);

  for (let i = 0; i < children.length; i++) {
    const isLast = i === children.length - 1;
    const childIndent = indent + (isLast ? "   " : "│  ");
    result += visualizeProcessHierarchy(snapshot, children[i].ProcessId, childIndent, visited);
  }

  return result;
}

function diffProcessSnapshot(current) {
  const newProcesses = [];
  for (const [pid, info] of current.entries()) {
    if (!initialSnapshot.has(pid)) {
      newProcesses.push(info);
    }
  }
  return newProcesses;
}

function truncateText(text, maxLen) {
  if (!text) return "";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, Math.max(0, maxLen - 1)) + "…";
}

function formatProcessInfo(p, cmdMaxLen = 140) {
  const pid = p?.ProcessId ?? "?";
  const ppid = p?.ParentProcessId ?? "?";
  const name = p?.Name ?? "unknown";
  const cmd =
    typeof p?.CommandLine === "string"
      ? truncateText(p.CommandLine.replace(/\s+/g, " "), cmdMaxLen)
      : "";
  return cmd ? `${name}(${pid}, ppid=${ppid}) [${cmd}]` : `${name}(${pid}, ppid=${ppid})`;
}

function isSelfProbeProcess(p) {
  if (!p || !p.Name) return false;
  const name = String(p.Name).toLowerCase();
  if (!p.CommandLine) return false;
  const cmd = String(p.CommandLine).toLowerCase();

  // Check for the specific command used to get process list
  if (!cmd.includes("win32_process")) return false;

  // It must be one of our shell wrappers
  if (!name.includes("powershell") && !name.includes("cmd")) {
    return false;
  }

  // It must contain the WMI/CIM command we use
  if (
    cmd.includes("get-ciminstance") ||
    cmd.includes("getciminstance") ||
    cmd.includes("gwmi") ||
    cmd.includes("get-wmiobject")
  ) {
    return true;
  }

  return false;
}

function isIgnoredExternalProcess(p) {
  if (!p || !p.Name) return false;
  const name = String(p.Name).toLowerCase();
  // Navigateur utilisé pendant le dev : pas pertinent pour les fuites
  if (name.includes("brave.exe") || name.includes("brave")) return true;
  return false;
}

// --- CHARGEMENT DU CACHE ---
function loadFunctionsCache() {
  if (fs.existsSync(FUNCTIONS_CACHE_FILE)) {
    try {
      const cache = JSON.parse(fs.readFileSync(FUNCTIONS_CACHE_FILE, "utf8"));

      const loadMap = (source, targetMap) => {
        if (!source) return;
        Object.entries(source).forEach(([name, data]) => {
          if (name && isNaN(name)) {
            targetMap.set(name, {
              declared: data.declared || false,
              loaded: data.loaded || false,
            });
          }
        });
      };

      loadMap(cache.node, detectedFunctions.node);
      loadMap(cache.edge, detectedFunctions.edge);

      // Récupération des PIDs pour nettoyage éventuel
      if (cache.processes) {
        Object.entries(cache.processes).forEach(([name, pid]) => {
          trackedProcesses.set(name, pid);
        });
      }
      return cache;
    } catch (e) {
      console.error("Erreur lecture cache:", e.message);
    }
  }
  return null;
}

const functionsCache = loadFunctionsCache();

function displayHelp() {
  console.log(`
${colors.bright}INSEME STARTUP & TEST MANAGER${colors.reset}
---------------------------------------------
Usage: node scripts/verify-and-start.js [options]

Options:
  --test, -t       Mode test : vérifie si tout est lancé et lance les tests d'intégration.
                   (Implique --incremental, ne redémarre rien si les ports sont occupés).
  --incremental    Conserve les processus déjà actifs (Tunnel, Sovereign) au lieu de les redémarrer.
  --manual         Mode test manuel : lance les services et les laisse actifs, sans tests auto.
  --tests <suite>  Choisit la suite de tests Playwright (api, briques, tools, backend, mic, all).
  --app <nom>      Choisit l'app cible (cyrnea, inseme, platform). Défaut: cyrnea.
  --cyrnea         Raccourci pour --app cyrnea.
  --inseme         Raccourci pour --app inseme.
  --platform       Raccourci pour --app platform.
  --baseline       Établit une baseline des processus (après restart).
  --reset-baseline Supprime la baseline existante (avec --clear-cache).
  --debug, -d      Active le mode debug maximal (logs détaillés, debug Netlify).
  --no-cache       Force la vérification complète des navigateurs Playwright (ignore le cache).
  --clear-cache    Efface le cache de vérification de Playwright et quitte.
  --stop           Arrête tous les services et nettoie les ports.
  --keep-netlify   Ne jamais arrêter Netlify Dev (pour debug et hot reload).
  --check-processes Active la vérification détaillée des processus (lent).
  --help, -h       Affiche cette aide.

Fichiers de sortie:
  Rapport final: logs/last_report.log
  Cache: logs/.playwright_cache
  `);
}

// Configuration keys that impact startup
const IMPACTFUL_KEYS = [
  "community_name",
  "SUPABASE_URL",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "MISTRAL_API_KEY",
  "HUGGINGFACE_API_KEY",
  "GROK_API_KEY",
  "KOKORO_URL",
  "SOVEREIGN_AI_URL",
  "DATABASE_URL",
  "NGROK_AUTHTOKEN",
];

// Note: Cache validity is checked via file modification time in loadFunctionsCache()
// Functions cache is loaded once at line 419 via functionsCache = loadFunctionsCache()

function saveFunctionsCache() {
  try {
    const data = {
      node: Object.fromEntries(detectedFunctions.node),
      edge: Object.fromEntries(detectedFunctions.edge),
      processes: Object.fromEntries(trackedProcesses),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(FUNCTIONS_CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function scanFunctionsDirectory() {
  const baseDir = path.join(NETLIFY_APP_DIR, "netlify");
  const edgeDir = path.join(baseDir, "edge-functions");
  const nodeDir = path.join(baseDir, "functions");

  const scan = (dir, targetMap, type) => {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        if (file.endsWith(".js") || file.endsWith(".ts")) {
          const name = file.replace(/\.(js|ts)$/, "");
          const current = targetMap.get(name) || {
            declared: false,
            loaded: false,
          };
          if (!current.declared) {
            current.declared = true;
            targetMap.set(name, current);
          }
        }
      });
    }
  };

  scan(edgeDir, detectedFunctions.edge, "Edge");
  scan(nodeDir, detectedFunctions.node, "Node.js");

  addLogEntry(
    "SYSTEM",
    `📂 Scan terminé : ${detectedFunctions.node.size} Node.js, ${detectedFunctions.edge.size} Edge Functions.`
  );
  saveFunctionsCache();
}

function loadNetlifyTomlFunctions() {
  if (!fs.existsSync(NETLIFY_TOML_PATH)) return;

  try {
    const content = fs.readFileSync(NETLIFY_TOML_PATH, "utf8");
    addLogEntry("SYSTEM", "📖 Lecture du netlify.toml...");

    const edgeFunctionRegex = /\[\[edge_functions\]\]\s+function\s*=\s*"([^"]+)"/g;
    const nodeFunctionRegex = /to\s*=\s*"\/\.netlify\/functions\/([^"\/]+)"/g;

    let matchEdge;
    let edgeCount = 0;
    while ((matchEdge = edgeFunctionRegex.exec(content)) !== null) {
      const name = matchEdge[1];
      const current = detectedFunctions.edge.get(name) || {
        declared: false,
        loaded: false,
      };
      if (!current.declared) {
        current.declared = true;
        detectedFunctions.edge.set(name, current);
        edgeCount++;
      }
    }

    let matchNode;
    let nodeCount = 0;
    while ((matchNode = nodeFunctionRegex.exec(content)) !== null) {
      const name = matchNode[1];
      const current = detectedFunctions.node.get(name) || {
        declared: false,
        loaded: false,
      };
      if (!current.declared) {
        current.declared = true;
        detectedFunctions.node.set(name, current);
        nodeCount++;
      }
    }

    scanFunctionsDirectory();
  } catch (e) {
    addLogEntry("SYSTEM", "⚠️ Erreur lors de la lecture du netlify.toml", true);
  }
}

let lastSnapshot = getProcessSnapshot();

function logNewProcesses(label) {
  // Si la vérification est désactivée et que ce n'est pas une demande manuelle, on ignore
  if (!CHECK_PROCESSES && !label.includes("MANUAL")) {
    return { started: [], ended: [] };
  }

  const current = getProcessSnapshot();

  // === DIAGNOSTIC CYRNEA ===
  // On regarde si on est en phase "NETLIFY" (lancement de l'app)
  // et on cherche spécifiquement si "vite" ou "netlify dev" est lancé mais bloqué.
  if (label.includes("NETLIFY")) {
    const relevant = Array.from(current.values()).filter((p) => {
      const cmd = (p.CommandLine || "").toLowerCase();
      return cmd.includes("vite") || cmd.includes("netlify") || cmd.includes("cyrnea");
    });
    if (relevant.length > 0) {
      console.log(
        `${colors.magenta}[DIAGNOSTIC CYRNEA] Processus potentiellement liés :${colors.reset}`
      );
      relevant.forEach((p) => console.log(`   > ${formatProcessInfo(p)}`));
    } else {
      console.log(
        `${colors.red}[DIAGNOSTIC CYRNEA] Aucun processus 'vite' ou 'netlify' détecté ! Le lancement a peut-être échoué silencieusement.${colors.reset}`
      );
    }
  }
  // =========================

  const deltaStarted = [];
  const deltaEnded = [];

  for (const [pid, info] of current.entries()) {
    if (!lastSnapshot.has(pid) && !isSelfProbeProcess(info)) deltaStarted.push(info);
  }
  for (const [pid, info] of lastSnapshot.entries()) {
    if (!current.has(pid) && !isSelfProbeProcess(info)) {
      deltaEnded.push(info);
    }
  }

  const root = getRootProcessInfo();
  const cleanedStarted = deltaStarted.filter((p) => !isIgnoredExternalProcess(p));
  const cleanedEnded = deltaEnded.filter((p) => !isIgnoredExternalProcess(p));

  const startedInternal = cleanedStarted.filter((p) =>
    isDescendantOf(current, p.ProcessId, root.pid)
  );
  const startedExternal = cleanedStarted.filter(
    (p) => !isDescendantOf(current, p.ProcessId, root.pid)
  );
  const endedInternal = cleanedEnded.filter((p) =>
    isDescendantOf(lastSnapshot, p.ProcessId, root.pid)
  );
  const endedExternal = cleanedEnded.filter(
    (p) => !isDescendantOf(lastSnapshot, p.ProcessId, root.pid)
  );

  // Sorting for consistent display
  startedInternal.sort((a, b) => a.ProcessId - b.ProcessId);
  startedExternal.sort((a, b) => a.ProcessId - b.ProcessId);
  endedInternal.sort((a, b) => a.ProcessId - b.ProcessId);
  endedExternal.sort((a, b) => a.ProcessId - b.ProcessId);

  const totalSinceBaseline = diffProcessSnapshot(current);
  const baselineInternal = totalSinceBaseline.filter((p) =>
    isDescendantOf(current, p.ProcessId, root.pid)
  ).length;

  if (cleanedStarted.length > 0 || cleanedEnded.length > 0) {
    const lines = [];
    lines.push(
      `🔎 [${label}] Δ +${cleanedStarted.length} / -${cleanedEnded.length} (baseline: +${totalSinceBaseline.length}, dont IDE: ${baselineInternal})`
    );

    if (startedInternal.length > 0) {
      lines.push(`  🆕 IDE +${startedInternal.length}`);
      startedInternal.slice(0, 12).forEach((p) => {
        lines.push(`    + ${formatProcessInfo(p)}`);
      });
      if (startedInternal.length > 12) lines.push(`    … +${startedInternal.length - 12} autres`);
    }
    if (startedExternal.length > 0) {
      lines.push(`  🌐 EXT +${startedExternal.length}`);
      const extLimit = 20;
      if (startedExternal.length <= extLimit) {
        startedExternal.slice(0, extLimit).forEach((p) => {
          lines.push(`    + ${formatProcessInfo(p)}`);
        });
      }
      if (startedExternal.length > extLimit)
        lines.push(`    … +${startedExternal.length - extLimit} autres`);
    }
    if (endedInternal.length > 0) {
      lines.push(`  🧹 IDE -${endedInternal.length}`);
      endedInternal.slice(0, 12).forEach((p) => {
        lines.push(`    - ${formatProcessInfo(p)}`);
      });
      if (endedInternal.length > 12) lines.push(`    … +${endedInternal.length - 12} autres`);
    }
    if (endedExternal.length > 0) {
      lines.push(`  🧹 EXT -${endedExternal.length}`);
      const extLimit = 20;
      if (endedExternal.length <= extLimit) {
        endedExternal.slice(0, extLimit).forEach((p) => {
          lines.push(`    - ${formatProcessInfo(p)}`);
        });
      }
      if (endedExternal.length > extLimit)
        lines.push(`    … +${endedExternal.length - extLimit} autres`);
    }

    addLogEntry("SYSTEM", lines.join("\n"));
  }

  processDeltaEvents.push({
    timestamp: Date.now(),
    label,
    rootPid: root.pid,
    started: cleanedStarted.map((p) => ({
      pid: p.ProcessId,
      ppid: p.ParentProcessId,
      name: p.Name,
      cmd: p.CommandLine || "",
      internal: isDescendantOf(current, p.ProcessId, root.pid),
    })),
    ended: cleanedEnded.map((p) => ({
      pid: p.ProcessId,
      ppid: p.ParentProcessId,
      name: p.Name,
      cmd: p.CommandLine || "",
      internal: isDescendantOf(lastSnapshot, p.ProcessId, root.pid),
    })),
  });

  lastSnapshot = current;
  return { started: deltaStarted, ended: deltaEnded };
}

function startPhase(id) {
  PHASES_STATUS[id].startTime = Date.now();
  logNewProcesses(`Début Phase: ${PHASES_STATUS[id].label}`);
}

function endPhase(id, status = null) {
  const phase = PHASES_STATUS[id];
  if (phase.startTime) {
    phase.duration = (Date.now() - phase.startTime) / 1000;
  }
  if (status) phase.status = status;
  logNewProcesses(`Fin Phase: ${phase.label}`);
}

const MAIN_REPORT_FILE = path.resolve(LOGS_DIR, "last_report.log");

dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const BRIQUE_COMPILER_PATH = path.join(
  ROOT_DIR,
  "packages",
  "cop-host",
  "scripts",
  "compile-briques.js"
);

const PORTS = {
  TUNNEL: 4040,
  SOVEREIGN: 8880,
  NETLIFY: 8888,
  VITE: 5173, // Port par défaut de Vite (utilisé par Netlify Dev)
};

const COMMANDS = {
  TUNNEL: {
    cmd: "pnpm",
    args: ["run", "tunnel"],
    cwd: path.join(ROOT_DIR, "apps", "platform"),
  },
  SOVEREIGN: {
    cmd: "pnpm",
    args: ["run", "sovereign:up"],
    cwd: path.join(ROOT_DIR, "packages", "models"),
  },
  NETLIFY: {
    cmd: "netlify",
    args: ["dev"],
    cwd: NETLIFY_APP_DIR,
  },
};

// ============================================================================
// SECTION: Logging Engine
// ============================================================================

/**
 * Removes ANSI escape codes from a string.
 * @param {string} str - String potentially containing ANSI codes
 * @returns {string} Clean string without ANSI escape sequences
 */
function stripAnsi(str) {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

/**
 * Adds a timestamped log entry to the global log and optionally prints to console.
 *
 * @param {string} source - Log source identifier (SYSTEM, METRICS, NETLIFY, etc.)
 * @param {string} message - Log message content
 * @param {boolean} [isError=false] - Whether this is an error message (affects coloring)
 * @param {boolean} [silent=false] - If true, only logs to report (not console) unless DEBUG mode
 */
function addLogEntry(source, message, isError = false, silent = false) {
  const now = Date.now();
  const delta = ((now - START_TIME) / 1000).toFixed(3);
  const cleanMessage = stripAnsi(message.trim());
  const entry = {
    timestamp: now,
    delta: delta,
    source: source,
    message: cleanMessage,
    isError: isError,
  };
  allLogEntries.push(entry);

  if (silent && !IS_DEBUG) return;

  // Real-time terminal output
  const color = isError
    ? colors.red
    : source === "SYSTEM"
      ? colors.bright
      : source === "METRICS"
        ? colors.cyan
        : colors.gray;

  process.stdout.write(
    `${colors.gray}[${delta}s]${colors.reset} ${color}[${source}]${colors.reset} ${message.trim()}\n`
  );
}

// Logging is now unified via addLogEntry() - no need for separate logToBoth()

// ============================================================================
// SECTION: Process Manager Class
// ============================================================================

/**
 * Manages lifecycle of a single service process (start, stop, health checks).
 *
 * @class ProcessManager
 * @property {string} name - Service identifier (TUNNEL, SOVEREIGN, NETLIFY)
 * @property {Object} config - Command configuration
 * @property {ChildProcess|null} child - Spawned child process reference
 */
class ProcessManager {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.child = null;
  }

  async start(readyCheck, timeout = 60000) {
    const args = [...this.config.args];
    if (IS_DEBUG && this.name === "NETLIFY") {
      args.push("--debug");
    }

    const rawLogPath = path.join(LOGS_DIR, `${this.name.toLowerCase()}.raw.log`);
    const logStream = fs.createWriteStream(rawLogPath, { flags: "w" });
    addLogEntry(this.name, `Logs bruts redirigés vers: ${rawLogPath}`);

    const fullCmd = `${this.config.cmd} ${args.join(" ")}`;
    addLogEntry(this.name, `DÉMARRAGE: [${fullCmd}] (CWD: ${this.config.cwd})`);

    // On lance check-tunnel indépendamment avant
    if (!IS_STOP && !CLEAR_CACHE && this.name === "NETLIFY") {
      try {
        addLogEntry(this.name, "Vérification préalable du tunnel...");
        execSync("node scripts/check-tunnel.js", { stdio: "inherit" });
      } catch (e) {
        throw new Error("[NETLIFY] La vérification du tunnel a échoué. Arrêt.");
      }
    }

    this.child = spawn(this.config.cmd, args, {
      cwd: this.config.cwd,
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
      env: {
        ...process.env,
        BROWSER: "none",
        FORCE_COLOR: "1",
        DEBUG: IS_DEBUG ? "*" : this.name === "NETLIFY" ? "netlify:*" : undefined,
      },
    });

    if (this.child.pid) {
      trackedProcesses.set(this.name, this.child.pid);
      saveFunctionsCache();
    }

    let isReady = false;
    let logBuffer = "";

    const handleLogLine = (line) => {
      const trimmedRaw = line.trim();
      if (!trimmedRaw) return;

      // Écrire dans le fichier brut
      if (logStream.writable) {
        logStream.write(line + "\n");
      }

      const cleanLine = stripAnsi(trimmedRaw);
      const trimmed = cleanLine.trim();

      if (trimmed) {
        // Détection des fonctions Netlify
        if (this.name === "NETLIFY") {
          // Détection par les logs de Netlify (symboles et messages)
          if (trimmed.includes("Loaded function")) {
            const parts = trimmed.split(/\s+/);
            const name = parts[parts.length - 1];
            if (!detectedFunctions.node.has(name)) {
              detectedFunctions.node.set(name, {
                declared: false,
                loaded: true,
              });
              addLogEntry("DEBUG", `🔍 Fonction Node.js chargée (log) : ${name}`);
              saveFunctionsCache();
            } else {
              detectedFunctions.node.get(name).loaded = true;
            }
          } else if (trimmed.includes("Loaded edge function")) {
            const parts = trimmed.split(/\s+/);
            const name = parts[parts.length - 1];
            if (!detectedFunctions.edge.has(name)) {
              detectedFunctions.edge.set(name, {
                declared: false,
                loaded: true,
              });
              addLogEntry("DEBUG", `🔍 Fonction Edge chargée (log) : ${name}`);
              saveFunctionsCache();
            } else {
              detectedFunctions.edge.get(name).loaded = true;
            }
          } else if (trimmed.includes("◈") || trimmed.includes("⬥")) {
            // Fallback pour les anciens logs ou formats différents
            const parts = trimmed.split(/\s+/);
            const name = parts[parts.length - 1];

            // On évite les faux positifs avec des mots clés
            if (
              name &&
              name.length > 2 &&
              !["functions", "netlify", "loading", "loaded"].includes(name.toLowerCase())
            ) {
              if (trimmed.toLowerCase().includes("edge")) {
                if (!detectedFunctions.edge.has(name)) {
                  detectedFunctions.edge.set(name, {
                    declared: false,
                    loaded: true,
                  });
                  addLogEntry("DEBUG", `🔍 Fonction Edge chargée (fallback edge) : ${name}`);
                  saveFunctionsCache();
                } else {
                  detectedFunctions.edge.get(name).loaded = true;
                }
              } else if (trimmed.toLowerCase().includes("function")) {
                if (!detectedFunctions.node.has(name)) {
                  detectedFunctions.node.set(name, {
                    declared: false,
                    loaded: true,
                  });
                  addLogEntry("DEBUG", `🔍 Fonction Node.js chargée (fallback func) : ${name}`);
                  saveFunctionsCache();
                } else {
                  detectedFunctions.node.get(name).loaded = true;
                }
              }
            }
          }
        }

        // Métriques
        const durationMatch = trimmed.match(
          /(\b\d+(\.\d+)?\s*(ms|s|minutes|seconds)\b|took\s+\d+|Done in\s+\d+)/i
        );
        if (durationMatch) {
          addLogEntry("METRICS", `[${this.name}] ${trimmed}`);
        }

        // Détection des requêtes aux fonctions pour la couverture
        if (this.name === "NETLIFY") {
          if (
            trimmed.includes("Request from") &&
            (trimmed.includes("/.netlify/functions/") || trimmed.includes("/api/"))
          ) {
            addLogEntry("METRICS", `[NETLIFY] ${trimmed}`);
          }
          if (trimmed.includes("Response with status")) {
            addLogEntry("METRICS", `[NETLIFY] ${trimmed}`);
          }
          if (
            trimmed.includes("Server now ready on") ||
            trimmed.includes("Ready on http") ||
            trimmed.includes("Local server running across all listening ports")
          ) {
            const nodeCount = detectedFunctions.node.size;
            const edgeCount = detectedFunctions.edge.size;

            if (nodeCount === 0 && edgeCount === 0) {
              addLogEntry(
                "NETLIFY",
                "⚠️ Attention: Serveur prêt mais aucune fonction détectée ! (Trop tôt ?)"
              );
              // On ne met pas isReady = true tout de suite si on attend des fonctions ?
              // Le user dit "si aucun function... c'est certainement moins que ce qu'on attend".
              // Mais si c'est vraiment "Ready", on ne peut pas faire grand chose de plus.
              // On va quand même marquer ready mais avec un warning, car le processus est techniquement prêt.
              isReady = true;
            } else {
              addLogEntry(
                "NETLIFY",
                `✅ Fin du démarrage. Fonctions chargées: ${nodeCount} Node, ${edgeCount} Edge.`
              );
              isReady = true;
            }
          }
        }

        // Ready checks
        if (this.name === "SOVEREIGN" && trimmed.includes("✅ Sovereign AI Ready")) {
          isReady = true;
        }

        // Logs généraux : on capture TOUT dans le rapport, mais on filtre la console
        const isNoisy =
          trimmed.includes("Reloading") ||
          trimmed.includes("Checking for updates") ||
          (trimmed.match(/^[◈⬥✔ℹ⚠✖]\s/) && !trimmed.includes("Loaded"));

        addLogEntry(this.name, trimmedRaw, false, isNoisy);
      }
    };

    const onData = (data) => {
      logBuffer += data.toString();
      const lines = logBuffer.split("\n");
      logBuffer = lines.pop(); // Garder le dernier morceau incomplet
      lines.forEach(handleLogLine);
    };

    this.child.stdout.on("data", onData);
    this.child.stderr.on("data", onData);

    let exitCode = null;
    this.child.on("exit", (code) => {
      exitCode = code;
    });

    // Wait for ready check
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (exitCode !== null) {
        throw new Error(
          `[${this.name}] Le processus s'est arrêté prématurément avec le code ${exitCode}`
        );
      }

      if (isReady) break;

      // On autorise maintenant le readyCheck pour NETLIFY aussi, car le log parsing est fragile
      if (await readyCheck()) {
        isReady = true;
        addLogEntry(this.name, "✅ Ready check externe (port/http) validé.");
        break;
      }
      if ((Date.now() - startTime) % 10000 < 2000) {
        // Log every ~10s
        addLogEntry(this.name, "En attente de disponibilité...", false, false);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (isReady) {
      addLogEntry(
        this.name,
        `✅ Prêt et vérifié après ${((Date.now() - startTime) / 1000).toFixed(1)}s`
      );
    } else {
      if (this.name === "SOVEREIGN") {
        addLogEntry(
          this.name,
          "⚠️ Le service n'a pas répondu dans les temps. Continuation en mode dégradé.",
          true
        );
        return;
      }
      throw new Error(`[${this.name}] Échec du démarrage.`);
    }
  }

  async stop() {
    if (this.name === "SOVEREIGN") {
      addLogEntry(this.name, "Arrêt propre via sovereign:down...");
      try {
        execSync("pnpm run sovereign:down", {
          cwd: this.config.cwd,
          stdio: "ignore",
        });
      } catch (e) {
        addLogEntry(this.name, "Erreur lors de l'arrêt (déjà arrêté ?)", true);
      }
      this.child = null;
      trackedProcesses.delete(this.name);
      saveFunctionsCache();
      return;
    }

    if (!this.child) return;
    const pid = this.child.pid;
    addLogEntry(this.name, `Arrêt du processus ${pid}...`);
    await killPid(pid, this.name);
    this.child = null;
    trackedProcesses.delete(this.name);
    saveFunctionsCache();
  }
}

// ============================================================================
// SECTION: Process Utilities
// ============================================================================

/**
 * Kills all processes listening on a specific port.
 * Handles both Windows (netstat) and Unix (lsof) systems.
 * Has safety guards to prevent killing system processes (PID < 1000).
 *
 * @param {number} port - Port number to clear
 * @returns {Promise<void>}
 */
async function killByPort(port) {
  if (!port || isNaN(port)) return;

  try {
    let pids = new Set();
    const currentPid = process.pid;

    if (process.platform === "win32") {
      const output = execSync("netstat -ano").toString();
      const lines = output.split("\n");
      // Pattern pour trouver ":PORT" dans la colonne Local Address
      // netstat -ano affiche:  TCP    127.0.0.1:8888         0.0.0.0:0              LISTENING       1234
      const portPattern = new RegExp(`:${port}\\s+`);

      lines.forEach((line) => {
        if (portPattern.test(line)) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1]);
          // SÉCURITÉ : On ne tue pas les PIDs système (< 1000) ni le processus actuel
          if (pid && pid > 1000 && pid !== currentPid) {
            pids.add(pid);
          }
        }
      });
    } else {
      try {
        const output = execSync(`lsof -t -i:${port}`).toString();
        output
          .split("\n")
          .filter((p) => p.trim())
          .forEach((pidStr) => {
            const pid = parseInt(pidStr);
            if (pid && pid > 100 && pid !== currentPid) {
              pids.add(pid);
            }
          });
      } catch (e) {}
    }

    for (const pid of pids) {
      addLogEntry("SYSTEM", `Nettoyage du port ${port} (PID ${pid})...`);
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
        } else {
          process.kill(pid, "SIGKILL");
        }
      } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Checks if a port is currently in use.
 *
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is open and accepting connections
 */
async function checkPort(port) {
  return new Promise((resolve) => {
    const client = net.connect(port, "127.0.0.1", () => {
      client.end();
      resolve(true);
    });
    client.on("error", () => resolve(false));
  });
}

// --- MAIN FLOW ---

const managers = {
  tunnel: new ProcessManager("TUNNEL", COMMANDS.TUNNEL),
  sovereign: new ProcessManager("SOVEREIGN", COMMANDS.SOVEREIGN),
  netlify: new ProcessManager("NETLIFY", COMMANDS.NETLIFY),
};

async function killOrphanedProcesses(graceDelayMs = 0) {
  if (process.platform !== "win32") return;

  if (graceDelayMs > 0) {
    addLogEntry("SYSTEM", `Délai de grâce de ${graceDelayMs}ms avant le nettoyage final...`);
    await new Promise((resolve) => setTimeout(resolve, graceDelayMs));
  }

  // Si on n'a pas activé la vérification des processus et qu'on n'est pas en mode stop/clean,
  // on évite de spammer des logs de nettoyage "intelligent" qui peuvent faire peur.
  const verbose = CHECK_PROCESSES || IS_STOP || CLEAR_CACHE;

  if (verbose) {
    addLogEntry("SYSTEM", "Nettoyage intelligent des processus descendants...");
  }

  try {
    const root = getRootProcessInfo();
    const currentPid = process.pid;

    // Trouver tous les descendants de root.pid qui sont dans notre dossier
    const escapedRoot = ROOT_DIR.replace(/\\/g, "\\\\");
    const targets =
      "node|deno|python|ngrok|pnpm|netlify|esbuild|ruby|conda|cmd|powershell|conhost|brave|chrome|msedge";

    // Commande PowerShell pour trouver les descendants (OPTIMISÉE: 1 seul appel WMI)
    const psCommand = `
      $allProcs = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine;
      function Get-Descendants($p) {
        $allProcs | Where-Object { $_.ParentProcessId -eq $p } | ForEach-Object {
          $_.ProcessId;
          Get-Descendants $_.ProcessId;
        }
      }
      $descendants = Get-Descendants ${root.pid};
      $allProcs | Where-Object {
        ($descendants -contains $_.ProcessId) -and
        ($_.Name -match '${targets}') -and
        ($_.CommandLine -like '*${escapedRoot}*') -and
        ($_.ProcessId -ne ${currentPid}) -and
        ($_.CommandLine -notmatch 'trae|vscode|cursor')
      } | ForEach-Object {
        Write-Output $_.ProcessId;
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue;
      }
    `.replace(/\n/g, " ");

    const output = execSync(`powershell -Command "${psCommand}"`, {
      stdio: "pipe",
    })
      .toString()
      .trim();

    if (output) {
      const killedPids = output.split(/\r?\n/).filter((p) => p.trim());
      addLogEntry(
        "SYSTEM",
        `✅ Nettoyage terminé : ${killedPids.length} processus descendants tués.`
      );
    } else if (verbose) {
      addLogEntry("SYSTEM", "✅ Aucun processus descendant orphelin trouvé.");
    }
  } catch (e) {
    addLogEntry("SYSTEM", `⚠️ Erreur lors du nettoyage: ${e.message}`, true);
  }
}

async function killPid(pid, name = "inconnu") {
  if (!pid) return;
  try {
    addLogEntry("SYSTEM", `Arrêt du processus ${name} (PID ${pid})...`);
    console.log(`${colors.gray}  - Arrêt de ${name} (PID ${pid})...${colors.reset}`);
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
      } catch (e) {
        // Souvent déjà mort ou accès refusé
      }
    } else {
      try {
        process.kill(pid, "SIGKILL");
      } catch (e) {}
    }
    // Petit délai pour laisser le temps à l'OS de nettoyer
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (e) {}
}

async function cleanupAll(force = false, graceDelayMs = 0) {
  addLogEntry("SYSTEM", "Nettoyage des processus et des ports...");

  if (IS_TEST_MODE && !force) {
    addLogEntry(
      "SYSTEM",
      "Mode TEST : on conserve tous les processus actifs (Tunnel, Sovereign, Netlify)."
    );
    return;
  }

  for (const [name, pid] of trackedProcesses.entries()) {
    if (KEEP_NETLIFY && name === "NETLIFY") continue;
    if (!force && IS_INCREMENTAL && (name === "TUNNEL" || name === "SOVEREIGN")) continue;
    await killPid(pid, name);
    trackedProcesses.delete(name);
  }
  saveFunctionsCache();

  if (!KEEP_NETLIFY && (!IS_INCREMENTAL || force)) {
    await killOrphanedProcesses(graceDelayMs);
  }

  let portsToKill =
    IS_INCREMENTAL && !force
      ? [PORTS.NETLIFY, PORTS.VITE]
      : [PORTS.TUNNEL, PORTS.SOVEREIGN, PORTS.NETLIFY, PORTS.VITE];

  if (KEEP_NETLIFY) {
    portsToKill = portsToKill.filter((p) => p !== PORTS.NETLIFY);
  }

  await Promise.all(portsToKill.map((port) => killByPort(port)));
}

function isFunctionTested(f, metricsEntries) {
  const shortName = f.replace(/^gen-/, "");
  const fn = f.toLowerCase();
  const sn = shortName.toLowerCase();

  const matchingEntries = metricsEntries.filter((e) => {
    const msg = e.message.toLowerCase();
    return msg.includes(fn) || msg.includes(`/${sn}`) || msg.includes(` ${sn} `);
  });

  if (matchingEntries.length === 0) return { tested: false, success: false };

  const hasSuccess = matchingEntries.some((e) => {
    const msg = e.message.toLowerCase();
    return (
      msg.includes("200") ||
      msg.includes("204") ||
      msg.includes("success") ||
      msg.includes("loaded")
    );
  });

  return { tested: true, success: hasSuccess };
}

async function generateFinalReport() {
  const reportStream = fs.createWriteStream(MAIN_REPORT_FILE, {
    flags: IS_MANUAL ? "a" : "w",
  });
  reportStream.write(`RAPPORT DE TEST DÉTAILLÉ - ${new Date().toISOString()}\n`);
  reportStream.write(`=============================================\n\n`);

  if (Object.keys(startupConfig).length > 0) {
    reportStream.write("--- CONFIGURATION IMPACTANTE ---\n");
    Object.entries(startupConfig).forEach(([k, v]) => {
      const displayValue =
        k.toLowerCase().includes("key") || k.toLowerCase().includes("token")
          ? `${v.substring(0, 4)}...${v.substring(v.length - 4)}`
          : v;
      reportStream.write(`${k.padEnd(25)}: ${displayValue}\n`);
    });
    reportStream.write("\n");
  }

  const rootInfo = getRootProcessInfo();
  const usingSavedBaseline = fs.existsSync(BASELINE_FILE);
  reportStream.write(`--- ENVIRONNEMENT SYSTÈME ---\n`);
  reportStream.write(`OS                 : ${process.platform}\n`);
  reportStream.write(`Processus Racine   : ${rootInfo.name} (PID: ${rootInfo.pid})\n`);
  reportStream.write(`Baseline           : ${usingSavedBaseline ? "Persistée" : "À chaud"}\n`);
  reportStream.write(`Processus Actuel   : node (PID: ${process.pid})\n\n`);

  reportStream.write("RÉSUMÉ DES PHASES :\n");
  Object.values(PHASES_STATUS).forEach((phase) => {
    const status = phase.status.padEnd(10);
    const duration = phase.duration > 0 ? `[${phase.duration.toFixed(1)}s]` : "";
    reportStream.write(`- ${phase.label.padEnd(30)}: ${status} ${duration}\n`);
  });
  reportStream.write("\n");

  const metricsEntries = allLogEntries.filter((e) => e.source === "METRICS");

  if (processDeltaEvents.length > 0) {
    reportStream.write("--- PROCESSUS: DELTAS PAR ÉTAPE ---\n");
    processDeltaEvents
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((evt) => {
        const deltaSec = ((evt.timestamp - START_TIME) / 1000).toFixed(3);
        reportStream.write(
          `\n[+${deltaSec}s] ${evt.label} (Δ +${evt.started.length} / -${evt.ended.length})\n`
        );

        const startedInternal = evt.started.filter((p) => p.internal).sort((a, b) => a.pid - b.pid);
        const startedExternal = evt.started
          .filter((p) => !p.internal)
          .sort((a, b) => a.pid - b.pid);
        const endedInternal = evt.ended.filter((p) => p.internal).sort((a, b) => a.pid - b.pid);
        const endedExternal = evt.ended.filter((p) => !p.internal).sort((a, b) => a.pid - b.pid);

        const writeList = (title, items, prefix) => {
          if (items.length === 0) return;
          reportStream.write(`${title} (${items.length})\n`);
          items.slice(0, 50).forEach((p) => {
            const cmd = truncateText(
              typeof p.cmd === "string" ? p.cmd.replace(/\s+/g, " ") : "",
              220
            );
            reportStream.write(
              `  ${prefix} ${p.name}(${p.pid}, ppid=${p.ppid})${cmd ? ` [${cmd}]` : ""}\n`
            );
          });
          if (items.length > 50) {
            reportStream.write(`  … +${items.length - 50} autres\n`);
          }
        };

        writeList("  IDE +", startedInternal, "+");
        writeList("  EXT +", startedExternal, "+");
        writeList("  IDE -", endedInternal, "-");
        writeList("  EXT -", endedExternal, "-");
      });
    reportStream.write("\n");
  }

  if (metricsEntries.length > 0) {
    const httpEvents = [];
    const pending = [];

    const cleanedMetrics = metricsEntries
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter((m, idx, arr) => {
        if (idx === 0) return true;
        return m.message !== arr[idx - 1].message;
      });

    cleanedMetrics.forEach((m) => {
      const msg = m.message || "";
      const reqMatch = msg.match(
        /^\[NETLIFY\]\s+Request from .*:\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+(\S+)/i
      );
      if (reqMatch) {
        pending.push({
          method: reqMatch[1].toUpperCase(),
          path: reqMatch[2],
          timestamp: m.timestamp,
        });
        return;
      }

      const resMatch = msg.match(/^\[NETLIFY\]\s+Response with status\s+(\d+)\s+in\s+(\d+)\s*ms/i);
      if (resMatch) {
        const status = parseInt(resMatch[1], 10);
        const durationMs = parseInt(resMatch[2], 10);
        const req = pending.shift();
        httpEvents.push({
          status,
          durationMs,
          method: req?.method || "?",
          path: req?.path || "?",
          timestamp: m.timestamp,
        });
      }
    });

    if (httpEvents.length > 0) {
      const statusByPath = new Map();
      httpEvents.forEach((e) => {
        const key = `${e.method} ${e.path}`;
        const current = statusByPath.get(key) || new Map();
        current.set(e.status, (current.get(e.status) || 0) + 1);
        statusByPath.set(key, current);
      });

      reportStream.write("--- HTTP (NETLIFY): RÉSUMÉ DES STATUTS ---\n");
      Array.from(statusByPath.entries())
        .sort((a, b) => {
          const aCount = Array.from(a[1].values()).reduce((x, y) => x + y, 0);
          const bCount = Array.from(b[1].values()).reduce((x, y) => x + y, 0);
          return bCount - aCount;
        })
        .slice(0, 60)
        .forEach(([k, statusMap]) => {
          const parts = Array.from(statusMap.entries())
            .sort(([sa], [sb]) => sa - sb)
            .map(([s, c]) => `${s}x${c}`)
            .join(", ");
          reportStream.write(`- ${k} -> ${parts}\n`);
        });

      const httpErrors = httpEvents.filter((e) => e.status >= 400);
      if (httpErrors.length > 0) {
        reportStream.write("\n--- HTTP (NETLIFY): ERREURS (4xx/5xx) ---\n");
        httpErrors.slice(-80).forEach((e) => {
          reportStream.write(`- ${e.method} ${e.path} -> ${e.status} (${e.durationMs}ms)\n`);
        });
      }

      reportStream.write("\n");
    }
  }

  const errors = allLogEntries.filter((e) => e.isError);
  if (errors.length > 0) {
    reportStream.write("--- ERREURS: EXTRAIT ---\n");
    errors.slice(-120).forEach((e) => {
      reportStream.write(`[+${e.delta}s] [${e.source}] ${e.message}\n`);
    });
    reportStream.write("\n");
  }

  const testInteresting = allLogEntries.filter((e) => {
    if (e.source !== "TESTS") return false;
    if (e.isError) return true;
    return /(\bfailed\b|\berror\b|\btimeout\b|✘|×|AssertionError)/i.test(e.message);
  });
  if (testInteresting.length > 0) {
    reportStream.write("--- TESTS: EXTRAIT IMPORTANT ---\n");
    testInteresting.slice(-200).forEach((e) => {
      reportStream.write(`[+${e.delta}s] ${e.message}\n`);
    });
    reportStream.write("\n");
  }

  if (detectedFunctions.node.size > 0 || detectedFunctions.edge.size > 0) {
    reportStream.write("--- FONCTIONS DÉTECTÉES (NETLIFY) ---\n");
    reportStream.write("Légende : [L] Loaded, [T] Declared in TOML, ✅ Tested\n\n");

    if (detectedFunctions.node.size > 0) {
      reportStream.write("Node.js Functions:\n");
      Array.from(detectedFunctions.node.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([f, info]) => {
          const check = isFunctionTested(f, metricsEntries);
          const status = `[${info.loaded ? "L" : " "}${info.declared ? "T" : " "}]`;
          const icon = check.success ? "✅" : check.tested ? "⚠️" : "❌";
          reportStream.write(`  ${icon} ${status} ${f}\n`);
        });
    }

    if (detectedFunctions.edge.size > 0) {
      reportStream.write("\nEdge Functions (Deno):\n");
      Array.from(detectedFunctions.edge.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([f, info]) => {
          const check = isFunctionTested(f, metricsEntries);
          const status = `[${info.loaded ? "L" : " "}${info.declared ? "T" : " "}]`;
          const icon = check.success ? "✅" : check.tested ? "⚠️" : "❌";
          reportStream.write(`  ${icon} ${status} ${f}\n`);
        });
    }
    reportStream.write("\n");
  }

  if (metricsEntries.length > 0) {
    reportStream.write(`\n--- MÉTRIQUES DÉTECTÉES ---\n`);
    metricsEntries.forEach((m) => {
      reportStream.write(`${m.message}\n`);
    });
    reportStream.write("\n");
  }

  const finalSnapshot = getProcessSnapshot();
  const remaining = diffProcessSnapshot(finalSnapshot);
  if (remaining.length > 0) {
    reportStream.write("\n🚨 PROCESSUS RÉSIDUELS DÉTECTÉS (FUITES POTENTIELLES) :\n");
    reportStream.write("--------------------------------------------------\n");

    // Grouper par processus parent pour montrer la hiérarchie des fuites
    const residualMap = new Map(remaining.map((p) => [p.ProcessId, p]));
    const roots = remaining.filter((p) => !residualMap.has(p.ParentProcessId));

    roots.forEach((root) => {
      reportStream.write(
        stripAnsi(
          visualizeProcessHierarchy(new Map([...initialSnapshot, ...residualMap]), root.ProcessId)
        )
      );
    });

    reportStream.write(
      "\nConseil : Utilisez 'taskkill /F /PID <PID>' pour nettoyer manuellement si nécessaire.\n\n"
    );
  }

  reportStream.write(`SÉQUENCE LINÉAIRE DES ÉVÉNEMENTS :\n`);
  reportStream.write(`---------------------------------------------\n`);

  // Sort entries by timestamp
  allLogEntries.sort((a, b) => a.timestamp - b.timestamp);

  allLogEntries.forEach((entry) => {
    const timePrefix = `[+${entry.delta}s]`.padEnd(12);
    const sourcePrefix = `[${entry.source}]`.padEnd(12);
    const errorMarker = entry.isError ? " ERR: " : " ";
    reportStream.write(`${timePrefix}${sourcePrefix}${errorMarker}${entry.message}\n`);
  });

  return new Promise((resolve, reject) => {
    reportStream.on("finish", () => resolve(MAIN_REPORT_FILE));
    reportStream.on("error", (err) => reject(err));
    reportStream.end();
  });
}

function displaySummaryReport() {
  console.log(`\n${colors.bright}=============================================${colors.reset}`);
  console.log(`${colors.bright}   RÉSUMÉ DE L'EXÉCUTION                     ${colors.reset}`);
  console.log(`${colors.bright}=============================================${colors.reset}`);

  let hasError = false;
  Object.values(PHASES_STATUS).forEach((phase) => {
    let icon = "⏳";
    let color = colors.reset;

    switch (phase.status) {
      case "SUCCESS":
        icon = "✅";
        color = colors.green;
        break;
      case "FAILED":
        icon = "❌";
        color = colors.red;
        hasError = true;
        break;
      case "WARNING":
        icon = "⚠️";
        color = colors.yellow;
        break;
      case "SKIPPED":
        icon = "⏭️";
        color = colors.cyan;
        break;
    }

    console.log(
      `${icon} ${phase.label.padEnd(30)}: ${color}${phase.status.padEnd(10)}${colors.reset}${phase.duration > 0 ? ` [${phase.duration.toFixed(1)}s]` : ""}`
    );
  });

  console.log(`${colors.bright}---------------------------------------------${colors.reset}`);

  const metricsEntries = allLogEntries.filter((e) => e.source === "METRICS");
  if (detectedFunctions.node.size > 0 || detectedFunctions.edge.size > 0) {
    console.log(`${colors.bright}COUVERTURE DES FONCTIONS :${colors.reset}`);

    const allFuncs = [
      ...Array.from(detectedFunctions.node.entries()).map(([f, info]) => ({
        name: f,
        type: "Node",
        info,
      })),
      ...Array.from(detectedFunctions.edge.entries()).map(([f, info]) => ({
        name: f,
        type: "Edge",
        info,
      })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    let testedCount = 0;
    const untested = [];

    allFuncs.forEach((fn) => {
      const check = isFunctionTested(fn.name, metricsEntries);
      if (check.success) {
        testedCount++;
        console.log(`  ${colors.green}✅ [${fn.type}] ${fn.name}${colors.reset}`);
      } else if (check.tested) {
        console.log(
          `  ${colors.yellow}⚠️ [${fn.type}] ${fn.name} (Appelé mais statut inconnu)${colors.reset}`
        );
        untested.push(fn);
      } else {
        untested.push(fn);
      }
    });

    if (untested.length > 0) {
      console.log(
        `\n${colors.bright}FONCTIONS RESTANTES À TESTER (${untested.length}) :${colors.reset}`
      );
      untested.forEach((fn) => {
        console.log(`  ${colors.red}❌ [${fn.type}] ${fn.name}${colors.reset}`);
      });
    }

    const total = allFuncs.length;
    console.log(`\nScore: ${testedCount}/${total} (${Math.round((testedCount / total) * 100)}%)`);
    console.log(`${colors.bright}---------------------------------------------${colors.reset}`);
  }

  if (hasError) {
    console.log(`${colors.red}${colors.bright}ÉTAT FINAL: ÉCHEC${colors.reset}`);
  } else {
    console.log(`${colors.green}${colors.bright}ÉTAT FINAL: SUCCÈS${colors.reset}`);
  }
  console.log(`${colors.bright}=============================================${colors.reset}\n`);
}

async function checkPlaywright() {
  if (!CURRENT_APP.playwright.enabled) {
    addLogEntry("SYSTEM", "Playwright non configuré pour cette app, phase ignorée.");
    return true;
  }

  const cmd = `pnpm --filter ${CURRENT_APP.playwright.filter} exec playwright install chromium`;

  // Utilisation du cache si possible
  if (!NO_CACHE && fs.existsSync(CACHE_FILE)) {
    const stats = fs.statSync(CACHE_FILE);
    const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

    // Si le cache a moins de 24h, on saute la vérification
    if (ageInHours < 24) {
      addLogEntry(
        "SYSTEM",
        `✅ Utilisation du cache pour Playwright (âge: ${ageInHours.toFixed(1)}h)`
      );
      return true;
    }
  }

  addLogEntry("SYSTEM", `Vérification de Playwright... ([${cmd}])`);
  try {
    const output = execSync(cmd, {
      cwd: ROOT_DIR,
      stdio: "pipe", // On capture pour le log
    });
    output
      .toString()
      .split("\n")
      .forEach((line) => {
        if (line.trim()) addLogEntry("PLAYWRIGHT", line.trim());
      });

    // On met à jour le cache
    fs.writeFileSync(CACHE_FILE, new Date().toISOString());
    return true;
  } catch (e) {
    addLogEntry("SYSTEM", "❌ Échec de l'installation de Playwright.", true);
    if (e.stdout) addLogEntry("PLAYWRIGHT", e.stdout.toString(), true);
    if (e.stderr) addLogEntry("PLAYWRIGHT", e.stderr.toString(), true);
    return false;
  }
}

function resolveTestTarget() {
  switch (TEST_SUITE) {
    case "all":
      return null;
    case "api":
      return "tests/integration/api.spec.js";
    case "briques":
    case "brique":
      return "tests/integration/gen-briques-tests.js";
    case "tools":
      return "tests/integration/tools.spec.js";
    case "backend":
      return "tests/integration/backend_simulation.spec.js";
    case "mic":
      return "tests/integration/smart_mic.spec.js";
    default:
      return TEST_SUITE;
  }
}

async function runTests() {
  if (!CURRENT_APP.playwright.enabled) {
    addLogEntry("SYSTEM", "Tests Playwright non configurés pour cette app, phase ignorée.");
    return true;
  }

  const cmd = "pnpm";
  const target = resolveTestTarget();

  const baseArgs = ["--filter", CURRENT_APP.playwright.filter, "exec", "playwright", "test"];

  const args = target ? [...baseArgs, target] : baseArgs;

  addLogEntry("SYSTEM", `Lancement des tests d'intégration... ([${cmd} ${args.join(" ")}])`);

  const timeoutMs = 15 * 60 * 1000;

  return await new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT_DIR,
      shell: true,
      env: {
        ...process.env,
        TEST_BASE_URL: `http://localhost:${PORTS.NETLIFY}`,
      },
    });

    const onLine = (chunk, isError = false) => {
      chunk
        .toString()
        .split("\n")
        .forEach((line) => {
          if (!line.trim()) return;
          addLogEntry("TESTS", line.trim(), isError);
          if (!isError) {
            const durationMatch = line.match(/(\b\d+(\.\d+)?\s*(ms|s|minutes|seconds)\b)/i);
            if (durationMatch) {
              addLogEntry("METRICS", `[TESTS] ${line.trim()}`);
            }
          }
        });
    };

    child.stdout.on("data", (chunk) => onLine(chunk, false));
    child.stderr.on("data", (chunk) => onLine(chunk, true));

    child.on("error", (err) => {
      addLogEntry(
        "SYSTEM",
        `❌ Impossible de lancer les tests d'intégration: ${err.message}`,
        true
      );
      resolve(false);
    });

    const timeout = setTimeout(() => {
      addLogEntry(
        "SYSTEM",
        `❌ Timeout des tests d'intégration après ${timeoutMs / 60000} minutes`,
        true
      );
      try {
        child.kill("SIGTERM");
      } catch {}
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 5000);
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        addLogEntry("SYSTEM", "✅ Tous les tests d'intégration ont réussi.");
        resolve(true);
      } else {
        addLogEntry("SYSTEM", `❌ Tests d'intégration terminés avec le code ${code}.`, true);
        resolve(false);
      }
    });
  });
}

async function runBriqueCompiler() {
  const cmd = "node";
  const args = [BRIQUE_COMPILER_PATH];

  addLogEntry("SYSTEM", `Lancement du compilateur de briques... ([${cmd} ${args.join(" ")}])`);

  const startTime = Date.now();

  return await new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT_DIR,
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
    });

    const onLine = (chunk, isError = false) => {
      chunk
        .toString()
        .split("\n")
        .forEach((line) => {
          if (!line.trim()) return;
          addLogEntry("BRIQUES", line.trim(), isError);
        });
    };

    child.stdout.on("data", (chunk) => onLine(chunk, false));
    child.stderr.on("data", (chunk) => onLine(chunk, true));

    child.on("error", (err) => {
      addLogEntry(
        "SYSTEM",
        `❌ Impossible de lancer le compilateur de briques: ${err.message}`,
        true
      );
      resolve(false);
    });

    child.on("close", (code) => {
      const duration = (Date.now() - startTime) / 1000;
      if (code === 0) {
        addLogEntry("METRICS", `[BRIQUES] Compilation terminée en ${duration.toFixed(1)}s`);
        resolve(true);
      } else {
        addLogEntry(
          "SYSTEM",
          `❌ Compilateur de briques terminé avec le code ${code} après ${duration.toFixed(1)}s`,
          true
        );
        resolve(false);
      }
    });
  });
}

async function startRepl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.magenta}MANUAL>${colors.reset} `,
  });

  const reportUrl = `file:///${MAIN_REPORT_FILE.replace(/\\/g, "/")}`;
  console.log(`\n${colors.cyan}--- MODE MANUEL ACTIF ---${colors.reset}`);
  console.log(`Les services restent actifs. Les logs sont collectés.`);
  console.log(`Rapport actuel: ${reportUrl}`);
  console.log(`Tapez 'help' pour voir les commandes disponibles.\n`);

  rl.prompt();

  rl.on("line", async (line) => {
    const args = line.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const rest = args.slice(1).join(" ");

    switch (cmd) {
      case "status":
        console.log(`\n${colors.bright}ÉTAT DES SERVICES :${colors.reset}`);
        console.log(
          `Tunnel    : ${trackedProcesses.has("TUNNEL") ? colors.green + "Actif (PID " + trackedProcesses.get("TUNNEL") + ")" : colors.red + "Inactif"}${colors.reset}`
        );
        console.log(
          `Sovereign : ${trackedProcesses.has("SOVEREIGN") ? colors.green + "Actif (PID " + trackedProcesses.get("SOVEREIGN") + ")" : colors.red + "Inactif"}${colors.reset}`
        );
        console.log(
          `Netlify   : ${trackedProcesses.has("NETLIFY") ? colors.green + "Actif (PID " + trackedProcesses.get("NETLIFY") + ")" : colors.red + "Inactif"}${colors.reset}`
        );

        const tPort = await checkPort(PORTS.TUNNEL);
        const sPort = await checkPort(PORTS.SOVEREIGN);
        const nPort = await checkPort(PORTS.NETLIFY);

        console.log(`\n${colors.bright}PORTS :${colors.reset}`);
        console.log(
          `Tunnel (${PORTS.TUNNEL})    : ${tPort ? colors.green + "OUVERT" : colors.red + "FERMÉ"}${colors.reset}`
        );
        console.log(
          `Sovereign (${PORTS.SOVEREIGN}) : ${sPort ? colors.green + "OUVERT" : colors.red + "FERMÉ"}${colors.reset}`
        );
        console.log(
          `Netlify (${PORTS.NETLIFY})   : ${nPort ? colors.green + "OUVERT" : colors.red + "FERMÉ"}${colors.reset}`
        );
        break;

      case "urls":
        console.log(`\n${colors.bright}URLS D'ACCÈS :${colors.reset}`);
        console.log(`App Locale : http://localhost:${PORTS.NETLIFY}`);
        console.log(`Sovereign  : http://localhost:${PORTS.SOVEREIGN}`);
        console.log(`Tunnel     : (Voir logs initiaux ou http://localhost:4040/status)`);
        break;

      case "mark":
        if (!rest) {
          console.log(`${colors.yellow}Usage: mark <message>${colors.reset}`);
        } else {
          const msg = `📌 MARK: ${rest}`;
          addLogEntry("MANUAL", msg);
          console.log(`${colors.green}Marqueur ajouté dans les logs et le rapport.${colors.reset}`);
        }
        break;

      case "report":
        console.log(`${colors.yellow}Génération du rapport en cours...${colors.reset}`);
        await generateFinalReport();
        console.log(`${colors.green}Rapport mis à jour : ${reportUrl}${colors.reset}`);
        break;

      case "delta":
        console.log(`${colors.yellow}Calcul du delta des processus...${colors.reset}`);
        const deltaResult = logNewProcesses("MANUAL DELTA");
        if (deltaResult.started.length === 0 && deltaResult.ended.length === 0) {
          console.log(`${colors.green}Aucun changement de processus détecté.${colors.reset}`);
        }
        break;

      case "exit":
      case "quit":
        rl.close();
        break;

      case "help":
        console.log(`\n${colors.bright}COMMANDES DISPONIBLES :${colors.reset}`);
        console.log(`  status       : Affiche l'état des processus et des ports.`);
        console.log(`  urls         : Affiche les URLs d'accès.`);
        console.log(`  mark <msg>   : Ajoute un marqueur visible dans les logs/rapport.`);
        console.log(`  report       : Force la mise à jour du rapport maintenant.`);
        console.log(`  exit / quit  : Arrête tout et quitte.`);
        console.log(`  clear / cls  : Efface l'écran.`);
        break;

      case "clear":
      case "cls":
        console.clear();
        break;

      case "":
        break;

      default:
        console.log(`${colors.red}Commande inconnue: ${cmd}${colors.reset}`);
        break;
    }
    rl.prompt();
  }).on("close", async () => {
    console.log(`\n${colors.yellow}Fermeture du mode manuel...${colors.reset}`);
    await handleExit("REPL_EXIT");
  });
}

async function main() {
  logBaseline();
  console.log(`\n${colors.bright}=============================================${colors.reset}`);
  console.log(
    `${colors.bright}   DÉMARRAGE ${CURRENT_APP.label} - PIPELINE DE CONTRÔLE   ${colors.reset}`
  );
  console.log(`${colors.bright}=============================================\n${colors.reset}`);

  try {
    startPhase("CLEANUP");
    await cleanupAll();
    endPhase("CLEANUP", "SUCCESS");

    // 1. Supabase Check
    addLogEntry("SYSTEM", "PHASE 1: VÉRIFICATION SUPABASE");
    startPhase("SUPABASE");
    try {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Credentials Supabase manquantes");

      const supabase = createClient(url, key);
      const { data: configData, error } = await supabase
        .from("instance_config")
        .select("key, value");

      if (error) throw error;

      addLogEntry("SYSTEM", `✅ Supabase OK (${configData.length} config items)`);
      endPhase("SUPABASE", "SUCCESS");

      // Extract and display impactful config
      configData.forEach((row) => {
        const k = row.key.trim();
        const lowerK = k.toLowerCase();
        const isImpactful = IMPACTFUL_KEYS.some((ik) => ik.toLowerCase() === lowerK);

        if (isImpactful) {
          startupConfig[k] = row.value;
          const displayValue =
            k.toLowerCase().includes("key") || k.toLowerCase().includes("token")
              ? `${row.value.substring(0, 4)}...${row.value.substring(row.value.length - 4)}`
              : row.value;
          addLogEntry("CONFIG", `Found: ${k} = ${displayValue}`);
        }
      });
      logNewProcesses("SUPABASE");
    } catch (e) {
      endPhase("SUPABASE", "FAILED");
      throw e;
    }

    addLogEntry("SYSTEM", "PHASE 2: COMPILATION DES BRIQUES");
    startPhase("BRIQUES");
    try {
      const ok = await runBriqueCompiler();
      endPhase("BRIQUES", ok ? "SUCCESS" : "FAILED");
    } catch (e) {
      endPhase("BRIQUES", "FAILED");
      throw e;
    }
    logNewProcesses("BRIQUES");

    // 3. Tunnel
    addLogEntry("SYSTEM", "PHASE 3: LANCEMENT DU TUNNEL");
    startPhase("TUNNEL");
    try {
      if (IS_INCREMENTAL && (await checkPort(PORTS.TUNNEL))) {
        addLogEntry("SYSTEM", "✅ Tunnel déjà actif (mode incrémental)");
        endPhase("TUNNEL", "SKIPPED");
      } else {
        await managers.tunnel.start(async () => await checkPort(PORTS.TUNNEL));
        endPhase("TUNNEL", "SUCCESS");
      }
      logNewProcesses("TUNNEL");
    } catch (e) {
      endPhase("TUNNEL", "FAILED");
      throw e;
    }

    // 4. Sovereign AI (LLM + TTS)
    addLogEntry("SYSTEM", "PHASE 4: LANCEMENT SOVEREIGN AI (LLM + TTS)");
    startPhase("SOVEREIGN");
    try {
      if (IS_INCREMENTAL && (await checkPort(PORTS.SOVEREIGN))) {
        addLogEntry("SYSTEM", "✅ Sovereign déjà actif (mode incrémental)");
        endPhase("SOVEREIGN", "SKIPPED");
      } else {
        await managers.sovereign.start(async () => {
          try {
            const res = await fetch(`http://localhost:${PORTS.SOVEREIGN}/health`);
            if (!res.ok) return false;
            const data = await res.json();
            return data.status === "ok" || data.status === "degraded";
          } catch (e) {
            return false;
          }
        }, 180000);
        endPhase("SOVEREIGN", "SUCCESS");
      }
      logNewProcesses("SOVEREIGN");
    } catch (e) {
      endPhase("SOVEREIGN", "FAILED");
      throw e;
    }

    // 5. Netlify Dev
    addLogEntry("SYSTEM", `PHASE 5: LANCEMENT NETLIFY DEV (${CURRENT_APP.label})`);
    startPhase("NETLIFY");
    loadNetlifyTomlFunctions();
    try {
      const checkNetlifyHealth = async () => {
        try {
          const url = `http://127.0.0.1:${PORTS.NETLIFY}/api/health`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            const text = await res.text();
            if (res.ok) {
              return true;
            }
            addLogEntry("DEBUG", `Check health failed: status ${res.status}`, false, true);
            return false;
          } catch (e) {
            clearTimeout(timeoutId);
            return false;
          }
        } catch (e) {
          return false;
        }
      };

      const reuseExisting =
        (IS_TEST_MODE || KEEP_NETLIFY) &&
        (await checkPort(PORTS.NETLIFY)) &&
        (await checkNetlifyHealth());

      if (reuseExisting) {
        addLogEntry(
          "SYSTEM",
          `✅ Netlify déjà actif et healthy (${IS_TEST_MODE ? "mode test" : "--keep-netlify"})`
        );
        endPhase("NETLIFY", "SKIPPED");
      } else {
        await managers.netlify.start(checkNetlifyHealth, 240000);
        endPhase("NETLIFY", "SUCCESS");
      }
      logNewProcesses("NETLIFY");
    } catch (e) {
      endPhase("NETLIFY", "FAILED");
      throw e;
    }

    // 6. Tests d'intégration
    if (!IS_MANUAL) {
      addLogEntry("SYSTEM", "PHASE 6: TESTS D'INTÉGRATION");
      try {
        startPhase("PLAYWRIGHT");
        const playwrightOk = await checkPlaywright();
        endPhase("PLAYWRIGHT", playwrightOk ? "SUCCESS" : "FAILED");

        if (playwrightOk) {
          startPhase("TESTS");
          const testSuccess = await runTests();
          endPhase("TESTS", testSuccess ? "SUCCESS" : "FAILED");
          if (!testSuccess) throw new Error("Les tests d'intégration ont échoué.");
        } else {
          PHASES_STATUS.TESTS.status = "SKIPPED";
        }
        logNewProcesses("TESTS");
      } catch (e) {
        if (PHASES_STATUS.TESTS.status === "PENDING") {
          endPhase("TESTS", "FAILED");
        }
        throw e;
      }
    } else {
      PHASES_STATUS.PLAYWRIGHT.status = "SKIPPED";
      PHASES_STATUS.TESTS.status = "SKIPPED";
      addLogEntry(
        "SYSTEM",
        "Mode MANUAL : tests automatiques désactivés (Playwright + intégration)."
      );
    }

    addLogEntry("SYSTEM", "🚀 TOUT EST PRÊT !");
    console.log(`\n${colors.green}Application: http://localhost:${PORTS.NETLIFY}${colors.reset}`);

    if (!IS_MANUAL) {
      displaySummaryReport();
      await generateFinalReport();
      const reportUrl = `file:///${MAIN_REPORT_FILE.replace(/\\/g, "/")}`;
      console.log(`\nRAPPORT FINAL: ${reportUrl} [1:1]`);

      logNewProcesses("Vérification Finale");

      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } else {
      await generateFinalReport();
      addLogEntry(
        "SYSTEM",
        "Mode MANUAL : services prêts, logs en cours de collecte. Ctrl+C pour générer le rapport final."
      );
      const reportUrl = `file:///${MAIN_REPORT_FILE.replace(/\\/g, "/")}`;
      console.log(
        `\nMode MANUAL: les logs continueront à être collectés. Ctrl+C pour fermer et générer le rapport: ${reportUrl}`
      );
    }
  } catch (err) {
    if (isExiting) return;
    addLogEntry("SYSTEM", `💥 ERREUR FATALE: ${err.message}`, true);
    await cleanupAll(true, 5000); // Force cleanup on error with 5s grace

    displaySummaryReport();
    await generateFinalReport();
    const reportUrl = `file:///${MAIN_REPORT_FILE.replace(/\\/g, "/")}`;
    console.log(`\nRAPPORT D'ERREUR: ${reportUrl} [1:1]`);
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

let isExiting = false;

const handleExit = async (signal) => {
  if (isExiting) {
    console.log(`\n${colors.red}⚠️  Arrêt forcé demandé !${colors.reset}`);
    process.exit(1);
  }
  isExiting = true;

  addLogEntry("SYSTEM", `Signal ${signal} reçu, nettoyage final...`);
  console.log(
    `\n${colors.yellow}🛑 Arrêt en cours... (Ctrl+C à nouveau pour forcer)${colors.reset}`
  );

  await cleanupAll(true, 3000); // 3s de grâce sur interruption manuelle
  await generateFinalReport();
  process.exit(0);
};

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

if (SHOW_HELP) {
  displayHelp();
  process.exit(0);
}

if (IS_STOP) {
  (async () => {
    console.log(`${colors.bright}ARRÊT DES SERVICES...${colors.reset}`);
    await cleanupAll(true, 3000);
    await generateFinalReport();
    console.log(`\n${colors.green}Tous les services ont été arrêtés.${colors.reset}`);
    process.exit(0);
  })();
} else if (CLEAR_CACHE) {
  (async () => {
    console.log(`${colors.bright}NETTOYAGE COMPLET...${colors.reset}`);

    // 0. Suppression de la baseline si demandée via un flag additionnel ou si on veut repartir de zéro
    if (ARGS.includes("--reset-baseline")) {
      if (fs.existsSync(BASELINE_FILE)) {
        fs.unlinkSync(BASELINE_FILE);
        console.log(`${colors.green}✅ Baseline supprimée.${colors.reset}`);
      }
    }
    if (trackedProcesses.size > 0) {
      console.log(`${colors.yellow}Arrêt des processus trackés...${colors.reset}`);
      for (const [name, pid] of trackedProcesses.entries()) {
        await killPid(pid, name);
      }
    }

    // 2. Nettoyage agressif des orphelins
    await killOrphanedProcesses();

    // 3. Suppression des caches
    let cleared = false;
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log(`${colors.green}✅ Cache Playwright effacé.${colors.reset}`);
      cleared = true;
    }
    if (fs.existsSync(FUNCTIONS_CACHE_FILE)) {
      fs.unlinkSync(FUNCTIONS_CACHE_FILE);
      console.log(`${colors.green}✅ Cache Fonctions effacé.${colors.reset}`);
      cleared = true;
    }
    if (!cleared) {
      console.log("Aucun fichier de cache à supprimer.");
    }

    console.log(
      `\n${colors.bright}Nettoyage terminé. Relancez sans --clear-cache pour démarrer.${colors.reset}`
    );
    process.exit(0);
  })();
} else {
  main();
}
