import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { departments } from "./departments"

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseCode: text("course_code").notNull().unique(),
    courseName: text("course_name").notNull(),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "restrict",
    }),
    courseType: text("course_type").notNull(),
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
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("courses_department_id_idx").on(table.departmentId),
    index("courses_course_type_idx").on(table.courseType),
    index("courses_is_active_idx").on(table.isActive),
  ]
)
