import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { faculty } from "./faculty"
import { classes } from "./classes"
import { classRoleEnum } from "./enums"

// Which faculty owns which class. The academic_coordinator is the one-per-class
// owner: they receive that class's onboarding queue and upload its attendance.
// tr is any other faculty attached to the class. This mapping drives a faculty's
// class scope — index (facultyId, isActive) is the lookup in getSessionUser().
export const facultyClassAssignments = pgTable(
  "faculty_class_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facultyId: uuid("faculty_id")
      .notNull()
      .references(() => faculty.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    role: classRoleEnum("role").notNull(),
    assignedBy: uuid("assigned_by").references(() => faculty.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Exactly one live academic coordinator per class.
    uniqueIndex("class_coordinator_live_uniq")
      .on(t.classId)
      .where(sql`role = 'academic_coordinator' AND is_active`),
    // One row per (class, faculty, role) so re-appointing reactivates rather
    // than duplicating. TRs are deliberately NOT capped at one per class: a
    // class has as many teachers as it has subjects.
    uniqueIndex("class_faculty_role_uniq").on(t.classId, t.facultyId, t.role),
    index("assignments_faculty_idx").on(t.facultyId, t.isActive),
    index("assignments_class_idx").on(t.classId, t.isActive),
  ]
)
