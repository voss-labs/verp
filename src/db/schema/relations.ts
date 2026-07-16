import { relations } from "drizzle-orm"
import { user, session, account } from "./auth"
import { departments } from "./departments"
import { faculty } from "./faculty"
import { classes } from "./classes"
import { deptAppointments } from "./appointments"
import { facultyClassAssignments } from "./assignments"
import { students } from "./students"
import { enrollmentRequests } from "./onboarding"
import { courses } from "./courses"
import { courseOfferings } from "./offerings"
import { marks } from "./marks"
import { attendance } from "./attendance"
import { auditLogs } from "./audit"

// ── Auth ──────────────────────────────────────────────────────────────
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

// ── Org: department -> classes / appointments / courses ───────────────
export const departmentsRelations = relations(departments, ({ many }) => ({
  classes: many(classes),
  appointments: many(deptAppointments),
  courses: many(courses),
}))

export const classesRelations = relations(classes, ({ one, many }) => ({
  department: one(departments, {
    fields: [classes.departmentCode],
    references: [departments.code],
  }),
  students: many(students),
  assignments: many(facultyClassAssignments),
  offerings: many(courseOfferings),
  enrollmentRequests: many(enrollmentRequests),
}))

export const deptAppointmentsRelations = relations(
  deptAppointments,
  ({ one }) => ({
    department: one(departments, {
      fields: [deptAppointments.deptCode],
      references: [departments.code],
    }),
    faculty: one(faculty, {
      fields: [deptAppointments.facultyId],
      references: [faculty.id],
    }),
  })
)

// ── Faculty and its assignments ───────────────────────────────────────
export const facultyRelations = relations(faculty, ({ one, many }) => ({
  authUser: one(user, { fields: [faculty.authUserId], references: [user.id] }),
  classAssignments: many(facultyClassAssignments),
  deptAppointments: many(deptAppointments),
  courseOfferings: many(courseOfferings),
}))

export const facultyClassAssignmentsRelations = relations(
  facultyClassAssignments,
  ({ one }) => ({
    faculty: one(faculty, {
      fields: [facultyClassAssignments.facultyId],
      references: [faculty.id],
    }),
    class: one(classes, {
      fields: [facultyClassAssignments.classId],
      references: [classes.id],
    }),
  })
)

// ── Students, onboarding ──────────────────────────────────────────────
export const studentsRelations = relations(students, ({ one, many }) => ({
  authUser: one(user, { fields: [students.authUserId], references: [user.id] }),
  class: one(classes, {
    fields: [students.classKey],
    references: [classes.classKey],
  }),
  marks: many(marks),
  attendance: many(attendance),
}))

export const enrollmentRequestsRelations = relations(
  enrollmentRequests,
  ({ one }) => ({
    authUser: one(user, {
      fields: [enrollmentRequests.authUserId],
      references: [user.id],
    }),
    class: one(classes, {
      fields: [enrollmentRequests.classId],
      references: [classes.id],
    }),
    reviewedBy: one(faculty, {
      fields: [enrollmentRequests.reviewedByFacultyId],
      references: [faculty.id],
    }),
  })
)

// ── Courses, offerings, marks, attendance ─────────────────────────────
export const coursesRelations = relations(courses, ({ one, many }) => ({
  department: one(departments, {
    fields: [courses.departmentCode],
    references: [departments.code],
  }),
  parent: one(courses, {
    fields: [courses.parentCourseId],
    references: [courses.id],
  }),
  offerings: many(courseOfferings),
}))

export const courseOfferingsRelations = relations(
  courseOfferings,
  ({ one, many }) => ({
    course: one(courses, {
      fields: [courseOfferings.courseId],
      references: [courses.id],
    }),
    class: one(classes, {
      fields: [courseOfferings.classId],
      references: [classes.id],
    }),
    faculty: one(faculty, {
      fields: [courseOfferings.facultyId],
      references: [faculty.id],
    }),
    marks: many(marks),
    attendance: many(attendance),
  })
)

export const marksRelations = relations(marks, ({ one }) => ({
  courseOffering: one(courseOfferings, {
    fields: [marks.courseOfferingId],
    references: [courseOfferings.id],
  }),
  student: one(students, {
    fields: [marks.studentId],
    references: [students.id],
  }),
}))

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(students, {
    fields: [attendance.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [attendance.classId],
    references: [classes.id],
  }),
  courseOffering: one(courseOfferings, {
    fields: [attendance.courseOfferingId],
    references: [courseOfferings.id],
  }),
}))

// ── Audit ─────────────────────────────────────────────────────────────
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(user, { fields: [auditLogs.actorId], references: [user.id] }),
}))
