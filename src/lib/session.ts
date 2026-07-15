import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getUserRoles } from "@/db/queries/roles"
import { getFacultyByAuthUserId } from "@/db/queries/faculty"
import { getStudentByAuthUserId } from "@/db/queries/students"

/**
 * `role` is null for an account VOSS authenticated but VERP cannot place: a real
 * VIT student whose TR has not uploaded them yet.
 *
 * It used to default to "student", which meant anyone who could create an account
 * silently received a student's access. Every guard must therefore be an
 * allowlist — "is this person staff" — and never a denylist, because a roleless
 * user is not a student and would sail straight through `role === "student"`.
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
  const roles = await getUserRoles(userId)
  const roleNames = roles.map((r) => r.roleDefinition.roleName)

  let role: SessionUser["role"] = null
  if (roleNames.includes("admin")) role = "admin"
  else if (roleNames.includes("faculty")) role = "faculty"
  else if (roleNames.includes("student")) role = "student"

  let facultyId: string | null = null
  let studentId: string | null = null

  if (role === "faculty" || role === "admin") {
    const fac = await getFacultyByAuthUserId(userId)
    facultyId = fac?.id ?? null
  }

  if (role === "student") {
    const stu = await getStudentByAuthUserId(userId)
    studentId = stu?.id ?? null
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
