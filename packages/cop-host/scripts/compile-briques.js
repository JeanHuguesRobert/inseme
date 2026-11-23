#!/usr/bin/env node
/**
 * Brique Compiler
 * Scans the monorepo to find brique.config.js and generates the necessary entry points.
 */

import { glob, globSync } from "glob";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import {
  writeFileSync as fsWriteFileSync,
  mkdirSync as fsMkdirSync,
  existsSync,
  rmSync,
  readFileSync,
  cpSync as fsCpSync,
  symlinkSync as fsSymlinkSync,
} from "fs";
import { platform } from "os";
import { loadBriqueProfile, selectBriqueCapabilities } from "../src/brique-profile.js";
import { auditPublicProjections } from "../src/public-projection-audit.js";

/**
 * PATH NORMALIZATION
 */
function validatePath(path, operation) {
  const absPath = resolve(path).replace(/\\/g, "/");
  // console.log(`  [FS ${operation}] -> ${absPath}`);
  return absPath;
}

const writeFileSync = (path, content, options) => {
  const safePath = validatePath(path, "WRITE");
  return fsWriteFileSync(safePath, content, options);
};

const mkdirSync = (path, options) => {
  const safePath = validatePath(path, "MKDIR");
  return fsMkdirSync(safePath, options);
};

const symlinkSync = (target, path, type) => {
  const safePath = validatePath(path, "SYMLINK");
  return fsSymlinkSync(target, safePath, type);
};

const cpSync = (src, dest, options) => {
  const safeDest = validatePath(dest, "COPY");
  return fsCpSync(src, safeDest, options);
};

import { Contract } from "../src/lib/contract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Locates the monorepo root robustly
 */
function findRoot(startDir) {
  let current = resolve(startDir);
  const isVerbose =
    process.argv.includes("--verbose") || process.argv.includes("-v") || process.env.DEBUG;

  if (isVerbose) console.log(`🔍 Root search starting at: ${current}`);

  while (current !== dirname(current)) {
    const hasWorkspace = existsSync(join(current, "pnpm-workspace.yaml"));
    const hasApps = existsSync(join(current, "apps"));
    const hasPackages = existsSync(join(current, "packages"));

    if (isVerbose) {
      console.log(
        `  Checking: ${current} (workspace:${hasWorkspace}, apps:${hasApps}, pkgs:${hasPackages})`
      );
    }

    const pathParts = current.toLowerCase().split(/[/]/);
    const isInsideApps = pathParts.includes("apps");

    if (hasWorkspace || (hasApps && hasPackages)) {
      if (isVerbose) console.log(`🎯 ROOT FOUND: ${current}`);
      return current;
    }
    current = dirname(current);
  }
  console.warn("⚠️ Warning: Could not locate monorepo root. Using current directory as fallback.");
  return resolve(".");
}

const ROOT = findRoot(__dirname);
const APPS_PATH = join(ROOT, "apps");

function readCliOption(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const selectedHostApp = readCliOption("--app");
const profileArgument = readCliOption("--profile");
const isProjectionAudit = process.argv.includes("--check-projections");
const isReportOnly = process.argv.includes("--report") || isProjectionAudit;
const auditBrique = readCliOption("--brique");
const profilePath = profileArgument
  ? resolve(
      profileArgument.includes("/") ||
        profileArgument.includes("\\") ||
        profileArgument.endsWith(".json")
        ? profileArgument
        : join(
            APPS_PATH,
            selectedHostApp || profileArgument,
            "brique-profiles",
            `${profileArgument}.json`
          )
    )
  : null;
const BRIQUE_PROFILE = profilePath ? loadBriqueProfile(profilePath) : null;

if (BRIQUE_PROFILE && selectedHostApp && selectedHostApp !== BRIQUE_PROFILE.host_app) {
  throw new Error(
    `Profile ${BRIQUE_PROFILE.id} belongs to host app ${BRIQUE_PROFILE.host_app}, not ${selectedHostApp}`
  );
}

const isDebug = process.argv.includes("--debug");
const isVerbose =
  process.argv.includes("--verbose") || process.argv.includes("-v") || process.env.DEBUG || isDebug;

/**
 * Maturity status of a brique.
 * Different briques evolve at different speeds.
 */
const BRIQUE_STATUSES = {
  SKELETON: "skeleton", // Very early: mostly declarations, many missing handlers
  EXPERIMENTAL: "experimental", // Functional but unstable / subject to big changes
  ACTIVE: "active", // Normal, mature state (default)
  DEPRECATED: "deprecated", // Still works but should not be used for new work
};

/**
 * Current global reality (as of late May 2026):
 * A massive refactoring was done end of 2025 and is still incomplete.
 * No brique is currently considered fully "active".
 * Therefore we default to "experimental" rather than "active".
 */
const DEFAULT_STATUS = BRIQUE_STATUSES.EXPERIMENTAL;

if (isVerbose) console.log(`🚀 Compiler started. CWD: ${process.cwd()} | ROOT: ${ROOT}`);

function safeMkdir(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    if (isVerbose) console.log(`  📁 Creation dossier: ${relative(ROOT, absolutePath)}`);
    mkdirSync(absolutePath, { recursive: true });
  }
}

