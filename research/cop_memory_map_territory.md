---
title: COP Memory — Map and Territory
subtitle: Pragmatic projections without confusing memory views with reality
author: Jean Hugues Noël Robert
affiliation: Institut Mariani / C.O.R.S.I.C.A.
date: '2026-06-21'
license: CC BY-SA 4.0
status: seed working note
corpus_role: source
language: en
document_role: source
document_kind: working-note
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: working-note
classification_confidence: medium
related:
  - research/cop_trace_model.md
  - research/cop_memory_profile.md
  - research/cop_memory_metadata_recursion.md
  - https://github.com/JeanHuguesRobert/cogentia/blob/main/research/Cogentia-and-Cogentigram.md
update_policy: UP-DEFAULT-REVIEWED
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# COP Memory — Map and Territory

## 1. Object

This note records a key invariant for COP/Memory:

```text
The MemoryView is a map, not the territory.
```

A distributed cognitive orchestration system must distinguish:

```text
territory = the real system, event, object, place, corpus, trace or evolving resource
map       = a bounded, task-relative, cost-aware representation of that territory
```

The map is necessary for action. The map must never be confused with the territory.

## 2. COP translation

In COP terms:

```text
Event / Artifact / NamedResource / ResourceState / material trace = closer to territory
Projection / Index / Summary / MetadataRecord / MemoryView        = map-like structures
```

This distinction is not absolute. A map can itself become a territory for another map:

```text
MemoryView -> can be stored as an Artifact
Artifact   -> can later be described by Metadata
Metadata   -> can be indexed by another MemoryView
```

This is the fractal risk. COP handles it through bounded recursion.

## 3. Practical rule

```text
Model the territory when preservation, proof or reconstruction matters.
Expose the map when action, reasoning or orientation matters.
Never let the agent forget which one it is using.
```

## 4. Why this matters

A perfect model of the territory may be impossible or too expensive to manipulate.

A useful map is necessarily selective:

- it chooses a scale;
- it chooses relevant features;
- it hides details;
- it simplifies topology;
- it has a date;
- it may become obsolete;
- it is made for an intended use.

The same applies to `MemoryView`.

A MemoryView should therefore declare:

```text
scale
purpose
scope
freshness
confidence
cost
excluded zones
expansion rules
```

## 5. Map failures

A map can fail in several ways:

```text
outdated map       = source changed, projection not invalidated
wrong scale        = too much or too little detail for the task
wrong purpose      = legal/probative use from a drafting view
missing territory  = important traces excluded or unavailable
overconfident map  = uncertainty hidden
captured map       = projection shaped by an actor's interest
beautiful map      = coherent representation masking a false premise
```

COP/Memory must therefore record not only what a MemoryView contains, but why it was generated and
under which constraints.

## 6. Agent invariant

```text
An agent should not act as if its MemoryView is the whole memory.
An agent should know whether it holds a pointer, a sketch, a working map, a probative map or an audited reconstruction.
```

The practical question is not:

```text
Do I have the complete territory?
```

It is:

```text
Is this map sufficient for this action, at this risk level, with these costs and constraints?
```

## 7. Relation to pragmatic memory

The pragmatic memory layer can be read as a disciplined map-making system:

```text
absolute memory model -> bounded MemoryView -> agent action
territory             -> map                -> navigation
```

The absolute model prevents category errors. The map enables action. The stop rules prevent infinite
cartography.

## 8. Small manipulable maps

The decisive advantage of a map is that it is a small object.

The territory is not merely large. At the limit, the territory is indefinitely complex:

```text
one place opens into its material history
one object opens into its production, use, wear and repairs
one document opens into its sources, versions, interpretations and effects
one decision opens into motives, pressures, mandates, evidence and consequences
one corpus opens into a graph of traces, contexts and derived products
```

A full map of the territory would become the territory again, and therefore would no longer be
usable as a map.

A practical MemoryView must therefore be:

```text
small enough to fit in attention
cheap enough to compute or retrieve
clear enough to orient action
explicit enough about what it omits
expandable enough when the risk justifies it
```

This is the operational reason why COP/Memory needs pragmatic projections rather than direct
exposure of the full trace graph.

The agent does not need the universe. It needs a map sufficient for the next action, with a visible
path for expansion if the map becomes insufficient.

## 9. Thing and representation

The map/territory distinction is itself a special case of a more fundamental distinction:

```text
thing           = what is, happened, exists, persists, or leaves traces
representation  = an image, model, name, description, map, memory, symbol, metadata record or view of that thing
```

A representation can point to a thing, describe it, simplify it, simulate it, orient action toward
it, or preserve a trace of it. It is not the thing itself.

This is the invariant expressed by Magritte's pipe:

```text
This is not a pipe.
It is a representation of a pipe.
```

For COP/Memory, the same applies to every object:

```text
A MemoryView of an event is not the event.
A summary of an artifact is not the artifact.
Metadata about a thing is not the thing.
A provenance graph is not the activity it describes.
A digital twin is not the living person.
A map of a place is not the place.
A model of a corpus is not the corpus.
```

The representation may itself become a thing in COP if it is stored, hashed, cited, audited,
versioned, criticized or reused. This is the fractal point:

```text
thing -> representation -> represented thing for another representation
```

The recursion is legitimate only if each level keeps its status explicit.

## 10. Representation status

Every pragmatic memory object should therefore indicate, explicitly or implicitly, its
representation status:

```text
pointer         = minimal reference to a thing
label           = human-readable name
summary         = compressed representation
map             = spatial, causal, semantic or procedural orientation aid
model           = structured representation with predictive or explanatory use
projection      = derived state from traces
metadata record = claims about a thing
memory view     = bounded task-relative representation
proof bundle    = representation designed for challenge and audit
```

