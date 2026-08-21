-- Import history: the receipt for every uploaded file, not the file.
--
-- Four importers exist -- roster, faculty, syllabus, marks -- and none of them
-- left a trace anywhere except two audit rows. Nobody could answer "was this
-- roster already loaded, by whom, and how many rows landed" without asking the
-- person who ran it.
--
-- Deliberately NOT the uploaded file. A roster is personal data with no reason
-- to sit on disk once it is parsed, so this records what the import did and
-- what it was called, and stops there.
--
-- Guarded rather than bare, like every file here: `drizzle-kit push` builds the
-- schema from src/db/schema, which now declares this table, so a freshly pushed
-- database arrives with it already present. A migration that cannot run twice
-- is a migration that breaks every new environment.

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  row_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  error_summary text,
  scope_label text NOT NULL,
  actor_user_id text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plain text columns with a CHECK rather than pg enums: the four kinds and two
-- statuses are the application's vocabulary, and a new kind should be one line
-- of TypeScript plus one migration, not an ALTER TYPE that cannot be undone.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'import_batches'::regclass
      AND conname = 'import_batches_kind_check'
  ) THEN
    ALTER TABLE import_batches
      ADD CONSTRAINT import_batches_kind_check
      CHECK (kind IN ('roster', 'faculty', 'courses', 'marks'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'import_batches'::regclass
      AND conname = 'import_batches_status_check'
  ) THEN
    ALTER TABLE import_batches
      ADD CONSTRAINT import_batches_status_check
      CHECK (status IN ('committed', 'failed'));
  END IF;
END $$;

-- The history page reads newest-first, faceted by kind; the scope and actor
-- indexes carry the per-caller filter an HOD or a TR sees.
CREATE INDEX IF NOT EXISTS import_batches_created_idx
  ON import_batches (created_at);
CREATE INDEX IF NOT EXISTS import_batches_kind_created_idx
  ON import_batches (kind, created_at);
CREATE INDEX IF NOT EXISTS import_batches_actor_idx
  ON import_batches (actor_user_id);
CREATE INDEX IF NOT EXISTS import_batches_scope_idx
  ON import_batches (scope_label);
