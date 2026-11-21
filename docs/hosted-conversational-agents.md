---
title: Hosted Conversational Agents for Personal Twins
document_kind: operational
document_role: architecture
visibility: public
lifecycle_state: active
language: en
date: '2026-11-21'
---

# A Conversational Agent is not its Personal Twin

Each real person's Personal Twin has a first child agent, a conversational
interface powered by ChatGPT. This *agent identity* is independent of both
the human's ChatGPT account/session and the Twin that supervises it. Its
canonical `agent:<twin-slug>:chatgpt` identity lives in COP's LogicalAgent
composition event journal. Supabase `instances` and `cop_logical_agents` are
operator projections of that declared identity. The child agent's
`host_instance_id` is its **parent Twin**, not the shared JHN Supabase project.

**Twin ≠ Principal ≠ agent ≠ provider account ≠ handler.** `reports_to`
denotes the Twin's root agent, `interface_role: primary` denotes the chosen
interface, and neither claim grants authority. An unclaimed Twin remains
unclaimed. Its ChatGPT agent has no independent mandate, token or permission
to access Gmail, ChatGPT content, hosted browsers, or private MCP tools.

The COP declaration is appended before Supabase projection and is idempotent:
a projection failure can be retried without rewriting the declaration. Other
specialized children, providers and alternative conversation agents can be
added without changing the model. This initial bootstrap only supports the
first ChatGPT interface for a `living_person` Twin.

## Operator use on the JHN host

```sh
cd /srv/cogentia/repos/inseme
node --env-file=.env apps/platform/scripts/hosted-conversational-agents.js \
  --twins jhn,marguerite-ghionga,frederic-lecourtois
# After reading the plan and confirming local COP store:
node --env-file=.env apps/platform/scripts/hosted-conversational-agents.js \
  --twins jhn,marguerite-ghionga,frederic-lecourtois \
  --apply --store /var/lib/cogentia/cop/john-root-v1.sqlite
```

The target slugs are *parameters*, not hardcoded logic. Do not place
credentials or ChatGPT account IDs into this script or public manifests.

## Next: identity-specific MCP connection

Connection through a ChatGPT plugin requires an independently authenticated
human Principal, verified OAuth subject-to-Principal binding, and a scoped
COP decision resolving the correct Twin. The existing JHN bearer token is
**never** distributed to a child's ChatGPT session. Unclaimed Twins have no
user OAuth access. The plugin must be evaluated on a real Free account, with
account-holder consent, before claiming that user self-service works.

Remaining stages: multi-Principal OAuth auth server / discovery, authenticated
per-Twin MCP tools, reusable ChatGPT plugin publication, and real Free-account
installation + governed private read Reality Test. None is provisioned by this
bootstrap.
