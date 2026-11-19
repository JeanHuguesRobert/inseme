#!/usr/bin/env node
/**
 * apps/platform/scripts/bootstrap-suvranu-twins.js
 *
 * Bootstrapping engine for Corsican Provisional Twins using @suvranu's following graph as seed.
 * Supports official X API v2 (with lawful access / Bearer token) and mock/fixture modes.
 *
 * Usage:
 *   node apps/platform/scripts/bootstrap-suvranu-twins.js --seed suvranu --discover
 *   node apps/platform/scripts/bootstrap-suvranu-twins.js --seed suvranu --provision <handle>
 *   node apps/platform/scripts/bootstrap-suvranu-twins.js --mock --discover
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import {
  XApiExternalActorSource,
  MockExternalActorSource,
  TwitterArchiveExternalActorSource,
  ensureProvisionalTwin,
  hydrateProvisionalTwin,
} from "../../../packages/cop-host/src/adapters/externalActorSource.js";

// Load platform .env
config({ path: resolve(process.cwd(), "apps/platform/.env") });

const args = process.argv.slice(2);
const isMock = args.includes("--mock");
const archiveIndex = args.indexOf("--archive");
const archivePath = archiveIndex !== -1 && args[archiveIndex + 1] ? args[archiveIndex + 1] : null;
const seedIndex = args.indexOf("--seed");
const seedHandle = seedIndex !== -1 && args[seedIndex + 1] ? args[seedIndex + 1] : "suvranu";
const provisionIndex = args.indexOf("--provision");
const provisionTarget =
  provisionIndex !== -1 && args[provisionIndex + 1] ? args[provisionIndex + 1] : null;
const isDiscover = args.includes("--discover") || (!provisionTarget && !args.includes("--hydrate"));

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Adapter selection
let adapter;
if (archivePath) {
  console.log(`📦 Loading Twitter/X Archive from: ${archivePath}...`);
  adapter = new TwitterArchiveExternalActorSource({ archivePath });
} else if (isMock) {
  console.log("🧪 Using MockExternalActorSource with Corsican seed fixtures...");
  adapter = new MockExternalActorSource("x", {
    actors: {
      1001: {
        provider_subject_id: "1001",
        handle: "suvranu",
        display_name: "U Suvranu",
        bio: "Curateur et observateur de la vie publique corse.",
      },
      2001: {
        provider_subject_id: "2001",
        handle: "corse_matin",
        display_name: "Corse-Matin",
        bio: "Premier quotidien d'information en Corse.",
      },
      2002: {
        provider_subject_id: "2002",
        handle: "univ_corsica",
        display_name: "Università di Corsica",
        bio: "Università di Corsica Pasquale Paoli — Corte.",
      },
      2003: {
        provider_subject_id: "2003",
        handle: "isula_corsica",
        display_name: "Cullettività di Corsica",
        bio: "Compte officiel de la Collectivité de Corse.",
      },
    },
    followingGraph: {
      suvranu: ["2001", "2002", "2003"],
    },
  });
} else {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    console.warn("\n⚠️  No X_BEARER_TOKEN or TWITTER_BEARER_TOKEN found in environment.");
    console.warn("   To run against live X API v2, set X_BEARER_TOKEN in apps/platform/.env.");
    console.warn(
      "   Falling back to simulation / mock mode with historical @suvranu seed fixtures.\n"
    );
    adapter = new MockExternalActorSource("x", {
      actors: {
        1001: {
          provider_subject_id: "1001",
          handle: "suvranu",
          display_name: "U Suvranu",
          bio: "Curateur et observateur de la vie publique corse.",
        },
        2001: {
          provider_subject_id: "2001",
          handle: "corse_matin",
          display_name: "Corse-Matin",
          bio: "Premier quotidien d'information en Corse.",
        },
        2002: {
          provider_subject_id: "2002",
          handle: "univ_corsica",
          display_name: "Università di Corsica",
          bio: "Università di Corsica Pasquale Paoli — Corte.",
        },
        2003: {
          provider_subject_id: "2003",
          handle: "isula_corsica",
          display_name: "Cullettività di Corsica",
          bio: "Compte officiel de la Collectivité de Corse.",
        },
      },
      followingGraph: {
        suvranu: ["2001", "2002", "2003"],
      },
    });
  } else {
    console.log("🌐 Initializing official X API v2 adapter with configured Bearer Token...");
    adapter = new XApiExternalActorSource({ bearerToken: token });
  }
}

async function run() {
  console.log(`\n========================================================`);
  console.log(`📡 PROVISIONAL TWIN BOOTSTRAPPER — SEED: @${seedHandle}`);
  console.log(`========================================================`);

  if (isDiscover) {
    console.log(`\n1. Enumerating following graph for seed: @${seedHandle}...`);
    try {
      const { actors, nextCursor } = await adapter.enumerate(seedHandle);
      console.log(`\n✅ Discovered ${actors.length} external actor identities:`);
      console.log(
        `--------------------------------------------------------------------------------`
      );
      console.log(
        `| Handle               | ID         | Name                        | Bio Preview `
      );
      console.log(
        `--------------------------------------------------------------------------------`
      );
      for (const a of actors) {
        const handle = `@${a.handle}`.padEnd(20);
        const id = String(a.provider_subject_id).padEnd(10);
        const name = (a.display_name || "").slice(0, 26).padEnd(27);
        const bio = (a.bio || "N/A").replace(/\n/g, " ").slice(0, 35);
        console.log(`| ${handle} | ${id} | ${name} | ${bio}...`);
      }
      console.log(
        `--------------------------------------------------------------------------------`
      );
      if (nextCursor) {
        console.log(`ℹ️  Next page cursor: ${nextCursor}`);
      }

      console.log(`\n💡 To lazily provision a Provisional Twin hosted on JHN, run:`);
      console.log(`   node apps/platform/scripts/bootstrap-suvranu-twins.js --provision <handle>`);
    } catch (err) {
      console.error("❌ Enumeration failed:", err.message);
    }
  }

  if (provisionTarget) {
    console.log(`\n2. Lazy provisioning Provisional Twin for: @${provisionTarget}...`);
    const rootHostId = "00000000-0000-0000-0000-000000000001"; // JHN
    const extIdentity = {
      provider: "x",
      provider_subject_id: `ext-${provisionTarget}`,
      handle: provisionTarget,
      display_name: provisionTarget,
    };

    if (supabase) {
      // Check if instance already exists
      const { data: existing } = await supabase
        .from("instances")
        .select("*")
        .eq("canonical_slug", provisionTarget.toLowerCase())
        .maybeSingle();

      if (existing) {
        console.log(
          `ℹ️  Provisional Twin already exists: [${existing.id}] ${existing.display_name}`
        );
      } else {
        const { data: newInst, error: insertErr } = await supabase
          .from("instances")
          .insert({
            host_instance_id: rootHostId,
            canonical_slug: provisionTarget.toLowerCase(),
            display_name: provisionTarget,
            bot_name: "Ophélia",
            subject_ref: `subject:x:${provisionTarget.toLowerCase()}`,
            subject_root_ref: `twin:${provisionTarget.toLowerCase()}`,
            status: "provisional",
            deployment_kind: "personal",
            subject_kind: "living_person",
            is_claimable: true,
            metadata: {
              discovery_source: "suvranu_following_graph",
              provider: "x",
              handle: provisionTarget,
            },
          })
          .select()
          .single();

        if (insertErr) {
          console.error("❌ Failed inserting provisional instance:", insertErr.message);
        } else {
          console.log(`🎉 Successfully provisioned Provisional Twin on JHN:`);
          console.log(`   - UUID: ${newInst.id}`);
          console.log(`   - Slug: ${newInst.canonical_slug}`);
          console.log(`   - Host: ${newInst.host_instance_id} (JHN)`);
          console.log(`   - Status: ${newInst.status} (Unclaimed, principal_id = null)`);
        }
      }
    }
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
