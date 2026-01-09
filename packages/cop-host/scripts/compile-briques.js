#!/usr/bin/env node
/**
 * Brique Compiler
 * Scans the monorepo to find brique.config.js and generates the necessary entry points.
 */

import { glob } from "glob";
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
  console.log(`🔍 Root search starting at: ${current}`);

  while (current !== dirname(current)) {
    const hasWorkspace = existsSync(join(current, "pnpm-workspace.yaml"));
    const hasApps = existsSync(join(current, "apps"));
    const hasPackages = existsSync(join(current, "packages"));

    console.log(
      `  Checking: ${current} (workspace:${hasWorkspace}, apps:${hasApps}, pkgs:${hasPackages})`
    );

    const pathParts = current.toLowerCase().split(/[\\\/]/);
    const isInsideApps = pathParts.includes("apps");

    if (hasWorkspace || (hasApps && hasPackages)) {
      console.log(`🎯 ROOT FOUND: ${current}`);
      return current;
    }
    current = dirname(current);
  }
  console.warn(
    "⚠️ Warning: Could not locate monorepo root. Using current directory as fallback."
  );
  return resolve(".");
}

const ROOT = findRoot(__dirname);
const APPS_PATH = join(ROOT, "apps");

console.log(`🚀 Compiler started. CWD: ${process.cwd()} | ROOT: ${ROOT}`);

function safeMkdir(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    console.log(`  📁 Creation dossier: ${relative(ROOT, absolutePath)}`);
    mkdirSync(absolutePath, { recursive: true });
  }
}

