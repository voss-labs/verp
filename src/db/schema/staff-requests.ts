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
import { departments } from "./departments"
import { faculty } from "./faculty"
import { enrollmentStatusEnum } from "./enums"

export const STAFF_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const
export type StaffRequestStatus = (typeof STAFF_REQUEST_STATUSES)[number]

export const staffRequests = pgTable(
  "staff_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email").notNull(),
    employeeId: text("employee_id").notNull(),
    deptCode: text("dept_code")
      .notNull()
      .references(() => departments.code),
    status: enrollmentStatusEnum("status")
      .$type<StaffRequestStatus>()
      .notNull()
      .default("pending"),
    reviewedByFacultyId: uuid("reviewed_by_faculty_id").references(
      () => faculty.id,
      { onDelete: "set null" }
    ),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_request_one_open_uniq")
      .on(t.authUserId)
      .where(sql`status in ('pending')`),
    index("staff_request_dept_status_idx").on(t.deptCode, t.status),
  ]
)