function netlifyOutputDir(appPath, kind) {
  if (!BRIQUE_PROFILE) return join(appPath, "netlify", kind);
  return join(appPath, "netlify", "profiles", BRIQUE_PROFILE.id, kind);
}

function generateProfileCoreEdgeFunctions(appPath, generatedFiles) {
  if (!BRIQUE_PROFILE) return;

  const genDir = netlifyOutputDir(appPath, "edge-functions");
  safeMkdir(genDir);

  for (const edgeFunction of BRIQUE_PROFILE.core.edge_functions) {
    const sourcePath = resolve(appPath, edgeFunction.source);
    if (!existsSync(sourcePath)) {
      throw new Error(
        `Core edge source for profile ${BRIQUE_PROFILE.id} not found: ${edgeFunction.source}`
      );
    }
    const targetPath = join(genDir, `${edgeFunction.function}.js`);
    const source = readFileSync(sourcePath, "utf8");
    const content = `// GENERATED FROM ${edgeFunction.source} FOR PROFILE ${BRIQUE_PROFILE.id}\n${source}`;
    generatedFiles.add(targetPath);
    writeIfChanged(targetPath, content);
  }
}

function profileModuleSpecifier(briqueDir, sourcePath) {
  const packagePath = join(briqueDir, "package.json");
  if (!existsSync(packagePath)) return null;
  const packageName = JSON.parse(readFileSync(packagePath, "utf8")).name;
  if (!packageName) return null;
  const packageRelativePath = relative(briqueDir, sourcePath).replace(/\\/g, "/");
  return `${packageName}/${packageRelativePath}`;
}

function validateProfileRuntime(appPath) {
  if (!BRIQUE_PROFILE) return;
  const packagePath = join(appPath, "package.json");
  const appPackage = JSON.parse(readFileSync(packagePath, "utf8"));
  const declaredPackages = {
    ...(appPackage.dependencies || {}),
    ...(appPackage.devDependencies || {}),
  };
  const missing = BRIQUE_PROFILE.core.runtime.required_packages.filter(
    (packageName) => !declaredPackages[packageName]
  );
  if (missing.length > 0) {
    throw new Error(
      `Profile ${BRIQUE_PROFILE.id} requires COP runtime packages missing from ${BRIQUE_PROFILE.host_app}: ${missing.join(", ")}`
    );
  }
}

function writeIfChanged(filePath, content) {
  if (existsSync(filePath)) {
    const existingContent = readFileSync(filePath, "utf8");
    if (existingContent === content) {
      if (isDebug) console.log(`  ⏭️  Skip (unchanged): ${relative(ROOT, filePath)}`);
      return false; // ON ARRÊTE VRAIMENT ICI
    }
    console.log(`  🔄 Update: ${relative(ROOT, filePath)}`);
  } else {
    console.log(`  🆕 Creation: ${relative(ROOT, filePath)}`);
  }
  writeFileSync(filePath, content); // Appel au wrapper protégé
  return true;
}

