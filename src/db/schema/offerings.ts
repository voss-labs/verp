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
import { courses } from "./courses"
import { semesters } from "./academic"
import { faculty } from "./faculty"
import { students } from "./students"

export const courseOfferings = pgTable(
  "course_offerings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    semesterId: integer("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "restrict" }),
    facultyId: uuid("faculty_id").references(() => faculty.id, {
      onDelete: "set null",
    }),
    division: text("division"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("offerings_course_sem_div_uniq").on(
      table.courseId,
      table.semesterId,
      table.division
    ),
    index("offerings_course_id_idx").on(table.courseId),
    index("offerings_semester_id_idx").on(table.semesterId),
    index("offerings_faculty_id_idx").on(table.facultyId),
  ]
)

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
  (table) => [
    unique("batches_offering_name_uniq").on(table.courseOfferingId, table.name),
    index("batches_course_offering_id_idx").on(table.courseOfferingId),
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
  (table) => [
    unique("batch_assignments_batch_student_uniq").on(
      table.batchId,
      table.studentId
    ),
    index("batch_assignments_batch_id_idx").on(table.batchId),
    index("batch_assignments_student_id_idx").on(table.studentId),
  ]
)

export const studentEnrollments = pgTable(
  "student_enrollments",
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
  (table) => [
    unique("enrollments_offering_student_uniq").on(
      table.courseOfferingId,
      table.studentId
    ),
    index("enrollments_course_offering_id_idx").on(table.courseOfferingId),
    index("enrollments_student_id_idx").on(table.studentId),
  ]
)
