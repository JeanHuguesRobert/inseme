/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { loadConfig, getConfig } from "../../../../cop-host/src/scripts/config.js";

// Load environment variables
await loadConfig();

const SUPABASE_URL = getConfig("supabase_url");
const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCES = [
  {
    label: "Mairie de Corte - Agenda",
    base_url: "https://www.mairie-corte.fr/",
    description: "Agenda des manifestations (modules.php?name=Calendrier)",
  },
  {
    label: "Mairie de Corte - Carte Interactive",
    base_url: "https://www.mairie-corte.fr/",
    description: "Points d'intérêt via SimpleCarto XML",
  },
  {
    label: "Mairie de Corte - Actualités",
    base_url: "https://www.mairie-corte.fr/",
    description: "Actualités et Publications administratives",
  },
];

const CONFIG_VALUES = [
  { key: "MAIRIE_LABEL", value: '"Mairie de Corte"', is_secret: false },
  { key: "MAIRIE_BASE_URL", value: '"https://www.mairie-corte.fr/"', is_secret: false },
  {
    key: "MAIRIE_AGENDA_URL",
    value: '"https://www.mairie-corte.fr/modules.php?name=Calendrier&op=listemanifs"',
    is_secret: false,
  },
  {
    key: "MAIRIE_CARTE_URL",
    value: '"https://www.mairie-corte.fr/modules.php?name=Sections&sop=viewarticle&artid=259"',
    is_secret: false,
  },
];

async function main() {
  console.log("Setting up sources for Corte...");

  // 1. Insert Sources
  for (const source of SOURCES) {
    const { data, error } = await supabase
      .from("sources_web")
      .upsert(source, { onConflict: "label" }) // assuming label is unique enough for this setup or we check by base_url
      .select();

    if (error) console.error(`Error inserting ${source.label}:`, error.message);
    else console.log(`Source configured: ${source.label}`);
  }

  // 2. Insert Config
  console.log("Updating instance_config...");
  for (const item of CONFIG_VALUES) {
    const { error } = await supabase.from("instance_config").upsert(item, { onConflict: "key" });

    if (error) console.error(`Error config ${item.key}:`, error.message);
    else console.log(`Config set: ${item.key}`);
  }

  console.log("Setup complete.");
}

main().catch(console.error);
