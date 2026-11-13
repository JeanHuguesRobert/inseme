import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "apps/platform/.env") });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/platform/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function applySeed() {
  console.log("=== APPLYING PERTITELLU SEED TO LIVE DATABASE ===");
  console.log("Database URL:", supabaseUrl);

  const jhnId = "00000000-0000-0000-0000-000000000001";
  const pertitelluId = "00000000-0000-0000-0000-000000000010";

  // 1. Upsert instance pertitellu-corte
  console.log("\n1. Seeding public.instances...");
  const { data: instData, error: instErr } = await supabase
    .from("instances")
    .upsert(
      {
        id: pertitelluId,
        host_instance_id: jhnId,
        canonical_slug: "pertitellu-corte",
        display_name: "Le Petit Parti — Corte",
        bot_name: "Ophélia",
        subject_ref: "collective:pertitellu-corte",
        twin_root_ref: "twin:pertitellu-corte",
        status: "autonomous",
        deployment_kind: "civic",
        subject_kind: "collective",
        is_claimable: false,
        metadata: {
          role: "civic_hub",
          city: "Corte",
          region: "Corse",
          canonical_url: "https://lepp.baronsmariani.org",
        },
      },
      { onConflict: "id" }
    )
    .select();

  if (instErr) {
    console.error("❌ Error seeding instance:", instErr);
  } else {
    console.log("✅ Instance seeded:", instData[0]?.canonical_slug);
  }

  // 2. Upsert aliases
  console.log("\n2. Seeding public.instance_aliases...");
  const aliases = [
    {
      alias: "pertitellu-corte",
      instance_id: pertitelluId,
      is_primary: true,
      alias_kind: "canonical_slug",
      description: "Primary slug for Pertitellu Corte",
    },
    {
      alias: "lepp",
      instance_id: pertitelluId,
      is_primary: false,
      alias_kind: "short_name",
      description: "Short name for Le Petit Parti",
    },
    {
      alias: "lepp.baronsmariani.org",
      instance_id: pertitelluId,
      is_primary: false,
      alias_kind: "subdomain",
      description: "Current web host for LePP / U Pertitellu (once DNS is activated)",
    },
    {
      alias: "pertitellu",
      instance_id: pertitelluId,
      is_primary: false,
      alias_kind: "short_name",
      description: "General collective name",
    },
    {
      alias: "corte",
      instance_id: pertitelluId,
      is_primary: false,
      alias_kind: "name_variant",
      description: "City name variant",
    },
  ];

  for (const alias of aliases) {
    const { error: aliasErr } = await supabase
      .from("instance_aliases")
      .upsert(alias, { onConflict: "alias" });

    if (aliasErr) {
      console.warn(`   ⚠️ Alias "${alias.alias}":`, aliasErr.message);
    } else {
      console.log(`   ✔ Alias "${alias.alias}" -> [${alias.instance_id}]`);
    }
  }

  // 3. Upsert instance_config
  console.log("\n3. Seeding public.instance_config...");
  const configs = [
    {
      instance_id: pertitelluId,
      key: "community_name",
      value: "Le Petit Parti — Corte",
      category: "identity",
      description: "Nom officiel de la communauté",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "community_code",
      value: "pertitellu-corte",
      category: "identity",
      description: "Code unique d'instance",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "community_type",
      value: "association",
      category: "identity",
      description: "Type de communauté",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "city_name",
      value: "Corte",
      category: "identity",
      description: "Ville de rattachement",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "region_code",
      value: "COR",
      category: "identity",
      description: "Code région",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "region_name",
      value: "Corse",
      category: "identity",
      description: "Nom de la région",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "bot_name",
      value: "Ophélia",
      category: "branding",
      description: "Nom de l'assistant / persona",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "app_url",
      value: "https://lepp.baronsmariani.org",
      category: "identity",
      description: "URL canonique de production",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "host_domain",
      value: "lepp.baronsmariani.org",
      category: "identity",
      description: "Domaine hôte",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "deployment_kind",
      value: "civic",
      category: "identity",
      description: "Type de déploiement",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "application_profile",
      value: "civic-platform",
      category: "identity",
      description: "Profil applicatif",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "contact_email",
      value: "contact@baronsmariani.org",
      category: "identity",
      description: "Email de contact",
      is_public: true,
      is_secret: false,
    },
    {
      instance_id: pertitelluId,
      key: "map_default_center",
      value: "42.3084,9.1505",
      category: "map",
      description: "Centre par défaut de la carte",
      is_public: true,
      is_secret: false,
    },
  ];

  for (const cfg of configs) {
    const { error: cfgErr } = await supabase
      .from("instance_config")
      .upsert(cfg, { onConflict: "instance_id,key" });

    if (cfgErr) {
      console.warn(`   ⚠️ Config "${cfg.key}":`, cfgErr.message);
    } else {
      console.log(`   ✔ Config "${cfg.key}" = "${cfg.value}"`);
    }
  }

  // 4. Test live resolution RPC
  console.log("\n4. Testing Live RPCs...");
  const { data: resolvedPertitellu } = await supabase.rpc("resolve_instance_id", {
    p_identifier: "lepp",
  });
  console.log(`   - "lepp" resolved to: ${resolvedPertitellu}`);

  const { data: effectiveName } = await supabase.rpc("get_effective_instance_config", {
    p_instance_id: pertitelluId,
    p_key: "community_name",
  });
  console.log(`   - Effective community_name (local): ${effectiveName}`);

  const { data: inheritedModel } = await supabase.rpc("get_effective_instance_config", {
    p_instance_id: pertitelluId,
    p_key: "openai_model",
  });
  console.log(`   - Inherited openai_model from JHN root: ${inheritedModel}`);

  console.log("\n🎉 LIVE SEED & RESOLUTION COMPLETED SUCCESSFULLY!");
}

applySeed().catch(console.error);
