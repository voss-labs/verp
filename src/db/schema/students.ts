import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

// The roll-number-keyed roster. This is the portable core another VOSS product
// can lift: a person is identified by their VIT roll number, linked to a VOSS
// identity (authUserId) the first time they sign in and claim it. Everything a
// product computes itself — marks, attendance — lives elsewhere, keyed to this.
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Set at claim time, when a verified VOSS login is bound to this roll number.
    // Null until then: a real student the TR has imported but who hasn't signed in.
    authUserId: text("auth_user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    // The lookup key. Encodes admission year, branch and division (see roll-number.ts).
    rollNumber: text("roll_number").notNull().unique(),
    // Nullable: attendance rosters carry no email. It arrives at claim time from
    // the student's verified @vit.edu.in VOSS login.
    email: text("email").unique(),
    department: text("department").notNull(),
    division: text("division"),
    year: text("year").notNull(),
    // The cohort this student belongs to, e.g. "2023-108-A". Derived from the
    // roll number on write (DSE rolls fold back to their batch's start year), so
    // a class's roster is just the students sharing its class_key — no manual
    // linking. Stored, not a hard FK: the class row may not exist yet, and a
    // repeater whose roll can't express their cohort gets an explicit override
    // written here. Null only for a roll we could not parse.
    classKey: text("class_key"),
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
    index("students_class_key_idx").on(table.classKey),
  ]
)
