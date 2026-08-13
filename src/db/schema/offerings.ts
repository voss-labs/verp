import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { classes } from "./classes"
import { faculty } from "./faculty"

// A subject being taught to a specific class in a specific semester by a faculty.
// This is the subject<->class<->teacher mapping: "TE-EXCS-A takes DBMS in sem 5,
// taught by Prof X". Marks and (subject-wise) attendance hang off the offering.
// classId replaces the old model's loose (semester, division) key — the class is
// now a first-class cohort, so an offering points straight at it.
export const courseOfferings = pgTable(
  "course_offerings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    facultyId: uuid("faculty_id").references(() => faculty.id, {
      onDelete: "set null",
    }),
    // 1..8 — which semester of the programme this offering runs in.
    semester: integer("semester").notNull(),
    // Publication is a governed state of its own, separate from entering marks
    // and from locking them. Locking says "I have finished"; publishing says
    // "the student may see this". Without it a half-entered ISA appeared on a
    // student's record the moment a teacher typed it, with no ESE and no grade,
    // and looked like a result rather than work in progress.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedByFacultyId: uuid("published_by_faculty_id").references(
      () => faculty.id,
      { onDelete: "set null" }
    ),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("offering_course_class_sem_uniq").on(
      t.courseId,
      t.classId,
      t.semester
    ),
    index("offerings_class_idx").on(t.classId),
    index("offerings_faculty_idx").on(t.facultyId),
  ]
)
