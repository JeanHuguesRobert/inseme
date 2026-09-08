import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migration = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../supabase/migrations/20260908043211_fractalog_act_records_and_ingress.sql"
);

const sql = await readFile(migration, "utf8");

test("FractaLog central migration retains a canonical JSONB document and checked projections", () => {
  assert.match(sql, /document jsonb NOT NULL/);
  assert.match(sql, /CHECK \(document->>'record_id' = record_id\)/);
  assert.match(sql, /CHECK \(document->'integrity'->>'document_hash' = document_hash\)/);
  assert.match(
    sql,
    /owner_instance_id uuid NOT NULL REFERENCES public\.instances\(id\) ON DELETE RESTRICT/
  );
  assert.match(
    sql,
    /on_behalf_of_instance_id uuid REFERENCES public\.instances\(id\) ON DELETE RESTRICT/
  );
  assert.match(sql, /CREATE UNIQUE INDEX fractalog_records_idempotency_key/);
});

test("FractaLog central ingress is service-only and does not expose direct table mutation", () => {
  assert.match(sql, /ALTER TABLE public\.fractalog_records ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.fractalog_records FROM PUBLIC, anon, authenticated/
  );
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.fractalog_append\(jsonb\) FROM PUBLIC, anon, authenticated/
  );
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.fractalog_append\(jsonb\) TO service_role/);
});
