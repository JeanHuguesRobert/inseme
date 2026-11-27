// The authorization server owns request and callback resolution.
// Nothing in the browser query string other than the opaque request ID is trusted.
export function readOAuthAuthorizationId(search) {
  const ids = new URLSearchParams(search).getAll("authorization_id");
  return ids.length === 1 && /^[A-Za-z0-9_-]{1,512}$/.test(ids[0]) ? ids[0] : null;
}
function httpsUrl(value) {
  if (typeof value !== "string" || !value) throw Error("invalid_oauth_redirect");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw Error("invalid_oauth_redirect");
  return url;
}
export function validateOAuthRedirect(value, registered = null) {
  const url = httpsUrl(value);
  if (registered) {
    const expected = httpsUrl(registered);
    if (url.origin !== expected.origin || url.pathname !== expected.pathname)
      throw Error("invalid_oauth_redirect");
    for (const [name, v] of expected.searchParams)
      if (!url.searchParams.getAll(name).includes(v)) throw Error("invalid_oauth_redirect");
  }
  return url.href;
}
export function validateOAuthDetails(data, authorizationId, userId) {
  if (!data || data.authorization_id !== authorizationId || data.user?.id !== userId ||
      typeof data.client?.id !== "string" || !data.client.id ||
      typeof data.client?.name !== "string" || !data.client.name ||
      typeof data.scope !== "string") throw Error("invalid_oauth_authorization");
  const redirect = validateOAuthRedirect(data.redirect_uri);
  return { id: authorizationId, clientName: data.client.name,
    redirect, scopes: data.scope.split(/\s+/).filter(Boolean) };
}
export function isPersonalOAuthSession(user, anonymousEmail) {
  return Boolean(user?.id && user.is_anonymous !== true &&
    (!user.email || user.email.toLowerCase() !== anonymousEmail.toLowerCase()));
}
