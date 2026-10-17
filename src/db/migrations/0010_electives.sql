-- Electives: a subject taught to the students who chose it.
--
-- Every other subject is taught to the whole division, so its roster is the
-- class and nothing needs storing. An elective is not: a division splits across
-- several of them, and treating one as whole-class meant its marks grid listed
-- every student in the division, and it could never be locked or published --
-- locking waits for a mark from everybody on the roster, and most of the class
-- would never have one.
--
-- A flag on the offering rather than a course type: whether a subject is taught
-- to the whole class is a fact about one class's timetable, which is what an
-- offering already records alongside its teacher and semester.
--
-- Guarded like every file here: drizzle-kit push builds both from
-- src/db/schema, so a freshly pushed database already has them.

ALTER TABLE course_offerings
  ADD COLUMN IF NOT EXISTS is_elective boolean NOT NULL DEFAULT false;

-- Constraints named the way drizzle-kit names them, so a database built by push
-- and one built by this file end up with the same schema.
CREATE TABLE IF NOT EXISTS elective_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL,
  student_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT elective_enrollments_course_offering_id_course_offerings_id_fk
    FOREIGN KEY (course_offering_id)
    REFERENCES course_offerings(id) ON DELETE CASCADE,
  CONSTRAINT elective_enrollments_student_id_students_id_fk
    FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE
);

-- One row per (offering, student): putting somebody on an elective twice must
-- not list them in its grid twice.
CREATE UNIQUE INDEX IF NOT EXISTS elective_enrollments_offering_student_uniq
  ON elective_enrollments (course_offering_id, student_id);
CREATE INDEX IF NOT EXISTS elective_enrollments_student_idx
  ON elective_enrollments (student_id, is_active);
