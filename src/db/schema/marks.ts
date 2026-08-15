import {
  pgTable,
  uuid,
  integer,
  text,
  boolean,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
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
    // The per-course maxima live on `courses`, so the database cannot check an
    // upper bound from here — the application does that. Non-negativity holds
    // for every component of every course, and it is the half that stops a
    // crafted write from quietly poisoning an average.
    check("marks_isa_non_negative", sql`${t.isa} IS NULL OR ${t.isa} >= 0`),
    check("marks_mse1_non_negative", sql`${t.mse1} IS NULL OR ${t.mse1} >= 0`),
    check("marks_mse2_non_negative", sql`${t.mse2} IS NULL OR ${t.mse2} >= 0`),
    check("marks_ese_non_negative", sql`${t.ese} IS NULL OR ${t.ese} >= 0`),
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
