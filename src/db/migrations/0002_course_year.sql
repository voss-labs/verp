-- Which year of the programme a course belongs to (FE/SE/TE/BE).
--
-- The syllabus ships one PDF per year, so this is how the catalogue is actually
-- organised. Distinct from course_offerings.semester, which records when a
-- particular class is taught the course rather than where it sits in the
-- curriculum.
--
-- Nullable: a course whose year nobody has recorded yet is a real state, and
-- better than defaulting every row to a year that may be wrong.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS year text;

CREATE INDEX IF NOT EXISTS courses_year_idx ON courses (year);
