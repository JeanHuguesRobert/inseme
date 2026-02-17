// packages/brique-cyrnea/hooks/useSupabase.js

import { useMemo } from "react";
import { getSupabase } from "@inseme/cop-host";

/**
 * Hook React pour obtenir le client Supabase
 * Utilise useMemo pour éviter les recréations
 */
export function useSupabase() {
  const supabase = useMemo(() => {
    return getSupabase();
  }, []);

  return supabase;
}
