import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { departments } from "./departments"

// A class is a COHORT-division, keyed by the roll-number prefix, e.g.
// classKey "2023-108-A" = admitted 2023, branch 108 (EXCS), division A. It is
// deliberately NOT stored as "TE-EXCS-A": the FE/SE/TE/BE label drifts every July
// as the cohort advances, so we store the stable admission year and compute the
// label at render (expectedYear). The roll number of any student resolves to
// exactly one classKey with zero string matching — that is the whole isolation
// story (a coordinator's scope is a set of classIds).
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classKey: text("class_key").notNull().unique(),
    admissionYear: integer("admission_year").notNull(),
    branchCode: text("branch_code").notNull(),
    departmentCode: text("department_code")
      .notNull()
      .references(() => departments.code, { onDelete: "restrict" }),
    division: text("division").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("classes_department_code_idx").on(t.departmentCode),
    index("classes_cohort_idx").on(t.admissionYear, t.branchCode, t.division),
    index("classes_is_active_idx").on(t.isActive),
  ]
)
