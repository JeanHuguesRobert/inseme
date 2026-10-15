// Pure predicate for idempotent dispatcher replay. It must never be
// interpreted as a compute failure; callback existence is checked separately.
export function isSkippedComputeReplay({request,result,diagnostic,phases}) {
  return Boolean(request && !result && !diagnostic &&
    phases.request==="success" && phases.replay==="success" &&
    phases.admission==="skipped" && phases.verify==="skipped" &&
    phases.execute==="skipped");
}
