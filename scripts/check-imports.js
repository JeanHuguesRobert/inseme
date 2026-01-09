#!/usr/bin/env node

/**
 * Check Import Paths in the entire project
 * Usage: node scripts/check-imports.js [flags]
 *
 * Flags:
 *   --fix-all        Fix extensions, fix broken paths (closest match), and deduplicate
 *   --fix-extensions Remove .js/.jsx from import paths
 *   --fix-paths      Fix broken relative paths if file exists elsewhere
 *   --deduplicate    Delete identical files and fix imports to canonical version
 *   --show-extensions Show all extension warnings (hidden by default)
 *   --errors-only    Only show major errors (non-existent files)
 *   --rename-pages   Rename duplicate page files to PageName.jsx
 *   --rename-components Rename duplicate component files with package prefix
 *   --analyze-exports Analyze what each file exports (functions, constants, etc)
 *   --show-unused    Show exports that are never used anywhere (requires --analyze-exports)
 *   --find-symbol=X  Find where symbol X is defined and where it is used
 *
 * Scans for broken imports in .js and .jsx files across specified directories.
 * Provides suggestions if the target file exists elsewhere in the project.
 */

import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import crypto from "crypto";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root
const projectRoot = path.resolve(path.dirname(__dirname));

// CLI Flags
const SHOW_EXTENSIONS = process.argv.includes("--show-extensions");
const ERRORS_ONLY = process.argv.includes("--errors-only");
const FIX_PATHS =
  process.argv.includes("--fix-paths") || process.argv.includes("--fix-all");
const FIX_EXTENSIONS =
  process.argv.includes("--fix-extensions") ||
  process.argv.includes("--fix-all");
const REQUIRE_EXTENSIONS =
  process.argv.includes("--require-extensions") ||
  process.argv.includes("--fix-all");
const DEDUPLICATE =
  process.argv.includes("--deduplicate") || process.argv.includes("--fix-all");
const RENAME_PAGES = process.argv.includes("--rename-pages");
const RENAME_COMPONENTS = process.argv.includes("--rename-components");
const ANALYZE_EXPORTS =
  process.argv.includes("--analyze-exports") ||
  process.argv.find((arg) => arg.startsWith("--find-symbol="));
const SHOW_UNUSED = process.argv.includes("--show-unused");
const FIND_SYMBOL = process.argv
  .find((arg) => arg.startsWith("--find-symbol="))
  ?.split("=")[1];

// Basenames that are expected to be duplicated across packages/apps and should be ignored in reports/suggestions
const IGNORED_DUPLICATE_BASENAMES = new Set([
  "index.js",
  "index.jsx",
  "App.js",
  "App.jsx",
  "main.js",
  "main.jsx",
  "styles.css",
  "tailwind.config.js",
  "vite.config.js",
  "postcss.config.js",
  "setupTests.js",
  "reportWebVitals.js",
  "brique.config.js",
  "supabase.js",
  "storage.js",
  "constants.js",
  "instanceConfig.backend.js",
  "instanceConfig.edge.js",
  "instanceConfig.client.js",
  "instanceConfig.core.js",
]);

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function colorize(text, color) {
  return `${colors[color] || ""}${text}${colors.reset}`;
}

// Regex for imports and exports (multiline support)
const IMPORT_REGEX_MULTILINE =
  /(?:import|export)\s+(?:.*?from\s+)?["'](.*?)[""]|import\s*\(["'](.*?)["']\)|component\s*:\s*["'](.*?)["']/gs;

// Regex for named exports: export const/let/var/function/class Name
const NAMED_EXPORT_REGEX =
  /^export\s+(?:const|let|var|function|class|async\s+function)\s+([a-zA-Z0-9_$]+)/gm;
// Regex for export { a, b as c }
const BRACE_EXPORT_REGEX = /export\s+\{([^}]+)\}/g;
// Regex for export default
const DEFAULT_EXPORT_REGEX =
  /export\s+default\s+(?:function|class|async\s+function)?\s*([a-zA-Z0-9_$]+)?/g;

// Regex for named imports: import { a, b as c } from '...'
const NAMED_IMPORT_REGEX = /import\s+\{([^}]+)\}\s+from/g;
// Regex for default import: import Name from '...'
const DEFAULT_IMPORT_REGEX = /import\s+([a-zA-Z0-9_$]+)\s+from/g;
// Regex for namespace import: import * as Name from '...'
const NAMESPACE_IMPORT_REGEX = /import\s+\*\s+as\s+([a-zA-Z0-9_$]+)\s+from/g;

// Workspace alias mapping
const WORKSPACE_ALIASES = {
  "@inseme/": "packages/",
};

function resolveWorkspacePath(importPath) {
  for (const [alias, replacement] of Object.entries(WORKSPACE_ALIASES)) {
    if (importPath.startsWith(alias)) {
      const subPath = importPath.slice(alias.length);
      // Try to find the package directory
      const parts = subPath.split("/");
      const packageName = parts[0];
      const remaining = parts.slice(1).join("/");

      // Base package path
      const packageDir = path.join(projectRoot, replacement, packageName);

      if (!existsSync(packageDir)) return null;

      if (remaining) {
        return path.join(packageDir, "src", remaining);
      } else {
        // Try index.js or index.jsx in src or root
        return packageDir; // checkPathExistence will handle index resolution
      }
    }
  }
  return null;
}

/**
 * Use git ls-files to get all tracked files (respects .gitignore)
 */
