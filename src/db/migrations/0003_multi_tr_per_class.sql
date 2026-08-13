-- Several TRs per class.
--
-- A class is taught by as many teachers as it has subjects, and each subject
-- carries its own teacher. The previous rule retired the incumbent TR whenever
-- another was appointed, which silently unstaffed them. Only the coordinator is
-- one-per-class, and that is already enforced by class_coordinator_live_uniq.
--
-- Adds the pair uniqueness the reactivating upsert needs. Duplicates are folded
-- first, keeping the newest row of each (class, faculty, role) and retiring the
-- rest, so the index can be created on existing data.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY class_id, faculty_id, role
           ORDER BY is_active DESC, created_at DESC
         ) AS rn
  FROM faculty_class_assignments
)
DELETE FROM faculty_class_assignments
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS class_faculty_role_uniq
  ON faculty_class_assignments (class_id, faculty_id, role);
