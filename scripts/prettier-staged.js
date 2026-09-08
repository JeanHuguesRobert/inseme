#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const files = process.argv.slice(2);
let preserved = 0;
const eligible = [];

for (const input of files) {
  const file = path.resolve(input);
  const source = await fs.readFile(file, "utf8");

  // Markdown is authored corpus material. Rewrapping prose or re-aligning
  // tables during an unrelated commit obscures the intended diff. Markdown
  // syntax and frontmatter are validated by their scoped checks instead.
  if (path.extname(file).toLowerCase() === ".md") {
    preserved++;
    console.log(
      `prettier-staged: preserve authored Markdown ${path.relative(process.cwd(), file)}`
    );
    continue;
  }

  eligible.push(file);
}

if (eligible.length) {
  const executable = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prettier.cmd" : "prettier"
  );
  const result = spawnSync(executable, ["--write", ...eligible], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`prettier-staged: eligible=${eligible.length}, preserved=${preserved}`);
