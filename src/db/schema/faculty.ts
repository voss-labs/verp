import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

// Staff roster. Same claim model as students: linked to a VOSS identity on first
// sign-in by verified email. `isAdmin` is the whole role model — a bound faculty
// row means "faculty", isAdmin means "admin". There is no separate role table;
// role is derived from the binding (see lib/session.ts).
export const faculty = pgTable(
  "faculty",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    employeeId: text("employee_id").notNull().unique(),
    email: text("email").notNull().unique(),
    department: text("department").notNull(),
    isAdmin: boolean("is_admin").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("faculty_auth_user_id_idx").on(table.authUserId),
    index("faculty_department_idx").on(table.department),
    index("faculty_is_active_idx").on(table.isActive),
  ]
)
