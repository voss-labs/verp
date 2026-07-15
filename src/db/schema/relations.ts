import { relations } from "drizzle-orm"
import { user, session, account } from "./auth"
import { students } from "./students"
import { faculty } from "./faculty"
import { auditLogs } from "./audit"

// Auth relations
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

// Student / faculty are each linked to at most one VOSS identity.
export const studentsRelations = relations(students, ({ one }) => ({
  authUser: one(user, { fields: [students.authUserId], references: [user.id] }),
}))

export const facultyRelations = relations(faculty, ({ one }) => ({
  authUser: one(user, { fields: [faculty.authUserId], references: [user.id] }),
}))

// Audit relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(user, { fields: [auditLogs.actorId], references: [user.id] }),
}))