function getTrackedFiles() {
  try {
    const output = execSync(
      "git ls-files --cached --others --exclude-standard",
      {
        cwd: projectRoot,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    return output
      .trim()
      .split("\n")
      .map((f) => path.join(projectRoot, f))
      .filter((f) => f.endsWith(".js") || f.endsWith(".jsx"));
  } catch (error) {
    console.error(
      colorize(
        "Error running git ls-files. Falling back to manual crawl...",
        "red"
      )
    );
    return [];
  }
}

/**
 * Alternative: get files via glob-like patterns
 */
async function getFilesToScan() {
  // We want to scan:
  // - apps/*/src/**/*.js,jsx
  // - apps/*/scripts/**/*.js
  // - scripts/**/*.js
  // - packages/*/src/**/*.js,jsx

  const files = [];
  const trackedFiles = getTrackedFiles();

  const includePatterns = [
    /^(?:\.\/)?apps\/.*\/src\/.*\.(js|jsx)$/,
    /^(?:\.\/)?apps\/.*\/scripts\/.*\.js$/,
    /^(?:\.\/)?apps\/.*\/netlify\/edge-functions\/.*\.js$/,
    /^(?:\.\/)?scripts\/.*\.js$/,
    /^(?:\.\/)?packages\/.*\.(js|jsx)$/,
    /^(?:\.\/)?packages\/.*\/brique\.config\.js$/,
    /^(?:\.\/)?packages\/.*\/generated\/.*\.js$/,
  ];

  const excludePatterns = [
    /(^|\/)old-.*?\//, // Exclude any directory starting with "old-"
  ];

  return trackedFiles.filter((file) => {
    // Only include files that actually exist on disk
    if (!existsSync(file)) return false;

    const relPath = path.relative(projectRoot, file).replace(/\\/g, "/");
    const isIncluded = includePatterns.some((pattern) => pattern.test(relPath));
    const isExcluded = excludePatterns.some((pattern) => pattern.test(relPath));

    return isIncluded && !isExcluded;
  });
}

// Global state
let allFilesIndex = new Map();
let nonExistentImportWarnings = [];
let extensionImportWarnings = []; // New: track imports with .js/.jsx extension
let duplicateFileNames = new Set();
let nonExistentReferencedFiles = new Set();
let importedFiles = new Set(); // Track actual resolved files that are imported
let scannedFiles = new Set(); // Track all files that were scanned for imports
let identicalFilesGroups = []; // New: groups of files with same name AND content
let exportsMap = new Map(); // filePath -> { named: Set, hasDefault: bool }
let usageMap = new Map(); // exportName -> Set(filePaths importing it)
let workspaceDepWarnings = []; // New: track missing package.json dependencies

/**
 * Get hash of file content
 */
async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    // Normalize line endings to avoid hash mismatch between Windows and Unix
    const normalizedContent = content.replace(/\r\n/g, "\n").trim();
    return crypto.createHash("md5").update(normalizedContent).digest("hex");
  } catch (err) {
    return null;
  }
}

/**
 * Find the nearest package.json for a given file
 */
async function findNearestPackageJson(filePath) {
  let currentDir = path.dirname(filePath);
  while (
    currentDir !== projectRoot &&
    currentDir !== path.dirname(projectRoot)
  ) {
    const pkgPath = path.join(currentDir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const content = await fs.readFile(pkgPath, "utf8");
        return { path: pkgPath, data: JSON.parse(content) };
      } catch {
        return null;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

/**
 * Check if a file is a "proxy" (just re-exports)
 */
async function isProxyFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("/*")
      );
    // A proxy file usually has only 1-2 lines like "export { ... } from '...';"
    return (
      lines.length <= 2 &&
      lines.every((l) => l.startsWith("export") && l.includes("from"))
    );
  } catch {
    return false;
  }
}

/**
 * Build index of all JS/JSX files in the project
 */
async function buildFileIndex(allFiles) {
  if (!ERRORS_ONLY) {
    console.log(
      colorize(`Building file index for ${allFiles.length} files...`, "cyan")
    );
  }

  for (const filePath of allFiles) {
    scannedFiles.add(filePath);
    const basename = path.basename(filePath);
    if (!allFilesIndex.has(basename)) {
      allFilesIndex.set(basename, []);
    }
    allFilesIndex.get(basename).push(filePath);
  }

  let duplicateCount = 0;
  for (const [basename, paths] of allFilesIndex.entries()) {
    if (paths.length > 1) {
      if (!IGNORED_DUPLICATE_BASENAMES.has(basename)) {
        // Only consider it a duplicate error if more than one file is NOT a proxy
        let realFiles = [];
        for (const p of paths) {
          if (!(await isProxyFile(p))) {
            realFiles.push(p);
          }
        }

        if (realFiles.length > 1) {
          duplicateFileNames.add(basename);
          duplicateCount++;
        }
      }

      // NEW: Check for identical content within duplicate basenames
      const contentGroups = new Map(); // hash -> [paths]
      for (const p of paths) {
        const hash = await getFileHash(p);
        if (hash) {
          if (!contentGroups.has(hash)) contentGroups.set(hash, []);
          contentGroups.get(hash).push(p);
        }
      }

      for (const [hash, group] of contentGroups.entries()) {
        if (group.length > 1) {
          identicalFilesGroups.push({
            basename,
            hash,
            paths: group,
          });
        }
      }
    }
  }

  if (!ERRORS_ONLY) {
    let totalProxies = 0;
    for (const [basename, paths] of allFilesIndex.entries()) {
      if (paths.length > 1) {
        for (const p of paths) {
          if (await isProxyFile(p)) totalProxies++;
        }
      }
    }
    console.log(
      colorize(
        `Indexing complete. ${duplicateCount} unique duplicate basenames flagged (ignored ${totalProxies} proxy files).`,
        "green"
      )
    );
  }
}

