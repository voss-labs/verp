import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { courseOfferings } from "./offerings"
import { students } from "./students"

// Who takes an elective. Every other subject is taught to the whole division,
// so its roster is the class and nothing needs storing. An elective is taught
// to the students who chose it, and a division splits across several of them,
// so each elective offering carries its own list.
//
// Only ever read narrowed to the offering's class (offeringRoster, in
// lib/electives.ts): somebody who leaves the class or is deactivated drops off
// the elective the way they drop off everything else, and a stray row cannot
// put a student from another division on it.
export const electiveEnrollments = pgTable(
  "elective_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseOfferingId: uuid("course_offering_id")
      .notNull()
      .references(() => courseOfferings.id, { onDelete: "cascade" }),
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
    uniqueIndex("elective_enrollments_offering_student_uniq").on(
      t.courseOfferingId,
      t.studentId
    ),
    index("elective_enrollments_student_idx").on(t.studentId, t.isActive),
  ]
)
