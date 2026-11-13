/**
 * Translate Supabase Auth recovery errors without leaking account existence,
 * sensitive response bodies or authentication credentials into the UI.
 * There is no guaranteed cooldown duration in a generic 429 response.
 */
export function recoveryRequestErrorMessage(error) {
  const status = Number(error?.status);
  const code = String(error?.code || '');
  if (status === 429 || code === 'over_email_send_rate_limit' ||
      code === 'over_request_rate_limit') {
    return "Supabase limite temporairement les envois de courriels de récupération. Aucun nouveau courriel n’a été envoyé. Réessayez plus tard, sans multiplier les demandes.";
  }
  if (status === 422 || code === 'email_address_invalid') {
    return "Adresse électronique refusée par Supabase. Vérifiez son format.";
  }
  return "La récupération n’a pas abouti. Réessayez plus tard ou vérifiez la configuration d’authentification.";
}
