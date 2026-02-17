// ClassFinder - CSS Class Analysis & Recovery Tool
// Tracks CSS classes across React codebase, identifies missing definitions,
// and helps recover accidentally deleted styles.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, "../src");
const outputFileMarkdown = path.join(__dirname, "../css-class-report.md");
const outputFileJson = path.join(__dirname, "../css-class-report.json");
const cacheFile = path.join(__dirname, "../.classfinder-cache.json");

// Cache management
function loadCache() {
  try {
    if (fs.existsSync(cacheFile)) {
      const data = fs.readFileSync(cacheFile, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("⚠️  Cache file corrupted, rebuilding...");
  }
  return { files: {}, version: "1.0" };
}

function saveCache(cache) {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.warn("⚠️  Could not save cache:", e.message);
  }
}

function getFileMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch (e) {
    return 0;
  }
}

function isFileCached(cache, filePath, currentMtime) {
  return cache.files[filePath] && cache.files[filePath].mtime === currentMtime;
}

// Tailwind dump parsing
function parseTailwindDump(dumpPath = path.join(__dirname, "..", "tailwind-dump.txt")) {
  const outFile = path.join(__dirname, "..", "tailwind-classes.json");
  let content = "";
  try {
    content = fs.readFileSync(dumpPath, "utf8");
  } catch (e) {
    // no dump available — return empty structure
    console.warn("⚠️  Tailwind dump file not found, skipping Tailwind class parsing.");
    const empty = {
      generatedAt: new Date().toISOString(),
      totalFullClasses: 0,
      fullClasses: [],
      exactUtilities: [],
      utilityPrefixes: [],
      variantPrefixes: [],
    };
    try {
      fs.writeFileSync(outFile, JSON.stringify(empty, null, 2), "utf8");
    } catch {}
    return empty;
  }

  const classRegex = /\.([^\s{,]+)/g;
  const fullClasses = new Set();
  let m;
  console.log("Parsing Tailwind dump file for class extraction...");
  while ((m = classRegex.exec(content)) !== null) {
    const cls = m[1].trim();
    if (!cls || cls.length < 2) continue;
    if (cls.startsWith("http") || cls.includes("...")) continue;
    fullClasses.add(cls);
  }

  const exact = new Set();
  const prefixes = new Set();
  const variantPrefixes = new Set();

  console.log(`Extracted ${fullClasses.size} unique Tailwind classes from dump.`);
  Array.from(fullClasses).forEach((full) => {
    const parts = full.split(":");
    if (parts.length > 1)
      for (let i = 0; i < parts.length - 1; i++) variantPrefixes.add(parts[i] + ":");
    const util = parts[parts.length - 1];
    exact.add(util);
    exact.add(full);

    const dashIndex = util.indexOf("-");
    if (dashIndex > 0) prefixes.add(util.substring(0, dashIndex + 1));
    else if (util.startsWith("-") && util.indexOf("-", 1) > 1) {
      const idx = util.indexOf("-", 1);
      prefixes.add(util.substring(0, idx + 1));
    } else {
      prefixes.add(util);
    }

    const numMatch = util.match(/^([a-zA-Z]+-).*$/);
    if (numMatch) prefixes.add(numMatch[1]);
  });

  const result = {
    generatedAt: new Date().toISOString(),
    totalFullClasses: fullClasses.size,
    fullClasses: Array.from(fullClasses).sort(),
    exactUtilities: Array.from(exact).sort(),
    utilityPrefixes: Array.from(prefixes).sort(),
    variantPrefixes: Array.from(variantPrefixes).sort(),
  };

  try {
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");
  } catch (e) {
    /* ignore */
  }
  console.log(`✓ Tailwind class data written to: ${outFile}`);
  return result;
}

// Enhanced Tailwind Detection with Auto-Parsing
let tailwindData = null;

function loadTailwindClasses() {
  if (tailwindData) return tailwindData;

  const dumpFile = path.join(__dirname, "../tailwind-dump.txt");
  const cacheFileLocal = path.join(__dirname, "../tailwind-classes.json");

  try {
    let needsRebuild = false;

    if (!fs.existsSync(cacheFileLocal)) {
      needsRebuild = true;
    } else if (fs.existsSync(dumpFile)) {
      const dumpMtime = getFileMtime(dumpFile);
      const cacheMtime = getFileMtime(cacheFileLocal);
      if (dumpMtime > cacheMtime) {
        needsRebuild = true;
      }
    }

    if (needsRebuild && fs.existsSync(dumpFile)) {
      tailwindData = parseTailwindDump();
      return tailwindData;
    }

    if (fs.existsSync(cacheFileLocal)) {
      const data = fs.readFileSync(cacheFileLocal, "utf8");
      tailwindData = JSON.parse(data);
      return tailwindData;
    }
  } catch (e) {
    console.warn("⚠️  Could not load Tailwind class list, using heuristics");
  }

  return null;
}

// Heuristic patterns (fallback)
const tailwindPrefixes = [
  "text-",
  "bg-",
  "border-",
  "ring-",
  "outline-",
  "shadow-",
  "divide-",
  "p-",
  "m-",
  "w-",
  "h-",
  "min-w-",
  "max-w-",
  "min-h-",
  "max-h-",
  "z-",
  "opacity-",
  "rounded-",
  "cursor-",
  "select-",
  "resize-",
  "list-",
  "decoration-",
  "tracking-",
  "leading-",
  "align-",
  "grid-",
  "col-",
  "row-",
  "gap-",
  "space-",
  "items-",
  "justify-",
  "content-",
  "self-",
  "place-",
  "order-",
  "object-",
  "overflow-",
  "whitespace-",
  "break-",
  "transition",
  "duration-",
  "ease-",
  "delay-",
  "animate-",
  "origin-",
  "scale-",
  "rotate-",
  "translate-",
  "skew-",
  "top-",
  "right-",
  "bottom-",
  "left-",
  "inset-",
  "from-",
  "via-",
  "to-",
  "fill-",
  "stroke-",
  "prose-",
];

const tailwindKeywords = new Set([
  "flex",
  "grid",
  "block",
  "inline",
  "inline-block",
  "hidden",
  "static",
  "fixed",
  "absolute",
  "relative",
  "sticky",
  "visible",
  "invisible",
  "container",
  "sr-only",
  "underline",
  "italic",
  "uppercase",
  "lowercase",
  "capitalize",
  "truncate",
  "antialiased",
  "subpixel-antialiased",
  "border",
  "shadow",
  "rounded",
  "table",
  "table-caption",
  "table-cell",
  "table-row-group",
  "table-row",
  "flow-root",
  "contents",
  "list-item",
  "prose",
  "not-prose",
  "group",
]);

const responsivePrefixes = ["sm:", "md:", "lg:", "xl:", "2xl:"];
const statePrefixes = [
  "hover:",
  "focus:",
  "active:",
  "visited:",
  "disabled:",
  "group-hover:",
  "focus-within:",
  "focus-visible:",
  "first:",
  "last:",
  "odd:",
  "even:",
];

// Add flag (default off) — user must pass --tailwind to enable detection/reporting
let tailwindEnabled = (function () {
  try {
    const dumpExists = fs.existsSync(path.join(__dirname, "../tailwind-dump.txt"));
    const cacheExists = fs.existsSync(path.join(__dirname, "../tailwind-classes.json"));
    return dumpExists || cacheExists;
  } catch (e) {
    console.warn("⚠️  Error checking Tailwind dump/cache files:", e);
    return false;
  }
})();

function isTailwind(className) {
  // Tailwind detection is opt-in
  if (!tailwindEnabled) return false;

  // Normalize — strip repeated responsive/state prefixes at start (e.g. md:hover:)
  let clean = className.replace(
    /^(?:(?:sm|md|lg|xl|2xl|hover|focus|active|visited|disabled|group-hover|focus-within|focus-visible|first|last|odd|even):)+/,
    ""
  );

  // Reject obvious non-tailwind patterns to avoid false positives:
  //  - contains uppercase letters (unless in arbitrary value)
  //  - contains underscore (unless in arbitrary value)
  //  - starts or ends with hyphen (unless negative utility)
  //  - contains double hyphen (BEM-like)

  // Allow negative values (starting with -)
  const isNegative = clean.startsWith("-");
  if (isNegative) clean = clean.substring(1);

  // Allow underscores only if inside square brackets (arbitrary values)
  const hasUnderscore = clean.includes("_");
  const isArbitrary = /\[.*\]/.test(clean);

  // Check for uppercase letters, but ignore content inside arbitrary value brackets []
  const withoutArbitrary = clean.replace(/\[.*\]/, "");

  if (/[A-Z]/.test(withoutArbitrary)) return false;
  if (hasUnderscore && !isArbitrary) return false;
  if (clean.includes("--")) return false; // BEM modifier
  if (clean.endsWith("-")) return false; // Incomplete class

  const twData = loadTailwindClasses();
  if (twData) {
    if (twData.exactClasses.includes(clean)) return true;
    for (const prefix of twData.prefixes) {
      if (clean.startsWith(prefix)) return true;
    }
  }

  // Heuristics (fallback): accept only well-formed utility patterns
  if (tailwindKeywords.has(clean)) return true;
  for (const prefix of tailwindPrefixes) {
    if (clean.startsWith(prefix)) return true;
  }
  // Arbitrary value utilities like w-[50px], top-[4px], etc.
  if (/\[[^\]]+\]/.test(clean)) return true;

  return false;
}

