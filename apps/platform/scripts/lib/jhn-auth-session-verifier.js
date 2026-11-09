/**
 * Server-side Supabase Auth verifier, to be injected into the existing
 * createVaultPrincipalPreflight({client,authenticateHuman}). The access token
 * stays inside an authenticated application server request. Never expose it
 * as an MCP argument or log it. Authenticated identity != mandate approval.
 */
const deny = () => ({verified:false});
export function createJhnAuthSessionVerifier({authClient}={}) {
  return async function authenticateHuman({session}={}) {
    // Access tokens MUST be supplied by the trusted web handler, never by a
    // chatbot; getUser(token) validates the token against the real Auth server.
    const token=session?.accessToken;
    if(!token||typeof token!=='string'||token.length>8192||
       typeof authClient?.auth?.getUser!=='function')return deny();
    try {
      const {data,error}=await authClient.auth.getUser(token);
      const user=data?.user;
      if(error||!user?.id||!user.email_confirmed_at||user.is_anonymous===true)
        return deny();
      return {verified:true,user_id:user.id,principal_ref:'principal:jhn',
        audience:'cogentia:principal-issuer'};
    }catch{return deny();}
  };
}
