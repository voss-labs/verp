-- Migration: 0003_seed_sem6_courses
-- Seeds Semester VI course definitions for EXCS department

-- Get EXCS department ID
DO $$
DECLARE
  dept_id integer;
BEGIN
  SELECT id INTO dept_id FROM departments WHERE code = 'EXCS';

  -- Core Theory Courses
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total)
  VALUES
    ('PCEC12T', 'Theory of Computer Science', dept_id, 'theory', 3, 40, 20, 40, 100),
    ('PCEC13T', 'Computer Networks', dept_id, 'theory', 2, 15, 20, 40, 75),
    ('PCEC14T', 'Analog & Digital Communications', dept_id, 'theory', 2, 15, 20, 40, 75)
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total;

  -- Core Practical Courses (linked to theory parent)
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total, parent_course_id)
  VALUES
    ('PCEC13P', 'Computer Networks Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PCEC13T')),
    ('PCEC14P', 'Analog & Digital Communications Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PCEC14T'))
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total,
    parent_course_id = EXCLUDED.parent_course_id;

  -- Professional Elective 2 (PE-2) Theory
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total)
  VALUES
    ('PEEC05T', 'Soft Computing', dept_id, 'theory', 2, 15, 20, 40, 75),
    ('PEEC06T', 'Data Warehousing and Mining', dept_id, 'theory', 2, 15, 20, 40, 75),
    ('PEEC07T', 'IoT System Design', dept_id, 'theory', 2, 15, 20, 40, 75),
    ('PEEC08T', 'Advanced VLSI Design', dept_id, 'theory', 2, 15, 20, 40, 75)
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total;

  -- Professional Elective 2 (PE-2) Practicals
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total, parent_course_id)
  VALUES
    ('PEEC05P', 'Soft Computing Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC05T')),
    ('PEEC06P', 'Data Warehousing and Mining Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC06T')),
    ('PEEC07P', 'IoT System Design Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC07T')),
    ('PEEC08P', 'Advanced VLSI Design Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC08T'))
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total,
    parent_course_id = EXCLUDED.parent_course_id;

  -- Professional Elective 3 (PE-3) Theory
  -- Placeholder codes - update when actual PE-3 courses are confirmed
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total)
  VALUES
    ('PEEC09T', 'PE-3 Option A', dept_id, 'theory', 2, 15, 20, 40, 75),
    ('PEEC10T', 'PE-3 Option B', dept_id, 'theory', 2, 15, 20, 40, 75),
    ('PEEC11T', 'PE-3 Option C', dept_id, 'theory', 2, 15, 20, 40, 75),
    ('PEEC12T2', 'PE-3 Option D', dept_id, 'theory', 2, 15, 20, 40, 75)
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total;

  -- Professional Elective 3 (PE-3) Practicals
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total, parent_course_id)
  VALUES
    ('PEEC09P', 'PE-3 Option A Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC09T')),
    ('PEEC10P', 'PE-3 Option B Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC10T')),
    ('PEEC11P', 'PE-3 Option C Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC11T')),
    ('PEEC12P2', 'PE-3 Option D Lab', dept_id, 'practical', 1, 25, 0, 25, 50,
      (SELECT id FROM courses WHERE course_code = 'PEEC12T2'))
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total,
    parent_course_id = EXCLUDED.parent_course_id;

  -- MDM Courses (4 credit theory)
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total)
  VALUES
    ('MDMBI02', 'Bioinformatics II', dept_id, 'theory', 4, 45, 30, 50, 125),
    ('MDMIE02', 'Innovation and Entrepreneurship II', dept_id, 'theory', 4, 45, 30, 50, 125),
    ('MDMBD02', 'Business Development II', dept_id, 'theory', 4, 45, 30, 50, 125),
    ('MDMRB02', 'Robotics II', dept_id, 'theory', 4, 45, 30, 50, 125)
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total;

  -- Project-1 (Synopsis)
  INSERT INTO courses (course_code, course_name, department_id, course_type, credits, max_isa, max_mse, max_ese, max_total)
  VALUES
    ('PRJ02', 'Project-1 (Synopsis)', dept_id, 'project', 2, 50, 0, 25, 75)
  ON CONFLICT (course_code) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    course_type = EXCLUDED.course_type,
    credits = EXCLUDED.credits,
    max_isa = EXCLUDED.max_isa,
    max_mse = EXCLUDED.max_mse,
    max_ese = EXCLUDED.max_ese,
    max_total = EXCLUDED.max_total;

END;
$$;