async function compile() {
  if (isVerbose) console.log("🏗️  Compiling briques (incremental mode)...");

  const manifests = (
    await glob("**/brique.config.js", {
      cwd: ROOT,
      ignore: ["**/node_modules/**", "**/dist/**", "**/apps/**/apps/**"],
    })
  ).sort();

  if (isVerbose) console.log(`🔍 ${manifests.length} briques found.`);

  const briques = [];
  const generatedFiles = new Set();

  // Collect missing handlers from embryonic / skeleton briques instead of spamming warnings
  const skippedHandlers = new Map(); // briqueId -> { functions: [], edgeFunctions: [], tools: [] }

  const hostAppsGlob = (
    await glob("*/netlify.toml", {
      cwd: APPS_PATH,
      absolute: false,
    })
  ).sort();

  const discoveredHostApps = hostAppsGlob
    .map((p) => p.split(/[\\/]/)[0])
    .filter((v, i, a) => a.indexOf(v) === i)
    .filter((appName) => appName.toLowerCase() !== "apps");

  const requestedHostApp = BRIQUE_PROFILE?.host_app || selectedHostApp;
  const hostApps = requestedHostApp
    ? discoveredHostApps.filter((appName) => appName === requestedHostApp)
    : discoveredHostApps;

  if (requestedHostApp && hostApps.length === 0) {
    throw new Error(`Host app not found: ${requestedHostApp}`);
  }

  for (const appName of hostApps) validateProfileRuntime(join(APPS_PATH, appName));

  if (isVerbose) console.log(`🏠 Host applications detected: ${hostApps.join(", ")}`);
  if (BRIQUE_PROFILE && !isProjectionAudit) {
    console.log(
      `🎛️  Applying deployment profile ${BRIQUE_PROFILE.id} to ${BRIQUE_PROFILE.host_app}: ${BRIQUE_PROFILE.briques.map((brique) => brique.id).join(", ") || "core only"}`
    );
  }

  for (const manifestPath of manifests) {
    const fullPath = resolve(ROOT, manifestPath);
    const briqueDir = dirname(fullPath);

    const { default: manifestConfig } = await import(`file://${fullPath}?t=${Date.now()}`);
    const config = selectBriqueCapabilities(manifestConfig, BRIQUE_PROFILE);
    if (!config) continue;

    const normalizedStatus =
      config.status && Object.values(BRIQUE_STATUSES).includes(config.status)
        ? config.status
        : DEFAULT_STATUS;

    if (!config.status) {
      if (isVerbose) {
        console.log(
          `   ℹ️  Brique "${config.id}" has no explicit status (defaulting to "${DEFAULT_STATUS}")`
        );
      }
    }

    briques.push({
      ...config,
      status: normalizedStatus,
      _manifestPath: manifestPath,
      _briqueDir: briqueDir,
    });

    if (isReportOnly) continue;

    for (const appName of hostApps) {
      const appPath = join(APPS_PATH, appName);

      if (config.functions) {
        const genDir = netlifyOutputDir(appPath, "functions");
        safeMkdir(genDir);

        const runtimePath = resolve(ROOT, "packages/cop-host/src/runtime/function.js");
        const relRuntimePath = relative(genDir, runtimePath).replace(/\\/g, "/");

        for (const [funcName, funcConfig] of Object.entries(config.functions)) {
          const handlerPath = resolve(briqueDir, funcConfig.handler);
          const relHandlerPath = relative(genDir, handlerPath).replace(/\\/g, "/");

          let handlerContent;
          try {
            handlerContent = readFileSync(handlerPath, "utf-8");
          } catch (e) {
            if (!skippedHandlers.has(config.id)) {
              skippedHandlers.set(config.id, {
                status: normalizedStatus || config.status || DEFAULT_STATUS,
                functions: [],
                edgeFunctions: [],
                tools: [],
              });
            }
            const entry = skippedHandlers.get(config.id);
            if (!entry.functions.includes(funcName)) entry.functions.push(funcName);
            continue;
          }

          const isAlreadyWrapped = handlerContent.includes("defineFunction(");
          const isAlreadyLoggingWrapped = handlerContent.includes("defineNodeFunctionWithLogging(");

          // Import paths for logging
          const nodeWrapperPath = resolve(
            ROOT,
            "packages/cop-host/src/lib/logging/node-wrapper.js"
          );
          const relNodeWrapperPath = relative(genDir, nodeWrapperPath).replace(/\\/g, "/");

          let wrapperContent;
          if (isAlreadyLoggingWrapped) {
            // Already has logging, just use it as-is
            wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import handler from "${relHandlerPath}";

export default handler;
`;
          } else if (isAlreadyWrapped) {
            // Has defineFunction but not logging, wrap with logging
            wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineNodeFunctionWithLogging } from "${relNodeWrapperPath}";
import { defineFunction as DEFINE_FUNCTION } from "${relRuntimePath}";
import handler from "${relHandlerPath}";

export default defineNodeFunctionWithLogging(${isAlreadyWrapped ? "handler" : "DEFINE_FUNCTION(handler)"}, {
  name: '${config.id}-${funcName}',
  logRequest: true,
  logResponse: true,
  logErrors: true,
  defaultLogData: {
    briqueId: '${config.id}',
    functionName: '${funcName}'
  }
});
`;
          } else {
            // No wrapper at all, add logging wrapper
            wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineNodeFunctionWithLogging } from "${relNodeWrapperPath}";
import { defineFunction as DEFINE_FUNCTION } from "${relRuntimePath}";
import handler from "${relHandlerPath}";

export default defineNodeFunctionWithLogging(DEFINE_FUNCTION(handler), {
  name: '${config.id}-${funcName}',
  logRequest: true,
  logResponse: true,
  logErrors: true,
  defaultLogData: {
    briqueId: '${config.id}',
    functionName: '${funcName}'
  }
});
`;
          }
          const targetFile = join(genDir, `gen-${config.id}-${funcName}.js`);
          generatedFiles.add(targetFile);
          writeIfChanged(targetFile, wrapperContent);
        }
      }

      if (config.edgeFunctions) {
        const genDir = netlifyOutputDir(appPath, "edge-functions");
        safeMkdir(genDir);

        const runtimePath = resolve(ROOT, "packages/cop-host/src/runtime/edge.js");
        const relRuntimePath = relative(genDir, runtimePath).replace(/\\/g, "/");

        for (const [funcName, funcConfig] of Object.entries(config.edgeFunctions)) {
          const handlerPath = resolve(briqueDir, funcConfig.handler);
          const relHandlerPath = relative(genDir, handlerPath).replace(/\\/g, "/");

          let handlerContent;
          try {
            handlerContent = readFileSync(handlerPath, "utf-8");
          } catch (e) {
            if (!skippedHandlers.has(config.id)) {
              skippedHandlers.set(config.id, {
                status: normalizedStatus || config.status || DEFAULT_STATUS,
                functions: [],
                edgeFunctions: [],
                tools: [],
              });
            }
            const entry = skippedHandlers.get(config.id);
            if (!entry.edgeFunctions.includes(funcName)) entry.edgeFunctions.push(funcName);
            continue;
          }

          const isAlreadyWrapped = handlerContent.includes("defineEdgeFunction(");
          const isAlreadyLoggingWrapped = handlerContent.includes("defineEdgeFunctionWithLogging(");

          // Import paths for logging
          const edgeWrapperPath = resolve(
            ROOT,
            "packages/cop-host/src/lib/logging/edge-wrapper.js"
          );
          const relEdgeWrapperPath = BRIQUE_PROFILE
            ? "@inseme/cop-host/logging/edge-wrapper.js"
            : relative(genDir, edgeWrapperPath).replace(/\\/g, "/");
          const handlerImportPath = BRIQUE_PROFILE
            ? profileModuleSpecifier(briqueDir, handlerPath)
            : relHandlerPath;
          if (!handlerImportPath) {
            throw new Error(`Profile handler must belong to a named package: ${handlerPath}`);
          }

          let wrapperContent;
          if (isAlreadyLoggingWrapped) {
            // Already has logging, just use it as-is
            wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import handler from "${handlerImportPath}";

export default handler;

export const config = {
  path: "${funcConfig.path}"
};
`;
          } else if (BRIQUE_PROFILE && isAlreadyWrapped) {
            // Profile builds must remain Edge-native. The handler already uses defineEdgeFunction,
            // while the legacy logging wrapper bundles Node-oriented logging modules.
            wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import handler from "${handlerImportPath}";

export default handler;

export const config = {
  path: "${funcConfig.path}"
};
`;
          } else if (isAlreadyWrapped) {
            // Has defineEdgeFunction but not logging, wrap with logging
            wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineEdgeFunctionWithLogging } from "${relEdgeWrapperPath}";
import handler from "${handlerImportPath}";

export default defineEdgeFunctionWithLogging(handler, {
  name: '${config.id}-${funcName}',
  logRequest: true,
  logResponse: true,
  logErrors: true,
  defaultLogData: {
    briqueId: '${config.id}',
    functionName: '${funcName}'
  }
});

export const config = {
  path: "${funcConfig.path}"
};
`;
          } else {
            // No wrapper at all, add logging wrapper
            wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineEdgeFunctionWithLogging } from "${relEdgeWrapperPath}";
import handler from "${handlerImportPath}";

export default defineEdgeFunctionWithLogging(handler, {
  name: '${config.id}-${funcName}',
  logRequest: true,
  logResponse: true,
  logErrors: true,
  defaultLogData: {
    briqueId: '${config.id}',
    functionName: '${funcName}'
  }
});

export const config = {
  path: "${funcConfig.path}"
};
`;
          }
          const targetFile = join(genDir, `gen-${config.id}-${funcName}.js`);
          generatedFiles.add(targetFile);
          writeIfChanged(targetFile, wrapperContent);
        }
      }

      // --- NEW: GENERATE TOOL HANDLERS AS EDGE FUNCTIONS ---
      if (config.tools) {
        const genDir = netlifyOutputDir(appPath, "edge-functions");
        safeMkdir(genDir);

        const runtimePath = resolve(ROOT, "packages/cop-host/src/runtime/edge.js");
        const relRuntimePath = relative(genDir, runtimePath).replace(/\\/g, "/");

        for (const tool of config.tools) {
          if (tool.handler) {
            const toolName = tool.function.name;
            const handlerPath = resolve(briqueDir, tool.handler);
            const relHandlerPath = relative(genDir, handlerPath).replace(/\\/g, "/");

            // Import paths for logging
            const edgeWrapperPath = resolve(
              ROOT,
              "packages/cop-host/src/lib/logging/edge-wrapper.js"
            );
            const relEdgeWrapperPath = relative(genDir, edgeWrapperPath).replace(/\\/g, "/");

            const wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineEdgeFunctionWithLogging } from "${relEdgeWrapperPath}";
import handler from "${relHandlerPath}";

// Tool wrappers always use defineEdgeFunctionWithLogging for consistent runtime access and logging
export default defineEdgeFunctionWithLogging(async (request, runtime, _context) => {
  // Tools use a different signature - they expect (runtime, args) not (request, runtime, context)
  // We need to extract args from the request body
  let args = {};
  try {
    if (request.body) {
      args = await request.json();
    }
  } catch (e) {
    // If JSON parsing fails, use empty args
  }

  return await handler(runtime, args);
}, {
  name: 'tool-${config.id}-${toolName}',
  logRequest: true,
  logResponse: true,
  logErrors: true,
  defaultLogData: {
    briqueId: '${config.id}',
    toolName: '${toolName}',
    toolType: 'brique-tool'
  }
});

export const config = {
  path: "/api/tools/${config.id}/${toolName}"
};
`;
            const targetFile = join(genDir, `gen-tool-${config.id}-${toolName}.js`);
            generatedFiles.add(targetFile);
            writeIfChanged(targetFile, wrapperContent);
          }
        }
      }

      const briquePublicDir = join(briqueDir, "public");
      if (!BRIQUE_PROFILE && existsSync(briquePublicDir)) {
        const appPublicGenDir = join(appPath, "public/briques", config.id);
        const parentDir = dirname(appPublicGenDir);
        safeMkdir(parentDir);
        generatedFiles.add(appPublicGenDir);

        if (!existsSync(appPublicGenDir)) {
          console.log(`🔗 Creating link for public assets of ${config.id} to ${appName}`);

          try {
            const type = platform() === "win32" ? "junction" : "dir";
            symlinkSync(briquePublicDir, appPublicGenDir, type);
          } catch (err) {
            console.warn(
              `⚠️ Unable to create symbolic link (${err.message}). Falling back to copy.`
            );
            cpSync(briquePublicDir, appPublicGenDir, { recursive: true });
          }
        }
      }
    }
  }

  if (isProjectionAudit) {
    const reports = hostApps.map(appName => auditPublicProjections({
      root: ROOT, appName, selectedBriques: briques, briqueId: auditBrique
    }));
    console.log(JSON.stringify({ mode: "read_only", reports }, null, 2));
    return;
  }

  if (isReportOnly) {
    console.log(
      JSON.stringify(
        {
          profile: BRIQUE_PROFILE
            ? {
                id: BRIQUE_PROFILE.id,
                host_app: BRIQUE_PROFILE.host_app,
                core: BRIQUE_PROFILE.core,
              }
            : null,
          host_apps: hostApps,
          briques: briques.map((brique) => ({
            id: brique.id,
            routes: (brique.routes || []).map((route) => route.path),
            functions: Object.keys(brique.functions || {}),
            edge_functions: Object.keys(brique.edgeFunctions || {}),
          })),
        },
        null,
        2
      )
    );
    return;
  }

  for (const appName of hostApps) {
    generateProfileCoreEdgeFunctions(join(APPS_PATH, appName), generatedFiles);
  }

  for (const appName of hostApps) {
    const appPath = join(APPS_PATH, appName);
    // App.jsx imports this registry regardless of deployment profile. When a
    // profile is selected, `briques` already contains that profile's selected
    // briques, so emit the matching registry rather than leaving Vite with a
    // missing generated module.
    const appSrc = join(appPath, "src");
    if (existsSync(appSrc)) {
      const registryPath = generateFrontendRegistry(appSrc, briques);
      if (registryPath) generatedFiles.add(registryPath);
    }

    if (!BRIQUE_PROFILE) {
      // --- NEW: GENERATE TEST REGISTRY ---
      const appTests = join(appPath, "tests/integration");
      if (existsSync(appTests)) {
        const testRegistryPath = generateTestRegistry(appTests, briques);
        if (testRegistryPath) generatedFiles.add(testRegistryPath);
      }

      updateNetlifyToml(appName, briques);
      syncDependencies(appName, briques);
    }

    const dirsToCheck = [
      netlifyOutputDir(appPath, "functions"),
      netlifyOutputDir(appPath, "edge-functions"),
      ...(BRIQUE_PROFILE ? [] : [join(appPath, "public/briques")]),
    ];

    for (const dir of dirsToCheck) {
      if (existsSync(dir)) {
        const files = (await glob("{gen-*,*}", { cwd: dir })).sort();
        for (const file of files) {
          const filePath = join(dir, file);
          if (
            !generatedFiles.has(filePath) &&
            (file.startsWith("gen-") || dir.endsWith("public/briques"))
          ) {
            console.log(`🗑️  Removing orphan file: ${relative(ROOT, filePath)}`);
            rmSync(filePath, { recursive: true, force: true });
          }
        }
      }
    }
  }

  if (!BRIQUE_PROFILE) {
    const roomPath = resolve(ROOT, "packages/room");
    if (existsSync(roomPath)) {
      const registryPath = generateFrontendRegistry(roomPath, briques);
      if (registryPath) generatedFiles.add(registryPath);
    }

    const opheliaPath = resolve(ROOT, "packages/brique-ophelia/edge/lib");
    if (existsSync(opheliaPath)) {
      const toolsRegistryPath = generateToolsRegistry(opheliaPath, briques);
      if (toolsRegistryPath) generatedFiles.add(toolsRegistryPath);

      const promptsRegistryPath = generatePromptsRegistry(opheliaPath, briques);
      if (promptsRegistryPath) generatedFiles.add(promptsRegistryPath);
    }

    await generateMagistralMaps();
  }

  // === Brique Maturity Report ===
  console.log("\n📊  Brique Maturity Report (post 2025 massive refactoring):");

  // Build a map of all known briques with their status
  const maturityReport = new Map();
  briques.forEach((b) => {
    maturityReport.set(b.id, b.status || DEFAULT_STATUS);
  });

  // Add any skipped ones that might not have been pushed to briques array yet
  skippedHandlers.forEach((data, id) => {
    if (!maturityReport.has(id)) {
      maturityReport.set(id, data.status || DEFAULT_STATUS);
    }
  });

  const byStatus = {};
  Object.values(BRIQUE_STATUSES).forEach((s) => (byStatus[s] = []));
  maturityReport.forEach((status, id) => {
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(id);
  });

  for (const [status, list] of Object.entries(byStatus)) {
    if (list.length > 0) {
      const label =
        status === "skeleton" ? " (very early)" : status === "experimental" ? "" : ` (${status})`;
      console.log(`   ${status}${label}: ${list.sort().join(", ")}`);
    }
  }

  if (!isProjectionAudit) console.log(
    "   Note: No brique is currently marked 'active' (massive refactoring still in progress).\n"
  );

  // Report skipped handlers, taking maturity status into account
  if (skippedHandlers.size > 0) {
    console.log("📦  Briques with missing handlers:");

    for (const [briqueId, data] of skippedHandlers.entries()) {
      const status = data.status || DEFAULT_STATUS;
      const parts = [];
      if (data.functions.length) parts.push(`functions: ${data.functions.join(", ")}`);
      if (data.edgeFunctions.length) parts.push(`edgeFunctions: ${data.edgeFunctions.join(", ")}`);
      if (data.tools.length) parts.push(`tools: ${data.tools.join(", ")}`);

      console.log(`   • ${briqueId} [${status}] — ${parts.join(" | ")}`);
    }
    console.log();
  }

  // Note about skeleton frontend routes (they are now stubbed to avoid Vite import errors)
  const skeletonWithRoutes = briques.filter(
    (b) => b.status === "skeleton" && b.routes && b.routes.length > 0
  );
  if (skeletonWithRoutes.length > 0) {
    console.log("🧪  Skeleton briques with declared routes (frontend components stubbed):");
    skeletonWithRoutes.forEach((b) => {
      console.log(`   • ${b.id} — ${b.routes.length} routes declared but not implemented yet`);
    });
    console.log();
  }

  console.log("✅ Compilation finished.");
}

