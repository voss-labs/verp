import { headers } from "next/headers"
import { and, eq, or } from "drizzle-orm"
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
  // The classes a coordinator/TR runs: `classIds` for URL-level scope checks,
  // `classKeys` (the cohort keys) for roster queries, which key off class_key.
  classIds: string[]
  classKeys: string[]
  // The subset of classIds this faculty coordinates (vs merely teaches).
  coordinatorClassIds: string[]
  capabilities: ReadonlySet<Capability>
}

// The tier's role overrides and this user's user overrides in ONE round trip —
// both live in permission_overrides, so a single OR-filtered read replaces the
// two it used to take, then we partition by subjectType in memory.
async function capabilitiesFor(
  tier: Exclude<Tier, "super_admin">,
  userId: string
): Promise<ReadonlySet<Capability>> {
  const rows = await db
    .select({
      subjectType: schema.permissionOverrides.subjectType,
      capability: schema.permissionOverrides.capability,
      effect: schema.permissionOverrides.effect,
    })
    .from(schema.permissionOverrides)
    .where(
      and(
        eq(schema.permissionOverrides.isActive, true),
        or(
          and(
            eq(schema.permissionOverrides.subjectType, "role"),
            eq(schema.permissionOverrides.subjectId, tier)
          ),
          and(
            eq(schema.permissionOverrides.subjectType, "user"),
            eq(schema.permissionOverrides.subjectId, userId)
          )
        )
      )
    )
  const roleOv: Override[] = []
  const userOv: Override[] = []
  for (const r of rows) {
    const ov = { capability: r.capability, effect: r.effect }
    ;(r.subjectType === "role" ? roleOv : userOv).push(ov)
  }
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
    classKeys: [] as string[],
    coordinatorClassIds: [] as string[],
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
  // One relational read pulls the faculty row plus its class assignments and HOD
  // appointments, replacing the three separate queries this used to run.
  const fac = await db.query.faculty.findFirst({
    where: and(
      eq(schema.faculty.authUserId, userId),
      eq(schema.faculty.isActive, true)
    ),
    columns: { id: true, role: true },
    with: {
      classAssignments: {
        where: (a, { eq }) => eq(a.isActive, true),
        columns: { classId: true, role: true },
        with: { class: { columns: { classKey: true } } },
      },
      deptAppointments: {
        where: (d, { eq, and }) =>
          and(eq(d.appointment, "hod"), eq(d.isActive, true)),
        columns: { deptCode: true },
      },
    },
  })
  if (fac) {
    const tier: Exclude<Tier, "student"> =
      fac.role === "super_admin" ? "super_admin" : fac.role
    if (tier === "super_admin") {
      return { ...base, tier, facultyId: fac.id, studentId: null, ...empty }
    }
    const classIds = fac.classAssignments.map((a) => a.classId)
    const classKeys = fac.classAssignments.map((a) => a.class.classKey)
    // The coordinator subset, not a second query: the role column rides along on
    // the assignment rows already being read. A TR and a coordinator both hold a
    // class, but only the coordinator may reopen marks somebody locked.
    const coordinatorClassIds = fac.classAssignments
      .filter((a) => a.role === "academic_coordinator")
      .map((a) => a.classId)
    const deptCodes =
      tier === "hod" ? fac.deptAppointments.map((d) => d.deptCode) : []
    return {
      ...base,
      tier,
      facultyId: fac.id,
      studentId: null,
      deptCodes,
      classIds,
      classKeys,
      coordinatorClassIds,
      capabilities: await capabilitiesFor(tier, userId),
    }
  }

  // ── student ──
  const stu = await db.query.students.findFirst({
    where: and(
      eq(schema.students.authUserId, userId),
      eq(schema.students.isActive, true)
    ),
    columns: { id: true, classKey: true },
  })
  if (stu) {
    return {
      ...base,
      tier: "student",
      facultyId: null,
      studentId: stu.id,
      deptCodes: [],
      classIds: [],
      classKeys: stu.classKey ? [stu.classKey] : [],
      coordinatorClassIds: [],
      capabilities: await capabilitiesFor("student", userId),
    }
  }

  // ── unbound ──
  return { ...base, tier: null, facultyId: null, studentId: null, ...empty }
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
