#!/usr/bin/env node
/**
 * One-time OWNER-INTERACTIVE JHN enrollment, invoked over the owner's SSH TTY.
 * Requires the existing account's Supabase password and explicit exact intent.
 * No password/token in arguments, env, logs, console output, Git or disk.
 * This is not an MCP endpoint and does not issue a COP mandate.
 */
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import './lib/config.js';
import { createPrincipalEnrollment } from './principal-enrollment.js';
import { JHN_VAULT_INSTANCE_ID } from './lib/vault-catalog.js';

const EMAIL = 'jhr@baronsmariani.org';
const CONFIRM = 'JE CONFIRME LE RATTACHEMENT JHN';
const fail = (message) => { console.error(`ECHEC: ${message}`); process.exitCode = 1; };

function terminalEcho(on) {
  const result = spawnSync('stty', [on ? 'echo' : '-echo'], { stdio: ['inherit', 'ignore', 'ignore'] });
  if (result.status !== 0) throw new Error('terminal_echo_control_unavailable');
}
async function passwordPrompt() {
  output.write('Mot de passe Supabase de jhr@baronsmariani.org (non affiché) : ');
  terminalEcho(false);
  try {
    const rl = readline.createInterface({ input, output, terminal: false });
    try { return (await rl.question('')).trim(); }
    finally { rl.close(); }
  } finally { terminalEcho(true); output.write('\n'); }
}

async function main() {
  if (!input.isTTY || !output.isTTY || !process.env.SSH_CONNECTION ||
      !process.env.SSH_TTY || process.argv.slice(2).length) {
    return fail('session_SSH_interactive_requise : ssh -tt fracta2 ... (aucun argument accepté)');
  }
  const url=process.env.SUPABASE_URL;
  const anon=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !adminKey) return fail('configuration Supabase serveur manquante');
  const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:instance,error:instanceError}=await admin.from('instances')
    .select('id,canonical_slug,principal_id,status,subject_kind').eq('id',JHN_VAULT_INSTANCE_ID).maybeSingle();
  if(instanceError || instance?.canonical_slug!=='jhn' || instance.status!=='autonomous' || instance.subject_kind!=='living_person')
    return fail('instance JHN introuvable ou non éligible');

  console.log('Objet : relier le compte Supabase confirmé jhr@baronsmariani.org à l’instance racine JHN.');
  console.log('Ne crée aucun compte, ne délivre aucun mandat COP, ne modifie aucun secret.');
  if(instance.principal_id) console.log('Instance déjà liée : vérification du titulaire avant conclusion.');
  const rl=readline.createInterface({input,output});
  let confirmation;
  try { confirmation=await rl.question(`Pour confirmer, tapez exactement : ${CONFIRM}\n> `); }
  finally { rl.close(); }
  if(confirmation!==CONFIRM) return fail('confirmation non fournie');
  let password;
  try { password=await passwordPrompt(); }
  catch { return fail('saisie sécurisée du mot de passe indisponible'); }
  if(!password) return fail('mot de passe vide');
  let session;
  try {
    const response=await auth.auth.signInWithPassword({email:EMAIL,password});
    session=response.error ? null : response.data?.session;
  } finally { password=undefined; }
  if(!session?.access_token) return fail('connexion Supabase refusée (aucune modification)');
  const accessToken=session.access_token;
  // The owner's SSH-authenticated interactive command and explicit confirmation
  // provide the scoped administrative claim; project-local Supabase Auth then
  // independently verifies the human account. This one-time bootstrap is NOT
  // a generic mandate issuer or an MCP-accessible approval mechanism.
  // No caller-defined Principal, scope, instance or email is accepted.
  let rootClaim={instanceId:JHN_VAULT_INSTANCE_ID,subjectUserId:session.user?.id,
    approvedAt:Date.now(),purpose:'principal-instance-claim',confirmation:CONFIRM};
  const verifyRootClaim=async ({rootClaim:claim,subjectUserId,instanceId}) => ({
    verified:claim === rootClaim && claim?.confirmation===CONFIRM &&
      claim?.purpose==='principal-instance-claim' && claim?.instanceId===instanceId &&
      instanceId===JHN_VAULT_INSTANCE_ID && claim?.subjectUserId===subjectUserId &&
      Math.abs(Date.now()-claim.approvedAt)<120000 &&
      session.user?.email?.toLowerCase()===EMAIL,
    issuerVerified:true,
    subjectUserId,instanceId,scope:'principal-instance-claim'
  });
  const enrollment=createPrincipalEnrollment({authClient:auth,adminClient:admin,verifyRootClaim});
  let result;
  try { result=await enrollment.claim({accessToken,instanceId:JHN_VAULT_INSTANCE_ID,rootClaim}); }
  finally { await auth.auth.signOut({scope:'local'}).catch(()=>{}); rootClaim=null; session=null; }
  if(!result.ok) return fail(result.reason || 'rattachement refusé');
  const {data:after,error:afterError}=await admin.from('instances').select('id,principal_id')
    .eq('id',JHN_VAULT_INSTANCE_ID).maybeSingle();
  if(afterError||after?.principal_id!==result.principal_id) return fail('vérification finale du rattachement échouée');
  console.log(result.changed ? 'SUCCES : Principal JHN rattaché et vérifié.' : 'SUCCES : Principal JHN déjà rattaché au bon compte.');
  console.log('Portée : identité uniquement ; aucun mandat COP créé ou modifié.');
}
await main().catch(()=>fail('erreur de traitement (aucun détail sensible affiché)'));
