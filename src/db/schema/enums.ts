import { pgEnum } from "drizzle-orm/pg-core"

// The RBAC tier a faculty account holds. Replaces the old faculty.isAdmin boolean.
// student is implicit (a bound students row) and unbound is null — neither needs
// an enum value here. super_admin is granted by the SUPER_ADMIN_EMAILS allowlist,
// not stored as a role that could be edited away.
export const facultyRoleEnum = pgEnum("faculty_role", [
  "super_admin",
  "hod",
  "faculty",
])

// A department-level appointment: who heads a dept, who co-ordinates it.
export const deptAppointmentEnum = pgEnum("dept_appointment", [
  "hod",
  "coordinator",
])

// A class-level appointment. The academic_coordinator is the one-per-class owner
// (approves onboarding, uploads attendance); tr is any other faculty assigned to
// the class. A faculty's class role can be either.
export const classRoleEnum = pgEnum("class_role", [
  "academic_coordinator",
  "tr",
])

// Lifecycle of a student's self-registration request. unrouted = the roll parsed
// but no class exists for it yet (nobody to route to).
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "pending",
  "approved",
  "rejected",
  "unrouted",
])

// permission_overrides: what a row targets, and whether it grants or denies.
export const overrideSubjectEnum = pgEnum("override_subject", ["role", "user"])
export const overrideEffectEnum = pgEnum("override_effect", ["grant", "deny"])

// VIT assessment + attendance vocabularies.
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
])
export const courseTypeEnum = pgEnum("course_type", [
  "theory",
  "practical",
  "project",
])
