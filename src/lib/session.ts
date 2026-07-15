import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getFacultyByAuthUserId } from "@/db/queries/faculty"
import { getStudentByAuthUserId } from "@/db/queries/students"

/**
 * `role` is null for an account VOSS authenticated but VERP cannot place: a real
 * VIT student whose TR has not uploaded them yet.
 *
 * There is no role table. Role IS the binding: a VOSS identity linked to a
 * faculty row is faculty (admin if that row is flagged), one linked to a student
 * row is a student, and one linked to neither is unplaced. This is why every
 * guard must be an allowlist — "is this person staff" — never a denylist: a
 * roleless user is not a student and would sail through `role === "student"`.
 */
export type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
  role: "admin" | "faculty" | "student" | null
  facultyId: string | null
  studentId: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const userId = session.user.id

  let role: SessionUser["role"] = null
  let facultyId: string | null = null
  let studentId: string | null = null

  const fac = await getFacultyByAuthUserId(userId)
  if (fac) {
    role = fac.isAdmin ? "admin" : "faculty"
    facultyId = fac.id
  } else {
    const stu = await getStudentByAuthUserId(userId)
    if (stu) {
      role = "student"
      studentId = stu.id
    }
  }

  return {
    id: userId,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    role,
    facultyId,
    studentId,
  }
}

/** Authenticated by VOSS, but not matched to anybody in the roster. */
export function isUnbound(user: SessionUser | null): boolean {
  return !!user && user.role === null
}

/**
 * Allowed to record marks, manage offerings, enrol students.
 *
 * A type predicate, not a boolean: after `if (!isStaff(user)) return 403`, the
 * compiler knows `user` is non-null and staff. The old denylist guards compiled
 * happily while letting a roleless user through — this makes that class of
 * mistake a build error rather than a security hole.
 */
export function isStaff(
  user: SessionUser | null
): user is SessionUser & { role: "faculty" | "admin" } {
  return user?.role === "faculty" || user?.role === "admin"
}
