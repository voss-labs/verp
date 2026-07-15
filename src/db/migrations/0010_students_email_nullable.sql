-- Roster imports (college attendance sheets) carry no email — it arrives later,
-- from the student's verified VOSS login when they claim their roll number. So a
-- student row must be able to exist without an email until then.
-- The UNIQUE constraint stays: Postgres permits multiple NULLs in a unique column.
ALTER TABLE students ALTER COLUMN email DROP NOT NULL;