function generatePromptsRegistry(baseDir, briques) {
  const registryPath = join(baseDir, "gen-all-prompts.js");
  const prompts = {};

  briques.forEach((b) => {
    if (b.prompts) {
      prompts[b.id] = {};
      for (const [key, relativePath] of Object.entries(b.prompts)) {
        const fullPath = resolve(b._briqueDir, relativePath);
        if (existsSync(fullPath)) {
          prompts[b.id][key] = readFileSync(fullPath, "utf-8");
        } else {
          console.warn(`⚠️ Prompt file not found for brique ${b.id}: ${fullPath}`);
        }
      }
    }
  });

  const content = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

export const ALL_BRIQUE_PROMPTS = ${JSON.stringify(prompts, null, 2)};
`;

  writeIfChanged(registryPath, content);
  return registryPath;
}

function generateToolsRegistry(baseDir, briques) {
  const registryPath = join(baseDir, "gen-all-tools.js");
  const allTools = [];
  briques.forEach((b) => {
    if (b.tools) {
      b.tools.forEach((t) => {
        allTools.push({
          ...t,
          briqueId: b.id,
        });
      });
    }
  });

  const content = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

export const ALL_BRIQUE_TOOLS = ${JSON.stringify(allTools, null, 2)};
`;

  writeIfChanged(registryPath, content);
  return registryPath;
}

