import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { specializePertitelluIndexHtml } from "./build-pertitellu-preview.js";
import { loadBriqueProfile } from "../../../packages/cop-host/src/brique-profile.js";

test("Pertitellu build specializes static metadata for LePP / Corte", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "inseme-pertitellu-meta-"));
  const indexPath = path.join(tempDir, "index.html");
  const fixture = `<!doctype html><html lang="fr"><head>
    <title id="page-title">Consultation Citoyenne</title>
    <meta name="description" content="Plateforme de consultation citoyenne incluant un wiki collaboratif et un système de propositions citoyennes.">
    <meta property="og:title" content="Consultation Citoyenne">
    <meta property="og:description" content="Participez à la démocratie locale avec notre plateforme de consultation citoyenne.">
    <meta property="og:url" content="{{ APP_URL }}">
    <meta property="og:image" content="{{ APP_URL }}/images/og-image.png">
    <meta name="twitter:image" content="{{ APP_URL }}/images/og-image.png">
  </head></html>`;
  try {
    await writeFile(indexPath, fixture, "utf8");
    await specializePertitelluIndexHtml(indexPath);
    const specialized = await readFile(indexPath, "utf8");
    assert.match(specialized, /Pertitellu — Plateforme Citoyenne de Corte/);
    assert.match(specialized, /https:\/\/lepp\.baronsmariani\.org\//);
    assert.doesNotMatch(specialized, /Consultation Citoyenne/);
    assert.doesNotMatch(specialized, /\{\{ APP_URL \}\}/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Pertitellu public hostname is updated without resurrecting abandoned lepp.fr alias", async () => {
  const instance = JSON.parse(await readFile(path.resolve(import.meta.dirname, "../instances/pertitellu-corte.json"), "utf8"));
  const example = JSON.parse(await readFile(path.resolve(import.meta.dirname, "../instances/pertitellu-corte.example.json"), "utf8"));
  for (const value of [instance, example]) {
    assert.equal(value.host_domain, "lepp.baronsmariani.org");
    assert.equal(value.canonical_url, "https://lepp.baronsmariani.org");
    assert.equal(value.contact_email, "contact@baronsmariani.org");
  }
  const seedJs = await readFile(path.resolve(import.meta.dirname, "apply-pertitellu-seed-live.js"), "utf8");
  const seedSql = await readFile(path.resolve(import.meta.dirname, "../instances/sql/pertitellu-hosted-seed.sql"), "utf8");
  for (const seed of [seedJs, seedSql]) {
    assert.match(seed, /lepp\.baronsmariani\.org/);
    assert.doesNotMatch(seed, /["']lepp\.fr["']/);
  }
});

test("public LePP landing is inert and cannot expose bundled SPA", async () => {
  const root = path.resolve(import.meta.dirname, "../fracta");
  const landing = await readFile(path.join(root, "en-preparation.html"), "utf8");
  const caddy = await readFile(path.join(root, "pertitellu.caddy"), "utf8");
  assert.match(landing, /Le Petit Parti/);
  assert.match(landing, /En préparation/);
  assert.match(landing, /https:\/\/lepp\.baronsmariani\.org\//);
  assert.doesNotMatch(landing, /<script/i);
  assert.match(caddy, /rewrite \* \/en-preparation\.html/);
  assert.match(caddy, /respond "Not published" 404/);
  assert.match(caddy, /backend_ready/);
});

test("pertitellu-corte profile is valid and includes all required civic briques", () => {
  const profilePath = path.resolve(import.meta.dirname, "../brique-profiles/pertitellu-corte.json");
  const profile = loadBriqueProfile(profilePath);

  assert.equal(profile.id, "pertitellu-corte");
  assert.equal(profile.deployment_kind, "civic");
  assert.equal(profile.application_profile, "civic-platform");

  const briqueIds = profile.briques.map((b) => b.id);
  assert.ok(briqueIds.includes("ophelia"), "Includes ophelia");
  assert.ok(briqueIds.includes("democracy"), "Includes democracy");
  assert.ok(briqueIds.includes("wiki"), "Includes wiki");
  assert.ok(briqueIds.includes("actes"), "Includes actes");
  assert.ok(briqueIds.includes("communes"), "Includes communes");
  assert.ok(briqueIds.includes("fil"), "Includes fil");
  assert.ok(briqueIds.includes("map"), "Includes map");
  assert.ok(briqueIds.includes("tasks"), "Includes tasks");
});
