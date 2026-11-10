/** Supabase owns token exchange. Never place recovery credentials in logs. */
export function recoveryLanding(location) {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const error = query.get('error') || fragment.get('error');
  const hasRecovery = query.get('type') === 'recovery' || fragment.get('type') === 'recovery';
  const hasCode = query.has('code'); // PKCE callback to dedicated recovery route
  return { expected: hasRecovery || hasCode, error: Boolean(error) };
}

export function eraseRecoveryUrl(location, history) {
  history.replaceState(history.state, '', location.pathname);
}
