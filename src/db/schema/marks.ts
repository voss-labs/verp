import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { courseOfferings } from "./offerings"
import { students } from "./students"
import { user } from "./auth"

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("marks_offering_student_uniq").on(
      table.courseOfferingId,
      table.studentId
    ),
    index("marks_course_offering_id_idx").on(table.courseOfferingId),
    index("marks_student_id_idx").on(table.studentId),
  ]
)

export const marksLocks = pgTable(
  "marks_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "cascade" }),
    component: text("component").notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedBy: text("locked_by").references(() => user.id, {
      onDelete: "set null",
    }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    unlockedBy: text("unlocked_by").references(() => user.id, {
      onDelete: "set null",
    }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("marks_locks_offering_component_uniq").on(
      table.courseOfferingId,
      table.component
    ),
    index("marks_locks_course_offering_id_idx").on(table.courseOfferingId),
  ]
)
