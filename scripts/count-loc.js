#!/usr/bin/env node

/**
 * Count Lines of Code in the entire project (respecting .gitignore)
 * Usage: node scripts/count-loc.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

function colorize(text, color) {
  return `${colors[color] || ""}${text}${colors.reset}`;
}

// Get the project root (parent of scripts directory)
const projectRoot = path.resolve(path.dirname(__dirname));

console.log(colorize("========================================", "cyan"));
console.log(colorize("  Project Line Counter (respecting gitignore)", "cyan"));
console.log(colorize("========================================", "cyan"));
console.log("");

/**
 * Use git ls-files to get all tracked files (respects .gitignore)
 */
function getTrackedFiles() {
  try {
    const output = execSync("git ls-files", {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return output
      .trim()
      .split("\n")
      .map((f) => path.join(projectRoot, f))
      .filter((f) => {
        // Exclude archive files from LOC count
        if (f.includes(path.join("apps", "inseme", "archive"))) return false;
        // Exclude generated files from LOC count
        if (f.includes(path.join("generated")) || path.basename(f).startsWith("gen-")) return false;
        // Exclude node_modules (sometimes tracked in sub-packages or symlinked)
        if (f.includes("node_modules")) return false;
        return fs.existsSync(f) && fs.statSync(f).isFile();
      });
  } catch (error) {
    console.error(colorize("Error running git ls-files. Falling back to manual crawl...", "red"));
    return [];
  }
}

/**
 * Count lines in a file
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.split("\n").length;
  } catch (e) {
    return 0;
  }
}

/**
 * Format number with thousand separators
 */
function formatNumber(num) {
  return num.toLocaleString("en-US");
}

const trackedFiles = getTrackedFiles();

if (trackedFiles.length === 0) {
  console.log(colorize("No files found or git error.", "red"));
  process.exit(1);
}

const results = trackedFiles
  .filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ext !== ".pdf" && ext !== ".md" && ext !== ".png" && ext !== ".json" && ext !== ".yaml";
  })
  .map((file) => {
    const ext = path.extname(file).toLowerCase() || "(no ext)";
    return {
      path: file,
      type: ext,
      file: path.basename(file),
      lines: countLines(file),
    };
  });

// Group by file type
const summaryMap = new Map();

results.forEach((item) => {
  if (!summaryMap.has(item.type)) {
    summaryMap.set(item.type, { files: 0, lines: 0 });
  }
  const summary = summaryMap.get(item.type);
  summary.files++;
  summary.lines += item.lines;
});

// Convert to array and sort by lines descending
const summary = Array.from(summaryMap.entries())
  .map(([type, data]) => ({
    type,
    files: data.files,
    lines: data.lines,
  }))
  .sort((a, b) => b.lines - a.lines);

// Display summary table
console.log(colorize("Summary by File Type:", "yellow"));
console.log("");

const typeWidth = Math.max(10, ...summary.map((s) => s.type.length));
const filesWidth = Math.max(8, ...summary.map((s) => s.files.toString().length));
const linesWidth = Math.max(10, ...summary.map((s) => formatNumber(s.lines).length));

console.log(
  "Type".padEnd(typeWidth) +
    "  " +
    "Files".padStart(filesWidth) +
    "  " +
    "Lines".padStart(linesWidth)
);

summary.forEach((row) => {
  console.log(
    row.type.padEnd(typeWidth) +
      "  " +
      row.files.toString().padStart(filesWidth) +
      "  " +
      formatNumber(row.lines).padStart(linesWidth)
  );
});

console.log("");

const totalFiles = summary.reduce((sum, s) => sum + s.files, 0);
const totalLines = summary.reduce((sum, s) => sum + s.lines, 0);

// Special count for JS + JSX
const jsjsxFiles = results.filter((r) => r.type === ".js" || r.type === ".jsx");
const jsjsxFilesCount = jsjsxFiles.length;
const jsjsxLinesCount = jsjsxFiles.reduce((sum, r) => sum + r.lines, 0);

console.log(colorize("========================================", "cyan"));
console.log(colorize(`Total Tracked Files: ${totalFiles}`, "green"));
console.log(colorize(`Total Project Lines: ${formatNumber(totalLines)}`, "green"));
console.log(
  colorize(
    `Total JS + JSX Lines: ${formatNumber(jsjsxLinesCount)} (${jsjsxFilesCount} files)`,
    "magenta"
  )
);

// Velocity calculation
try {
  // The Survey project officially started with the creation of the GitHub repository
  // Date: 2025-10-20
  const surveyStartDateStr = "2025-10-20";

  if (surveyStartDateStr) {
    const firstDate = new Date(surveyStartDateStr);
    const today = new Date();
    const diffTime = Math.abs(today - firstDate);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const velocity = totalLines / diffDays;

    console.log(colorize("Vitesse du projet Survey (Velocity):", "yellow"));
    console.log(`Projet Survey démarré le: ${colorize(surveyStartDateStr, "cyan")}`);
    console.log(`Âge du projet Survey: ${colorize(formatNumber(diffDays), "cyan")} jours`);
    console.log(
      `Vélocité moyenne: ${colorize(formatNumber(Math.round(velocity)), "green")} lignes / jour`
    );
  }
} catch (e) {
  // Silent fail
}

console.log(colorize("========================================", "cyan"));
console.log("");

// Top 10 largest files
console.log(colorize("Top 10 Largest Files:", "yellow"));
console.log("");

const top10 = results.sort((a, b) => b.lines - a.lines).slice(0, 10);
const fileWidth = Math.max(20, ...top10.map((f) => f.file.length));

console.log("File".padEnd(fileWidth) + "  " + "Type".padEnd(10) + "  " + "Lines".padStart(10));

top10.forEach((row) => {
  console.log(
    row.file.padEnd(fileWidth) +
      "  " +
      row.type.padEnd(10) +
      "  " +
      formatNumber(row.lines).padStart(10)
  );
});

console.log("");