function updateNetlifyToml(appName, briques) {
  const tomlPath = join(APPS_PATH, appName, "netlify.toml");
  if (!existsSync(tomlPath)) return;

  let content = readFileSync(tomlPath, "utf8");
  const redirects = [];
  const edgeConfigs = [];

  briques.forEach((b) => {
    if (b.functions) {
      Object.keys(b.functions).forEach((funcName) => {
        const apiPath = `/api/${b.id}-${funcName}`;
        const functionName = `gen-${b.id}-${funcName}`;
        const target = `/.netlify/functions/${functionName}`;
        redirects.push(`[[redirects]]\n  from = "${apiPath}"\n  to = "${target}"\n  status = 200`);
      });
    }

    if (b.edgeFunctions) {
      Object.keys(b.edgeFunctions).forEach((funcName) => {
        const config = b.edgeFunctions[funcName];
        const functionName = `gen-${b.id}-${funcName}`;
        const path = config.path || `/api/edge/${functionName}`;
        edgeConfigs.push(`[[edge_functions]]\n  function = "${functionName}"\n  path = "${path}"`);
      });
    }

    if (b.tools) {
      b.tools.forEach((tool) => {
        if (tool.handler) {
          const toolName = tool.function.name;
          const functionName = `gen-tool-${b.id}-${toolName}`;
          const path = `/api/tools/${b.id}/${toolName}`;
          edgeConfigs.push(
            `[[edge_functions]]\n  function = "${functionName}"\n  path = "${path}"`
          );
        }
      });
    }
  });

  const sectionStart = "# --- GENERATED BRIQUE REDIRECTS START ---";
  const sectionEnd = "# --- GENERATED BRIQUE REDIRECTS END ---";
  const newSection = `${sectionStart}\n${redirects.join("\n\n")}\n${sectionEnd}`;

  if (content.includes(sectionStart) && content.includes(sectionEnd)) {
    const re = new RegExp(`${sectionStart}[\\s\\S]*?${sectionEnd}`, "g");
    content = content.replace(re, newSection);
  } else if (redirects.length > 0) {
    if (content.includes("[[redirects]]")) {
      content = content.replace("[[redirects]]", `${newSection}\n\n[[redirects]]`);
    } else {
      content += `\n\n${newSection}`;
    }
  }

  const edgeStart = "# --- GENERATED BRIQUE EDGE START ---";
  const edgeEnd = "# --- GENERATED BRIQUE EDGE END ---";
  const newEdgeSection = `${edgeStart}\n${edgeConfigs.join("\n\n")}\n${edgeEnd}`;

  if (content.includes(edgeStart) && content.includes(edgeEnd)) {
    const re = new RegExp(`${edgeStart}[\\s\\S]*?${edgeEnd}`, "g");
    content = content.replace(re, newEdgeSection);
  } else if (edgeConfigs.length > 0) {
    if (content.includes("[[edge_functions]]")) {
      content = content.replace("[[edge_functions]]", `${newEdgeSection}\n\n[[edge_functions]]`);
    } else {
      content += `\n\n${newEdgeSection}`;
    }
  }

  // TODO: need this? writeIfChanged(tomlPath, content);
}

