import { createClient } from "@supabase/supabase-js";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

// Supabase client initialisé de façon lazy
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(getConfig("supabase_url"), getConfig("supabase_service_role_key"));
  }
  return _supabase;
}

/**
 * Netlify function for running long jobs with progress updates
 * This demonstrates server-side job processing with realtime progress updates
 */
export const handler = async (event, context) => {
  // Charger la configuration
  await loadInstanceConfig();
  // Enable CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { jobId, jobType, payload } = JSON.parse(event.body);

    if (!jobId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "jobId is required" }),
      };
    }

    // Start the job
    await getSupabase().rpc("update_job_progress", {
      job_id: jobId,
      new_progress: 0,
      new_message: "Job started",
      new_status: "running",
    });

    // Simulate long-running job with progress updates
    const totalSteps = payload?.steps || 10;
    const delay = payload?.delay || 1000;

    for (let i = 1; i <= totalSteps; i++) {
      const progress = Math.round((i / totalSteps) * 100);
      const message = `Processing step ${i}/${totalSteps}`;

      await getSupabase().rpc("update_job_progress", {
        job_id: jobId,
        new_progress: progress,
        new_message: message,
        new_status: i === totalSteps ? "completed" : "running",
      });

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Mark job as completed with result
    await getSupabase()
      .from("jobs")
      .update({
        result: { completed: true, processedSteps: totalSteps },
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        jobId,
        message: "Job completed successfully",
      }),
    };
  } catch (error) {
    console.error("Job runner error:", error);

    // Mark job as failed
    if (event.body) {
      try {
        const { jobId } = JSON.parse(event.body);
        if (jobId) {
          await getSupabase().rpc("update_job_progress", {
            job_id: jobId,
            new_status: "failed",
            new_message: "Job failed: " + error.message,
          });

          await getSupabase()
            .from("jobs")
            .update({
              error_details: { message: error.message, stack: error.stack },
              completed_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        }
      } catch (updateError) {
        console.error("Error updating failed job:", updateError);
      }
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Job execution failed",
        details: error.message,
      }),
    };
  }
};
