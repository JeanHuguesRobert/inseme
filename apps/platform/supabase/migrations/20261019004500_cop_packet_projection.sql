-- CognitivePacket durable projection for the portable COP runtime.
--
-- Additive and portable across SQLite and PostgreSQL/Supabase.
-- CognitivePacket is the canonical work identity; cop_tasks/cop_steps remain
-- optional compatibility/current-state projections.

CREATE TABLE IF NOT EXISTS cop_packets (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (length(status) > 0),
  mandate_id TEXT,
  packet_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cop_packets_status
  ON cop_packets (status);

CREATE INDEX IF NOT EXISTS idx_cop_packets_mandate
  ON cop_packets (mandate_id);
