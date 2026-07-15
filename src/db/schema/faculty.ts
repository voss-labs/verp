import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { facultyRoleEnum } from "./enums"

// Staff roster. Linked to a VOSS identity on first sign-in by verified email.
// `role` is the RBAC tier (super_admin is granted by the SUPER_ADMIN_EMAILS
// allowlist at session time, not stored here). A faculty's scope — which depts or
// classes they act on — comes from dept_appointments and faculty_class_assignments,
// not from this row.
export const faculty = pgTable(
  "faculty",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    employeeId: text("employee_id").notNull().unique(),
    email: text("email").notNull().unique(),
    department: text("department").notNull(),
    role: facultyRoleEnum("role").notNull().default("faculty"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("faculty_auth_user_id_idx").on(table.authUserId),
    index("faculty_department_idx").on(table.department),
    index("faculty_role_idx").on(table.role),
    index("faculty_is_active_idx").on(table.isActive),
  ]
)
