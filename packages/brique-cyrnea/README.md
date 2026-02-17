# 🍻 @inseme/brique-cyrnea - Social Conviviality & Bar Management

**@inseme/brique-cyrnea** is the "Conviviality" module of the Inseme monorepo. It is designed to
bring people together in social spaces like bars or community centers through games, music, and
challenges.

This module focuses on the informal, social side of community building, providing tools to manage
the "vibe" and engagement in real-time social settings.

> For an overview of the ecosystem (Agora, IA, Multi-instances), see the
> [global repository README](../../README.md).

---

## 🎯 What is it for?

It transforms social spaces into interactive environments where technology serves human connection.

### 1. 🎮 Interactive Games & Challenges

A suite of social games and challenges designed to be played in physical locations, fostering
interaction between patrons.

### 2. 🎵 Music & Playlist Management

Collaborative playlist management allowing users to influence the musical atmosphere of the space.

### 3. 📊 Vibe Monitoring

Tools for bar managers to monitor and adjust the social atmosphere (vibe) based on real-time
engagement data and roles.

---

## 🚀 Key Features

- **Barman Dashboard**: A control center for managing the social experience, music, and roles.
- **Bar Memory**: Persistence of the bar's state (funding, tips, active zone) directly in the
  barman's `localStorage`, making the phone the source of truth.
- **Trust-Based Tips**: A tip system designed to empower barmen, relying on trust and human nature
  to drive engagement and rewards.
- **Client Mini-App**: A lightweight interface for patrons to participate in games and challenges.
- **Role System**: Dynamic role assignment (Barman, Client, etc.) that influences available
  interactions.
- **Playlist Manager**: Tools for collaborative and automated music selection.

---

## 🗄️ Storage Architecture & Privacy Design

### 📱 User Data Storage (Client-Side)

**Design Philosophy: User Privacy & Anonymity First**

User-related data is **intentionally stored in localStorage** on the client device, not in Supabase
authentication. This is a deliberate architectural decision for:

- **Privacy Protection**: No personal data is stored in centralized databases
- **Anonymity by Design**: Users interact without creating accounts or providing personal
  information
- **Local Sovereignty**: Each user's device is their own data source of truth
- **No Authentication Barrier**: Instant access without registration process

**What's stored in localStorage:**

- User pseudonym and display preferences
- Zone selection and navigation state
- Public links and social connections
- Session state and UI preferences
- Temporary interaction history

**What's NOT stored:**

- Personal identifiers (email, phone, etc.)
- Authentication tokens or credentials
- Cross-session tracking data
- Personal behavioral analytics

### 🏠 Bar Data Storage (Supabase)

**Bar configuration and state** are persisted in the `metadata` column of the `inseme_rooms` table:

```sql
-- inseme_rooms table structure
CREATE TABLE inseme_rooms (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  metadata JSONB, -- ← Bar configuration, settings, state
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Stored in room metadata:**

- Bar name and description
- WiFi configuration and network settings
- Service availability (Ophelia, Gabriel, music)
- Zone definitions and layout
- Ritual configurations and game packs
- Barman permissions and sesame codes
- Session state (open/closed, active rituals)

### 💬 Message Storage (Supabase)

**All user interactions and messages** are stored in the `inseme_messages` table:

```sql
-- inseme_messages table structure
CREATE TABLE inseme_messages (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES inseme_rooms(id),
  user_id TEXT, -- Pseudonym or identifier
  message TEXT,
  metadata JSONB, -- Message type, attachments, zone info
  type TEXT, -- 'chat', 'legend', 'tip', 'ritual', etc.
  created_at TIMESTAMP
);
```

**Message types stored:**

- Chat messages and visual signals
- Legend declarations and promotions
- Tip declarations and ritual participation
- Game interactions and challenges
- After-party proposals and invitations

---

## 🧠 Philosophy: "Barman Friendly" & Gift Theory

Cyrnea is built with a **Barman-First** and **Anthropological** approach:

1. **Empowerment**: We provide barmen with tools that make their job more interactive and rewarding.
2. **Local Sovereignty**: By using `localStorage` for the "Memory of the Bar", we ensure that the
   barman's device is the primary controller of the atmosphere.
3. **Incentivization**: The trust-based tip system encourages barmen to promote the platform, as it
   directly translates into better engagement and potential rewards.
4. **Marcel Mauss & Gift Theory**: The tipping system is inspired by the works of Marcel Mauss on
   the **gift and counter-gift** (_don et contre-don_). It aims to foster free, voluntary, and
   non-contractual social exchanges between clients and barmen, without systemic tracking or
   obligation. The technical flow remains strictly **stateless** and neutral, acting only as a
   relay.

---

## 🛠️ Project Structure

```
packages/brique-cyrnea/
├── src/
│   ├── lib/           # Game logic, playlists, roles, and vibe monitoring
│   └── pages/         # Dashboards for managers and patron mini-apps
├── brique.config.js   # Module configuration
└── package.json       # Dependencies and metadata
```

---

## ⚖️ Neutrality & Commitment

This infrastructure is a **neutral** technological tool. It is designed to ensure digital
independence and does not support any specific ideology or candidate.

---

## 📜 License & Author

This project is licensed under the **MIT License**.

**Author: Jean Hugues Noël Robert**

- Project supported by the **C.O.R.S.I.C.A.** association.
- [LePP.fr](https://lepp.fr) community.

---

### #PERTITELLU | CORTI CAPITALE
