import { getFacultyByEmail, linkFacultyToAuthUser } from "@/db/queries/faculty"
import { getStudentByEmail, linkStudentToAuthUser } from "@/db/queries/students"
import { createAuditLog } from "@/db/queries/audit"

/**
 * Binds a VOSS identity to the person it belongs to, exactly once, on first
 * sign-in.
 *
 * VOSS tells us two things and only two: a subject id, and a verified
 * @vit.edu.in address. It knows nothing about roll numbers, divisions, or who
 * teaches what — that lives here, in the roster a TR uploaded.
 *
 * The verified email is the ONLY thing we bind on. It is the single fact both
 * systems agree about and that a student cannot forge: VOSS proved they control
 * that mailbox, and the TR decided which mailbox belongs to which roll number.
 * Binding on anything the user could type — a roll number, a name — would let
 * any verified student claim any classmate's record.
 *
 * No match is not an error. It means a real VIT student whose TR has not
 * uploaded them yet. They get an explicit dead end, never a default role.
 */
export async function bindIdentity(authUserId: string, email: string) {
  const address = email.trim().toLowerCase()

  const faculty = await getFacultyByEmail(address)
  if (faculty) {
    if (faculty.authUserId && faculty.authUserId !== authUserId) {
      // Two VOSS identities claiming one record. Never silently repoint it —
      // that would hand a staff member's account to whoever signed in second.
      throw new Error(
        `Faculty ${faculty.employeeId} is already linked to a different VOSS account.`
      )
    }
    if (!faculty.authUserId) {
      await linkFacultyToAuthUser(faculty.id, authUserId)
      await createAuditLog({
        action: "identity.bound",
        actorId: authUserId,
        targetType: "faculty",
        targetId: faculty.id,
        details: { email: address, employeeId: faculty.employeeId },
      })
    }
    return { kind: "faculty" as const, id: faculty.id }
  }

  const student = await getStudentByEmail(address)
  if (student) {
    if (student.authUserId && student.authUserId !== authUserId) {
      throw new Error(
        `Roll number ${student.rollNumber} is already linked to a different VOSS account.`
      )
    }
    if (!student.authUserId) {
      await linkStudentToAuthUser(student.id, authUserId)
      await createAuditLog({
        action: "identity.bound",
        actorId: authUserId,
        targetType: "student",
        targetId: student.id,
        details: { email: address, rollNumber: student.rollNumber },
      })
    }
    return { kind: "student" as const, id: student.id }
  }

  return { kind: "unbound" as const, id: null }
}
