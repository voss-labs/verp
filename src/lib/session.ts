import { headers } from "next/headers"
import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import * as schema from "@/db/schema"
import {
  effectiveCapabilities,
  type Capability,
  type Override,
  type Tier,
} from "@/lib/rbac"

// The bootstrap seam: a login on this allowlist IS super_admin, independent of
// any faculty row. It is the single door-opener (no seed data). Comma-separated.
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

/**
 * `tier` is the RBAC layer; null = an account VOSS verified but VERP cannot place
 * (they land on the pending screen). Scope facts (`deptCodes` for an HOD,
 * `classIds` for a coordinator/TR, `studentId` for a student) are resolved once
 * here and are what every scoped query filters on. `capabilities` is the tier's
 * code defaults overlaid with the super-admin's permission_overrides — super_admin
 * carries an empty set because `can()` short-circuits it to allow-all.
 */
export type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
  tier: Tier | null
  facultyId: string | null
  studentId: string | null
  deptCodes: string[]
  classIds: string[]
  capabilities: ReadonlySet<Capability>
}

async function overridesFor(
  subjectType: "role" | "user",
  subjectId: string
): Promise<Override[]> {
  const rows = await db
    .select({
      capability: schema.permissionOverrides.capability,
      effect: schema.permissionOverrides.effect,
    })
    .from(schema.permissionOverrides)
    .where(
      and(
        eq(schema.permissionOverrides.subjectType, subjectType),
        eq(schema.permissionOverrides.subjectId, subjectId),
        eq(schema.permissionOverrides.isActive, true)
      )
    )
  return rows
}

async function capabilitiesFor(
  tier: Exclude<Tier, "super_admin">,
  userId: string
): Promise<ReadonlySet<Capability>> {
  const [roleOv, userOv] = await Promise.all([
    overridesFor("role", tier),
    overridesFor("user", userId),
  ])
  return effectiveCapabilities(tier, roleOv, userOv)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const userId = session.user.id
  const email = session.user.email.toLowerCase()
  const base = {
    id: userId,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  }
  const empty = {
    deptCodes: [] as string[],
    classIds: [] as string[],
    capabilities: new Set<Capability>() as ReadonlySet<Capability>,
  }

  // ── super_admin: the allowlist wins, with or without a faculty row ──
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    const fac = await db.query.faculty.findFirst({
      where: eq(schema.faculty.authUserId, userId),
      columns: { id: true },
    })
    return {
      ...base,
      tier: "super_admin",
      facultyId: fac?.id ?? null,
      studentId: null,
      ...empty,
    }
  }

  // ── faculty (hod / faculty) ──
  const fac = await db.query.faculty.findFirst({
    where: and(
      eq(schema.faculty.authUserId, userId),
      eq(schema.faculty.isActive, true)
    ),
    columns: { id: true, role: true },
  })
  if (fac) {
    const tier: Exclude<Tier, "student"> =
      fac.role === "super_admin" ? "super_admin" : fac.role
    if (tier === "super_admin") {
      return { ...base, tier, facultyId: fac.id, studentId: null, ...empty }
    }
    const [deptCodes, classIds, capabilities] = await Promise.all([
      tier === "hod" ? hodDeptCodes(fac.id) : Promise.resolve([]),
      facultyClassIds(fac.id),
      capabilitiesFor(tier, userId),
    ])
    return {
      ...base,
      tier,
      facultyId: fac.id,
      studentId: null,
      deptCodes,
      classIds,
      capabilities,
    }
  }

  // ── student ──
  const stu = await db.query.students.findFirst({
    where: and(
      eq(schema.students.authUserId, userId),
      eq(schema.students.isActive, true)
    ),
    columns: { id: true, classId: true },
  })
  if (stu) {
    return {
      ...base,
      tier: "student",
      facultyId: null,
      studentId: stu.id,
      deptCodes: [],
      classIds: stu.classId ? [stu.classId] : [],
      capabilities: await capabilitiesFor("student", userId),
    }
  }

  // ── unbound ──
  return { ...base, tier: null, facultyId: null, studentId: null, ...empty }
}

async function hodDeptCodes(facultyId: string): Promise<string[]> {
  const rows = await db
    .select({ deptCode: schema.deptAppointments.deptCode })
    .from(schema.deptAppointments)
    .where(
      and(
        eq(schema.deptAppointments.facultyId, facultyId),
        eq(schema.deptAppointments.appointment, "hod"),
        eq(schema.deptAppointments.isActive, true)
      )
    )
  return rows.map((r) => r.deptCode)
}

async function facultyClassIds(facultyId: string): Promise<string[]> {
  const rows = await db
    .select({ classId: schema.facultyClassAssignments.classId })
    .from(schema.facultyClassAssignments)
    .where(
      and(
        eq(schema.facultyClassAssignments.facultyId, facultyId),
        eq(schema.facultyClassAssignments.isActive, true)
      )
    )
  return rows.map((r) => r.classId)
}

/** Authenticated by VOSS, but not matched to anybody — the pending screen. */
export function isUnbound(user: SessionUser | null): boolean {
  return !!user && user.tier === null
}

/**
 * Staff = anyone above student. A type predicate so `if (!isStaff(user)) return`
 * narrows the caller to a placed staff account — a roleless user can never slip
 * through as one.
 */
export function isStaff(
  user: SessionUser | null
): user is SessionUser & { tier: "super_admin" | "hod" | "faculty" } {
  return (
    user?.tier === "super_admin" ||
    user?.tier === "hod" ||
    user?.tier === "faculty"
  )
}
