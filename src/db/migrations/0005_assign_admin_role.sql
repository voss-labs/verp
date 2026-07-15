-- ============================================
-- 0005_assign_admin_role.sql
-- Assign admin role to the first registered user
-- ============================================

-- Assign the 'admin' role to the earliest registered user
INSERT INTO user_roles (user_id, role_definition_id, assigned_at)
SELECT
  u.id,
  rd.id,
  now()
FROM "user" u
CROSS JOIN role_definitions rd
WHERE rd.role_name = 'admin'
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id, role_definition_id) DO UPDATE SET is_active = true, updated_at = now();
