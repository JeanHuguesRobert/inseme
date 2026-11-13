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

/**
 * Supabase's legacy recovery email redirects to the origin root. Route only
 * a verifiable recovery callback into the dedicated password form BEFORE
 * Supabase initializes, retaining its URL payload for Supabase Auth to exchange.
 * The application never parses, logs or stores the token itself.
 */
export function routeRootRecoveryCallback(location, history) {
  if(location.pathname !== '/' || location.hostname !== 'jhn.baronsmariani.org')return false;
  const query=new URLSearchParams(location.search);
  const fragment=new URLSearchParams((location.hash||'').replace(/^#/,''));
  if(query.get('type')!=='recovery' && fragment.get('type')!=='recovery')return false;
  history.replaceState(history.state,'','/auth/reset-password'+location.search+location.hash);
  return true;
}
