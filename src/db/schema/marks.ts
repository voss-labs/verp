import {
  pgTable,
  uuid,
  integer,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { courseOfferings } from "./offerings"
import { students } from "./students"
import { faculty } from "./faculty"

// A student's marks for one course offering — the VIT components: ISA, two MSEs,
// ESE. Nullable because they are entered at different points in the term. One row
// per (offering, student); re-import upserts.
export const marks = pgTable(
  "marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    isa: integer("isa"),
    mse1: integer("mse1"),
    mse2: integer("mse2"),
    ese: integer("ese"),
    recordedByFacultyId: uuid("recorded_by_faculty_id").references(
      () => faculty.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("marks_offering_student_uniq").on(t.courseOfferingId, t.studentId),
    index("marks_student_idx").on(t.studentId),
  ]
)

// A per-component lock: once a coordinator locks ISA for an offering, marks for
// that component can no longer be edited until unlocked. Keeps the audit of who
// froze what and when.
export const marksLocks = pgTable(
  "marks_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "cascade" }),
    component: text("component").notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedByFacultyId: uuid("locked_by_faculty_id").references(
      () => faculty.id,
      { onDelete: "set null" }
    ),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("marks_locks_offering_component_uniq").on(
      t.courseOfferingId,
      t.component
    ),
  ]
)