function findTargetFilesFromIndex(targetFileName) {
  return allFilesIndex.get(targetFileName) || [];
}

function getRelativePath(fromPath, toPath) {
  const fromDir = path.dirname(fromPath);
  let relPath = path.relative(fromDir, toPath);

  // Strip .js or .jsx extension from the result
  relPath = relPath.replace(/\.(js|jsx)$/i, "");

  if (!relPath.startsWith(".") && !path.isAbsolute(relPath)) {
    relPath = "./" + relPath;
  }
  return relPath.replace(/\\/g, "/");
}

async function checkPathExistence(baseResolvedPath) {
  const possiblePaths = [baseResolvedPath];
  const ext = path.extname(baseResolvedPath);

  if (ext === "" || !ext.match(/\.(js|jsx)$/i)) {
    possiblePaths.push(baseResolvedPath + ".js");
    possiblePaths.push(baseResolvedPath + ".jsx");

    try {
      const stats = await fs.stat(baseResolvedPath);
      if (stats.isDirectory()) {
        possiblePaths.push(path.join(baseResolvedPath, "index.js"));
        possiblePaths.push(path.join(baseResolvedPath, "index.jsx"));
        possiblePaths.push(path.join(baseResolvedPath, "src", "index.js"));
        possiblePaths.push(path.join(baseResolvedPath, "src", "index.jsx"));

        // Check package.json main
        const pkgPath = path.join(baseResolvedPath, "package.json");
        try {
          const pkgContent = await fs.readFile(pkgPath, "utf8");
          const pkg = JSON.parse(pkgContent);
          if (pkg.main) {
            possiblePaths.push(path.join(baseResolvedPath, pkg.main));
          }
        } catch {}
      }
    } catch {}
  }

  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      importedFiles.add(path.resolve(p)); // Track successful imports
      return true;
    } catch {}
  }
  return false;
}

