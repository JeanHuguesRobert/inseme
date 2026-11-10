import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryLanding, eraseRecoveryUrl } from '../src/lib/recoveryLanding.js';
const loc = (search='',hash='') => ({pathname:'/auth/reset-password',search,hash});
test('implicit recovery and PKCE callback recognized without exposing credentials',()=>{
 assert.deepEqual(recoveryLanding(loc('','#access_token=SECRET&type=recovery')),{expected:true,error:false});
 assert.deepEqual(recoveryLanding(loc('?code=SECRET')),{expected:true,error:false});
 assert.deepEqual(recoveryLanding(loc()),{expected:false,error:false});
 assert.deepEqual(recoveryLanding(loc('','#error=access_denied&type=recovery')),{expected:true,error:true});
});
test('URL cleanup discards token-bearing query and fragment',()=>{
 let url;
 eraseRecoveryUrl(loc('?code=SECRET','#access_token=SECRET'),{state:null,replaceState(_state,_title,u){url=u;}});
 assert.equal(url,'/auth/reset-password');
 assert.equal(url.includes('SECRET'),false);
});
