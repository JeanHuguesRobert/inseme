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

For the current JHN-hosted pilot, a Personal Twin can have a first
conversational child agent declared for the ChatGPT interface. This declaration
is an **architectural identity**, not an assertion that every person has
signed in, installed a Cogentia plugin or already used that interface.
This *agent identity* is independent of both
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

## Inaugural real-user pilot — status and meaning

As of 2026-11-21, three identities are declared in the JHN COP journal and
projected into JHN Supabase:

| Personal Twin | Conversational agent | Real-user trial status |
| --- | --- | --- |
| John/JHN | `agent:jhn:chatgpt` | JHN is an active first user/developer; this new per-agent OAuth enrollment is not established by the declaration |
| Maguy | `agent:marguerite-ghionga:chatgpt` | Hosted provisional Twin, ChatGPT Free declared; individual login/MCP and first real task remain to be tested |
| Frédéric (Aréopage) | `agent:frederic-lecourtois:chatgpt` | Hosted provisional Twin, ChatGPT Free declared; individual login/MCP and first real task remain to be tested |

They are *de facto* alpha/beta participants in the evolving Cogentia system,
not evidence of a public beta release. **A registry status such as
`mcp_connection: not_connected` describes this onboarding/binding path only**;
it does not negate an existing, separately verified JHN tool connection or
prove that a person's ChatGPT account lacks every possible MCP capability.
Keep **provisioned / authenticated / connected / used / validated** as separate
claims. Each person's own concrete work is the end-to-end Reality Test; the
burden of understanding or debugging CPS belongs primarily to Cogentia.

Field learning and personal-data locality are specified in
[FractaCognition §9](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/fractacognition_principles.md#9-validated-learning-and-selective-propagation).

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