function getAllFiles(dirPath, extensions) {
  let files = [];
  try {
    const items = fs.readdirSync(dirPath);
    console.log(`Reading directory: ${dirPath}`);
    items.forEach((item) => {
      const fullPath = path.join(dirPath, item);

      // Skip obsolete chat implementations
      const relativePath = path.relative(srcDir, fullPath);
      const normalizedPath = relativePath.replace(/\\/g, "/");
      if (
        normalizedPath.includes("components/bob/legacy") ||
        normalizedPath.includes("components/bob/broken-v1")
      ) {
        console.log(`⏭️  Skipping obsolete directory: ${relativePath}`);
        return;
      }

      if (fs.statSync(fullPath).isDirectory()) {
        files = files.concat(getAllFiles(fullPath, extensions));
      } else {
        if (extensions.some((ext) => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    });
  } catch (e) {
    console.error(`Error reading directory ${dirPath}:`, e);
  }
  return files;
}

function extractClassesFromJsx(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const classes = new Set();
  const staticRegex = /className=['"]([^'"]+)['"]/g;
  let match;
  while ((match = staticRegex.exec(content)) !== null) {
    match[1].split(/\s+/).forEach((c) => {
      if (c.trim()) classes.add(c.trim());
    });
  }
  const templateRegex = /className=\{`([^`]+)`\}/g;
  while ((match = templateRegex.exec(content)) !== null) {
    const cleanContent = match[1].replace(/\$\{[^}]+\}/g, " ");
    cleanContent.split(/\s+/).forEach((c) => {
      if (c.trim()) classes.add(c.trim());
    });
  }
  const dynamicRegex = /className=\{([^}]+)\}/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    const inner = match[1];
    const stringRegex = /['"]([^'"]+)['"]/g;
    let strMatch;
    while ((strMatch = stringRegex.exec(inner)) !== null) {
      strMatch[1].split(/\s+/).forEach((c) => {
        if (c.trim()) classes.add(c.trim());
      });
    }
  }
  return classes;
}

function extractDefinitionsFromCss(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const classes = new Set();
  const cssRegex = /\.([a-zA-Z0-9-_]+)(?=\s*[{,:.])/g;
  let match;
  while ((match = cssRegex.exec(content)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

// --- BEGIN: Inline CSS detection (NEW) ---
function extractCssBlocksFromJsxContent(content) {
  const blocks = [];

  // <style>...</style>
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(content)) !== null) {
    if (m[1] && m[1].trim()) blocks.push(m[1]);
  }

  // tagged templates: css`...`, styled.x`...`, createGlobalStyle`...`, injectGlobal`...`
  const taggedRe = /\b(?:css|createGlobalStyle|injectGlobal|styled\.[a-zA-Z0-9_]+)\s*`([\s\S]*?)`/g;
  while ((m = taggedRe.exec(content)) !== null) {
    if (m[1] && m[1].trim()) blocks.push(m[1]);
  }

  // heuristic: template literal containing ".class {" patterns
  const anyTemplateRe = /`([\s\S]*?\.[a-zA-Z0-9_-]+\s*\{[\s\S]*?)`/g;
  while ((m = anyTemplateRe.exec(content)) !== null) {
    if (m[1] && m[1].trim()) blocks.push(m[1]);
  }

  return blocks;
}

function extractClassesFromCssBlock(css) {
  const classes = new Set();
  const classRe = /\.([a-zA-Z0-9\-_]+)/g;
  let mm;
  while ((mm = classRe.exec(css)) !== null) {
    classes.add(mm[1]);
  }
  return Array.from(classes);
}

// NEW: extract CSS-like keys from JS style objects (const styles = { 'chat-info': ..., ... })
function extractStyleObjectKeysFromJsxContent(content) {
  const keys = new Set();
  const stylesObjRe =
    /\b(?:const|let|var|export\s+const)\s+([a-zA-Z0-9_$]+)\s*=\s*\{([\s\S]*?)\}\s*;/g;
  let m;
  while ((m = stylesObjRe.exec(content)) !== null) {
    const objBody = m[2];
    const keyRe = /['"]?([a-zA-Z0-9\-_]+)['"]?\s*:/g;
    let km;
    while ((km = keyRe.exec(objBody)) !== null) {
      // Accept keys that look like CSS class identifiers (hyphenated or simple)
      const k = km[1];
      if (k && k.length > 1) keys.add(k);
    }
  }
  return Array.from(keys);
}

function buildInlineCssMap(jsxFiles) {
  const map = {}; // class -> Set of relative jsx files
  jsxFiles.forEach((file) => {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch (e) {
      return;
    }

    // existing style blocks and tagged templates
    const blocks = extractCssBlocksFromJsxContent(content);
    const rel = path.relative(srcDir, file);
    if (blocks.length) {
      blocks.forEach((b) => {
        const classes = extractClassesFromCssBlock(b);
        classes.forEach((cls) => {
          if (!map[cls]) map[cls] = new Set();
          map[cls].add(rel);
        });
      });
    }

    // NEW: detect style object keys (const styles = { 'chat-info': ... })
    const styleKeys = extractStyleObjectKeysFromJsxContent(content);
    if (styleKeys && styleKeys.length) {
      styleKeys.forEach((k) => {
        if (!map[k]) map[k] = new Set();
        map[k].add(`styleobj:${rel}`);
      });
    }
  });

  // normalize to arrays
  const out = {};
  Object.keys(map).forEach((k) => (out[k] = Array.from(map[k]).sort()));

  // write map for downstream use (optional)
  try {
    fs.writeFileSync(
      path.join(__dirname, "../.inline-css-map.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), map: out }, null, 2),
      "utf8"
    );
    console.log(
      `✓ Inline CSS map written: .inline-css-map.json (${Object.keys(out).length} classes)`
    );
  } catch (e) {
    // ignore write errors
    console.warn("⚠️  Error writing inline CSS map:", e);
  }

  return out;
}
// --- END: Inline CSS detection (NEW) ---

// Parse command-line arguments
const args = process.argv.slice(2);
let queryClass = null;
let queryJsxFile = null;
let queryCssFile = null;
let showHelp = false;
let smartQuery = null;
let generateTailwindDumpFlag = false;

// (inside existing args parsing loop add:)
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--class" && i + 1 < args.length) {
    queryClass = args[i + 1];
    i++;
  } else if (args[i] === "--jsx" && i + 1 < args.length) {
    queryJsxFile = args[i + 1];
    i++;
  } else if (args[i] === "--css" && i + 1 < args.length) {
    queryCssFile = args[i + 1];
    i++;
  } else if (args[i] === "--tailwind") {
    tailwindEnabled = true; // enable Tailwind features only when requested
  } else if (args[i] === "--help" || args[i] === "-h") {
    showHelp = true;
  } else if (!args[i].startsWith("--") && !smartQuery) {
    smartQuery = args[i];
  } else if (args[i] === "--generate-tailwind-dump" || args[i] === "--gen-tailwind-dump") {
    generateTailwindDumpFlag = true;
  }
}

if (showHelp) {
  console.log(`
ClassFinder — CSS Class Analysis & Recovery Tool

USAGE
  node scripts/extract-classes.js [OPTIONS] [QUERY]

OPTIONS
  --class <name>               Query a specific CSS class (shows where it's defined/used)
  --jsx <file>                 Query a JSX/JS file (lists classes used + status)
  --css <file>                 Query a CSS file (shows which JSX files reference it)
  --tailwind                   Enable Tailwind detection (auto-detected if dump/cache present)
  --generate-tailwind-dump     Attempt to generate tailwind-dump.txt (requires npx tailwindcss)
  --help, -h                   Show this help message

QUERY
  A plain argument is a "smart" query — the script will try to detect whether it's
  a class name, a JSX filename, or a CSS filename and act accordingly.

BEHAVIOR
  - Single entrypoint: scripts/extract-classes.js
    • integrates Tailwind dump parsing, inline CSS extraction and file scanning.
  - Tailwind detection:
    • auto-enabled when tailwind-dump.txt or tailwind-classes.json exists, or explicitly with --tailwind.
    • use --generate-tailwind-dump to attempt generating a dump via the Tailwind CLI (npx tailwindcss).
  - Inline CSS:
    • the analyzer detects <style> blocks, styled-components tagged templates and style objects in JSX.

EXAMPLES
  # Generate full report
  node scripts/extract-classes.js

  # Smart query
  node scripts/extract-classes.js Header

  # Explicit class query
  node scripts/extract-classes.js --class btn-primary

  # Generate Tailwind dump then run analysis
  node scripts/extract-classes.js --generate-tailwind-dump

`);
  process.exit(0);
}

console.log("Starting CSS Class Analysis...");

// Load cache
const cache = loadCache();
let cacheHits = 0;
let cacheMisses = 0;

const jsxFiles = getAllFiles(srcDir, [".jsx", ".tsx", ".js"]);
const usedClasses = new Map();

jsxFiles.forEach((file) => {
  const relativePath = path.relative(srcDir, file);
  const currentMtime = getFileMtime(file);

  let classes;
  if (isFileCached(cache, relativePath, currentMtime)) {
    classes = new Set(cache.files[relativePath].classes);
    cacheHits++;
  } else {
    classes = extractClassesFromJsx(file);
    cache.files[relativePath] = {
      mtime: currentMtime,
      classes: Array.from(classes),
      type: "jsx",
    };
    cacheMisses++;
  }

  classes.forEach((cls) => {
    if (!usedClasses.has(cls)) usedClasses.set(cls, new Set());
    usedClasses.get(cls).add(relativePath);
  });
});

// Build inline CSS map from JSX files so inline-defined classes are recognized
const inlineCssMap = buildInlineCssMap(jsxFiles);

const cssFiles = getAllFiles(srcDir, [".css", ".scss", ".less"]);
const definedClasses = new Map();

cssFiles.forEach((file) => {
  const relativePath = path.relative(srcDir, file);
  const currentMtime = getFileMtime(file);

  let classes;
  if (isFileCached(cache, relativePath, currentMtime)) {
    classes = new Set(cache.files[relativePath].classes);
    cacheHits++;
  } else {
    classes = extractDefinitionsFromCss(file);
    cache.files[relativePath] = {
      mtime: currentMtime,
      classes: Array.from(classes),
      type: "css",
    };
    cacheMisses++;
  }

  classes.forEach((cls) => {
    if (!definedClasses.has(cls)) definedClasses.set(cls, new Set());
    definedClasses.get(cls).add(relativePath);
  });
});

// Clean up cache
const currentFiles = new Set([...jsxFiles, ...cssFiles].map((f) => path.relative(srcDir, f)));
for (const cachedFile in cache.files) {
  if (!currentFiles.has(cachedFile)) {
    delete cache.files[cachedFile];
  }
}

saveCache(cache);

const missingClasses = [];
let customClasses = [];
const tailwindClasses = [];
const unusedClasses = [];

// Class categorization: tailwind only if explicitly enabled
for (const [cls, files] of usedClasses.entries()) {
  const usedIn = Array.from(files);
  const definedInSet = new Set();

  // classes defined in external CSS files
  if (definedClasses.has(cls)) {
    definedClasses.get(cls).forEach((p) => definedInSet.add(p));
  }

  // classes defined inline inside JSX (prefer these as "defined")
  if (inlineCssMap[cls]) {
    inlineCssMap[cls].forEach((p) => definedInSet.add(`inline:${p}`));
  }

  if (definedInSet.size > 0) {
    customClasses.push({ name: cls, usedIn, definedIn: Array.from(definedInSet) });
  } else if (tailwindEnabled && isTailwind(cls)) {
    tailwindClasses.push({ name: cls, usedIn });
  } else {
    missingClasses.push({ name: cls, usedIn });
  }
}

// for (const [cls, files] of usedClasses.entries()) {
//     if (definedClasses.has(cls)) {
//         customClasses.push({ name: cls, usedIn: Array.from(files), definedIn: Array.from(definedClasses.get(cls)) });
//     } else if (tailwindEnabled && isTailwind(cls)) {
//         tailwindClasses.push({ name: cls, usedIn: Array.from(files) });
//     } else {
//         missingClasses.push({ name: cls, usedIn: Array.from(files) });
//     }
// }

for (const [cls, files] of definedClasses.entries()) {
  if (!usedClasses.has(cls)) {
    unusedClasses.push({ name: cls, definedIn: Array.from(files) });
  }
}

// Identify classes that are probably local to a component:
// defined under styles/ or src/styles and used only once.
const localComponentCandidates = [];
if (customClasses.length) {
  const remaining = [];
  for (const item of customClasses) {
    const definedInStyle = item.definedIn.some(
      (p) =>
        p.startsWith("styles/") ||
        p.startsWith("style/") ||
        p.startsWith("src/styles/") ||
        p.includes("\\styles\\") ||
        p.includes("/styles/")
    );
    if (definedInStyle && item.usedIn.length === 1) {
      localComponentCandidates.push(item);
    } else {
      remaining.push(item);
    }
  }
  customClasses = remaining;
}

// Build maps for queries
const jsxFileClasses = new Map();
jsxFiles.forEach((file) => {
  const relativePath = path.relative(srcDir, file);
  const classes = extractClassesFromJsx(file);
  jsxFileClasses.set(relativePath, Array.from(classes).sort());
});

const cssFileIndex = new Map();
cssFiles.forEach((file) => {
  const relativePath = path.relative(srcDir, file);
  const classes = extractDefinitionsFromCss(file);
  const usedByFiles = new Set();

  classes.forEach((cls) => {
    if (usedClasses.has(cls)) {
      usedClasses.get(cls).forEach((jsxFile) => {
        usedByFiles.add(jsxFile);
      });
    }
  });

  cssFileIndex.set(relativePath, {
    totalClasses: classes.size,
    usedClasses: Array.from(classes).filter((cls) => usedClasses.has(cls)).length,
    usedByFiles: Array.from(usedByFiles).sort(),
  });
});

// Handle smart query
if (smartQuery && !queryClass && !queryJsxFile && !queryCssFile) {
  const normalizedQuery = smartQuery.replace(/\\/g, "/");

  let matchedJsx = null;
  for (const filePath of jsxFileClasses.keys()) {
    if (filePath.includes(normalizedQuery) || normalizedQuery.includes(filePath)) {
      matchedJsx = filePath;
      break;
    }
  }

  let matchedCss = null;
  for (const filePath of cssFileIndex.keys()) {
    if (filePath.includes(normalizedQuery) || normalizedQuery.includes(filePath)) {
      matchedCss = filePath;
      break;
    }
  }

  const hasClass = usedClasses.has(smartQuery) || definedClasses.has(smartQuery);

  if (matchedJsx && !matchedCss && !hasClass) {
    console.log(`🔍 Detected JSX file query\n`);
    queryJsxFile = matchedJsx;
  } else if (matchedCss && !matchedJsx && !hasClass) {
    console.log(`🔍 Detected CSS file query\n`);
    queryCssFile = matchedCss;
  } else if (hasClass && !matchedJsx && !matchedCss) {
    console.log(`🔍 Detected class name query\n`);
    queryClass = smartQuery;
  } else if (matchedJsx || matchedCss || hasClass) {
    console.log(`\n🤔 Multiple matches found for "${smartQuery}":\n`);
    if (hasClass) {
      console.log(`  [1] Class: .${smartQuery}`);
    }
    if (matchedJsx) {
      console.log(`  [${hasClass ? "2" : "1"}] JSX file: ${matchedJsx}`);
    }
    if (matchedCss) {
      console.log(`  [${(hasClass ? 2 : 1) + (matchedJsx ? 1 : 0)}] CSS file: ${matchedCss}`);
    }
    console.log(`\nPlease use explicit flags to specify:\n`);
    if (hasClass) console.log(`  --class ${smartQuery}`);
    if (matchedJsx) console.log(`  --jsx ${matchedJsx}`);
    if (matchedCss) console.log(`  --css ${matchedCss}`);
    process.exit(0);
  } else {
    console.log(`\n❌ No matches found for "${smartQuery}"\n`);
    process.exit(1);
  }
}

// Handle queries
if (queryClass) {
  console.log(`\nQuerying class: .${queryClass}\n${"=".repeat(50)}`);

  if (definedClasses.has(queryClass)) {
    console.log(`✓ DEFINED in: ${Array.from(definedClasses.get(queryClass)).join(", ")}`);
  } else {
    console.log("✗ NOT DEFINED in any CSS file");
  }

  if (usedClasses.has(queryClass)) {
    const files = Array.from(usedClasses.get(queryClass));
    console.log(`✓ USED in ${files.length} file${files.length > 1 ? "s" : ""}:`);
    files.forEach((file) => console.log(`  - ${file}`));
  } else {
    console.log("✗ NOT USED in any JSX file");
  }

  if (tailwindEnabled && isTailwind(queryClass)) {
    console.log("\nℹ This appears to be a Tailwind utility class");
  }

  process.exit(0);
}

if (queryJsxFile) {
  const normalizedPath = queryJsxFile.replace(/\\/g, "/");
  let matchedFile = null;
  console.log(`Searching for JSX file matching: ${normalizedPath}`);

  for (const filePath of jsxFileClasses.keys()) {
    const normalizedFilePath = filePath.replace(/\\/g, "/");
    if (
      normalizedFilePath.includes(normalizedPath) ||
      normalizedPath.includes(normalizedFilePath)
    ) {
      matchedFile = filePath;
      break;
    }
  }
  if (!matchedFile) {
    console.log(`\n✗ File not found: ${queryJsxFile}`);
    process.exit(1);
  }

  const classes = jsxFileClasses.get(matchedFile);
  console.log(
    `\nClasses used in: ${matchedFile}\n${"=".repeat(50)}\nTotal: ${classes.length} classes\n`
  );

  const statusGroups = { OK: [], TAILWIND: [], MISSING: [] };

  classes.forEach((cls) => {
    if (definedClasses.has(cls)) {
      statusGroups.OK.push({ cls, def: Array.from(definedClasses.get(cls)).join(", ") });
    } else if (tailwindEnabled && isTailwind(cls)) {
      statusGroups.TAILWIND.push({ cls });
    } else {
      statusGroups.MISSING.push({ cls });
    }
  });

  if (statusGroups.OK.length > 0) {
    console.log(`✓ DEFINED (${statusGroups.OK.length}):`);
    statusGroups.OK.forEach(({ cls, def }) => console.log(`  .${cls} → ${def}`));
    console.log();
  }

  if (statusGroups.MISSING.length > 0) {
    console.log(`✗ MISSING (${statusGroups.MISSING.length}):`);
    statusGroups.MISSING.forEach(({ cls }) => console.log(`  .${cls}`));
    console.log();
  }

  if (tailwindEnabled && statusGroups.TAILWIND.length > 0) {
    console.log(`ℹ TAILWIND (${statusGroups.TAILWIND.length}):`);
    statusGroups.TAILWIND.forEach(({ cls }) => console.log(`  .${cls}`));
  }

  process.exit(0);
}

if (queryCssFile) {
  const normalizedPath = queryCssFile.replace(/\\/g, "/");
  let matchedFile = null;
  console.log(`Searching for CSS file matching: ${normalizedPath}`);

  for (const filePath of cssFileIndex.keys()) {
    if (filePath.includes(normalizedPath) || normalizedPath.includes(filePath)) {
      matchedFile = filePath;
      break;
    }
  }

  if (!matchedFile) {
    console.log(`\n✗ CSS file not found: ${queryCssFile}`);
    process.exit(1);
  }

  const info = cssFileIndex.get(matchedFile);
  console.log(`\nCSS File: ${matchedFile}\n${"=".repeat(50)}`);
  console.log(`Total classes defined: ${info.totalClasses}`);
  console.log(`Classes actually used: ${info.usedClasses}`);
  console.log(`Unused classes: ${info.totalClasses - info.usedClasses}\n`);

  if (info.usedByFiles.length === 0) {
    console.log("✗ NOT USED by any JSX file (potentially unused CSS file)");
  } else {
    console.log(
      `✓ USED by ${info.usedByFiles.length} file${info.usedByFiles.length > 1 ? "s" : ""}:`
    );
    info.usedByFiles.forEach((file) => console.log(`  - ${file}`));
  }

  process.exit(0);
}

// Generate full report
let report = `CSS CLASS ANALYSIS REPORT
Generated on: ${new Date().toLocaleString()}
========================================

SUMMARY
-------
Total Unique Classes Used: ${usedClasses.size}
  - Custom Defined: ${customClasses.length}
${tailwindEnabled ? `  - Likely Tailwind: ${tailwindClasses.length}` : ""}
  - Missing / Undefined: ${missingClasses.length}

Total Custom Classes Defined: ${definedClasses.size}
  - Used: ${customClasses.length}
  - Potentially Unused: ${unusedClasses.length}


PRIORITY: LIKELY DELETED CLASSES TO RECOVER
============================================
(Missing classes that appear to be custom classes, not Tailwind)
(Sorted by usage frequency - most used first)

`;

const likelyDeletedClasses = missingClasses
  .filter((item) => {
    const name = item.name;
    if (name.match(/^(sm|md|lg|xl|2xl):/)) return false;
    if (name.match(/^(hover|focus|active|group):/)) return false;
    if (name.match(/^[a-z]+-\d+$/)) return false;
    if (name.match(/^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky)$/))
      return false;
    if (name.includes("-") && !name.match(/^[a-z]+\d+$/)) return true;
    if (name.match(/^[a-z]+[A-Z]/)) return true;
    return true;
  })
  .sort((a, b) => b.usedIn.length - a.usedIn.length);

if (likelyDeletedClasses.length === 0) {
  report += "✓ No likely deleted custom classes found!\n";
} else {
  report += `Found ${likelyDeletedClasses.length} potentially deleted custom classes:\n\n`;

  likelyDeletedClasses.forEach((item, index) => {
    const count = item.usedIn.length;
    const priority = count > 5 ? "HIGH" : count > 2 ? "MEDIUM" : "LOW";

    report += `${index + 1}. [${priority}] .${item.name}\n`;
    report += `   Used in ${count} file${count > 1 ? "s" : ""}: ${item.usedIn.join(", ")}\n`;

    let suggestedFile = "styles/ui-components.css";

    if (count === 1) {
      suggestedFile = `Local constant in ${item.usedIn[0]}`;
    } else if (item.name.includes("btn") || item.name.includes("button"))
      suggestedFile = "styles/buttons.css";
    else if (
      item.name.includes("nav") ||
      item.name.includes("header") ||
      item.name.includes("footer") ||
      item.name.includes("site")
    )
      suggestedFile = "styles/layout.css";
    else if (
      item.name.includes("form") ||
      item.name.includes("input") ||
      item.name.includes("choice")
    )
      suggestedFile = "styles/forms.css";
    else if (
      item.name.includes("modal") ||
      item.name.includes("dialog") ||
      item.name.includes("consent")
    )
      suggestedFile = "styles/modals.css";
    else if (
      item.name.includes("chat") ||
      item.name.includes("message") ||
      item.name.includes("bob")
    )
      suggestedFile = "styles/chat.css";
    else if (item.name.match(/^(text|font|heading|title|page-title|section)/))
      suggestedFile = "styles/typography.css";
    else if (item.name.match(/^(bg|border|m[tblrxy]?-|p[tblrxy]?-)/))
      suggestedFile = "styles/utilities.css";
    else if (item.name.includes("wiki")) suggestedFile = "styles/wiki.css";
    else if (item.name.includes("provider") || item.name.includes("model"))
      suggestedFile = "styles/provider-status.css";

    report += `   Suggested recovery location: ${suggestedFile}\n\n`;
  });
}

report += `
1. ALL MISSING CLASSES (Used but not defined in CSS and not identified as Tailwind)
------------------------------------------------------------------------------------
`;

if (missingClasses.length === 0) {
  report += "No missing classes found.\n";
} else {
  missingClasses
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((item) => {
      const count = item.usedIn.length;
      report += `[MISSING] .${item.name} (used in ${count} file${count > 1 ? "s" : ""})\n`;
      if (count === 1) {
        report += `    Used in: ${item.usedIn[0]}\n`;
      } else {
        report += `    Used in: ${item.usedIn.join(", ")}\n`;
      }
    });
}

report += `
2. CUSTOM CLASSES (Defined and Used)
------------------------------------
`;

customClasses
  .sort((a, b) => a.name.localeCompare(b.name))
  .forEach((item) => {
    const count = item.usedIn.length;
    report += `[OK] .${item.name} (used in ${count} file${count > 1 ? "s" : ""})\n`;
    report += `    Defined in: ${item.definedIn.join(", ")}\n`;
    if (count === 1) {
      report += `    Used in: ${item.usedIn[0]}\n`;
    }
  });

report += `
2b. POTENTIAL LOCAL / COMPONENT CLASSES (defined in styles/ and used only once)
--------------------------------------------------------------------------------
`;
if (localComponentCandidates.length === 0) {
  report += "None found.\n";
} else {
  localComponentCandidates
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((item) => {
      report += `[LOCAL] .${item.name}\n`;
      report += `    Defined in: ${item.definedIn.join(", ")}\n`;
      report += `    Used in: ${item.usedIn.join(", ")}\n`;
      report += `    Suggestion: consider moving this rule to the component's local stylesheet or a colocated CSS module.\n\n`;
    });
}

report += `
3. POTENTIALLY UNUSED CLASSES (Defined but not found in JSX)
------------------------------------------------------------
(Note: May be used dynamically or in other ways not caught by static analysis)
`;

unusedClasses
  .sort((a, b) => a.name.localeCompare(b.name))
  .forEach((item) => {
    report += `[UNUSED?] .${item.name}\n`;
    report += `    Defined in: ${item.definedIn.join(", ")}\n`;
  });

if (tailwindEnabled) {
  report += `
4. TAILWIND CLASSES (Filtered out)
----------------------------------
Total: ${tailwindClasses.length}
(List omitted for brevity)


`;
}

// DUPLICATE DEFINITIONS ANALYSIS
const cssDuplicates = [];
const mixedDuplicates = [];

// Check for CSS duplicates (defined in >1 CSS file)
for (const [cls, files] of definedClasses.entries()) {
  if (files.size > 1) {
    cssDuplicates.push({ name: cls, locations: Array.from(files) });
  }
}

// Check for Mixed duplicates (CSS + Inline/Local)
for (const [cls, files] of definedClasses.entries()) {
  if (inlineCssMap[cls]) {
    const cssLocs = Array.from(files);
    const inlineLocs = inlineCssMap[cls].map((l) => `inline/local in ${l}`);
    mixedDuplicates.push({ name: cls, locations: [...cssLocs, ...inlineLocs] });
  }
}

if (cssDuplicates.length > 0 || mixedDuplicates.length > 0) {
  report += `
5. DUPLICATE CLASS DEFINITIONS
------------------------------
`;

  if (cssDuplicates.length > 0) {
    report += `\n[CSS DUPLICATES] Defined in multiple CSS files:\n`;
    cssDuplicates
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((item) => {
        report += `  .${item.name}\n`;
        report += `    Found in: ${item.locations.join(", ")}\n`;
      });
  }

  if (mixedDuplicates.length > 0) {
    report += `\n[MIXED DUPLICATES] Defined in CSS and JSX (potential conflict):\n`;
    mixedDuplicates
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((item) => {
        report += `  .${item.name}\n`;
        report += `    Found in: ${item.locations.join(", ")}\n`;
      });
  }
  report += "\n";
}

report += `
6. PER-JSX FILE ANALYSIS
------------------------
`;

const sortedJsxFiles = Array.from(jsxFileClasses.keys()).sort();

sortedJsxFiles.forEach((filePath) => {
  const classes = jsxFileClasses.get(filePath);
  if (classes.length === 0) return;

  report += `\n[FILE] ${filePath} (${classes.length} classes)\n`;

  classes.forEach((cls) => {
    let status = "";
    let details = "";

    if (definedClasses.has(cls)) {
      status = "OK";
      details = `defined in ${Array.from(definedClasses.get(cls)).join(", ")}`;
    } else if (tailwindEnabled && isTailwind(cls)) {
      status = "TAILWIND";
      details = "utility class";
    } else {
      status = "MISSING";
      details = "not defined in custom CSS";
    }

    report += `  [${status}] .${cls} - ${details}\n`;
  });
});

report += `

6. CSS FILE REVERSE INDEX
--------------------------
(Shows which JSX files use classes from each CSS file)
`;

const sortedCssFiles = Array.from(cssFileIndex.keys()).sort();

sortedCssFiles.forEach((filePath) => {
  const info = cssFileIndex.get(filePath);
  report += `\n[CSS] ${filePath}\n`;
  report += `  Total classes defined: ${info.totalClasses}\n`;
  report += `  Classes actually used: ${info.usedClasses}\n`;

  if (info.usedByFiles.length === 0) {
    report += `  Used by: (none - potentially unused file)\n`;
  } else {
    report += `  Used by ${info.usedByFiles.length} file${info.usedByFiles.length > 1 ? "s" : ""}:\n`;
    info.usedByFiles.forEach((jsxFile) => {
      report += `    - ${jsxFile}\n`;
    });
  }
});

// Build structured JSON data for machine-readable output
const reportData = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalUsed: usedClasses.size,
    customDefined: customClasses.length,
    tailwindClasses: tailwindEnabled ? tailwindClasses.length : 0,
    missing: missingClasses.length,
    unused: unusedClasses.length,
    cssDuplicates: cssDuplicates.length,
    mixedDuplicates: mixedDuplicates.length,
  },
  missingClasses: missingClasses.map((item) => ({
    name: item.name,
    usedIn: item.usedIn,
  })),
  customClasses: customClasses.map((item) => ({
    name: item.name,
    definedIn: item.definedIn,
    usedIn: item.usedIn,
  })),
  unusedClasses: unusedClasses.map((item) => ({
    name: item.name,
    definedIn: item.definedIn,
  })),
  duplicates: {
    css: cssDuplicates,
    mixed: mixedDuplicates,
  },
  localCandidates: localComponentCandidates.map((item) => ({
    name: item.name,
    definedIn: item.definedIn,
    usedIn: item.usedIn,
  })),
  likelyDeleted: likelyDeletedClasses.map((item) => ({
    name: item.name,
    usedIn: item.usedIn,
    priority: item.usedIn.length > 5 ? "HIGH" : item.usedIn.length > 2 ? "MEDIUM" : "LOW",
  })),
};