A representation can be useful, beautiful, actionable, probative or misleading. Its value depends on
purpose, scale, freshness, confidence, provenance and omissions.

## 11. Representation as approximation

A representation is necessarily partial.

It selects, compresses, abstracts, normalizes, frames, filters and sometimes distorts. Even when it
is useful, it remains an approximation of the thing represented.

This point is already explicit in the Cogentia / Cogentigram / Cogentiscope triad:

```text
Cogentia     = the inferred persistent structural signature;
Cogentigram  = a structured measurable representation of that signature;
Cogentiscope = the instrument or protocol that produces the representation.
```

The Cogentigram is not Cogentia itself. It is a projection, produced by an instrument, under
assumptions, with uncertainty, drift and limits.

COP/Memory generalizes this beyond Cogentia:

```text
thing              -> representation
person             -> profile / dossier / digital twin / cogentigram
place              -> map / description / sensor model / heritage report
object             -> photo / condition report / material trace summary
event              -> log entry / witness statement / causal reconstruction
corpus             -> index / summary / MemoryView / concept graph
resource           -> descriptor / state view / temporal projection
```

The general rule is:

```text
Every representation must remain marked as a representation.
Every representation should expose, when relevant, its approximation regime.
```

## 12. Approximation regime

A useful representation should be able to declare its approximation regime:

```text
purpose       = why this representation exists
scale         = level of detail retained
scope         = what is inside / outside
method        = how it was produced
instrument    = human, AI agent, sensor, procedure, model, archive, measurement system
confidence    = how reliable it is for the declared purpose
uncertainty   = what is not known or unstable
freshness     = whether the represented thing may have changed
omissions     = what was deliberately or accidentally excluded
bias_risks    = likely distortions or capture risks
status        = draft, working view, audited view, probative bundle, obsolete view
```

This is philosophy and epistemology, but it is also operational engineering.

An agent must not only receive a representation. It must know the kind of representation it is
using, the action for which it is sufficient, and the point at which it must ask for a deeper or
different representation.

## 13. Circumstances and situation

The ordinary phrase "it depends on the circumstances" is a practical way to express the more
technical idea of situated representation.

```text
circumstances = the concrete surrounding conditions that matter for judgment or action
situation     = the structured context in which an agent, thing, event or representation exists and acts
```

The two notions are close. Their difference is mostly one of register and modelling discipline:

```text
circumstances = common language, immediately intelligible, flexible, non-technical
situation     = philosophical, epistemological and architectural term, easier to formalize
```

For public explanation, "circumstances" is often preferable because it is ordinary language. For
COP/Memory, "situation" is useful because it can be structured:

```text
time
place
agent
role
mandate
task
purpose
risk level
available traces
accessible representations
cost constraints
privacy boundary
confidence requirements
```

A representation is never merely partial. It is partial under circumstances. It is situated.

The practical bridge is:

```text
ça dépend des circonstances
= it depends on the situation
= the representation is valid only relative to a context of use
```

COP should therefore allow both vocabularies:

```text
circumstances = human-facing language
situation     = structured operational model
```

## 14. Situated judgment and moral ambiguity

Circumstances matter not only for knowledge. They also matter for judgment.

The same visible behavior can be evaluated very differently depending on the situation:

```text
an act of violence        -> aggression, defense, rescue, revenge, sacrifice, coercion
refusal to obey           -> irresponsibility, courage, resistance, disloyalty, survival
secrecy                   -> manipulation, protection, prudence, betrayal, tactical necessity
destruction               -> vandalism, liberation, sabotage, healing, ecological defense
```

The behavior is not enough. Judgment requires a situated interpretation of the act, its causes,
constraints, alternatives, intentions, pressures, risks and consequences.

This is why a non-manichean narrative is often more realistic than a simple good/evil
classification. In a film such as _Princess Mononoke_, the same character can appear right or wrong
depending on the local configuration of life, violence, survival, loyalty, injury, revenge,
protection and ecological balance. The value of the action is not readable from the gesture alone.
It depends on the circumstances.

COP/Memory should therefore distinguish:

```text
behavior_trace      = what was observed or recorded
situated_context    = the circumstances that make the behavior intelligible
interpretation      = the current reading of the behavior
judgment            = an evaluative conclusion under explicit criteria
revision_condition  = what new information could change the judgment
```

A judgment is therefore a representation too. It must remain marked as situated, partial and
revisable.

Practical rule:

```text
Never evaluate a behavior without exposing the circumstances that make the evaluation intelligible.
Never let a moral judgment silently pass as a context-free property of an act or person.
```

## 15. COP invariant

```text
Never let a representation silently pass for the thing represented.
Never let a thing be used by an agent without knowing through which representation it is being accessed.
Never let an approximation silently pass as exhaustive knowledge.
Never let a situated representation silently pass as context-free knowledge.
Never let a situated judgment silently pass as a context-free moral truth.
```

The practical task of COP/Memory is not to eliminate representations. It is to make representations
small, explicit, typed, bounded, traceable, approximate, contestable, situated and expandable.

## 16. Stable formula

```text
The absolute model protects truth conditions.
The MemoryView enables action.
The map is useful only while it remains explicitly distinct from the territory.
The map is useful because it is smaller, cheaper and more manipulable than the territory.
The representation is useful only while it remains explicitly distinct from the thing represented.
Every representation is an approximation; its usefulness depends on knowing its purpose, scope, method, confidence and omissions.
Every useful representation is situated: it depends on the circumstances of action, interpretation and use.
A judgment is also a representation: it must remain tied to the circumstances that make it intelligible.
```
