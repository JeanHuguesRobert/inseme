#!/usr/bin/env node

/**
 * Script d'import des observations biodiversité depuis GBIF
 * Cible: Zone de Corte et environs (Corse)
 * Limitation: Volume contrôlé pour éviter surcharge
 */

import { initSupabase } from "../packages/cop-host/src/client/supabase.js";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join } from "path";

// Configuration
const CONFIG = {
  // Zone géographique: Corte et environs (bounding box approximative)
  bbox: {
    minLng: 9.0,
    minLat: 42.2,
    maxLng: 9.3,
    maxLat: 42.4,
  },

  // Limites pour éviter surcharge
  maxObservations: 1000,
  maxRecordsPerPage: 300,

  // Période: Dernière année pour données pertinentes
  dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  dateTo: new Date().toISOString().split("T")[0],

  // Filtres taxonomiques (groupes pertinents pour Corse)
  // Laisser vide pour tous les groupes, ou spécifier des classes
  taxonClasses: [], // Ex: ["AVES", "MAMMALIA", "INSECTA"]

  // Logging
  logDir: "./logs",
  enableLogging: true,
};

// Logger simple
function log(message, level = "INFO") {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}`;
  console.log(logMessage);

  if (CONFIG.enableLogging) {
    if (!existsSync(CONFIG.logDir)) {
      mkdirSync(CONFIG.logDir, { recursive: true });
    }
    const logFile = join(
      CONFIG.logDir,
      `gbif_import_${new Date().toISOString().split("T")[0]}.log`
    );
    require("fs").appendFileSync(logFile, logMessage + "\n");
  }
}

// Conversion des données GBIF vers notre schéma
function transformGbifToObservation(gbifRecord) {
  try {
    const { occurrence, identification } = gbifRecord;

    // Coordonnées
    const latitude = parseFloat(occurrence.decimalLatitude);
    const longitude = parseFloat(occurrence.decimalLongitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      return null;
    }

    // Date d'observation
    let observedAt = null;
    if (occurrence.eventDate) {
      // Format GBIF: 2023-04-15T12:30:00Z ou 2023-04-15
      observedAt = occurrence.eventDate.includes("T")
        ? occurrence.eventDate
        : `${occurrence.eventDate}T12:00:00Z`;
    }

    if (!observedAt) {
      return null;
    }

    // Noms scientifiques
    const scientificName = occurrence.scientificName || identification?.scientificName;
    const vernacularName = occurrence.vernacularName || "";

    if (!scientificName) {
      return null;
    }

    // Transform en notre schéma
    return {
      scientific_name: scientificName.trim(),
      vernacular_name: vernacularName?.trim() || null,
      observed_at: observedAt,
      observer_name: occurrence.recordedBy?.trim() || "GBIF Contributor",
      source: "gbif",
      validation_status: occurrence.identificationVerificationStatus
        ? occurrence.identificationVerificationStatus === "1"
          ? "confirmed"
          : "probable"
        : "unverified",
      certainty: "medium", // GBIF data generally reliable
      count: occurrence.individualCount ? parseInt(occurrence.individualCount) : 1,
      life_stage: occurrence.lifeStage || null,
      sex: occurrence.sex || null,
      behavior: null, // GBIF doesn't typically have this
      habitat: occurrence.habitat || null,
      latitude,
      longitude,
      location: {
        country: occurrence.country,
        countryCode: occurrence.countryCode,
        stateProvince: occurrence.stateProvince,
        municipality: occurrence.municipality,
        locality: occurrence.locality,
        gbif_id: occurrence.gbifID,
        datasetKey: occurrence.datasetKey,
        publishingOrgKey: occurrence.publishingOrgKey,
      },
      metadata: {
        gbif_record: true,
        gbif_id: occurrence.gbifID,
        dataset_name: occurrence.datasetName,
        publishing_country: occurrence.publishingCountry,
        last_interpreted: occurrence.lastInterpreted,
        issues: occurrence.issues || [],
        coordinate_uncertainty: occurrence.coordinateUncertaintyInMeters,
      },
    };
  } catch (error) {
    log(
      `Error transforming GBIF record ${gbifRecord.occurrence?.gbifID}: ${error.message}`,
      "ERROR"
    );
    return null;
  }
}

// Récupération des données depuis GBIF API
async function fetchGbifObservations(offset = 0) {
  const { minLng, minLat, maxLng, maxLat } = CONFIG.bbox;

  let url =
    `https://api.gbif.org/v1/occurrence/search?` +
    `decimalLongitude=${minLng},${maxLng}&` +
    `decimalLatitude=${minLat},${maxLat}&` +
    `eventDate=${CONFIG.dateFrom},${CONFIG.dateTo}&` +
    `hasCoordinate=true&` +
    `limit=${CONFIG.maxRecordsPerPage}&` +
    `offset=${offset}`;

  // Ajouter filtres taxonomiques si spécifiés
  if (CONFIG.taxonClasses.length > 0) {
    url += `&taxonClassKey=${CONFIG.taxonClasses.join(",")}`;
  }

  log(`Fetching GBIF data: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GBIF API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    log(`GBIF fetch error: ${error.message}`, "ERROR");
    throw error;
  }
}

// Upsert des observations dans Supabase
async function upsertObservations(observations) {
  if (observations.length === 0) return;

  const { supabase } = await initSupabase();

  log(`Upserting ${observations.length} observations to Supabase`);

  try {
    // D'abord, s'assurer que les taxons existent
    const uniqueTaxa = [...new Set(observations.map((obs) => obs.scientific_name))];
    log(`Processing ${uniqueTaxa.length} unique taxa`);

    for (const scientificName of uniqueTaxa) {
      const { data: existingTaxon } = await supabase
        .from("biodiversity_taxa")
        .select("id")
        .eq("scientific_name", scientificName)
        .single();

      if (!existingTaxon) {
        // Créer le taxon s'il n'existe pas
        await supabase.from("biodiversity_taxa").insert({
          scientific_name: scientificName,
          vernacular_name:
            observations.find((obs) => obs.scientific_name === scientificName)?.vernacular_name ||
            null,
          metadata: { source: "gbif_import" },
        });
      }
    }

    // Récupérer les IDs des taxons
    const { data: taxa } = await supabase
      .from("biodiversity_taxa")
      .select("id, scientific_name")
      .in("scientific_name", uniqueTaxa);

    const taxonMap = new Map(taxa.map((t) => [t.scientific_name, t.id]));

    // Ajouter les taxon_id aux observations
    const observationsWithTaxonId = observations.map((obs) => ({
      ...obs,
      taxon_id: taxonMap.get(obs.scientific_name) || null,
    }));

    // Upsert des observations
    const { data: result, error } = await supabase
      .from("biodiversity_observations")
      .upsert(observationsWithTaxonId, {
        onConflict: "latitude, longitude, observed_at, scientific_name",
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }

    log(`Successfully upserted ${observations.length} observations`);
    return result;
  } catch (error) {
    log(`Supabase upsert error: ${error.message}`, "ERROR");
    throw error;
  }
}

// Fonction principale d'import
async function importGbifData() {
  log("Starting GBIF import process");
  log(`Target area: ${JSON.stringify(CONFIG.bbox)}`);
  log(`Date range: ${CONFIG.dateFrom} to ${CONFIG.dateTo}`);
  log(`Max observations: ${CONFIG.maxObservations}`);

  let totalImported = 0;
  let offset = 0;

  try {
    while (totalImported < CONFIG.maxObservations) {
      log(`Fetching batch ${Math.floor(offset / CONFIG.maxRecordsPerPage) + 1}`);

      const gbifData = await fetchGbifObservations(offset);

      if (!gbifData.results || gbifData.results.length === 0) {
        log("No more results from GBIF");
        break;
      }

      // Transformer les données
      const transformedObservations = gbifData.results
        .map(transformGbifToObservation)
        .filter(Boolean); // Remove null values

      if (transformedObservations.length === 0) {
        log("No valid observations in this batch");
        offset += CONFIG.maxRecordsPerPage;
        continue;
      }

      // Limiter pour ne pas dépasser le maximum
      const remainingSlots = CONFIG.maxObservations - totalImported;
      const batchToImport = transformedObservations.slice(0, remainingSlots);

      // Importer dans Supabase
      await upsertObservations(batchToImport);

      totalImported += batchToImport.length;
      offset += CONFIG.maxRecordsPerPage;

      log(`Progress: ${totalImported}/${CONFIG.maxObservations} observations imported`);

      // Si GBIF a moins de résultats que demandé, on a atteint la fin
      if (gbifData.results.length < CONFIG.maxRecordsPerPage) {
        log("Reached end of GBIF results");
        break;
      }

      // Pause pour éviter de surcharger l'API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    log(`Import completed successfully! Total imported: ${totalImported}`);
  } catch (error) {
    log(`Import failed: ${error.message}`, "ERROR");
    process.exit(1);
  }
}

// Exécution du script
if (import.meta.url === `file://${process.argv[1]}`) {
  importGbifData()
    .then(() => {
      log("GBIF import script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      log(`Script failed: ${error.message}`, "ERROR");
      process.exit(1);
    });
}

export { importGbifData, transformGbifToObservation, fetchGbifObservations };
