import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const faculty = pgTable(
  "faculty",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    employeeId: text("employee_id").notNull().unique(),
    email: text("email").notNull().unique(),
    department: text("department").notNull(),
    designation: text("designation"),
    phoneNo: text("phone_no"),
    qualification: text("qualification"),
    specialization: text("specialization"),
    profilePic: text("profile_pic"),
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
