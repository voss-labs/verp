-- Migration: 0002_academic_schema
-- Adds academic years, semesters, redesigned courses, offerings, batches, enrollments, marks

-- Add division column to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS division text;

-- Drop old attendance table (deferred feature)
DROP TABLE IF EXISTS attendance CASCADE;

-- Recreate courses table with new structure
-- First drop dependent FKs if any
ALTER TABLE courses DROP COLUMN IF EXISTS faculty_id;
ALTER TABLE courses DROP COLUMN IF EXISTS semester;
ALTER TABLE courses DROP COLUMN IF EXISTS year;

-- Add new columns to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'theory';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_isa integer NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_mse integer NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_ese integer NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_total integer NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS parent_course_id uuid REFERENCES courses(id) ON DELETE SET NULL;

-- Create academic_years table
CREATE TABLE IF NOT EXISTS academic_years (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create semesters table
CREATE TABLE IF NOT EXISTS semesters (
  id serial PRIMARY KEY,
  academic_year_id integer NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  number integer NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(academic_year_id, number)
);
CREATE INDEX IF NOT EXISTS semesters_academic_year_id_idx ON semesters(academic_year_id);
CREATE INDEX IF NOT EXISTS semesters_is_current_idx ON semesters(is_current);

-- Create course_offerings table
CREATE TABLE IF NOT EXISTS course_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  semester_id integer NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
  faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL,
  division text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, semester_id, division)
);
CREATE INDEX IF NOT EXISTS offerings_course_id_idx ON course_offerings(course_id);
CREATE INDEX IF NOT EXISTS offerings_semester_id_idx ON course_offerings(semester_id);
CREATE INDEX IF NOT EXISTS offerings_faculty_id_idx ON course_offerings(faculty_id);

-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_offering_id, name)
);
CREATE INDEX IF NOT EXISTS batches_course_offering_id_idx ON batches(course_offering_id);

-- Create batch_assignments table
CREATE TABLE IF NOT EXISTS batch_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, student_id)
);
CREATE INDEX IF NOT EXISTS batch_assignments_batch_id_idx ON batch_assignments(batch_id);
CREATE INDEX IF NOT EXISTS batch_assignments_student_id_idx ON batch_assignments(student_id);

-- Create student_enrollments table
CREATE TABLE IF NOT EXISTS student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_offering_id, student_id)
);
CREATE INDEX IF NOT EXISTS enrollments_course_offering_id_idx ON student_enrollments(course_offering_id);
CREATE INDEX IF NOT EXISTS enrollments_student_id_idx ON student_enrollments(student_id);

-- Create marks table
CREATE TABLE IF NOT EXISTS marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  isa integer,
  mse1 integer,
  mse2 integer,
  ese integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_offering_id, student_id)
);
CREATE INDEX IF NOT EXISTS marks_course_offering_id_idx ON marks(course_offering_id);
CREATE INDEX IF NOT EXISTS marks_student_id_idx ON marks(student_id);

-- Create marks_locks table
CREATE TABLE IF NOT EXISTS marks_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  component text NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  locked_by uuid REFERENCES faculty(id) ON DELETE SET NULL,
  locked_at timestamptz,
  unlocked_by uuid REFERENCES faculty(id) ON DELETE SET NULL,
  unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_offering_id, component)
);
CREATE INDEX IF NOT EXISTS marks_locks_course_offering_id_idx ON marks_locks(course_offering_id);

-- Apply updated_at triggers to new tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- Seed: Academic Year 2025-26 and Semester 6
INSERT INTO academic_years (name, start_date, end_date, is_current)
VALUES ('2025-26', '2025-06-01', '2026-05-31', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO semesters (academic_year_id, number, is_current)
SELECT id, 6, true FROM academic_years WHERE name = '2025-26'
ON CONFLICT (academic_year_id, number) DO NOTHING;

-- Update departments: ensure EXCS exists
INSERT INTO departments (name, code, description)
VALUES ('Electronics and Computer Science', 'EXCS', 'Electronics and Computer Science with Multidisciplinary Minor')
ON CONFLICT (code) DO NOTHING;
