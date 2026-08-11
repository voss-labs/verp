import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { departments } from "./departments"
import { courseTypeEnum } from "./enums"

// A subject in the catalogue, owned by a department, carrying the VIT assessment
// caps (ISA / MSE / ESE). parentCourseId links a practical/lab back to its theory
// course. A course is abstract; a course_offering (offerings.ts) is a specific
// class being taught this subject by a faculty in a given semester.
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseCode: text("course_code").notNull().unique(),
    courseName: text("course_name").notNull(),
    departmentCode: text("department_code").references(() => departments.code, {
      onDelete: "restrict",
    }),
    courseType: courseTypeEnum("course_type").notNull(),
    credits: integer("credits").notNull(),
    maxIsa: integer("max_isa").notNull(),
    maxMse: integer("max_mse").notNull().default(0),
    maxEse: integer("max_ese").notNull(),
    maxTotal: integer("max_total").notNull(),
    parentCourseId: uuid("parent_course_id").references(
      (): AnyPgColumn => courses.id,
      { onDelete: "set null" }
    ),
    description: text("description"),
    // Which year of the programme the course belongs to (FE/SE/TE/BE). The
    // syllabus is published one PDF per year, so this is what the catalogue is
    // actually organised by — a flat list of every course the department has
    // ever offered is not something anyone can navigate.
    //
    // Distinct from courseOfferings.semester, which says when a specific CLASS
    // is taught it. The year is a property of the curriculum; the semester is a
    // property of the delivery.
    year: text("year"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("courses_department_code_idx").on(t.departmentCode),
    index("courses_is_active_idx").on(t.isActive),
  ]
)
