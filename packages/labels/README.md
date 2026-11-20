# `@inseme/labels`

Minimal, dependency-free label identities and selectors, shared by Inseme domains.

A **Label is an entity** with a stable `id` and a separate display `name` (and optional description).
Objects such as Propositions, LogicalAgents and COPTasks should **reference label IDs**, not copy
label definitions. Persistence, assignment events and indexed projections belong to the owning
domain; this package does not create storage or issue COP authority.

```js
import { createLabel, matchesLabels, parseLabelSelector } from '@inseme/labels';

const corse = createLabel({ id: 'corse', name: 'Corse' });
const energie = createLabel({ id: '#energie', name: 'Énergie' });
const taskLabels = [corse.id, energie.id];

matchesLabels(taskLabels, '#corse #energie'); // true (AND)
parseLabelSelector('#corse #energie'); // { all: ['corse', 'energie'] }
```

Selectors currently support **only conjunction** (`all`): all named labels must be present.
This reuses Kudocracy's basic inclusion semantics without importing its historical UI-specific
computed tags, `#but`/`#all` operators, keyword search, delegation policy, or sorting.
They may be added as separate, tested features when a real usage needs them. A missing label
never grants a match. An empty selector matches all objects.

`normalizeLabelId()` accepts either a string (`'corse'`, `'#Corse'`) or an entity with a string
`id`; it canonicalizes case and the optional leading `#`. Display names do not affect identity.

Run `pnpm --filter @inseme/labels test` (or `node --test` within this package).

Source inspiration: [`virteal/kudocracy` `Topic.is_tagged()` and `tags_includes()`](https://github.com/virteal/kudocracy/blob/master/lib/main.js).
