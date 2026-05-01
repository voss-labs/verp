import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    rollNumber: text("roll_number").notNull().unique(),
    email: text("email").notNull().unique(),
    department: text("department").notNull(),
    division: text("division"),
    year: text("year").notNull(),
    semester: text("semester"),
    phoneNo: text("phone_no"),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
    gender: text("gender"),
    address: text("address"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    profilePic: text("profile_pic"),
    graduatedAt: timestamp("graduated_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("students_auth_user_id_idx").on(table.authUserId),
    index("students_department_idx").on(table.department),
    index("students_year_idx").on(table.year),
    index("students_is_active_idx").on(table.isActive),
    index("students_email_idx").on(table.email),
    index("students_roll_number_idx").on(table.rollNumber),
  ]
)
