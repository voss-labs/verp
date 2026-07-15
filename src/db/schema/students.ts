import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { classes } from "./classes"

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
    // The class this roll belongs to, resolved from the roll number at approval
    // time. Null while unlinked or if the class does not exist yet.
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
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
    index("students_class_id_idx").on(table.classId),
  ]
)
