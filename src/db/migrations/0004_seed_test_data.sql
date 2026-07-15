-- Migration: 0004_seed_test_data
-- Seeds course offerings for Sem 6, test students, and enrollments

DO $$
DECLARE
  sem_id integer;
  -- course IDs
  c_tcs uuid; c_cn_t uuid; c_cn_p uuid;
  c_adc_t uuid; c_adc_p uuid;
  c_pe2_t uuid; c_pe2_p uuid;
  c_pe3_t uuid; c_pe3_p uuid;
  c_mdm uuid; c_prj uuid;
  -- offering IDs
  o_tcs_a uuid; o_tcs_b uuid;
  o_cn_t_a uuid; o_cn_t_b uuid;
  o_cn_p_a uuid; o_cn_p_b uuid;
  o_adc_t_a uuid; o_adc_t_b uuid;
  o_adc_p_a uuid; o_adc_p_b uuid;
  o_pe2_t uuid; o_pe2_p uuid;
  o_pe3_t uuid; o_pe3_p uuid;
  o_mdm uuid; o_prj_a uuid; o_prj_b uuid;
  -- student IDs
  s_id uuid;
  dept_id integer;
BEGIN
  SELECT id INTO sem_id FROM semesters WHERE is_current = true LIMIT 1;
  SELECT id INTO dept_id FROM departments WHERE code = 'EXCS';

  -- Get course IDs
  SELECT id INTO c_tcs FROM courses WHERE course_code = 'PCEC12T';
  SELECT id INTO c_cn_t FROM courses WHERE course_code = 'PCEC13T';
  SELECT id INTO c_cn_p FROM courses WHERE course_code = 'PCEC13P';
  SELECT id INTO c_adc_t FROM courses WHERE course_code = 'PCEC14T';
  SELECT id INTO c_adc_p FROM courses WHERE course_code = 'PCEC14P';
  SELECT id INTO c_pe2_t FROM courses WHERE course_code = 'PEEC05T';
  SELECT id INTO c_pe2_p FROM courses WHERE course_code = 'PEEC05P';
  SELECT id INTO c_pe3_t FROM courses WHERE course_code = 'PEEC09T';
  SELECT id INTO c_pe3_p FROM courses WHERE course_code = 'PEEC09P';
  SELECT id INTO c_mdm FROM courses WHERE course_code = 'MDMIE02';
  SELECT id INTO c_prj FROM courses WHERE course_code = 'PRJ02';

  -- Create course offerings (Div A and B for core, single for electives)
  INSERT INTO course_offerings (id, course_id, semester_id, division) VALUES
    (gen_random_uuid(), c_tcs, sem_id, 'A'),
    (gen_random_uuid(), c_tcs, sem_id, 'B'),
    (gen_random_uuid(), c_cn_t, sem_id, 'A'),
    (gen_random_uuid(), c_cn_t, sem_id, 'B'),
    (gen_random_uuid(), c_cn_p, sem_id, 'A'),
    (gen_random_uuid(), c_cn_p, sem_id, 'B'),
    (gen_random_uuid(), c_adc_t, sem_id, 'A'),
    (gen_random_uuid(), c_adc_t, sem_id, 'B'),
    (gen_random_uuid(), c_adc_p, sem_id, 'A'),
    (gen_random_uuid(), c_adc_p, sem_id, 'B'),
    (gen_random_uuid(), c_pe2_t, sem_id, NULL),
    (gen_random_uuid(), c_pe2_p, sem_id, NULL),
    (gen_random_uuid(), c_pe3_t, sem_id, NULL),
    (gen_random_uuid(), c_pe3_p, sem_id, NULL),
    (gen_random_uuid(), c_mdm, sem_id, NULL),
    (gen_random_uuid(), c_prj, sem_id, 'A'),
    (gen_random_uuid(), c_prj, sem_id, 'B')
  ON CONFLICT (course_id, semester_id, division) DO NOTHING;

  -- Seed 10 test students (Div A)
  INSERT INTO students (id, first_name, last_name, roll_number, email, department, division, year, semester)
  VALUES
    (gen_random_uuid(), 'Harshal', 'More', '23108A0054', 'harshal.more@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Om', 'Mohite', '23108A0042', 'om.mohite@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Arjun', 'Patil', '23108A0010', 'arjun.patil@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Sneha', 'Deshmukh', '23108A0015', 'sneha.deshmukh@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Rahul', 'Sharma', '23108A0022', 'rahul.sharma@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Priya', 'Joshi', '23108A0031', 'priya.joshi@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Aditya', 'Kulkarni', '23108A0005', 'aditya.kulkarni@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Pooja', 'Nair', '23108A0038', 'pooja.nair@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Rohan', 'Gupta', '23108A0048', 'rohan.gupta@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
    (gen_random_uuid(), 'Ananya', 'Iyer', '23108A0060', 'ananya.iyer@vit.edu.in', 'EXCS', 'A', 'TE', '6')
  ON CONFLICT (roll_number) DO NOTHING;

  -- Seed 5 test students (Div B)
  INSERT INTO students (id, first_name, last_name, roll_number, email, department, division, year, semester)
  VALUES
    (gen_random_uuid(), 'Vikram', 'Singh', '23108B0008', 'vikram.singh@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
    (gen_random_uuid(), 'Meera', 'Rao', '23108B0019', 'meera.rao@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
    (gen_random_uuid(), 'Siddharth', 'Pawar', '23108B0027', 'siddharth.pawar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
    (gen_random_uuid(), 'Kavya', 'Menon', '23108B0035', 'kavya.menon@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
    (gen_random_uuid(), 'Nikhil', 'Thakur', '23108B0044', 'nikhil.thakur@vit.edu.in', 'EXCS', 'B', 'TE', '6')
  ON CONFLICT (roll_number) DO NOTHING;

  -- Enroll Div A students in Div A core offerings + electives
  FOR s_id IN SELECT id FROM students WHERE division = 'A' AND department = 'EXCS' AND year = 'TE' AND is_active = true
  LOOP
    -- Core theory offerings (Div A)
    INSERT INTO student_enrollments (course_offering_id, student_id)
    SELECT co.id, s_id FROM course_offerings co
    JOIN courses c ON co.course_id = c.id
    WHERE co.semester_id = sem_id
      AND co.division = 'A'
      AND c.course_code IN ('PCEC12T', 'PCEC13T', 'PCEC14T', 'PCEC13P', 'PCEC14P', 'PRJ02')
    ON CONFLICT (course_offering_id, student_id) DO NOTHING;

    -- Electives (no division)
    INSERT INTO student_enrollments (course_offering_id, student_id)
    SELECT co.id, s_id FROM course_offerings co
    JOIN courses c ON co.course_id = c.id
    WHERE co.semester_id = sem_id
      AND co.division IS NULL
      AND c.course_code IN ('PEEC05T', 'PEEC05P', 'PEEC09T', 'PEEC09P', 'MDMIE02')
    ON CONFLICT (course_offering_id, student_id) DO NOTHING;
  END LOOP;

  -- Enroll Div B students in Div B core offerings + electives
  FOR s_id IN SELECT id FROM students WHERE division = 'B' AND department = 'EXCS' AND year = 'TE' AND is_active = true
  LOOP
    INSERT INTO student_enrollments (course_offering_id, student_id)
    SELECT co.id, s_id FROM course_offerings co
    JOIN courses c ON co.course_id = c.id
    WHERE co.semester_id = sem_id
      AND co.division = 'B'
      AND c.course_code IN ('PCEC12T', 'PCEC13T', 'PCEC14T', 'PCEC13P', 'PCEC14P', 'PRJ02')
    ON CONFLICT (course_offering_id, student_id) DO NOTHING;

    INSERT INTO student_enrollments (course_offering_id, student_id)
    SELECT co.id, s_id FROM course_offerings co
    JOIN courses c ON co.course_id = c.id
    WHERE co.semester_id = sem_id
      AND co.division IS NULL
      AND c.course_code IN ('PEEC05T', 'PEEC05P', 'PEEC09T', 'PEEC09P', 'MDMIE02')
    ON CONFLICT (course_offering_id, student_id) DO NOTHING;
  END LOOP;

END;
$$;
