-- Marks must be non-negative. The application validates against each course's
-- own maxima, which the database cannot see from this table -- but "not
-- negative" is true of every component of every course, and it is the half that
-- turns a silently wrong average into a rejected write.
--
-- Guarded rather than bare: `drizzle-kit push` builds the schema from
-- src/db/schema, which now declares these, so a freshly pushed database arrives
-- here with them already present. A migration that cannot run twice is a
-- migration that breaks every new environment.

DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY['isa', 'mse1', 'mse2', 'ese'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'marks'::regclass
        AND conname = format('marks_%s_non_negative', col)
    ) THEN
      EXECUTE format(
        'ALTER TABLE marks ADD CONSTRAINT marks_%1$s_non_negative
         CHECK (%1$I IS NULL OR %1$I >= 0) NOT VALID', col
      );
      EXECUTE format('ALTER TABLE marks VALIDATE CONSTRAINT marks_%s_non_negative', col);
    END IF;
  END LOOP;
END $$;
