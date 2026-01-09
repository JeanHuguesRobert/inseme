import React, { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";

const SupabaseContext = createContext(undefined);

export function SupabaseProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {
    currentUser,
    loading: userLoading,
    error: userError,
    userStatus,
    updateProfile,
  } = useCurrentUser();
  const [connectionState, setConnectionState] = useState("disconnected");
  const [realtimeStatus, setRealtimeStatus] = useState("disconnected");
  const [authEvent, setAuthEvent] = useState(null);
  // Task monitoring state
  const [activeTasks, setActiveTasks] = useState(new Map());

  // Resolve client (use getSupabase to obtain the initialized instance)
  let client;
  try {
    client = getSupabase();
  } catch (e) {
    console.error("SupabaseContext: Error initializing client:", e);
    client = null;
  }

  // Task monitoring functions
  const createTask = async (type, payload = {}) => {
    console.log("SupabaseContext: Creating task:", type, payload);
    try {
      const { data, error } = await client
        .from("tasks")
        .insert({
          type,
          payload,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      console.log("SupabaseContext: Created task:", data.id);
      return data;
    } catch (err) {
      console.error("SupabaseContext: Error creating task:", err);
      throw err;
    }
  };

  const updateTaskProgress = async (taskId, progress, message, status) => {
    console.log("SupabaseContext: Updating task progress:", taskId, progress, status);
    try {
      const { error } = await client.rpc("update_task_progress", {
        task_id: taskId,
        new_progress: progress,
        new_message: message,
        new_status: status,
      });

      if (error) throw error;
    } catch (err) {
      console.error("SupabaseContext: Error updating task progress:", err);
      throw err;
    }
  };

  const getTask = async (taskId) => {
    try {
      const { data, error } = await client.from("tasks").select("*").eq("id", taskId).single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("SupabaseContext: Error fetching task:", err);
      throw err;
    }
  };

  const cancelTask = async (taskId) => {
    console.log("SupabaseContext: Cancelling task:", taskId);
    try {
      const { error } = await client.from("tasks").update({ status: "cancelled" }).eq("id", taskId);

      if (error) throw error;
    } catch (err) {
      console.error("SupabaseContext: Error cancelling task:", err);
      throw err;
    }
  };

  useEffect(() => {
    console.log("SupabaseContext: Initializing with URL:", import.meta.env.VITE_SUPABASE_URL);
    console.log(
      "SupabaseContext: Initializing with key:",
      import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + "..."
    );

    if (!client) {
      console.error("SupabaseContext: Supabase client is null");
      setLoading(false);
      return;
    }

    // Monitor realtime connection state with detailed status tracking
    const channel = client.channel("connection-monitor");

    channel.subscribe((status, err) => {
      console.log("SupabaseContext: Realtime channel status:", status, err);
      setRealtimeStatus(status.toLowerCase());

      if (status === "SUBSCRIBED") {
        setConnectionState("connected");
        console.log("SupabaseContext: Realtime connected and subscribed");
      } else if (status === "SUBSCRIBING") {
        setConnectionState("connecting");
        console.log("SupabaseContext: Realtime connecting...");
      } else if (status === "CHANNEL_ERROR" || status === "ERROR") {
        setConnectionState("error");
        console.warn("SupabaseContext: Realtime connection error:", {
          status,
          err,
          connectionState,
        });
      } else if (status === "TIMED_OUT") {
        setConnectionState("disconnected");
        console.warn("SupabaseContext: Realtime connection timed out");
      } else if (status === "CLOSED") {
        setConnectionState("disconnected");
        console.warn("SupabaseContext: Realtime connection closed");
      } else if (status === "REJOINING") {
        setConnectionState("reconnecting");
        console.log("SupabaseContext: Realtime rejoining...");
      }
    });

    // Initialize session
    client.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Error getting session:", error);
        setError(error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes with detailed event tracking
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      console.log(
        "SupabaseContext: Auth state change:",
        event,
        session?.user?.id ? "user:" + session.user.id.substring(0, 8) : "no user"
      );
      setAuthEvent(event);

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (client) client.removeChannel(channel);
    };
  }, []);

  const value = {
    supabase: client ? client : null,
    session,
    user,
    currentUser,
    loading,
    error,
    userLoading,
    userError,
    userStatus,
    updateProfile,
    connectionState,
    realtimeStatus,
    authEvent,
    activeTasks,
    createTask,
    updateTaskProgress,
    getTask,
    cancelTask,
  };

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  if (context === null) {
    console.warn("useSupabase: context is null, returning default value");
    return {
      supabase: null,
      session: null,
      user: null,
      loading: true,
      error: null,
      connectionState: "disconnected",
      realtimeStatus: "disconnected",
      authEvent: null,
      activeTasks: new Map(),
      createTask: () => Promise.reject(new Error("Supabase not initialized")),
      updateTaskProgress: () => Promise.reject(new Error("Supabase not initialized")),
      getTask: () => Promise.reject(new Error("Supabase not initialized")),
      cancelTask: () => Promise.reject(new Error("Supabase not initialized")),
    };
  }
  return context;
}
