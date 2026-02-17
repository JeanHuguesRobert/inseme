import { supabase } from "./supabase.js";

export async function submitLead(data) {
  try {
    const { error } = await supabase.from("transparency_leads").insert({
      lead_type: data.lead_type || "citoyen_engage",
      maturity_level: data.maturity_level || 1,
      name: data.name || data.email.split("@")[0], // Fallback simple pour le nom
      email: data.email,
      phone: data.phone || null,
      commune_name: data.commune_name || "Inconnue", // Requis par le schéma
      message: data.message || null,
      source: "inseme_landing",
      accepted_contact: true,
      metadata: {
        ...data.metadata,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        referrer: typeof document !== "undefined" ? document.referrer : "unknown",
        timestamp: new Date().toISOString(),
        app: "inseme",
      },
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error submitting lead:", error);
    return { success: false, error: error.message };
  }
}