function syncDependencies(appName, briques) {
  const appPackagePath = join(APPS_PATH, appName, "package.json");
  if (!existsSync(appPackagePath)) return;

  const appPackage = JSON.parse(readFileSync(appPackagePath, "utf8"));
  let changed = false;

  if (!appPackage.dependencies) appPackage.dependencies = {};

  for (const brique of briques) {
    const briquePackagePath = join(brique._briqueDir, "package.json");
    if (!existsSync(briquePackagePath)) continue;

    const briquePackage = JSON.parse(readFileSync(briquePackagePath, "utf8"));
    if (!briquePackage.dependencies) continue;

    for (const [dep, version] of Object.entries(briquePackage.dependencies)) {
      if (dep.startsWith("@inseme/")) continue;
      const cleanVersion = version.startsWith("workspace:") ? "*" : version;
      if (!appPackage.dependencies[dep]) {
        appPackage.dependencies[dep] = cleanVersion;
        changed = true;
      }
    }
  }

  if (changed) {
    const sortedDeps = {};
    Object.keys(appPackage.dependencies)
      .sort()
      .forEach((key) => {
        sortedDeps[key] = appPackage.dependencies[key];
      });
    appPackage.dependencies = sortedDeps;
    writeIfChanged(appPackagePath, JSON.stringify(appPackage, null, 2) + "\n");
  }
}