// Write JSON output
fs.writeFileSync(outputFileJson, JSON.stringify(reportData, null, 2));
console.log(`JSON report generated: ${outputFileJson}`);

// Convert text report to Markdown format
let mdReport = report
  .replace(/^CSS CLASS ANALYSIS REPORT$/gm, "# CSS Class Analysis Report")
  .replace(/^Generated on: (.+)$/gm, "_Generated on: $1_")
  .replace(/^========================================$/gm, "")
  .replace(/^SUMMARY$/gm, "## Summary")
  .replace(/^-------$/gm, "")
  .replace(
    /^PRIORITY: LIKELY DELETED CLASSES TO RECOVER$/gm,
    "## Priority: Likely Deleted Classes to Recover"
  )
  .replace(/^--------------------------------------------$/gm, "")
  .replace(/^1\. ALL MISSING CLASSES/gm, "## 1. All Missing Classes")
  .replace(
    /^------------------------------------------------------------------------------------$/gm,
    ""
  )
  .replace(/^2\. CUSTOM CLASSES/gm, "## 2. Custom Classes")
  .replace(/^------------------------------------$/gm, "")
  .replace(
    /^2b\. POTENTIAL LOCAL \/ COMPONENT CLASSES/gm,
    "## 2b. Potential Local / Component Classes"
  )
  .replace(
    /^--------------------------------------------------------------------------------$/gm,
    ""
  )
  .replace(/^3\. POTENTIALLY UNUSED CLASSES/gm, "## 3. Potentially Unused Classes")
  .replace(/^------------------------------------------------------------$/gm, "")
  .replace(/^4\. TAILWIND CLASSES/gm, "## 4. Tailwind Classes")
  .replace(/^----------------------------------$/gm, "")
  .replace(/^5\. DUPLICATE CLASS DEFINITIONS$/gm, "## 5. Duplicate Class Definitions")
  .replace(/^------------------------------$/gm, "")
  .replace(/^6\. PER-JSX FILE ANALYSIS$/gm, "## 6. Per-JSX File Analysis")
  .replace(/^------------------------$/gm, "")
  .replace(/^\[MISSING\]/gm, "**[MISSING]**")
  .replace(/^\[OK\]/gm, "**[OK]**")
  .replace(/^\[UNUSED\?\]/gm, "**[UNUSED?]**")
  .replace(/^\[LOCAL\]/gm, "**[LOCAL]**")
  .replace(/^\[TAILWIND\]/gm, "**[TAILWIND]**")
  .replace(/^\[CSS DUPLICATES\]/gm, "### CSS Duplicates")
  .replace(/^\[MIXED DUPLICATES\]/gm, "### Mixed Duplicates")
  .replace(/^\[FILE\] (.+)$/gm, "### File: `$1`")
  .replace(/^\[CSS\] (.+)$/gm, "### CSS: `$1`")
  .replace(/\.([\w-]+)(?=\s)/g, "`.$1`");

