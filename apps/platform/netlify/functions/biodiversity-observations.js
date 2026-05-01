/**
 * API Endpoint: /api/biodiversity/observations
 * Returns biodiversity observations as GeoJSON
 *
 * Query parameters:
 * - bbox: bounding box (minLng,minLat,maxLng,maxLat)
 * - taxon: scientific name filter
 * - date_from: start date filter (YYYY-MM-DD)
 * - date_to: end date filter (YYYY-MM-DD)
 * - validation_status: filter by validation status
 * - limit: pagination limit (default: 1000)
 * - offset: pagination offset (default: 0)
 */

import { initSupabase } from "@inseme/cop-host/src/client/supabase.js";

export const handler = async (event) => {
  // Set CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const {
      bbox,
      taxon,
      date_from,
      date_to,
      validation_status,
      limit = "1000",
      offset = "0",
    } = queryParams;

    // Initialize Supabase
    const { supabase } = await initSupabase();

    // Build the query
    let query = supabase
      .from("biodiversity_observations")
      .select(
        `
        id,
        scientific_name,
        vernacular_name,
        observed_at,
        observer_name,
        source,
        validation_status,
        certainty,
        count,
        life_stage,
        sex,
        behavior,
        habitat,
        latitude,
        longitude,
        location,
        metadata,
        biodiversity_taxa (
          id,
          scientific_name,
          vernacular_name,
          taxon_rank,
          kingdom,
          class_name,
          order_name,
          family_name,
          genus,
          protected_status,
          invasive_status,
          conservation_status
        )
      `
      )
      .order("observed_at", { ascending: false });

    // Apply filters
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(parseFloat);
      if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
        // Use PostGIS ST_Within for spatial filtering
        query = query.filter(
          "geom",
          "within",
          `ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)`
        );
      }
    }

    if (taxon) {
      query = query.ilike("scientific_name", `%${taxon}%`);
    }

    if (date_from) {
      query = query.gte("observed_at", date_from);
    }

    if (date_to) {
      query = query.lte("observed_at", date_to);
    }

    if (validation_status) {
      query = query.eq("validation_status", validation_status);
    }

    // Enhanced temporal filters
    const { temporal_grouping, recent_days } = queryParams;

    if (temporal_grouping) {
      // Group by day, week, month, year
      if (temporal_grouping === "day") {
        query = query.select(`
          id,
          scientific_name,
          vernacular_name,
          observed_at,
          observer_name,
          source,
          validation_status,
          certainty,
          count,
          life_stage,
          sex,
          behavior,
          habitat,
          latitude,
          longitude,
          location,
          metadata,
          observed_date,
          biodiversity_taxa (
            id,
            scientific_name,
            vernacular_name,
            taxon_rank,
            kingdom,
            class_name,
            order_name,
            family_name,
            genus,
            protected_status,
            invasive_status,
            conservation_status
          )
        `);
      }
    }

    if (recent_days) {
      const days = parseInt(recent_days);
      if (!isNaN(days) && days > 0) {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - days);
        query = query.gte("observed_at", recentDate.toISOString());
      }
    }

    // Apply pagination
    const limitNum = Math.min(parseInt(limit) || 1000, 5000); // Max 5000 for performance
    const offsetNum = parseInt(offset) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    // Execute query
    const { data: observations, error, count } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Database query failed", details: error.message }),
      };
    }

    // Transform to GeoJSON FeatureCollection
    const features = observations.map((obs) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [obs.longitude, obs.latitude],
      },
      properties: {
        id: obs.id,
        scientific_name: obs.scientific_name,
        vernacular_name: obs.vernacular_name,
        observed_at: obs.observed_at,
        observer_name: obs.observer_name,
        source: obs.source,
        validation_status: obs.validation_status,
        certainty: obs.certainty,
        count: obs.count,
        life_stage: obs.life_stage,
        sex: obs.sex,
        behavior: obs.behavior,
        habitat: obs.habitat,
        location: obs.location,
        metadata: obs.metadata,
        taxonomy: obs.biodiversity_taxa || null,
      },
    }));

    const geojson = {
      type: "FeatureCollection",
      features,
      total_count: count || observations.length,
      limit: limitNum,
      offset: offsetNum,
      filters_applied: {
        bbox: bbox || null,
        taxon: taxon || null,
        date_from: date_from || null,
        date_to: date_to || null,
        validation_status: validation_status || null,
        temporal_grouping: temporal_grouping || null,
        recent_days: recent_days || null,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(geojson),
    };
  } catch (error) {
    console.error("API handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error", details: error.message }),
    };
  }
};
