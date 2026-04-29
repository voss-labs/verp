-- Fix marks_locks: locked_by and unlocked_by should be text referencing user.id
-- (Better Auth uses text IDs, not UUIDs)

-- Drop existing FK constraints (IF EXISTS for fresh-db idempotency)
ALTER TABLE marks_locks DROP CONSTRAINT IF EXISTS marks_locks_locked_by_fkey;
ALTER TABLE marks_locks DROP CONSTRAINT IF EXISTS marks_locks_unlocked_by_fkey;

-- Change column types from uuid to text (no-op if already text)
ALTER TABLE marks_locks ALTER COLUMN locked_by TYPE text USING locked_by::text;
ALTER TABLE marks_locks ALTER COLUMN unlocked_by TYPE text USING unlocked_by::text;

-- Add new FK constraints referencing user table (skip if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marks_locks_locked_by_user_fk'
  ) THEN
    ALTER TABLE marks_locks ADD CONSTRAINT marks_locks_locked_by_user_fk
      FOREIGN KEY (locked_by) REFERENCES "user"(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marks_locks_unlocked_by_user_fk'
  ) THEN
    ALTER TABLE marks_locks ADD CONSTRAINT marks_locks_unlocked_by_user_fk
      FOREIGN KEY (unlocked_by) REFERENCES "user"(id) ON DELETE SET NULL;
  END IF;
END $$;

