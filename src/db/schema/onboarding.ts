import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { user } from "./auth"
import { classes } from "./classes"
import { faculty } from "./faculty"
import { enrollmentStatusEnum } from "./enums"

// A student's self-registration awaiting their class coordinator's approval.
// email is the VOSS-verified session email (locked, never a typed field) — the
// student only asserts a roll number + name. The roll parser resolves classId,
// which routes the request to exactly one coordinator's queue. On approval a
// bound students row is created; the request is the audit of who let them in.
export const enrollmentRequests = pgTable(
  "enrollment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rollNumber: text("roll_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email").notNull(),
    // Resolved from the roll number. Null = unrouted (no class exists for it yet).
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    status: enrollmentStatusEnum("status").notNull().default("pending"),
    reviewedByFacultyId: uuid("reviewed_by_faculty_id").references(
      () => faculty.id,
      { onDelete: "set null" }
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One open request per account (pending or unrouted are both "open").
    uniqueIndex("enrollment_one_open_uniq")
      .on(t.authUserId)
      .where(sql`status in ('pending','unrouted')`),
    // The coordinator's queue: their classIds x pending.
    index("enrollment_class_status_idx").on(t.classId, t.status),
    index("enrollment_roll_idx").on(t.rollNumber),
  ]
)
