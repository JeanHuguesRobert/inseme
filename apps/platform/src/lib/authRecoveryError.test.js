import test from "node:test";
import assert from "node:assert/strict";
import { recoveryRequestErrorMessage } from "./authRecoveryError.js";

test("Supabase 429 email send rate limit is explicit and does not invent a retry time", () => {
  const message=recoveryRequestErrorMessage({status:429,code:"over_email_send_rate_limit",message:"secret"});
  assert.match(message,/limite temporairement/);
  assert.match(message,/Réessayez plus tard/);
  assert.doesNotMatch(message,/secret|minute|heure/i);
});
test("code-only rate limit also gets actionable feedback",()=>{
  assert.match(recoveryRequestErrorMessage({code:"over_request_rate_limit"}),/limite temporairement/);
});
test("a malformed address has an independent explanation",()=>{
  assert.match(recoveryRequestErrorMessage({status:422}),/Adresse électronique/);
});
test("other failures return a non-secret generic error",()=>{
  assert.doesNotMatch(recoveryRequestErrorMessage({status:503,message:"private_backend_detail"}),/private_backend_detail/);
});
