import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core"

export const academicYears = pgTable("academic_years", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const semesters = pgTable(
  "semesters",
  {
    id: serial("id").primaryKey(),
    academicYearId: integer("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("semesters_year_number_uniq").on(table.academicYearId, table.number),
    index("semesters_academic_year_id_idx").on(table.academicYearId),
    index("semesters_is_current_idx").on(table.isCurrent),
  ]
)