async function checkImportsInFile(filePath) {
  const results = [];
  let fileContent;
  try {
    fileContent = await fs.readFile(filePath, "utf8");
  } catch {
    return [];
  }

  // Analyze exports if requested
  if (ANALYZE_EXPORTS) {
    const namedExports = new Set();
    let hasDefaultExport = false;

    // 1. Named exports: export const X ...
    let exportMatch;
    NAMED_EXPORT_REGEX.lastIndex = 0;
    while ((exportMatch = NAMED_EXPORT_REGEX.exec(fileContent)) !== null) {
      namedExports.add(exportMatch[1]);
    }

    // 2. Brace exports: export { a, b as c }
    BRACE_EXPORT_REGEX.lastIndex = 0;
    while ((exportMatch = BRACE_EXPORT_REGEX.exec(fileContent)) !== null) {
      const parts = exportMatch[1].split(",");
      parts.forEach((p) => {
        const name = p
          .trim()
          .split(/\s+as\s+/)
          .pop();
        if (name) namedExports.add(name);
      });
    }

    // 3. Default export
    DEFAULT_EXPORT_REGEX.lastIndex = 0;
    if (DEFAULT_EXPORT_REGEX.test(fileContent)) {
      hasDefaultExport = true;
    }

    exportsMap.set(filePath, {
      named: namedExports,
      hasDefault: hasDefaultExport,
    });

    // Track usage (named imports)
    NAMED_IMPORT_REGEX.lastIndex = 0;
    let importMatch;
    while ((importMatch = NAMED_IMPORT_REGEX.exec(fileContent)) !== null) {
      const parts = importMatch[1].split(",");
      parts.forEach((p) => {
        const name = p.trim().split(/\s+as\s+/)[0]; // The original name exported
        if (name) {
          if (!usageMap.has(name)) usageMap.set(name, new Set());
          usageMap.get(name).add(filePath);
        }
      });
    }
  }

  const allComments = [];
  const commentRegex = /\/\*[\s\S]*?\*\/|\/\/.*/g;
  let commentMatch;
  while ((commentMatch = commentRegex.exec(fileContent)) !== null) {
    allComments.push({
      start: commentMatch.index,
      end: commentMatch.index + commentMatch[0].length,
    });
  }

  function isInsideComment(index) {
    return allComments.some((c) => index >= c.start && index < c.end);
  }

  let newContent = fileContent;
  let hasChanges = false;
  let match;
  IMPORT_REGEX_MULTILINE.lastIndex = 0;

  while ((match = IMPORT_REGEX_MULTILINE.exec(fileContent)) !== null) {
    if (isInsideComment(match.index)) continue;

    const fullMatch = match[0];
    const importPath = match[1] || match[2] || match[3];
    if (!importPath) continue;

    const lineIndex = fileContent.substring(0, match.index).split("\n").length;
    const lineNumber = lineIndex > 0 ? lineIndex : 1;

    // Ignore assets
    if (
      importPath.match(
        /\.(css|scss|less|png|svg|jpg|jpeg|gif|webp|woff2?|ttf|eot)$/i
      )
    )
      continue;

    const fileDir = path.dirname(filePath);
    let resolvedPath;

    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      resolvedPath = path.resolve(fileDir, importPath);
    } else {
      resolvedPath = resolveWorkspacePath(importPath);
    }

    if (!resolvedPath) {
      // For Vite compatibility, we also need to check if the import is a bare specifier
      // (not relative, not workspace alias) but exists in our package structure.
      if (
        !importPath.startsWith(".") &&
        !importPath.startsWith("/") &&
        !importPath.startsWith("@inseme/")
      ) {
        // This could be a direct package name or something else.
        // We'll skip standard node_modules but check if it matches one of our internal packages
        const potentialInternalPkg = `@inseme/${importPath}`;
        const tryResolved = resolveWorkspacePath(potentialInternalPkg);
        if (tryResolved) {
          resolvedPath = tryResolved;
        }
      }
    }

    if (!resolvedPath) continue;

    // Check for missing workspace dependencies in package.json
    if (importPath.startsWith("@inseme/")) {
      const parts = importPath.split("/");
      const packageName = parts[0] + "/" + parts[1]; // e.g., @inseme/room
      const pkgInfo = await findNearestPackageJson(filePath);
      if (pkgInfo) {
        const deps = {
          ...(pkgInfo.data.dependencies || {}),
          ...(pkgInfo.data.devDependencies || {}),
          ...(pkgInfo.data.peerDependencies || {}),
        };
        if (!deps[packageName]) {
          workspaceDepWarnings.push({
            file: filePath,
            importPath,
            packageName,
            packageJson: pkgInfo.path,
          });

          if (FIX_PATHS) {
            // Proactively add to package.json if FIX_PATHS is on
            try {
              const pkgData = pkgInfo.data;
              if (!pkgData.dependencies) pkgData.dependencies = {};
              pkgData.dependencies[packageName] = "*";
              await fs.writeFile(
                pkgInfo.path,
                JSON.stringify(pkgData, null, 2) + "\n"
              );
              console.log(
                colorize(
                  `  [FIX] Added ${packageName} to ${path.relative(
                    projectRoot,
                    pkgInfo.path
                  )}`,
                  "green"
                )
              );
            } catch (err) {
              console.error(
                colorize(
                  `Failed to update ${pkgInfo.path}: ${err.message}`,
                  "red"
                )
              );
            }
          }
        }
      }
    }

    // Check for unwanted/missing extensions
    const hasJsExtension = importPath.endsWith(".js");
    const hasJsxExtension = importPath.endsWith(".jsx");
    const isEdgeFunction =
      (filePath.includes("netlify") && filePath.includes("functions")) ||
      filePath.includes("/edge/") ||
      filePath.includes("\\edge\\");
    const isSharedPackage =
      filePath.includes("packages") && !filePath.includes("ui");

    // Auto-enable REQUIRE_EXTENSIONS only for JS in Edge Functions or Shared Packages
    const shouldRequireJsExtension =
      isEdgeFunction || isSharedPackage || REQUIRE_EXTENSIONS;

    if (hasJsxExtension) {
      // NEVER keep .jsx extensions, Vite doesn't want them
      const suggested = importPath.replace(/\.jsx$/i, "");
      extensionImportWarnings.push({
        file: filePath,
        line: lineNumber,
        importPath,
        suggested,
      });
      const newMatch = fullMatch.replace(importPath, suggested);
      if (newContent.includes(fullMatch)) {
        newContent = newContent.replace(fullMatch, newMatch);
        hasChanges = true;
        console.log(
          colorize(
            `  [FIX] Removed .jsx extension: ${importPath} -> ${suggested}`,
            "green"
          )
        );
      }
    } else if (hasJsExtension && !shouldRequireJsExtension && FIX_EXTENSIONS) {
      // Remove .js if not required
      const suggested = importPath.replace(/\.js$/i, "");
      extensionImportWarnings.push({
        file: filePath,
        line: lineNumber,
        importPath,
        suggested,
      });
      const newMatch = fullMatch.replace(importPath, suggested);
      if (newContent.includes(fullMatch)) {
        newContent = newContent.replace(fullMatch, newMatch);
        hasChanges = true;
        console.log(
          colorize(
            `  [FIX] Removed .js extension: ${importPath} -> ${suggested}`,
            "green"
          )
        );
      }
    } else if (
      !hasJsExtension &&
      !hasJsxExtension &&
      shouldRequireJsExtension
    ) {
      // Add .js ONLY if it's a .js file and we are in a backend context
      if (existsSync(resolvedPath + ".js")) {
        const suggested = importPath + ".js";
        extensionImportWarnings.push({
          file: filePath,
          line: lineNumber,
          importPath,
          suggested,
        });
        const newMatch = fullMatch.replace(importPath, suggested);
        if (newContent.includes(fullMatch)) {
          newContent = newContent.replace(fullMatch, newMatch);
          hasChanges = true;
          console.log(
            colorize(
              `  [FIX] Added .js extension: ${importPath} -> ${suggested}`,
              "green"
            )
          );
        }
      } else if (existsSync(path.join(resolvedPath, "index.js"))) {
        const suggested = importPath + "/index.js";
        extensionImportWarnings.push({
          file: filePath,
          line: lineNumber,
          importPath,
          suggested,
        });
        const newMatch = fullMatch.replace(importPath, suggested);
        if (newContent.includes(fullMatch)) {
          newContent = newContent.replace(fullMatch, newMatch);
          hasChanges = true;
          console.log(
            colorize(
              `  [FIX] Added .js extension: ${importPath} -> ${suggested}`,
              "green"
            )
          );
        }
      }
    }

    let exists = await checkPathExistence(resolvedPath);
    if (exists) continue;

    const targetFileName = path.basename(importPath).split("?")[0];
    let potentialTargetFiles = [];

    if (path.extname(targetFileName) === "") {
      potentialTargetFiles.push(
        ...findTargetFilesFromIndex(targetFileName + ".js")
      );
      potentialTargetFiles.push(
        ...findTargetFilesFromIndex(targetFileName + ".jsx")
      );
    } else {
      potentialTargetFiles.push(...findTargetFilesFromIndex(targetFileName));
    }

    if (potentialTargetFiles.length === 0) {
      nonExistentImportWarnings.push({
        file: filePath,
        line: lineNumber,
        badImport: importPath,
        message: `File "${targetFileName}" not found anywhere.`,
      });
      nonExistentReferencedFiles.add(targetFileName);
    } else {
      let fixes = potentialTargetFiles.map((targetFile) => {
        const correctPath = getRelativePath(filePath, targetFile);
        return { targetFile, correctPath };
      });

      // Avoid noise for common files like index.js, App.jsx etc.
      const isCommonFile =
        IGNORED_DUPLICATE_BASENAMES.has(targetFileName) ||
        IGNORED_DUPLICATE_BASENAMES.has(targetFileName + ".js") ||
        IGNORED_DUPLICATE_BASENAMES.has(targetFileName + ".jsx");

      if (isCommonFile && fixes.length > 1) {
        // Sort by proximity and take only the closest ones
        fixes.sort((a, b) => {
          const jumpsA = a.correctPath.split("..").length - 1;
          const jumpsB = b.correctPath.split("..").length - 1;
          if (jumpsA !== jumpsB) return jumpsA - jumpsB;
          return a.correctPath.length - b.correctPath.length;
        });

        // Heuristic: for common files, only suggest if it's very close or limit to top 2
        fixes = fixes.filter((f) => {
          const jumps = f.correctPath.split("..").length - 1;
          return jumps <= 3;
        });

        if (fixes.length > 2) {
          fixes = fixes.slice(0, 2);
        }
      }

      if (fixes.length > 0) {
        results.push({
          file: filePath,
          line: lineNumber,
          badImport: importPath,
          fixes: fixes,
        });
      } else {
        // If all fixes were filtered out for a common file, treat as not found to avoid noise
        nonExistentImportWarnings.push({
          file: filePath,
          line: lineNumber,
          badImport: importPath,
          message: `File "${targetFileName}" not found in a reasonable proximity (ignoring distant common files).`,
        });
      }

      if (FIX_PATHS && fixes.length >= 1) {
        let suggestedPath;
        if (fixes.length === 1) {
          suggestedPath = fixes[0].correctPath;
        } else {
          // Heuristic: pick the "closest" one (fewest directory jumps)
          const sortedFixes = [...fixes].sort((a, b) => {
            const jumpsA = a.correctPath.split("..").length - 1;
            const jumpsB = b.correctPath.split("..").length - 1;
            if (jumpsA !== jumpsB) return jumpsA - jumpsB;
            // If same jumps, prefer the one that matches the original basename if we renamed
            const originalBase = path.basename(importPath).split(".")[0];
            const aBase = path.basename(a.targetFile).split(".")[0];
            const bBase = path.basename(b.targetFile).split(".")[0];
            if (aBase.includes(originalBase) && !bBase.includes(originalBase))
              return -1;
            if (bBase.includes(originalBase) && !aBase.includes(originalBase))
              return 1;
            return a.correctPath.length - b.correctPath.length;
          });
          suggestedPath = sortedFixes[0].correctPath;
          if (!ERRORS_ONLY) {
            console.log(
              colorize(
                `  [HEURISTIC] Multiple targets for ${importPath}, picked closest: ${suggestedPath}`,
                "yellow"
              )
            );
          }
        }

        const suggestedWithoutExt = suggestedPath.replace(/\.(js|jsx)$/i, "");
        const newMatch = fullMatch.replace(importPath, suggestedWithoutExt);
        if (newContent.includes(fullMatch)) {
          newContent = newContent.replace(fullMatch, newMatch);
          hasChanges = true;
          if (!ERRORS_ONLY) {
            console.log(
              colorize(
                `  [FIX] Path: ${importPath} -> ${suggestedWithoutExt}`,
                "green"
              )
            );
          }
        }
      }
    }
  }

  if (hasChanges && (FIX_EXTENSIONS || FIX_PATHS)) {
    try {
      await fs.writeFile(filePath, newContent, "utf8");
      if (!ERRORS_ONLY) {
        let fixedMsg = "Fixed";
        if (FIX_EXTENSIONS) fixedMsg += " extensions";
        if (FIX_PATHS) fixedMsg += (FIX_EXTENSIONS ? " and" : "") + " paths";
        console.log(colorize(`${fixedMsg} in ${filePath}`, "green"));
      }
    } catch (err) {
      console.error(
        colorize(`Error fixing ${filePath}: ${err.message}`, "red")
      );
    }
  }

  return results;
}

