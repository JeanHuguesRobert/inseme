import test from 'node:test';
import assert from 'node:assert/strict';
import {readOAuthAuthorizationId,validateOAuthDetails,validateOAuthRedirect,isPersonalOAuthSession} from './mcpOAuthConsent.js';
const id='request-1', userId='user-1';
const callback='https://claude.ai/api/mcp/auth_callback';
test('only one opaque authorization ID is read',()=>{
 assert.equal(readOAuthAuthorizationId('?authorization_id=request-1&redirect_uri=https://evil.example'),id);
 for(const s of ['', '?authorization_id=', '?authorization_id=a&authorization_id=b','?authorization_id=https://evil.example'])
  assert.equal(readOAuthAuthorizationId(s),null);
});
test('server details must match the current request and authenticated user',()=>{
 const data={authorization_id:id,user:{id:userId},client:{id:'client',name:'Claude'},redirect_uri:callback,scope:'openid email'};
 assert.deepEqual(validateOAuthDetails(data,id,userId),{id,clientName:'Claude',redirect:callback,scopes:['openid','email']});
 assert.throws(()=>validateOAuthDetails(data,id,'other'));
 assert.throws(()=>validateOAuthDetails(data,'other',userId));
 assert.throws(()=>validateOAuthDetails({...data,redirect_uri:'javascript:alert(1)'},id,userId));
});
test('returned callback preserves registered origin, path and existing query',()=>{
 assert.equal(validateOAuthRedirect(callback+'?code=a&state=b',callback),callback+'?code=a&state=b');
 for(const url of ['http://claude.ai/api/mcp/auth_callback','https://claude.ai.evil.example/api/mcp/auth_callback','https://claude.ai/other','https://u:p@claude.ai/api/mcp/auth_callback','javascript:alert(1)'])
  assert.throws(()=>validateOAuthRedirect(url,callback));
 assert.throws(()=>validateOAuthRedirect(callback+'?code=a',callback+'?fixed=b'));
});
test('guest and anonymous sessions do not enter the authorization flow',()=>{
 assert.equal(isPersonalOAuthSession({id:'a',email:'anonymous@lepp.com'},'anonymous@lepp.com'),false);
 assert.equal(isPersonalOAuthSession({id:'a',is_anonymous:true},'anonymous@lepp.com'),false);
 assert.equal(isPersonalOAuthSession({id:'a',email:'person@example.org'},'anonymous@lepp.com'),true);
});
