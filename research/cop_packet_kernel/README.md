---
title: "COP Experimental Packet Kernel"
subtitle: "Executable formalization of the accepted mission-bearing Cognitive Packet hypothesis"
version: "0.1.0-experimental"
status: "experimental-formalization"
normative: false
date: "2026-07-20"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
repository: "JeanHuguesRobert/inseme"
issue: "https://github.com/JeanHuguesRobert/inseme/issues/21"
source_hypothesis: "../cop_zero_draft.md"
human_validation_required: true
review_status: "pending-human-validation"
document_role: "source"
document_kind: "experiment-log"
visibility: "public"
lifecycle_state: "active"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "experiment-log"
classification_confidence: "medium"
---

# COP Experimental Packet Kernel

This directory is an executable experiment derived from the human-accepted hypothesis in
[`../cop_zero_draft.md`](../cop_zero_draft.md). It is not a normative COP specification, a runtime,
or a compatibility layer.

The experiment asks one narrow question:

> Can the same small packet-centred vocabulary describe and mechanically test a physical object's
> journey, a CLI/LLM continuation, and processing through intermittent Fractanet nodes?

## Authority and projections

The authority order is:

1. `schema/cop-packet-kernel.schema.json` — canonical experimental structure;
2. `vectors/*.json` — falsifiable examples using that structure;
3. `generated/cop-packet-kernel.generated.ts` — deterministic TypeScript projection;
4. `test/conformance.test.mjs` — executable candidate laws and scenario obligations.

The generated TypeScript file is not an independent model. Change the schema, then regenerate it.

## Execute the experiment

From the repository root, with the supported Node version:

```sh
node research/cop_packet_kernel/tools/generate-types.mjs --check
node --test research/cop_packet_kernel/test/conformance.test.mjs
```

No package installation or third-party dependency is required.

## What is checked

The harness separates three kinds of evidence:

- **structural validation:** every vector is validated against the local JSON Schema vocabulary;
- **semantic laws:** eight candidate conservation laws are evaluated over the packet graph;
- **scenario obligations:** each scenario must contain the concrete facts that make it a useful
  falsification attempt rather than a renamed generic workflow.

Negative tests deliberately mutate valid vectors and verify that every executable candidate law can
actually reject a violation.

## What remains open

The experiment cannot establish:

- cryptographic immutability or authorship;
- the truth of physical custody observations;
- real accessibility of a referenced content object;
- legal authority, consent, privacy, retention, or erasure semantics;
- distributed ordering, clock behaviour, delivery guarantees, or network liveness;
- whether the current names deserve normative stability.

These remain explicit research questions. Passing the harness means only that the three scenarios
are coherent under this provisional vocabulary and the executable subset of the candidate laws.

## Human checkpoint

After inspection, the principal may choose exactly one continuation:

```text
reject formalization
revise formalization
accept as the experimental executable COP kernel
```

Acceptance would permit a separate clean-slate issue to rewrite the minimal kernel against these
vectors. It would not yet make this corpus normative.
