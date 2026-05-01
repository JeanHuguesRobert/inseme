/**
 * API Endpoint: POST /api/biodiversity/observations
 * Allows citizens to submit biodiversity observations
 *
 * Expected input:
 * {
 *   "scientific_name": "...",
 *   "vernacular_name": "...", (optional)
 *   "lat": ...,
 *   "lng": ...,
 *   "date": "...", (YYYY-MM-DD or ISO datetime)
 *   "count": ..., (optional, default: 1)
 *   "observer_name": "...", (optional)
 *   "notes": "...", (optional)
 *   "life_stage": "...", (optional)
 *   "sex": "...", (optional)
 *   "habitat": "...", (optional)
 * }
 */

import { initSupabase } from "@inseme/cop-host/src/client/supabase.js";

export const handler = async (event) => {
  // Set CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid JSON in request body",
          details: parseError.message,
        }),
      };
    }

    // Validate required fields
    const { scientific_name, lat, lng, date } = requestBody;

    if (!scientific_name || !scientific_name.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required field: scientific_name",
        }),
      };
    }

    if (lat === undefined || lng === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: lat and lng",
        }),
      };
    }

    if (!date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required field: date",
        }),
      };
    }

    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid coordinates: lat and lng must be numbers",
        }),
      };
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Coordinates out of valid range",
        }),
      };
    }

    // Parse and validate date
    let observedAt;
    try {
      if (date.includes("T")) {
        // ISO datetime format
        observedAt = new Date(date).toISOString();
      } else {
        // Date only format - set to noon UTC
        observedAt = new Date(date + "T12:00:00.000Z").toISOString();
      }

      // Check if date is valid and not in future
      const observationDate = new Date(observedAt);
      if (isNaN(observationDate.getTime())) {
        throw new Error("Invalid date");
      }

      if (observationDate > new Date()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Observation date cannot be in the future",
          }),
        };
      }

      // Optional: prevent very old dates (more than 10 years)
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      if (observationDate < tenYearsAgo) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Observation date cannot be more than 10 years old",
          }),
        };
      }
    } catch (dateError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid date format. Use YYYY-MM-DD or ISO datetime",
          details: dateError.message,
        }),
      };
    }

    // Validate count if provided
    let count = 1;
    if (requestBody.count !== undefined) {
      count = parseInt(requestBody.count);
      if (isNaN(count) || count < 1 || count > 1000) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Invalid count: must be a number between 1 and 1000",
          }),
        };
      }
    }

    // Initialize Supabase
    const { supabase } = await initSupabase();

    // Check if taxon exists, create if not
    let taxonId = null;
    const { data: existingTaxon } = await supabase
      .from("biodiversity_taxa")
      .select("id")
      .eq("scientific_name", scientific_name.trim())
      .single();

    if (existingTaxon) {
      taxonId = existingTaxon.id;
    } else {
      // Create new taxon entry
      const { data: newTaxon, error: taxonError } = await supabase
        .from("biodiversity_taxa")
        .insert({
          scientific_name: scientific_name.trim(),
          vernacular_name: requestBody.vernacular_name?.trim() || null,
          metadata: {
            source: "citizen_contribution",
            created_via: "api",
          },
        })
        .select("id")
        .single();

      if (taxonError) {
        console.error("Error creating taxon:", taxonError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: "Failed to create taxon entry",
            details: taxonError.message,
          }),
        };
      }

      taxonId = newTaxon.id;
    }

    // Create observation record
    const observationData = {
      taxon_id: taxonId,
      scientific_name: scientific_name.trim(),
      vernacular_name: requestBody.vernacular_name?.trim() || null,
      observed_at: observedAt,
      observer_name: requestBody.observer_name?.trim() || "Citoyen",
      source: "citizen",
      validation_status: "unverified",
      certainty: "unknown", // Citizen observations start as unknown certainty
      count: count,
      life_stage: requestBody.life_stage?.trim() || null,
      sex: requestBody.sex?.trim() || null,
      behavior: null, // Not collected in basic form
      habitat: requestBody.habitat?.trim() || null,
      latitude: latitude,
      longitude: longitude,
      location: {
        notes: requestBody.notes?.trim() || null,
        submission_method: "api",
        user_agent: event.headers["user-agent"] || null,
      },
      metadata: {
        api_submission: true,
        ip_address: event.headers["x-forwarded-for"] || event.headers["x-real-ip"] || "unknown",
        submission_timestamp: new Date().toISOString(),
      },
    };

    const { data: observation, error: observationError } = await supabase
      .from("biodiversity_observations")
      .insert(observationData)
      .select(
        `
        id,
        scientific_name,
        vernacular_name,
        observed_at,
        observer_name,
        source,
        validation_status,
        count,
        latitude,
        longitude,
        created_at
      `
      )
      .single();

    if (observationError) {
      console.error("Error creating observation:", observationError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to create observation",
          details: observationError.message,
        }),
      };
    }

    // Log successful submission
    console.log(
      `New citizen observation submitted: ${observation.id} - ${observation.scientific_name}`
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Observation submitted successfully",
        observation: {
          id: observation.id,
          scientific_name: observation.scientific_name,
          vernacular_name: observation.vernacular_name,
          observed_at: observation.observed_at,
          observer_name: observation.observer_name,
          validation_status: observation.validation_status,
          count: observation.count,
          latitude: observation.latitude,
          longitude: observation.longitude,
          created_at: observation.created_at,
        },
        note: "Your observation has been submitted and will be reviewed by validators",
      }),
    };
  } catch (error) {
    console.error("API handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};
