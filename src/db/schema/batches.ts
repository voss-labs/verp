import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { courseOfferings } from "./offerings"
import { students } from "./students"

// Practical batches: a lab of 70 students runs as B1/B2/B3 in a room that seats
// 25. The batch is a property of one OFFERING, not of the class — a student can
// sit in B1 for one lab and B2 for another, depending on the timetable, so it
// cannot be hung off the roster.
//
// Deliberately NOT a marks dimension. Marks stay keyed (offering, student);
// a batch only says which session a student attends, which is what makes lab
// attendance and marks entry tractable a batch at a time.
export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("batches_offering_name_uniq").on(t.courseOfferingId, t.name),
    index("batches_offering_idx").on(t.courseOfferingId, t.isActive),
  ]
)

export const batchAssignments = pgTable(
  "batch_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("batch_assignments_batch_student_uniq").on(
      t.batchId,
      t.studentId
    ),
    index("batch_assignments_student_idx").on(t.studentId, t.isActive),
  ]
)
