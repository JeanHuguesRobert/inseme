import test from "node:test";
import assert from "node:assert/strict";
import {routeRootRecoveryCallback,recoveryLanding} from "./recoveryLanding.js";

function fixture(pathname,search,hash,hostname="jhn.baronsmariani.org"){
 const location={pathname,search,hash,hostname};
 const calls=[];
 const history={state:null,replaceState(...args){calls.push(args)}};
 return {location,history,calls};
}
test("legacy Supabase implicit recovery at JHN root retains callback parameters",()=>{
 const x=fixture("/","","#access_token=synthetic&refresh_token=synthetic&type=recovery");
 assert.equal(routeRootRecoveryCallback(x.location,x.history),true);
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0][2],"/auth/reset-password#access_token=synthetic&refresh_token=synthetic&type=recovery");
 assert.equal(recoveryLanding({search:"",hash:"#type=recovery"}).expected,true);
});
test("does not intercept ordinary JHN routes or OAuth callbacks",()=>{
 for(const x of [
  fixture("/","",""),
  fixture("/","?code=oauth",""),
  fixture("/","?foo=1","#type=signup"),
  fixture("/john","","#type=recovery"),
  fixture("/","","#type=recovery","other.baronsmariani.org")
 ]){
  assert.equal(routeRootRecoveryCallback(x.location,x.history),false);
  assert.equal(x.calls.length,0);
 }
});
test("recovery error and search data are preserved for guarded form",()=>{
 const x=fixture("/","?type=recovery&error=access_denied","");
 assert.equal(routeRootRecoveryCallback(x.location,x.history),true);
 assert.equal(x.calls[0][2],"/auth/reset-password?type=recovery&error=access_denied");
 assert.equal(recoveryLanding({search:x.location.search,hash:x.location.hash}).error,true);
});
