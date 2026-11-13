import test from "node:test";
import assert from "node:assert/strict";
import { passwordUpdateErrorMessage } from "./passwordUpdateError.js";

test("same_password is actionable",()=>{
 const msg=passwordUpdateErrorMessage({status:422,code:"same_password"});
 assert.match(msg,/déjà celui de votre compte/);
 assert.match(msg,/différent/);
});
test("recovery session errors do not disclose tokens",()=>{
 const msg=passwordUpdateErrorMessage({code:"session_not_found",message:"secret_token"});
 assert.match(msg,/session de récupération/);
 assert.doesNotMatch(msg,/secret_token/);
});
test("unknown errors remain safe",()=>{
 assert.doesNotMatch(passwordUpdateErrorMessage({message:"private_server_detail"}),/private_server_detail/);
});
