ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS batch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'attendance'::regclass
      AND c.contype = 'f'
      AND a.attname = 'batch_id'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_batch_id_batches_id_fk
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS attendance_batch_session_idx
  ON attendance (batch_id, session_date, session_slot)
  WHERE batch_id IS NOT NULL;
