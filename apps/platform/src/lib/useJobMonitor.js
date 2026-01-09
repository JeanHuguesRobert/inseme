import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@inseme/cop-host";

/**
 * Hook for monitoring job progress with realtime updates
 * @param {string} jobId - The job ID to monitor
 * @param {function} onProgress - Callback when job progress updates
 * @param {function} onComplete - Callback when job completes
 * @param {function} onError - Callback when job fails
 * @returns {object} - Job state and control functions
 */
export function useJobMonitor(jobId, onProgress, onComplete, onError) {
  const { supabase } = useSupabase();
  const [job, setJob] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState(null);

  // Fetch job data from database
  const fetchJob = useCallback(async () => {
    if (!jobId || !supabase) return;

    try {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();

      if (error) {
        console.error("useJobMonitor: Error fetching job:", error);
        setError(error);
        return;
      }

      setJob(data);
      setError(null);

      // Call progress callback
      if (onProgress && data) {
        onProgress(data);
      }

      // Call completion callbacks
      if (data.status === "completed" && onComplete) {
        onComplete(data);
      } else if (data.status === "failed" && onError) {
        onError(data);
      }
    } catch (err) {
      console.error("useJobMonitor: Exception fetching job:", err);
      setError(err);
    }
  }, [jobId, supabase, onProgress, onComplete, onError]);

  // Subscribe to realtime updates
  const subscribeToJob = useCallback(() => {
    if (!jobId || !supabase) return;

    const topic = `job:${jobId}`;
    console.log("useJobMonitor: Subscribing to job channel:", topic);

    const newChannel = supabase.channel(topic, {
      config: {
        broadcast: { self: true },
        presence: { key: supabase.auth.getUser()?.id },
      },
    });

    // Listen for broadcast events (from DB triggers)
    newChannel.on("broadcast", { event: "*" }, (payload) => {
      console.log("useJobMonitor: Received broadcast:", payload);

      if (payload.new) {
        const updatedJob = payload.new;
        setJob(updatedJob);

        // Call callbacks
        if (onProgress) {
          onProgress(updatedJob);
        }

        if (updatedJob.status === "completed" && onComplete) {
          onComplete(updatedJob);
        } else if (updatedJob.status === "failed" && onError) {
          onError(updatedJob);
        }
      }
    });

    // Monitor subscription status
    newChannel.subscribe((status, err) => {
      console.log("useJobMonitor: Channel status:", status, err);
      setIsSubscribed(status === "SUBSCRIBED");

      if (err) {
        console.error("useJobMonitor: Channel error:", err);
        setError(err);
      }

      // Re-sync data when reconnected
      if (status === "SUBSCRIBED") {
        console.log("useJobMonitor: Reconnected, re-syncing job data");
        fetchJob();
      }
    });

    setChannel(newChannel);
    return newChannel;
  }, [jobId, supabase, fetchJob, onProgress, onComplete, onError]);

  // Cleanup subscription
  const unsubscribe = useCallback(() => {
    if (channel) {
      console.log("useJobMonitor: Unsubscribing from job channel");
      supabase.removeChannel(channel);
      setChannel(null);
      setIsSubscribed(false);
    }
  }, [channel, supabase]);

  // Initialize subscription and fetch initial data
  useEffect(() => {
    if (jobId) {
      fetchJob();
      const newChannel = subscribeToJob();

      return () => {
        if (newChannel) {
          supabase.removeChannel(newChannel);
        }
      };
    }
  }, [jobId, fetchJob, subscribeToJob, supabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    job,
    isSubscribed,
    error,
    refetch: fetchJob,
    unsubscribe,
  };
}

/**
 * Hook for creating and monitoring a new job
 * @param {string} jobType - Type of job (e.g., 'data_import', 'report_generation')
 * @param {object} payload - Job payload data
 * @param {function} onProgress - Progress callback
 * @param {function} onComplete - Completion callback
 * @param {function} onError - Error callback
 * @returns {object} - Job creation and monitoring functions
 */
export function useJobCreator(jobType, payload = {}, onProgress, onComplete, onError) {
  const { supabase } = useSupabase();
  const [isCreating, setIsCreating] = useState(false);
  const [createdJobId, setCreatedJobId] = useState(null);

  const createJob = useCallback(async () => {
    if (!supabase) {
      throw new Error("Supabase client not available");
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          type: jobType,
          payload: payload,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log("useJobCreator: Created job:", data.id);
      setCreatedJobId(data.id);
      return data;
    } catch (err) {
      console.error("useJobCreator: Error creating job:", err);
      if (onError) {
        onError(err);
      }
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [supabase, jobType, payload, onError]);

  // Use the monitor hook for the created job
  const jobMonitor = useJobMonitor(createdJobId, onProgress, onComplete, onError);

  return {
    createJob,
    isCreating,
    jobId: createdJobId,
    job: jobMonitor.job,
    isSubscribed: jobMonitor.isSubscribed,
    error: jobMonitor.error,
    refetch: jobMonitor.refetch,
  };
}
