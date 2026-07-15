-- ============================================
-- 0001_setup.sql
-- Updated_at triggers + seed data (roles, departments)
-- ============================================

-- 1. Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Apply updated_at triggers to all tables with updated_at column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- 3. Seed role definitions
INSERT INTO role_definitions (role_name, display_name, description, permissions, hierarchy_level)
VALUES
  ('admin', 'Administrator', 'Full system access', '{"all": true}'::jsonb, 100),
  ('hod', 'Head of Department', 'Department management access', '{"department": true, "faculty": true, "students": true}'::jsonb, 75),
  ('faculty', 'Faculty', 'Course and attendance management', '{"courses": true, "attendance": true}'::jsonb, 50),
  ('student', 'Student', 'View own data', '{"self": true}'::jsonb, 10)
ON CONFLICT (role_name) DO NOTHING;

-- 4. Seed departments
INSERT INTO departments (name, code, description)
VALUES
  ('Computer Science & Engineering', 'CSE', 'Department of Computer Science and Engineering'),
  ('Information Technology', 'IT', 'Department of Information Technology'),
  ('Electronics & Telecommunication', 'EXTC', 'Department of Electronics and Telecommunication Engineering'),
  ('Mechanical Engineering', 'MECH', 'Department of Mechanical Engineering'),
  ('Civil Engineering', 'CIVIL', 'Department of Civil Engineering'),
  ('Electrical Engineering', 'EE', 'Department of Electrical Engineering'),
  ('Applied Sciences', 'AS', 'Department of Applied Sciences and Humanities')
ON CONFLICT (code) DO NOTHING;
