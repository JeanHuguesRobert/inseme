/* eslint-env deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop(); // pois or events

  const supabaseUrl = globalThis.Deno?.env.get("SUPABASE_URL");
  const supabaseKey = globalThis.Deno?.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Helper to extract instance (subdomain) if needed - usually passed via header by cop-host
  const instanceName = req.headers.get("X-Ophelia-Instance-Name");

  try {
    if (path === "pois") {
      // Fetch POIs
      // Assuming a table 'municipal_poi' or 'points_of_interest'
      const { data, error } = await supabase
        .from("municipal_pois") // Guessing table name based on context
        .select("*");

      if (error) {
        // Fallback if table doesn't exist yet, return empty feature collection
        return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const features = data.map((poi) => ({
        type: "Feature",
        properties: {
          id: poi.id,
          name: poi.name,
          category: poi.category,
          description: poi.description,
          image_url: poi.image_url,
        },
        geometry: {
          type: "Point",
          coordinates: [poi.lng, poi.lat], // GeoJSON is [lng, lat]
        },
      }));

      return new Response(JSON.stringify({ type: "FeatureCollection", features }), {
        headers: { "Content-Type": "application/json" },
      });
    } else if (path === "events") {
      // Fetch Events from posts
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .ilike("metadata->>type", "event%");

      if (error) throw error;

      // Map to simple JSON or GeoJSON
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
