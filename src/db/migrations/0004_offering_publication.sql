-- Publication as a governed state, separate from marks entry and locking.
--
-- Locking says "I have finished entering this component". Publishing says "the
-- student may see this result". Until now there was no second statement, so a
-- half-entered ISA reached a student's record the moment a teacher typed it —
-- with no ESE and no grade — and read as a result rather than as work in
-- progress.
--
-- Nullable: not-yet-published is the normal state of every offering in a live
-- term, not an exception.
ALTER TABLE course_offerings
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by_faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS offerings_published_idx
  ON course_offerings (published_at);