function generateFrontendRegistry(baseDir, briques) {
  const genDir = join(baseDir, "generated");
  safeMkdir(genDir);
  const registryPath = join(genDir, "brique-registry.js");

  // --- CONSOLIDATE PROMPTS ---
  const consolidatedPrompts = {};

  // 1. App-local prompts (from public/prompts)
  const appPublicPromptsDir = join(dirname(baseDir), "public/prompts");
  if (existsSync(appPublicPromptsDir)) {
    const localPrompts = globSync("**/*.md", { cwd: appPublicPromptsDir });
    localPrompts.forEach((p) => {
      const fullPath = join(appPublicPromptsDir, p);
      const url = `/prompts/${p.replace(/\\/g, "/")}`;
      consolidatedPrompts[url] = readFileSync(fullPath, "utf-8");
    });
  }

  // 2. Brique prompts (using their public URLs)
  briques.forEach((b) => {
    if (b.prompts) {
      Object.entries(b.prompts).forEach(([key, relPath]) => {
        const fullPath = resolve(b._briqueDir, relPath);
        if (existsSync(fullPath)) {
          // Public URL for brique assets is /briques/[id]/[path_relative_to_brique_public]
          const briquePublicDir = join(b._briqueDir, "public");
          if (relPath.startsWith("./public/") || relPath.startsWith("public/")) {
            const publicPath = relPath.replace(/^(\.\/)?public\//, "");
            const url = `/briques/${b.id}/${publicPath.replace(/\\/g, "/")}`;
            consolidatedPrompts[url] = readFileSync(fullPath, "utf-8");
          }
          // Also allow brique:key format
          consolidatedPrompts[`${b.id}:${key}`] = readFileSync(fullPath, "utf-8");
        }
      });
    }
  });

  // 3. GUARANTEED DEFAULT
  // Strategy: inseme.md > first local .md > ophelia:identity
  let defaultPrompt = consolidatedPrompts["/prompts/inseme.md"];
  if (!defaultPrompt) {
    const firstLocal = Object.keys(consolidatedPrompts).find(
      (k) => k.startsWith("/prompts/") && k.endsWith(".md")
    );
    if (firstLocal) defaultPrompt = consolidatedPrompts[firstLocal];
  }
  if (!defaultPrompt) {
    defaultPrompt = consolidatedPrompts["ophelia:identity"];
  }

  if (defaultPrompt) {
    consolidatedPrompts["__default__"] = defaultPrompt;
  }

  let content = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

export const CONSOLIDATED_PROMPTS = ${JSON.stringify(consolidatedPrompts, null, 2)};

export const BRIQUES = ${JSON.stringify(
    briques.map((b) => ({
      id: b.id,
      name: b.name,
      feature: b.feature,
      // Always emit an array — App.jsx maps routes; library packages may omit routes
      routes: Array.isArray(b.routes) ? b.routes : [],
      menuItems: Array.isArray(b.menuItems) ? b.menuItems : [],
      tools: b.tools?.map((t) => ({ ...t, briqueId: b.id })) || [],
      configSchema: b.configSchema || {},
      hasPublic: existsSync(join(b._briqueDir, "public")),
      prompts: b.prompts
        ? Object.fromEntries(
            Object.entries(b.prompts).map(([key, relPath]) => {
              const fullPath = resolve(b._briqueDir, relPath);
              return [key, existsSync(fullPath) ? readFileSync(fullPath, "utf-8") : null];
            })
          )
        : undefined,
    })),
    null,
    2
  )};

export const BRIQUE_COMPONENTS = {
`;

  briques.forEach((b) => {
    if (b.routes) {
      const isSkeleton = b.status === "skeleton";
      b.routes.forEach((route) => {
        if (isSkeleton) {
          // Skeleton briques declare routes in brique.config.js but have no implementation yet.
          // We emit a safe stub so Vite import analysis does not fail during dev.
          content += `  "${b.id}:${route.path}": () => Promise.resolve({ default: () => null }), // SKELETON — no implementation yet\n`;
          return;
        }
        const componentPath = resolve(b._briqueDir, route.component);
        const relPath = relative(genDir, componentPath).replace(/\\/g, "/");
        content += `  "${b.id}:${route.path}": () => import("${relPath}"),\n`;
      });
    }
  });

  content += `};
`;

  writeIfChanged(registryPath, content);
  return registryPath;
}

