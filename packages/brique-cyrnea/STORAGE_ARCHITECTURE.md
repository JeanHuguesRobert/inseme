# Storage Architecture & Privacy Design

## 🎯 Design Philosophy

The Cyrnea bar application uses a **privacy-first storage architecture** that intentionally
separates user data from bar data. This design prioritizes user anonymity while enabling rich social
interactions.

---

## 📱 User Data Storage (Client-Side localStorage)

### Privacy-First Design

**User-related data is INTENTIONALLY stored in localStorage on the client device, NOT in Supabase
authentication.** This is a deliberate architectural decision for:

- **Privacy Protection**: No personal data is stored in centralized databases
- **Anonymity by Design**: Users interact without creating accounts or providing personal
  information
- **Local Sovereignty**: Each user's device is their own data source of truth
- **No Authentication Barrier**: Instant access without registration process
- **GDPR Compliance**: Minimal data collection with user control

### What's Stored in localStorage

```javascript
// User Preferences & State
localStorage.setItem("inseme_client_screen", "fil"); // Current navigation
localStorage.setItem("inseme_client_zone", "indoor"); // Preferred zone
localStorage.setItem("inseme_client_pseudo", "UserNickname"); // Chosen pseudonym
localStorage.setItem("inseme_gabriel_mode", "false"); // AI assistant mode
localStorage.setItem("inseme_on_duty", "false"); // Barman service status

// Social Data
localStorage.setItem(
  "inseme_client_public_links",
  JSON.stringify([{ label: "Portfolio", url: "https://example.com", icon: "briefcase" }])
);

// Session Data
localStorage.setItem("inseme_barman_tab", "overview"); // Admin UI state
localStorage.setItem("inseme_bar_sesame_ok_roomslug", "true"); // Access validation
```

### What's NOT Stored (By Design)

- ❌ Personal identifiers (email, phone, real name)
- ❌ Authentication tokens or credentials
- ❌ Cross-session tracking data
- ❌ Personal behavioral analytics
- ❌ Location data or IP addresses
- ❌ Device fingerprinting

---

## 🏠 Bar Data Storage (Supabase inseme_rooms.metadata)

### Architecture

All bar configuration and state is persisted in the `metadata` JSONB column of the `inseme_rooms`
table:

```sql
CREATE TABLE inseme_rooms (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- Public URL identifier
  metadata JSONB,                     -- ← All bar data stored here
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Metadata Structure

```json
{
  "displayName": "Cyrnea Bar",
  "wifi_ssid": "Cyrnea_Guest",
  "wifi_password": "password123",
  "facebook_url": "https://facebook.com/cyrnea",
  "instagram_url": "https://instagram.com/cyrnea",
  "custom_links": [{ "label": "Menu", "url": "https://cyrnea.menu", "icon": "menu" }],
  "zones": [
    { "id": "indoor", "label": "Intérieur" },
    { "id": "outdoor", "label": "Terrasse" },
    { "id": "terrace", "label": "Extérieur" }
  ],
  "bar_sesame": "42",
  "local_ip": "192.168.1.100",
  "tunnel_url": "https://abc123.ngrok.io",
  "services": {
    "ophelia": { "enabled": true },
    "gabriel": { "enabled": false },
    "music": { "enabled": true, "volume": 50 }
  },
  "game_packs": ["classic", "corsica"],
  "rituals": ["cafe_suspendu", "macagna"],
  "session": {
    "is_open": true,
    "started_at": "2024-01-30T12:00:00Z"
  }
}
```

### Data Categories

- **Basic Info**: Name, description, location
- **Network**: WiFi settings, tunnel URLs, local IP
- **Social Media**: Facebook, Instagram, custom links
- **Services**: AI assistants, music, games availability
- **Zones**: Physical layout definitions
- **Security**: Sesame codes for admin access
- **Session**: Open/closed state, active rituals

---

## 💬 Message Storage (Supabase inseme_messages)

### Architecture

All user interactions and content are stored in the `inseme_messages` table:

```sql
CREATE TABLE inseme_messages (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES inseme_rooms(id),
  user_id TEXT,                        -- Pseudonym or identifier
  message TEXT,
  metadata JSONB,                      -- Message type, attachments, zone
  type TEXT,                          -- Message category
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Message Types & Examples

```javascript
// Chat Message
{
  type: "chat",
  user_id: "BarmanJean",
  message: "Bienvenue à tous !",
  metadata: { zone: "indoor" }
}

// Legend Declaration
{
  type: "legend_add",
  user_id: "ClientMarie",
  message: "Le moment où le café a volé !",
  metadata: { zone: "outdoor", visual_signal: true }
}

// Tip Declaration
{
  type: "tip_declaration",
  user_id: "Anonymous",
  message: "Pourboire pour Jean",
  metadata: {
    to: "BarmanJean",
    amount: 20,
    privacy: "anon",
    method: "manual"
  }
}

// Ritual Participation
{
  type: "ritual_participation",
  user_id: "ClientPaul",
  message: "❤️ PAUL offre un CAFÉ SUSPENDU !",
  metadata: {
    ritual: "suspendu",
    name: "Café Suspendu"
  }
}

// After-Party Proposal
{
  type: "after_proposal",
  user_id: "ClientSophie",
  message: "🌙 L'After commence ! Rejoindre : https://app.inseme.bar/room=cyrnea-after-abc123",
  metadata: {
    parent_slug: "cyrnea",
    after_slug: "cyrnea-after-abc123",
    proposed_by: "Sophie"
  }
}
```

### Privacy Protection

- **No Personal Data**: Only pseudonyms and content
- **No Tracking**: No behavioral analytics or profiling
- **Ephemeral**: Messages can be archived/deleted per session
- **User Control**: Users can request content removal

---

## 🔐 Security Considerations

### Client-Side Security

```javascript
// Secure localStorage handling
try {
  const data = localStorage.getItem("inseme_client_pseudo");
  const pseudo = data ? JSON.parse(data) : null;
} catch (e) {
  console.error("Failed to parse localStorage data:", e);
  // Fallback to default state
}
```

## 🚀 Implementation Guidelines

### For Developers

1. **Never store personal data** in localStorage or Supabase
2. **Always use pseudonyms** for user identification
3. **Validate all inputs** before storage
4. **Handle localStorage errors** gracefully
5. **Document storage decisions** in component headers

### Storage Patterns

```javascript
// ✅ Correct: User preferences in localStorage
localStorage.setItem("inseme_client_zone", selectedZone);

// ✅ Correct: Bar config in room metadata
await updateRoomMetadata(roomId, { wifi_ssid: ssid });

// ✅ Correct: Messages in messages table
await sendMessage(roomId, message, metadata);

// ❌ Wrong: Personal data in database
await saveUserEmail(userId, email); // NEVER DO THIS

// ❌ Wrong: Sensitive data in localStorage
localStorage.setItem("auth_token", token); // NEVER DO THIS
```

---

## 📊 Data Flow Summary

```
User Device (localStorage)     Supabase (Cloud)
├── Pseudonym                 ├── inseme_rooms.metadata
├── Preferences               ├── inseme_messages
├── Zone selection            └── Room configuration
├── UI state
└── Session data
```

This architecture ensures **user privacy** while enabling **rich social interactions** and
**efficient bar management**.
