CREATE TABLE IF NOT EXISTS staff_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  employee_id text NOT NULL,
  dept_code text NOT NULL REFERENCES departments(code),
  status enrollment_status NOT NULL DEFAULT 'pending',
  reviewed_by_faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_request_one_open_uniq
  ON staff_requests (auth_user_id)
  WHERE status IN ('pending');

CREATE INDEX IF NOT EXISTS staff_request_dept_status_idx
  ON staff_requests (dept_code, status);
