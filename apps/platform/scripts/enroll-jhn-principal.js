#!/usr/bin/env node
/**
 * One-time owner-administration bootstrap over an interactive SSH session.
 * No Supabase password, human auth token or new signing ceremony requested.
 * This binds the unique pre-existing confirmed admin profile to the founding
 * JHN instance; no mandate, effect, secret or other account is changed.
 *
 * The two authorized SSH keys are host operator credentials; this is NOT a
 * proof of human identity for a general Principal issuer. Never expose this
 * script as MCP, HTTP, background or automated administrative capability.
 */
import readline from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {createSupabaseClient} from './lib/config.js';
import {createJhnOwnerSshEnrollment} from './lib/jhn-owner-ssh-enrollment.js';
const CONFIRM='JE CONFIRME LE RATTACHEMENT JHN';
const fail=reason=>{console.error(`ECHEC: ${reason}`);process.exitCode=1;};
async function main(){
  if(!stdin.isTTY||!stdout.isTTY||!process.env.SSH_CONNECTION||!process.env.SSH_TTY||process.argv.length!==2)
    return fail('session_SSH_interactive_requise (aucun argument accepté)');
  console.log('Opération : rattacher le compte Supabase confirmé jhr@baronsmariani.org à l’instance fondatrice JHN.');
  console.log('Autorité : administration SSH de Fracta2, puis confirmation explicite de cette opération unique.');
  console.log('Aucun mot de passe, aucune création de compte, aucune émission ni modification de mandat.');
  const rl=readline.createInterface({input:stdin,output:stdout});
  let confirmation;
  try{confirmation=await rl.question(`Saisissez exactement : ${CONFIRM}\n> `);}finally{rl.close();}
  if(confirmation!==CONFIRM)return fail('confirmation non fournie');
  let admin;
  try{admin=createSupabaseClient();}catch{return fail('client administratif Supabase non disponible');}
  const result=await createJhnOwnerSshEnrollment({adminClient:admin})
    .claim({sshOwnerSession:true,ownerConfirmed:true});
  if(!result.ok)return fail(result.reason);
  console.log(result.changed?'SUCCES : Principal JHN rattaché et vérifié.':'SUCCES : Principal JHN déjà rattaché à votre compte.');
  console.log('Portée : identité uniquement ; aucun mandat COP créé ou modifié.');
}
await main().catch(()=>fail('opération indisponible : aucun secret ni détail interne affiché'));
