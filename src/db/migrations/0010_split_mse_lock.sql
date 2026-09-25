-- Split the single "mse" lock into independent mse1 / mse2 locks.
--
-- Locking used to freeze both MSE halves together, because publishing
-- required every component locked anyway. Now MSE1 and MSE2 lock — and
-- publish — independently, so a stored "mse" row is carried forward onto both
-- halves rather than silently dropped: a component a teacher had already
-- frozen should not reopen just because the column was renamed.
INSERT INTO marks_locks (course_offering_id, component, is_locked, locked_by_faculty_id, locked_at)
SELECT course_offering_id, 'mse1', is_locked, locked_by_faculty_id, locked_at
FROM marks_locks
WHERE component = 'mse'
ON CONFLICT (course_offering_id, component) DO NOTHING;

INSERT INTO marks_locks (course_offering_id, component, is_locked, locked_by_faculty_id, locked_at)
SELECT course_offering_id, 'mse2', is_locked, locked_by_faculty_id, locked_at
FROM marks_locks
WHERE component = 'mse'
ON CONFLICT (course_offering_id, component) DO NOTHING;

DELETE FROM marks_locks WHERE component = 'mse';
