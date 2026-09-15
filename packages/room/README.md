---
title: '@inseme/room'
author: unknown
date: '2026-01-18'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 8301d4f
  origin_date: '2026-01-18'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# @inseme/room

**@inseme/room** is the "Organic Assembly" protocol. It provides a real-time democratic space where
roles are performed, not assigned.

Designed for **Liquid Democracy**, it replaces rigid permissions with AI-assisted mediation,
allowing any group—from Municipal Councils to Co-ownerships—to self-organize, debate, and trace
decisions without bureaucracy.

## Philosophy

- **Human-First**: No hard-coded permissions. Anyone can open a session. The group decides
  legitimacy.
- **AI as Mirror**: Ophélia (the AI) observes, validates coherence, and archives history, but never
  commands.
- **Traceability**: Every action (Vote, Speech, Presence) is logged to build an unalterable history
  ("The Living Record").

## Features

- **InsemeRoom**: A full-featured assembly room component.
- **Liquid Roles**: Conflict detection instead of permission denial.
- **AI Oracle (Ophélia)**: Can answer "Who was here yesterday?" or "What was the decision on X?".
- **Deep History**: Full-text search on raw logs + Official Report generation.
- **Video Conferencing**: Native Jitsi Meet integration.
- **Liquid Voting**: Dynamic vote delegation (`bye` command).

## Installation

```bash
npm install @inseme/room
```

_Note: This package requires `@supabase/supabase-js`, `react`, `lucide-react`, and
`@jitsi/react-sdk` as peer dependencies._

## Quick Start

```jsx
import { InsemeRoom } from "@inseme/room";
import { supabase } from "./your-supabase-client";

function App() {
  const user = { id: "...", user_metadata: { full_name: "..." } };

  return (
    <InsemeRoom
      roomName="Agora"
      user={user}
      supabase={supabase}
      config={{
        promptUrl: "/prompts/inseme.md",
        opheliaUrl: "/api/ophelia",
        ophelia: {
          api_url: "https://api.groq.com/openai/v1/chat/completions",
          model: "llama-3.3-70b-versatile",
        },
      }}
    />
  );
}
```

## Documentation

Detailed documentation is available in the `docs/` folder:

- [Packaging & Integration](./docs/packaging.md)
- [Ophélia Configuration](./docs/ophelia.md)
- [SaaS & R2 Deployment](./docs/saas-deployment.md)

## License

MIT - See [LICENSE](./LICENSE) for details.
