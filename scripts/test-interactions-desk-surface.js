// Smoke test: Interactions Desk UI + edge wiring exist (#36 slice).
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const page = path.join(root, "apps/platform/src/pages/InteractionsDeskPage.jsx");
const edge = path.join(root, "apps/platform/netlify/edge-functions/interactions-desk.js");
const profileEdge = path.join(
  root,
  "apps/platform/netlify/profiles/jhn/edge-functions/interactions-desk.js"
);
const app = path.join(root, "apps/platform/src/App.jsx");
const landing = path.join(root, "apps/platform/src/pages/JhnLandingPage.jsx");
const toml = path.join(root, "apps/platform/netlify.toml");
const profile = path.join(root, "apps/platform/brique-profiles/jhn.json");

for (const file of [page, edge, profileEdge, app, landing, toml, profile]) {
  assert.ok(fs.existsSync(file), `missing ${file}`);
}

const pageSrc = fs.readFileSync(page, "utf8");
assert.ok(pageSrc.includes("/api/interactions/desk"));
assert.ok(pageSrc.includes("Sign in to John"));
assert.ok(pageSrc.includes("Open cases only"));

const edgeSrc = fs.readFileSync(edge, "utf8");
assert.ok(edgeSrc.includes("interaction_cases_desk"));
assert.ok(edgeSrc.includes("missing_bearer_token"));
assert.ok(edgeSrc.includes("NASA_PRINCIPAL_SUBJECT"));
assert.ok(edgeSrc.includes("newSupabase(true)"));

const appSrc = fs.readFileSync(app, "utf8");
assert.ok(appSrc.includes('path="/interactions"'));
assert.ok(appSrc.includes("InteractionsDeskPage"));

const landingSrc = fs.readFileSync(landing, "utf8");
assert.ok(landingSrc.includes('to="/interactions"'));

const tomlSrc = fs.readFileSync(toml, "utf8");
assert.ok(tomlSrc.includes('function = "interactions-desk"'));
assert.ok(tomlSrc.includes('path = "/api/interactions/desk"'));

const profileJson = JSON.parse(fs.readFileSync(profile, "utf8"));
assert.ok(profileJson.core.routes.includes("/interactions"));
assert.ok(
  profileJson.core.edge_functions.some(
    (item) => item.function === "interactions-desk" && item.path === "/api/interactions/desk"
  )
);

console.log("Interactions Desk surface smoke checks passed.");
