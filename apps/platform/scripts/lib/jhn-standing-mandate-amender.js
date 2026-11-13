/**
 * JHN standing-mandate amendment, server-side boundary only.
 * Caller MUST supply the Supabase Auth session from the trusted web handler,
 * never from a chatbot/MCP argument. The injected approval verifier must
 * independently bind the entire proposal to an authenticated Principal action.
 * This adapter neither authenticates using service_role nor creates a mandate.
 */
import { amendMandate } from '../../../../packages/cop-core/src/governed-act.js';
import { createJhnAuthSessionVerifier } from './jhn-auth-session-verifier.js';
import { createVaultPrincipalPreflight } from './vault-principal-preflight.js';

const refused = (reason) => Object.freeze({ ok:false, reason, issued:false });
const required = (value) => typeof value === 'string' && value.trim().length > 0;

export function createJhnStandingMandateAmender({
  authClient, instanceClient, store, verifyApproval
} = {}) {
  return Object.freeze({
    async amend({ session, proposal, approval } = {}) {
      // No issuance path without an independently supplied server-side verifier.
      if (typeof verifyApproval !== 'function') return refused('approval_verifier_unavailable');
      if (!store || typeof store.replay !== 'function' || typeof store.append !== 'function')
        return refused('canonical_store_unavailable');
      if (!session?.accessToken || !proposal || typeof proposal !== 'object')
        return refused('authenticated_proposal_required');
      if (!required(proposal.mandate_ref) || !required(proposal.expected_version) ||
          !required(proposal.reason) || !proposal.scope ||
          typeof proposal.scope !== 'object' || Array.isArray(proposal.scope))
        return refused('invalid_proposal');
      if (proposal.principal_ref !== 'principal:jhn')
        return refused('principal_mismatch');
      const inspect = await createVaultPrincipalPreflight({
        client:instanceClient,
        authenticateHuman:createJhnAuthSessionVerifier({authClient})
      }).inspect({session});
      if (!inspect.ok || inspect.principal_ref !== 'principal:jhn')
        return refused('principal_authentication_failed');
      // Identity alone is never permission to approve: verifier must be a
      // trusted independent implementation, not a request-provided function.
      // No await: canonical amendMandate expects a synchronous verifier.
      const verifyPrincipalApproval = (exactProposal, evidence) => {
        const attestation = verifyApproval({
          proposal: exactProposal, evidence, principal_ref:inspect.principal_ref
        });
        if (attestation?.verified !== true || attestation.principal_ref !== inspect.principal_ref ||
            !required(attestation.evidence_ref) ||
            (attestation.proposal_ref && attestation.proposal_ref !== exactProposal.mandate_ref))
          return {verified:false};
        return attestation;
      };
      try {
        const result=amendMandate(store, {
          mandate_ref:proposal.mandate_ref,
          expected_version:proposal.expected_version,
          principal_ref:inspect.principal_ref,
          scope:proposal.scope,
          reason:proposal.reason,
          valid_from:proposal.valid_from,
          valid_until:proposal.valid_until,
          approval
        }, {verifyPrincipalApproval});
        if (!result.ok) return refused(result.error);
        return {ok:true,issued:true,mandate_ref:result.mandate_ref,
          version:result.version,receipt:result.receipt};
      } catch {
        return refused('mandate_amendment_failed');
      }
    }
  });
}
