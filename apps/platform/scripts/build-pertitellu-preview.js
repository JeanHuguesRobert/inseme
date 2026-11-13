#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDir, "..");
const viteCli = path.resolve(appDirectory, "node_modules", "vite", "bin", "vite.js");

const PERTITELLU_STATIC_META = {
  title: "Pertitellu — Plateforme Citoyenne de Corte",
  description:
    "Plateforme civique et démocratique de Corte — Consultations, Wiki collaboratif, Kudocracy et transparence.",
  canonicalUrl: "https://lepp.baronsmariani.org/",
};

export async function specializePertitelluIndexHtml(
  indexPath = path.join(appDirectory, "dist", "index.html")
) {
  const index = await readFile(indexPath, "utf8");
  let specialized = index
    .replace(
      /<title[^>]*>.*?<\/title>/s,
      `<title id="page-title">${PERTITELLU_STATIC_META.title}</title>`
    )
    .replace(
      /(name="description"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.description}$2`
    )
    .replace(
      /(id="page-description"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.description}$2`
    )
    .replace(/(property="og:title"[^>]*content=")[^"]*(")/s, `$1${PERTITELLU_STATIC_META.title}$2`)
    .replace(/(id="og-title"[^>]*content=")[^"]*(")/s, `$1${PERTITELLU_STATIC_META.title}$2`)
    .replace(
      /(property="og:description"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.description}$2`
    )
    .replace(
      /(id="og-description"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.description}$2`
    )
    .replace(
      /(property="og:url"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.canonicalUrl}$2`
    )
    .replace(/(id="og-url"[^>]*content=")[^"]*(")/s, `$1${PERTITELLU_STATIC_META.canonicalUrl}$2`)
    .replace(
      /(property="og:image"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.canonicalUrl}images/og-image.png$2`
    )
    .replace(
      /(id="og-image"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.canonicalUrl}images/og-image.png$2`
    )
    .replace(
      /(name="twitter:image"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.canonicalUrl}images/og-image.png$2`
    )
    .replace(
      /(id="twitter-image"[^>]*content=")[^"]*(")/s,
      `$1${PERTITELLU_STATIC_META.canonicalUrl}images/og-image.png$2`
    )
    .replaceAll("{{ APP_URL }}", PERTITELLU_STATIC_META.canonicalUrl.replace(/\/$/, ""))
    .replaceAll("Consultation Citoyenne", PERTITELLU_STATIC_META.title)
    .replaceAll(
      "Plateforme de consultation citoyenne incluant un wiki collaboratif et un système de propositions citoyennes.",
      PERTITELLU_STATIC_META.description
    )
    .replaceAll(
      "Participez à la démocratie locale avec notre plateforme de consultation citoyenne.",
      PERTITELLU_STATIC_META.description
    );

  await writeFile(indexPath, specialized, "utf8");
}

function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: appDirectory,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  console.log("🎛️  Compiling briques for pertitellu-corte profile...");
  run([
    path.resolve(appDirectory, "../../packages/cop-host/scripts/compile-briques.js"),
    "--app",
    "platform",
    "--profile",
    "brique-profiles/pertitellu-corte.json",
  ]);

  console.log("⚡ Building Vite SPA for fracta preview...");
  run([viteCli, "build"], {
    ...process.env,
    INSEME_DEPLOYMENT_PROFILE: "pertitellu-corte",
  });

  await specializePertitelluIndexHtml();
  cpSync(path.join(appDirectory, "dist"), path.join(appDirectory, "dist-fracta-preview"), {
    recursive: true,
    force: true,
  });
  console.log("✅ Pertitellu Corte fracta preview build complete!");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Unable to build Pertitellu preview: ${error.message}`);
    process.exitCode = 1;
  });
}
