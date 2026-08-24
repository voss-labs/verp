import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { students } from "./students"
import { classes } from "./classes"
import { courseOfferings } from "./offerings"
import { batches } from "./batches"
import { faculty } from "./faculty"
import { attendanceStatusEnum } from "./enums"

// One attendance mark per student per session. classId is denormalised so scope
// (and later RLS) filters without a join; courseOfferingId is optional — set for
// subject-wise attendance, null for a plain day/slot. Uploaded from the TR's CSV
// via the same importer as the roster; the unique key makes re-import idempotent.
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    courseOfferingId: uuid("course_offering_id").references(
      () => courseOfferings.id,
      { onDelete: "set null" }
    ),
    batchId: uuid("batch_id").references(() => batches.id, {
      onDelete: "set null",
    }),
    sessionDate: date("session_date").notNull(),
    sessionSlot: text("session_slot").notNull().default("1"),
    status: attendanceStatusEnum("status").notNull(),
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
    // The subject is part of what identifies a session. Without it, two
    // subjects taught in the same slot on the same day collided on this key and
    // the second register silently overwrote the first. Postgres treats NULLs
    // as distinct in a unique index, so the class-level form (no offering) is
    // kept unique by the partial index below instead.
    uniqueIndex("attendance_student_subject_session_uniq")
      .on(t.studentId, t.sessionDate, t.sessionSlot, t.courseOfferingId)
      .where(sql`course_offering_id IS NOT NULL`),
    uniqueIndex("attendance_student_class_session_uniq")
      .on(t.studentId, t.sessionDate, t.sessionSlot)
      .where(sql`course_offering_id IS NULL`),
    index("attendance_class_date_idx").on(t.classId, t.sessionDate),
    index("attendance_student_idx").on(t.studentId),
    index("attendance_batch_session_idx")
      .on(t.batchId, t.sessionDate, t.sessionSlot)
      .where(sql`batch_id IS NOT NULL`),
  ]
)