function writeIfChanged(filePath, content) {
  if (existsSync(filePath)) {
    const existingContent = readFileSync(filePath, "utf8");
    if (existingContent === content) {
      console.log(`  ⏭️  Skip (unchanged): ${relative(ROOT, filePath)}`);
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
  console.log("🏗️  Compiling briques (incremental mode)...");

  const manifests = (
    await glob("**/brique.config.js", {
      cwd: ROOT,
      ignore: ["**/node_modules/**", "**/dist/**", "**/apps/**/apps/**"],
    })
  ).sort();

  console.log(`🔍 ${manifests.length} briques found.`);

  const briques = [];
  const generatedFiles = new Set();

  const hostAppsGlob = (
    await glob("*/netlify.toml", {
      cwd: APPS_PATH,
      absolute: false,
    })
  ).sort();

  const hostApps = hostAppsGlob
    .map((p) => p.split(/[\\\/]/)[0])
    .filter((v, i, a) => a.indexOf(v) === i)
    .filter((appName) => appName.toLowerCase() !== "apps");

  console.log(`🏠 Host applications detected: ${hostApps.join(", ")}`);

  for (const manifestPath of manifests) {
    const fullPath = resolve(ROOT, manifestPath);
    const briqueDir = dirname(fullPath);

    const { default: config } = await import(
      `file://${fullPath}?t=${Date.now()}`
    );

    briques.push({
      ...config,
      _manifestPath: manifestPath,
      _briqueDir: briqueDir,
    });

    for (const appName of hostApps) {
      const appPath = join(APPS_PATH, appName);

      if (config.functions) {
        const genDir = join(appPath, "netlify/functions");
        safeMkdir(genDir);

        const runtimePath = resolve(
          ROOT,
          "packages/cop-host/src/runtime/function.js"
        );
        const relRuntimePath = relative(genDir, runtimePath).replace(
          /\\/g,
          "/"
        );

        for (const [funcName, funcConfig] of Object.entries(config.functions)) {
          const handlerPath = resolve(briqueDir, funcConfig.handler);
          const relHandlerPath = relative(genDir, handlerPath).replace(
            /\\/g,
            "/"
          );

          const handlerContent = readFileSync(handlerPath, "utf-8");
          const isAlreadyWrapped = handlerContent.includes("defineFunction(");

          const wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineFunction } from "${relRuntimePath}";
import handler from "${relHandlerPath}";

export default ${isAlreadyWrapped ? "handler" : "defineFunction(handler)"};
`;
          const targetFile = join(genDir, `gen-${config.id}-${funcName}.js`);
          generatedFiles.add(targetFile);
          writeIfChanged(targetFile, wrapperContent);
        }
      }

      if (config.edgeFunctions) {
        const genDir = join(appPath, "netlify/edge-functions");
        safeMkdir(genDir);

        const runtimePath = resolve(
          ROOT,
          "packages/cop-host/src/runtime/edge.js"
        );
        const relRuntimePath = relative(genDir, runtimePath).replace(
          /\\/g,
          "/"
        );

        for (const [funcName, funcConfig] of Object.entries(
          config.edgeFunctions
        )) {
          const handlerPath = resolve(briqueDir, funcConfig.handler);
          const relHandlerPath = relative(genDir, handlerPath).replace(
            /\\/g,
            "/"
          );

          const handlerContent = readFileSync(handlerPath, "utf-8");
          const isAlreadyWrapped = handlerContent.includes(
            "defineEdgeFunction("
          );

          const wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineEdgeFunction } from "${relRuntimePath}";
import handler from "${relHandlerPath}";

export default ${isAlreadyWrapped ? "handler" : "defineEdgeFunction(handler)"};

export const config = {
  path: "${funcConfig.path}"
};
`;
          const targetFile = join(genDir, `gen-${config.id}-${funcName}.js`);
          generatedFiles.add(targetFile);
          writeIfChanged(targetFile, wrapperContent);
        }
      }

      // --- NEW: GENERATE TOOL HANDLERS AS EDGE FUNCTIONS ---
      if (config.tools) {
        const genDir = join(appPath, "netlify/edge-functions");
        safeMkdir(genDir);

        const runtimePath = resolve(
          ROOT,
          "packages/cop-host/src/runtime/edge.js"
        );
        const relRuntimePath = relative(genDir, runtimePath).replace(
          /\\/g,
          "/"
        );

        for (const tool of config.tools) {
          if (tool.handler) {
            const toolName = tool.function.name;
            const handlerPath = resolve(briqueDir, tool.handler);
            const relHandlerPath = relative(genDir, handlerPath).replace(
              /\\/g,
              "/"
            );

            const wrapperContent = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineEdgeFunction } from "${relRuntimePath}";
import handler from "${relHandlerPath}";

// Tool wrappers always use defineEdgeFunction for consistent runtime access
export default defineEdgeFunction(async (runtime, args) => {
  return await handler(runtime, args);
});

export const config = {
  path: "/api/tools/${config.id}/${toolName}"
};
`;
            const targetFile = join(
              genDir,
              `gen-tool-${config.id}-${toolName}.js`
            );
            generatedFiles.add(targetFile);
            writeIfChanged(targetFile, wrapperContent);
          }
        }
      }

      const briquePublicDir = join(briqueDir, "public");
      if (existsSync(briquePublicDir)) {
        const appPublicGenDir = join(appPath, "public/briques", config.id);
        const parentDir = dirname(appPublicGenDir);
        safeMkdir(parentDir);
        generatedFiles.add(appPublicGenDir);

        if (!existsSync(appPublicGenDir)) {
          console.log(
            `🔗 Creating link for public assets of ${config.id} to ${appName}`
          );

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

  for (const appName of hostApps) {
    const appPath = join(APPS_PATH, appName);
    const appSrc = join(appPath, "src");
    if (existsSync(appSrc)) {
      const registryPath = generateFrontendRegistry(appSrc, briques);
      if (registryPath) generatedFiles.add(registryPath);
    }

    // --- NEW: GENERATE TEST REGISTRY ---
    const appTests = join(appPath, "tests/integration");
    if (existsSync(appTests)) {
      const testRegistryPath = generateTestRegistry(appTests, briques);
      if (testRegistryPath) generatedFiles.add(testRegistryPath);
    }

    updateNetlifyToml(appName, briques);
    syncDependencies(appName, briques);

    const dirsToCheck = [
      join(appPath, "netlify/functions"),
      join(appPath, "netlify/edge-functions"),
      join(appPath, "public/briques"),
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
            console.log(
              `🗑️  Removing orphan file: ${relative(ROOT, filePath)}`
            );
            rmSync(filePath, { recursive: true, force: true });
          }
        }
      }
    }
  }

  const roomPath = resolve(ROOT, "packages/room");
  if (existsSync(roomPath)) {
    const registryPath = generateFrontendRegistry(roomPath, briques);
    if (registryPath) generatedFiles.add(registryPath);
  }

  const opheliaPath = resolve(ROOT, "packages/brique-ophelia/edge/lib");
  if (existsSync(opheliaPath)) {
    const toolsRegistryPath = generateToolsRegistry(opheliaPath, briques);
    if (toolsRegistryPath) generatedFiles.add(toolsRegistryPath);
  }

  console.log("✅ Compilation finished.");
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
        redirects.push(
          `[[redirects]]\n  from = "${apiPath}"\n  to = "${target}"\n  status = 200`
        );
      });
    }

    if (b.edgeFunctions) {
      Object.keys(b.edgeFunctions).forEach((funcName) => {
        const config = b.edgeFunctions[funcName];
        const functionName = `gen-${b.id}-${funcName}`;
        const path = config.path || `/api/edge/${functionName}`;
        edgeConfigs.push(
          `[[edge_functions]]\n  function = "${functionName}"\n  path = "${path}"`
        );
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
      content = content.replace(
        "[[redirects]]",
        `${newSection}\n\n[[redirects]]`
      );
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
      content = content.replace(
        "[[edge_functions]]",
        `${newEdgeSection}\n\n[[edge_functions]]`
      );
    } else {
      content += `\n\n${newEdgeSection}`;
    }
  }

  writeIfChanged(tomlPath, content);
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

  let content = `// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

export const BRIQUES = ${JSON.stringify(
    briques.map((b) => ({
      id: b.id,
      name: b.name,
      feature: b.feature,
      routes: b.routes,
      menuItems: b.menuItems,
      tools: b.tools?.map((t) => ({ ...t, briqueId: b.id })),
      configSchema: b.configSchema,
      hasPublic: existsSync(join(b._briqueDir, "public")),
    })),
    null,
    2
  )};

export const BRIQUE_COMPONENTS = {
`;

  briques.forEach((b) => {
    if (b.routes) {
      b.routes.forEach((route) => {
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

compile().catch((err) => {
  console.error("❌ Error during compilation:", err);
  process.exit(1);
});
