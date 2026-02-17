import supabaseBus from "./supabaseBus.js";
import wsBus from "./wsBus.js";

export default function createBus({ type = import.meta.env?.COP_BUS || "supabase" } = {}) {
  switch (type) {
    case "ws":
      return wsBus();
    case "supabase":
    default:
      // supabaseBus exports initBus/publish/subscribe already as static functions
      return supabaseBus;
  }
}