// Generate Table of Contents
const toc = `
## Table of Contents

- [Summary](#summary)
- [Priority: Likely Deleted Classes to Recover](#priority-likely-deleted-classes-to-recover)
- [1. All Missing Classes](#1-all-missing-classes)
- [2. Custom Classes](#2-custom-classes)
- [2b. Potential Local / Component Classes](#2b-potential-local--component-classes)
- [3. Potentially Unused Classes](#3-potentially-unused-classes)
${tailwindEnabled ? "- [4. Tailwind Classes](#4-tailwind-classes)\n" : ""}${cssDuplicates.length > 0 || mixedDuplicates.length > 0 ? "- [5. Duplicate Class Definitions](#5-duplicate-class-definitions)\n" : ""}- [6. Per-JSX File Analysis](#6-per-jsx-file-analysis)

---

`;

// Insert TOC after the header and generated date
mdReport = mdReport.replace(/(# CSS Class Analysis Report\n_Generated on: .+_\n\n)/, `$1${toc}`);

// Write Markdown output
fs.writeFileSync(outputFileMarkdown, mdReport);
console.log(`Markdown report generated: ${outputFileMarkdown}`);

// --- BEGIN: Tailwind dump generation ---
async function generateTailwindDump(outputPath) {
  console.log("Generating Tailwind CSS dump...");
  try {
    const { execSync } = await import("child_process");

    // Try to generate Tailwind dump using npx tailwindcss
    const configPath = path.join(__dirname, "..", "tailwind.config.js");
    const inputPath = path.join(__dirname, "..", "src", "index.css");

    let command = `npx tailwindcss --config ${configPath} --input ${inputPath} --output ${outputPath}`;

    // If config doesn't exist, try without it
    if (!fs.existsSync(configPath)) {
      command = `npx tailwindcss --input ${inputPath} --output ${outputPath}`;
    }

    // If input doesn't exist, try with a minimal CSS
    if (!fs.existsSync(inputPath)) {
      const minimalCss = "@tailwind base; @tailwind components; @tailwind utilities;";
      const tempInputPath = path.join(__dirname, "..", "temp-tailwind-input.css");
      fs.writeFileSync(tempInputPath, minimalCss);
      command = `npx tailwindcss --input ${tempInputPath} --output ${outputPath}`;

      try {
        execSync(command, { stdio: "inherit" });
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempInputPath)) {
          fs.unlinkSync(tempInputPath);
        }
      }
    } else {
      execSync(command, { stdio: "inherit" });
    }

    console.log(`✅ Tailwind dump generated: ${outputPath}`);
  } catch (error) {
    console.warn("⚠️  Failed to generate Tailwind dump:", error.message);
    console.warn("   Make sure Tailwind CSS is installed: npm install -D tailwindcss");
    // Don't throw error, just continue without the dump
  }
}

// --- BEGIN: Coordinator / exported runner ---
export async function runAll(opts = {}) {
  // If caller requested generation, attempt it before parsing
  const shouldGen = Boolean(opts.generateTailwindDump || generateTailwindDumpFlag);
  if (shouldGen) {
    await generateTailwindDump(path.join(__dirname, "..", "tailwind-dump.txt"));
  }

  // parse tailwind dump (if present) and produce tailwind-classes.json
  const tailwind = parseTailwindDump(opts.tailwindDumpPath);

  // ...existing extraction logic that previously built inline CSS map...
  // If buildInlineCssMap or similar is defined in this file, call it here.
  // Example: const inlineMap = buildInlineCssMap(allJsxFiles);
  // Return combined result for convenience.
  let inlineMap = {};
  if (typeof buildInlineCssMap === "function") {
    try {
      inlineMap = buildInlineCssMap(opts.jsxFiles || []);
    } catch (e) {
      /* ignore */
    }
  }

  return { tailwind, inlineMap };
}