function generateTestRegistry(baseDir, briques) {
  const genDir = baseDir;
  safeMkdir(genDir);
  const registryPath = join(genDir, "gen-briques-tests.js");

  const tests = [];
  for (const brique of briques) {
    const testsDir = join(brique._briqueDir, "tests");
    if (existsSync(testsDir)) {
      const specFiles = glob.sync("**/*.spec.js", { cwd: testsDir });
      for (const specFile of specFiles) {
        const fullSpecPath = resolve(testsDir, specFile);
        const relPath = relative(genDir, fullSpecPath).replace(/\\/g, "/");
        tests.push({
          briqueId: brique.id,
          name: brique.name,
          path: relPath,
          importName: `tests_${brique.id.replace(/-/g, "_")}_${specFile
            .replace(/\\/g, "_")
            .replace(/\//g, "_")
            .replace(/\.spec\.js$/, "")}`,
        });
      }
    }
  }

  if (tests.length === 0) {
    writeIfChanged(
      registryPath,
      `// No brique tests found\nexport default function registerAllBriqueTests() {}\n`
    );
    return registryPath;
  }

  let content = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

${tests.map((t) => `import ${t.importName} from "${t.path}";`).join("\n")}

export default function registerAllBriqueTests(test, expect) {
${tests
  .map(
    (t) => `  // Brique: ${t.name}
  if (typeof ${t.importName} === "function") {
    ${t.importName}(test, expect);
  }`
  )
  .join("\n\n")}
}
`;

  writeIfChanged(registryPath, content);
  return registryPath;
}

async function generateMagistralMaps() {
  const mapsDir = resolve(ROOT, "packages/magistral/registry/maps");
  if (!existsSync(mapsDir)) return;

  const mapFiles = await glob("*.json", { cwd: mapsDir });
  for (const file of mapFiles) {
    const jsonPath = join(mapsDir, file);
    const jsPath = jsonPath.replace(".json", ".js");
    const content = readFileSync(jsonPath, "utf-8");

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn(`⚠️ Invalid JSON in map ${file}: ${e.message}`);
      continue;
    }

    const jsContent = `// GENERATED AUTOMATICALLY BY BRIQUE COMPILER
// Source: ${file}

export default ${JSON.stringify(parsed, null, 2)};
`;
    writeIfChanged(jsPath, jsContent);
  }
}

compile().catch((err) => {
  console.error("❌ Error during compilation:", err);
  process.exit(1);
});
