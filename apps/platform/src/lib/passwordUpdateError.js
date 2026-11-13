/** Safe user-facing interpretation of Supabase Auth password update errors. */
export function passwordUpdateErrorMessage(error) {
  const code = String(error?.code || '');
  if (code === 'same_password') {
    return "Ce mot de passe est déjà celui de votre compte. Vous pouvez essayer de vous connecter avec lui, ou en choisir un différent.";
  }
  if (code === 'weak_password') {
    return "Le nouveau mot de passe ne respecte pas les exigences de sécurité de Supabase. Choisissez-en un plus robuste.";
  }
  if (code === 'session_not_found' || code === 'session_expired' ||
      code === 'invalid_jwt' || code === 'refresh_token_not_found') {
    return "Votre session de récupération n’est plus valide. Demandez un nouveau lien.";
  }
  return "Le changement de mot de passe a été refusé. Vérifiez votre session et réessayez avec un mot de passe différent.";
}
