// Read-only consistency view over COP-Host's existing public asset and
// generated frontend-registry paths. Does not generate or rewrite anything.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function markdownFiles(dir) {
  if (!existsSync(dir)) return [];
  const result = [];
  const visit = (base) => {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const filename = join(base, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile() && entry.name.endsWith(".md")) result.push(relative(dir, filename).replaceAll("\\", "/"));
    }
  };
  visit(dir);
  return result.sort();
}

function contentBody(text) {
  return text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, "").replace(/\r\n/g, "\n").trim();
}

export function classifyProjection(source, projected) {
  if (source === projected) return "exact";
  if (contentBody(source) === contentBody(projected)) return "metadata_only";
  return "content_drift";
}

function readGeneratedRegistry(file) {
  if (!existsSync(file)) return { status: "missing", values: null };
  const content = readFileSync(file, "utf8");
  const match = content.match(/export const CONSOLIDATED_PROMPTS = (\{[\s\S]*?\});\s*(?:export |$)/);
  if (!match) return { status: "unrecognized", values: null };
  try {
    return { status: "parsed", values: JSON.parse(match[1]) };
  } catch {
    return { status: "unrecognized", values: null };
  }
}

export function auditPublicProjections({ root, appName, selectedBriques, briqueId = null }) {
  const appDir = join(root, "apps", appName);
  const selected = new Set(selectedBriques.map(b => b.id));
  const configured = selectedBriques.filter(b => !briqueId || b.id === briqueId);
  const existing = join(appDir, "public", "briques");
  const present = existsSync(existing) ? readdirSync(existing, { withFileTypes: true })
    .filter(e => e.isDirectory() || e.isSymbolicLink()).map(e => e.name) : [];
  const ids = [...new Set([...configured.map(b => b.id), ...present.filter(id => !briqueId || briqueId === id)])].sort();
  const registry = readGeneratedRegistry(join(appDir, "src/generated/brique-registry.js"));
  const results = [];
  for (const id of ids) {
    const brique = configured.find(b => b.id === id);
    const sourceDir = join(root, "packages", `brique-${id}`, "public");
    const projectionDir = join(existing, id);
    const sourcePrompts = markdownFiles(sourceDir);
    const projectionPrompts = markdownFiles(projectionDir);
    const paths = [...new Set([...sourcePrompts, ...projectionPrompts])].sort();
    const counts = { exact: 0, metadata_only: 0, content_drift: 0, missing_source: 0, missing_projection: 0,
      registry_exact: 0, registry_drift: 0, registry_missing: 0, registry_not_declared: 0 };
    const differences = [];
    for (const path of paths) {
      const sourceFile = join(sourceDir, path), projectionFile = join(projectionDir, path);
      let classification;
      if (!existsSync(sourceFile)) classification = "missing_source";
      else if (!existsSync(projectionFile)) classification = "missing_projection";
      else classification = classifyProjection(readFileSync(sourceFile, "utf8"), readFileSync(projectionFile, "utf8"));
      counts[classification]++;
      if (classification !== "exact") differences.push({ path, classification });

      if (brique && existsSync(sourceFile)) {
        const declaredPaths = Object.values(brique.prompts || {})
          .map(value => String(value).replace(/^\.\//, "").replace(/^public\//, ""));
        const declared = declaredPaths.includes(path);
        const url = `/briques/${id}/${path}`;
        const actual = registry.values?.[url];
        const state = !declared ? "registry_not_declared" :
          actual === undefined ? "registry_missing" :
          actual === readFileSync(sourceFile, "utf8") ? "registry_exact" : "registry_drift";
        counts[state]++;
        if (state !== "registry_exact" && state !== "registry_not_declared") differences.push({ path, classification: state });
      }
    }
    const registryEntries = registry.values
      ? Object.keys(registry.values).filter(key => key.startsWith(`/briques/${id}/`)).length
      : null;
    results.push({
      brique: id,
      generated_registry_entry_count: registryEntries,
      out_of_profile_registry_entries: !selected.has(id) && registryEntries !== null ? registryEntries : 0,
      profile_selected: selected.has(id),
      public_projection_present: existsSync(projectionDir),
      status: selected.has(id) ? "selected" : "out_of_profile_artifact",
      source_file_count: sourcePrompts.length,
      projected_file_count: projectionPrompts.length,
      generated_registry_status: registry.status,
      counts, differences
    });
  }
  return { mode: "read_only", app: appName, selected_briques: [...selected].sort(),
    generated_registry_status: registry.status, projections: results };
}
