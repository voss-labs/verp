import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { departments } from "./departments"
import { faculty } from "./faculty"
import { deptAppointmentEnum } from "./enums"

// Who heads / co-ordinates each department. Kept separate from faculty.role so a
// dept's leadership can change without rewriting the person's tier, and so the
// history stays (soft-deactivate, never delete).
export const deptAppointments = pgTable(
  "dept_appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deptCode: text("dept_code")
      .notNull()
      .references(() => departments.code, { onDelete: "cascade" }),
    facultyId: uuid("faculty_id")
      .notNull()
      .references(() => faculty.id, { onDelete: "cascade" }),
    appointment: deptAppointmentEnum("appointment").notNull(),
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
    // At most one live HOD and one live coordinator per department.
    uniqueIndex("dept_appointment_live_uniq")
      .on(t.deptCode, t.appointment)
      .where(sql`is_active`),
    index("dept_appointments_faculty_idx").on(t.facultyId, t.isActive),
  ]
)
