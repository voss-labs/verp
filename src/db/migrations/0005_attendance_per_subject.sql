-- Attendance is identified by subject as well as slot.
--
-- courseOfferingId has been on the row since attendance was introduced, but the
-- unique key was (student, date, slot) only. Two subjects taught in the same
-- slot on the same day therefore collided, and the second register silently
-- overwrote the first — a class could lose a lecture's attendance without any
-- error.
--
-- Postgres treats NULLs as distinct inside a unique index, so a single key
-- including course_offering_id would stop constraining the class-level form at
-- all. Two partial indexes instead: one for subject sessions, one for
-- class-level ones.
-- The constraint owns the index, so dropping the index first is refused.
ALTER TABLE attendance
  DROP CONSTRAINT IF EXISTS attendance_student_session_uniq;
DROP INDEX IF EXISTS attendance_student_session_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_subject_session_uniq
  ON attendance (student_id, session_date, session_slot, course_offering_id)
  WHERE course_offering_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_class_session_uniq
  ON attendance (student_id, session_date, session_slot)
  WHERE course_offering_id IS NULL;
