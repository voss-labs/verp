import { relations } from "drizzle-orm"
import { user, session, account } from "./auth"
import { students } from "./students"
import { faculty } from "./faculty"
import { departments } from "./departments"
import { courses } from "./courses"
import { roleDefinitions, userRoles } from "./roles"
import { academicYears, semesters } from "./academic"
import {
  courseOfferings,
  batches,
  batchAssignments,
  studentEnrollments,
} from "./offerings"
import { marks, marksLocks } from "./marks"
import { auditLogs } from "./audit"

// Auth relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  roles: many(userRoles),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

// Role relations
export const roleDefinitionsRelations = relations(
  roleDefinitions,
  ({ many }) => ({
    userRoles: many(userRoles),
  })
)

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(user, { fields: [userRoles.userId], references: [user.id] }),
  roleDefinition: one(roleDefinitions, {
    fields: [userRoles.roleDefinitionId],
    references: [roleDefinitions.id],
  }),
}))

// Department relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  courses: many(courses),
}))

// Student relations
export const studentsRelations = relations(students, ({ one, many }) => ({
  authUser: one(user, { fields: [students.authUserId], references: [user.id] }),
  enrollments: many(studentEnrollments),
  batchAssignments: many(batchAssignments),
  marks: many(marks),
}))

// Faculty relations
export const facultyRelations = relations(faculty, ({ one, many }) => ({
  authUser: one(user, { fields: [faculty.authUserId], references: [user.id] }),
  courseOfferings: many(courseOfferings),
}))

// Academic relations
export const academicYearsRelations = relations(academicYears, ({ many }) => ({
  semesters: many(semesters),
}))

export const semestersRelations = relations(semesters, ({ one, many }) => ({
  academicYear: one(academicYears, {
    fields: [semesters.academicYearId],
    references: [academicYears.id],
  }),
  courseOfferings: many(courseOfferings),
}))

// Course relations
export const coursesRelations = relations(courses, ({ one, many }) => ({
  department: one(departments, {
    fields: [courses.departmentId],
    references: [departments.id],
  }),
  parentCourse: one(courses, {
    fields: [courses.parentCourseId],
    references: [courses.id],
  }),
  offerings: many(courseOfferings),
}))

// Offering relations
export const courseOfferingsRelations = relations(
  courseOfferings,
  ({ one, many }) => ({
    course: one(courses, {
      fields: [courseOfferings.courseId],
      references: [courses.id],
    }),
    semester: one(semesters, {
      fields: [courseOfferings.semesterId],
      references: [semesters.id],
    }),
    faculty: one(faculty, {
      fields: [courseOfferings.facultyId],
      references: [faculty.id],
    }),
    batches: many(batches),
    enrollments: many(studentEnrollments),
    marks: many(marks),
    locks: many(marksLocks),
  })
)

export const batchesRelations = relations(batches, ({ one, many }) => ({
  courseOffering: one(courseOfferings, {
    fields: [batches.courseOfferingId],
    references: [courseOfferings.id],
  }),
  assignments: many(batchAssignments),
}))

export const batchAssignmentsRelations = relations(
  batchAssignments,
  ({ one }) => ({
    batch: one(batches, {
      fields: [batchAssignments.batchId],
      references: [batches.id],
    }),
    student: one(students, {
      fields: [batchAssignments.studentId],
      references: [students.id],
    }),
  })
)

export const studentEnrollmentsRelations = relations(
  studentEnrollments,
  ({ one }) => ({
    courseOffering: one(courseOfferings, {
      fields: [studentEnrollments.courseOfferingId],
      references: [courseOfferings.id],
    }),
    student: one(students, {
      fields: [studentEnrollments.studentId],
      references: [students.id],
    }),
  })
)

// Marks relations
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

// Audit relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(user, { fields: [auditLogs.actorId], references: [user.id] }),
}))

export const marksLocksRelations = relations(marksLocks, ({ one }) => ({
  courseOffering: one(courseOfferings, {
    fields: [marksLocks.courseOfferingId],
    references: [courseOfferings.id],
  }),
  lockedByFaculty: one(faculty, {
    fields: [marksLocks.lockedBy],
    references: [faculty.id],
  }),
}))