async function main() {
  if (!ERRORS_ONLY) {
    console.log(colorize("========================================", "cyan"));
    console.log(colorize("       Monorepo Import Checker", "cyan"));
    console.log(colorize("========================================", "cyan"));
    console.log("");
  }

  const allFiles = await getFilesToScan();
  await buildFileIndex(allFiles);

  if (RENAME_PAGES) {
    console.log(colorize("\n--- Renaming Page Duplicates ---", "yellow"));
    let renameCount = 0;
    const renamedMap = new Map(); // oldPath -> newPath

    for (const [basename, paths] of allFilesIndex.entries()) {
      if (paths.length > 1) {
        for (const filePath of paths) {
          const dir = path.dirname(filePath);
          const dirName = path.basename(dir).toLowerCase();

          if (dirName === "pages" || dirName === "page") {
            const ext = path.extname(basename);
            const nameWithoutExt = path.basename(basename, ext);
            const newBasename = `Page${nameWithoutExt}${ext}`;
            const newPath = path.join(dir, newBasename);

            if (!existsSync(newPath)) {
              console.log(
                colorize(
                  `  [RENAME] ${path.relative(projectRoot, filePath)} -> ${newBasename}`,
                  "green"
                )
              );
              await fs.rename(filePath, newPath);
              renamedMap.set(filePath, newPath);
              renameCount++;
            }
          }
        }
      }
    }

    if (renameCount > 0) {
      console.log(
        colorize(`\nRenamed ${renameCount} files. Rebuilding index...`, "green")
      );
      // Re-scan files and rebuild index
      const updatedFiles = await getFilesToScan();
      allFilesIndex.clear();
      duplicateFileNames.clear();
      scannedFiles.clear();
      identicalFilesGroups = [];
      await buildFileIndex(updatedFiles);
    } else {
      console.log(colorize("No page duplicates found to rename.", "gray"));
    }
  }

  if (RENAME_COMPONENTS) {
    console.log(colorize("\n--- Renaming Component Duplicates ---", "yellow"));
    let renameCount = 0;

    for (const [basename, paths] of allFilesIndex.entries()) {
      if (paths.length > 1 && !IGNORED_DUPLICATE_BASENAMES.has(basename)) {
        for (const filePath of paths) {
          const relPath = path
            .relative(projectRoot, filePath)
            .replace(/\\/g, "/");
          const parts = relPath.split("/");

          // Only rename if it's in a package/brique to avoid breaking app structure unnecessarily
          if (parts[0] === "packages") {
            const packageName = parts[1];
            // Remove 'brique-' prefix for cleaner names
            const prefix = packageName
              .replace("brique-", "")
              .replace("cop-", "");
            const capitalizedPrefix =
              prefix.charAt(0).toUpperCase() + prefix.slice(1);

            const ext = path.extname(basename);
            const nameWithoutExt = path.basename(basename, ext);

            // Don't prefix if already prefixed
            if (nameWithoutExt.startsWith(capitalizedPrefix)) continue;

            const newBasename = `${capitalizedPrefix}${nameWithoutExt}${ext}`;
            const newPath = path.join(path.dirname(filePath), newBasename);

            if (!existsSync(newPath)) {
              console.log(
                colorize(`  [RENAME] ${relPath} -> ${newBasename}`, "green")
              );
              await fs.rename(filePath, newPath);
              renameCount++;
            }
          }
        }
      }
    }

    if (renameCount > 0) {
      console.log(
        colorize(
          `\nRenamed ${renameCount} components. Rebuilding index...`,
          "green"
        )
      );
      // Re-scan files and rebuild index
      const updatedFiles = await getFilesToScan();
      allFilesIndex.clear();
      duplicateFileNames.clear();
      scannedFiles.clear();
      identicalFilesGroups = [];
      await buildFileIndex(updatedFiles);
    } else {
      console.log(colorize("No component duplicates found to rename.", "gray"));
    }
  }

  if (DEDUPLICATE) {
    console.log(colorize("\n--- Deduplicating Exact Files ---", "yellow"));
    let deleteCount = 0;
    const redirects = new Map(); // deletedPath -> canonicalPath

    for (const group of identicalFilesGroups) {
      // Logic to find canonical:
      // 1. Prefer packages/cop-host or packages/* over apps/
      // 2. Prefer apps/platform over other apps
      // 3. Prefer shortest path if same type
      const sortedPaths = [...group.paths].sort((a, b) => {
        const score = (p) => {
          const rel = path.relative(projectRoot, p).replace(/\\/g, "/");
          if (rel.startsWith("packages/cop-host")) return 0;
          if (rel.startsWith("packages/")) return 1;
          if (rel.startsWith("apps/platform")) return 2;
          return 3;
        };
        const scoreA = score(a);
        const scoreB = score(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.length - b.length;
      });

      const canonical = sortedPaths[0];
      const toDelete = sortedPaths.slice(1);

      for (const p of toDelete) {
        console.log(
          colorize(
            `  [DELETE] ${path.relative(projectRoot, p)} (canonical: ${path.relative(projectRoot, canonical)})`,
            "red"
          )
        );
        await fs.unlink(p);
        redirects.set(p, canonical);
        deleteCount++;
      }
    }

    if (deleteCount > 0) {
      console.log(
        colorize(
          `\nDeleted ${deleteCount} duplicates. Rebuilding index and scanning for import fixes...`,
          "green"
        )
      );
      // Re-scan files and rebuild index
      const updatedFiles = await getFilesToScan();
      allFilesIndex.clear();
      duplicateFileNames.clear();
      scannedFiles.clear();
      identicalFilesGroups = [];
      await buildFileIndex(updatedFiles);
    }
  }

  let allFixableImports = [];
  if (!ERRORS_ONLY) {
    console.log(
      colorize(`Scanning ${allFiles.length} files for imports...`, "cyan")
    );
  }

  for (const file of allFiles) {
    const fileResults = await checkImportsInFile(file);
    allFixableImports.push(...fileResults);
  }

  if (SHOW_UNUSED && ANALYZE_EXPORTS) {
    console.log(
      colorize("\n--- Dead Code Analysis (Unused Exports) ---", "yellow")
    );
    let unusedCount = 0;
    for (const [filePath, data] of exportsMap.entries()) {
      const relPath = path.relative(projectRoot, filePath);
      const unusedInFile = [];

      for (const exp of data.named) {
        // Simple check: is this export name ever used in a NAMED_IMPORT elsewhere?
        if (!usageMap.has(exp)) {
          unusedInFile.push(exp);
        }
      }

      if (unusedInFile.length > 0) {
        console.log(`${colorize(relPath, "gray")}:`);
        unusedInFile.forEach((exp) => {
          console.log(`  Unused export: "${colorize(exp, "red")}"`);
          unusedCount++;
        });
      }
    }
    if (unusedCount === 0) {
      console.log(colorize("✅ No unused named exports found!", "green"));
    } else {
      console.log(
        colorize(`\nFound ${unusedCount} potentially unused exports.`, "yellow")
      );
    }
  }

  // --- NEW: Export Collision Detection ---
  if (ANALYZE_EXPORTS) {
    console.log(colorize("\n--- Export Collision Analysis ---", "yellow"));
    const collisionMap = new Map(); // exportName -> Set(filePaths)
    for (const [filePath, data] of exportsMap.entries()) {
      for (const exp of data.named) {
        if (!collisionMap.has(exp)) collisionMap.set(exp, new Set());
        collisionMap.get(exp).add(filePath);
      }
    }

    let collisionCount = 0;
    for (const [name, files] of collisionMap.entries()) {
      if (files.size > 1) {
        console.log(`  Collision: "${colorize(name, "red")}" exported from:`);
        files.forEach((f) => {
          console.log(`    - ${path.relative(projectRoot, f)}`);
        });
        collisionCount++;
      }
    }
    if (collisionCount === 0) {
      console.log(colorize("✅ No export name collisions found.", "green"));
    } else {
      console.log(
        colorize(`\nFound ${collisionCount} export name collisions.`, "yellow")
      );
    }
  }

  // --- NEW: Symbol Lookup ---
  if (FIND_SYMBOL) {
    console.log(
      colorize(`\n--- Symbol Lookup: "${FIND_SYMBOL}" ---`, "yellow")
    );

    // 1. Find definitions
    const definitions = [];
    for (const [filePath, data] of exportsMap.entries()) {
      if (data.named.has(FIND_SYMBOL)) {
        definitions.push(filePath);
      }
    }

    if (definitions.length > 0) {
      console.log(colorize(`\nDefinitions (${definitions.length}):`, "green"));
      definitions.forEach((d) => {
        console.log(`  - ${path.relative(projectRoot, d)}`);
      });
    } else {
      console.log(colorize("\nNo named export definitions found.", "red"));
    }

    // 2. Find references (named imports)
    const references = usageMap.get(FIND_SYMBOL);
    if (references && references.size > 0) {
      console.log(colorize(`\nReferences (${references.size}):`, "green"));
      Array.from(references).forEach((r) => {
        console.log(`  - ${path.relative(projectRoot, r)}`);
      });
    } else {
      console.log(colorize("\nNo named import references found.", "red"));
    }
  }

  if (!ERRORS_ONLY) {
    console.log("");
    console.log(colorize("--- Import Issues Summary ---", "yellow"));
  }

  if (nonExistentImportWarnings.length > 0) {
    console.log(
      colorize("\n🚨 MAJOR ERRORS: Imports to non-existent files:\n", "red")
    );
    nonExistentImportWarnings.forEach((warning) => {
      const relPath = path.relative(projectRoot, warning.file);
      console.log(
        `${colorize(relPath, "gray")}:${colorize(warning.line, "yellow")}`
      );
      console.log(`  Import: "${colorize(warning.badImport, "red")}"`);
      console.log(`  ${warning.message}\n`);
    });
  } else if (!ERRORS_ONLY) {
    console.log(
      colorize("\n✅ No imports to missing files detected.", "green")
    );
  }

  if (ERRORS_ONLY) {
    if (nonExistentImportWarnings.length === 0) {
      console.log(colorize("✅ No major import errors found.", "green"));
    }
    return;
  }

  // --- NEW: Extension Warnings ---
  if (extensionImportWarnings.length > 0) {
    if (SHOW_EXTENSIONS) {
      console.log(
        colorize(
          "\n⚠️ EXTENSION WARNINGS: Imports with .js or .jsx extension (not recommended):\n",
          "yellow"
        )
      );
      extensionImportWarnings.forEach((warning) => {
        const relPath = path.relative(projectRoot, warning.file);
        console.log(
          `${colorize(relPath, "gray")}:${colorize(warning.line, "yellow")}`
        );
        console.log(`  Current: "${colorize(warning.importPath, "red")}"`);
        console.log(`  Suggested: "${colorize(warning.suggested, "green")}"\n`);
      });
    } else {
      console.log(
        colorize(
          `\nℹ️  Skipped ${extensionImportWarnings.length} extension warnings. (Use --show-extensions to see them)`,
          "gray"
        )
      );
    }
  }

  if (allFixableImports.length > 0) {
    console.log(
      colorize(
        "\n⚠️ WARNINGS: Broken paths (but target exists elsewhere):\n",
        "yellow"
      )
    );
    allFixableImports.forEach((result) => {
      const relPath = path.relative(projectRoot, result.file);
      console.log(
        `${colorize(relPath, "gray")}:${colorize(result.line, "yellow")}`
      );
      console.log(`  Current: "${colorize(result.badImport, "red")}"`);
      result.fixes.forEach((fix, index) => {
        const targetRel = path.relative(projectRoot, fix.targetFile);
        console.log(`  Suggestion ${index + 1}:`);
        console.log(`    File found at: ${colorize(targetRel, "cyan")}`);
        console.log(
          `    Suggested path: "${colorize(fix.correctPath, "green")}"`
        );
      });
      console.log("");
    });
  } else {
    console.log(colorize("\n✅ No fixable import paths found.", "green"));
  }

  // --- NEW: Unused Files Detection ---
  const unusedFiles = [...scannedFiles].filter(
    (f) => !importedFiles.has(path.resolve(f))
  );
  // Filter out entry points and standalone files
  const filteredUnused = unusedFiles.filter((f) => {
    const rel = path.relative(projectRoot, f).replace(/\\/g, "/");
    const basename = path.basename(f);
    return (
      !rel.includes("main.jsx") &&
      !rel.includes("index.jsx") &&
      !rel.includes("main.js") &&
      !rel.includes("index.js") &&
      !rel.includes("/netlify/") && // Netlify files are auto-loaded by Netlify
      !rel.includes("/__tests__/") && // Tests are entry points
      !rel.includes("/test/") &&
      !rel.includes("/storage-implementations/") && // Dynamically loaded implementations
      !basename.endsWith(".test.js") &&
      !basename.endsWith(".test.jsx") &&
      !basename.endsWith(".spec.js") &&
      !basename.endsWith(".spec.jsx") &&
      !(basename === "test.js") && // standalone test files
      // Scripts directly under a "scripts" folder are entry points, but subfolders are not
      !(rel.split("/").slice(-2, -1)[0] === "scripts")
    );
  });

  if (filteredUnused.length > 0) {
    console.log(
      colorize(
        "\n🔍 UNUSED FILES: Files that are never imported (potential orphans):\n",
        "magenta"
      )
    );
    filteredUnused.forEach((file) => {
      console.log(`  - ${colorize(path.relative(projectRoot, file), "gray")}`);
    });
    console.log(
      colorize(
        `\n  Total potential orphans: ${filteredUnused.length}`,
        "magenta"
      )
    );
  }

  if (workspaceDepWarnings.length > 0) {
    console.log(
      colorize(
        "\n📦 MISSING WORKSPACE DEPENDENCIES: @inseme/* imports not in package.json:\n",
        "red"
      )
    );
    // Group by package.json for cleaner output
    const byPkg = new Map();
    workspaceDepWarnings.forEach((w) => {
      if (!byPkg.has(w.packageJson)) byPkg.set(w.packageJson, []);
      byPkg.get(w.packageJson).push(w);
    });

    for (const [pkgJson, warnings] of byPkg.entries()) {
      console.log(`${colorize(path.relative(projectRoot, pkgJson), "cyan")}:`);
      // Deduplicate package names per package.json
      const missing = [...new Set(warnings.map((w) => w.packageName))];
      missing.forEach((m) => {
        console.log(`  Missing dependency: "${colorize(m, "red")}"`);
      });
    }
  }

  // --- NEW: Exact Duplicates Report ---
  if (identicalFilesGroups.length > 0) {
    console.log(
      colorize(
        "\n👯 EXACT DUPLICATES: Files with same name AND identical content:\n",
        "red"
      )
    );
    identicalFilesGroups.forEach((group) => {
      console.log(
        `  ${colorize(group.basename, "cyan")} (MD5: ${colorize(
          group.hash.substring(0, 8),
          "gray"
        )})`
      );
      group.paths.forEach((p) =>
        console.log(`    - ${colorize(path.relative(projectRoot, p), "gray")}`)
      );
    });
  }

  // --- NEW: Duplicate Basename Report ---
  const simpleDuplicates = Array.from(duplicateFileNames).filter(
    (name) => !identicalFilesGroups.some((g) => g.basename === name)
  );

  if (simpleDuplicates.length > 0) {
    console.log(
      colorize(
        "\n📂 DUPLICATE BASENAMES: Different files with the same name (but different content):\n",
        "yellow"
      )
    );
    for (const name of simpleDuplicates) {
      const paths = allFilesIndex.get(name);
      console.log(
        `  ${colorize(name, "cyan")} exists in ${paths.length} locations:`
      );
      paths.forEach((p) =>
        console.log(`    - ${colorize(path.relative(projectRoot, p), "gray")}`)
      );
    }
  }

  console.log("");
  console.log(colorize("========================================", "cyan"));
  const totalIssues =
    nonExistentImportWarnings.length +
    allFixableImports.length +
    extensionImportWarnings.length +
    identicalFilesGroups.length;
  if (totalIssues === 0) {
    console.log(colorize("🎉 All imports are valid!", "green"));
  } else {
    console.log(colorize(`Total issues found: ${totalIssues}`, "red"));
    console.log(`  - Major errors: ${nonExistentImportWarnings.length}`);
    console.log(`  - Fixable paths: ${allFixableImports.length}`);
    console.log(`  - Extension warnings: ${extensionImportWarnings.length}`);
    console.log(`  - Exact duplicates: ${identicalFilesGroups.length}`);
  }
  console.log(colorize("========================================", "cyan"));
}

main().catch((err) =>
  console.error(colorize(`Script error: ${err.message}`, "red"))
);
