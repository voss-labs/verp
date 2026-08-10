-- Practical batches and cohort graduation.
--
-- Written to be safely re-runnable: `db:push` may already have created these
-- objects on a developer's database before this file existed, and the runner
-- records a filename once but cannot know what state a pushed database is in.
-- Every statement is therefore guarded.

-- ── graduation ─────────────────────────────────────────────────────────────
-- expectedYear() returns null past BE, so without this a finished cohort falls
-- back to a raw admission year and reads like a parse failure.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS graduated_at timestamptz;

-- ── practical batches ──────────────────────────────────────────────────────
-- A batch belongs to one OFFERING, not to the class: a student can sit in B1
-- for one lab and B2 for another depending on the timetable.
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS batches_offering_name_uniq
  ON batches (course_offering_id, name);
CREATE INDEX IF NOT EXISTS batches_offering_idx
  ON batches (course_offering_id, is_active);

CREATE TABLE IF NOT EXISTS batch_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One live row per (batch, student): re-assigning a student to the same batch
-- must not silently duplicate them into a session twice.
CREATE UNIQUE INDEX IF NOT EXISTS batch_assignments_batch_student_uniq
  ON batch_assignments (batch_id, student_id);
CREATE INDEX IF NOT EXISTS batch_assignments_student_idx
  ON batch_assignments (student_id, is_active);
