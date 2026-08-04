// Seeding a person means seeding a ROSTER ROW, not an account.
//
// VERP holds no credentials: VOSS is the only door, and better-auth's
// emailAndPassword is off. So this cannot create a login — nothing here has a
// password to set. What it does is write the row that a VOSS login BINDS to.
//
// The contract is bindIdentity (src/lib/bind.ts): on every sign-in it looks up
// the verified address in faculty, then students, and links the row it finds.
// Seed a faculty row carrying your own @vit.edu.in address, sign in through
// VOSS, and you arrive holding that row's tier and scope. Seed nothing and you
// authenticate fine but land on the pending screen with no role — the correct
// outcome for an unplaced account, not a bug.
//
// super_admin is deliberately absent: it comes from the SUPER_ADMIN_EMAILS
// allowlist at session time (src/lib/session.ts), never from a row that could be
// edited away.

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { and, eq } from "drizzle-orm"
import * as schema from "@/db/schema"
import { classKeyFromRoll } from "@/lib/class-key"
import {
  expectedYear,
  isValidRollNumber,
  parseRollNumber,
} from "@/lib/roll-number"

export type SeedTier = "hod" | "coordinator" | "tr" | "student"

export interface TierOption {
  value: SeedTier
  label: string
  hint: string
}

// What the wizard offers. Mirrors the tiers getSessionUser() can actually
// resolve — a coordinator and a TR are both faculty rows, separated only by
// their class assignment role.
export const SEED_TIERS: TierOption[] = [
  { value: "hod", label: "HOD", hint: "heads a department, sees its faculty" },
  {
    value: "coordinator",
    label: "Academic coordinator",
    hint: "owns one class: onboarding queue + attendance",
  },
  { value: "tr", label: "Teacher (TR)", hint: "attached to one class" },
  { value: "student", label: "Student", hint: "own marks and attendance" },
]

// The demo cohort every seeded person hangs off. EXCS/108 division A admitted
// 2023 gives class_key "2023-108-A" — the same value classKeyFromRoll() derives
// from a 23108Axxxx roll, so seeded staff and seeded students land in one class
// with no manual linking.
const DEMO_DEPT = "EXCS"
const DEMO_DEPT_NAME = "Electronics & Computer Science"
const DEMO_ADMISSION_YEAR = 2023
const DEMO_BRANCH_CODE = "108"
const DEMO_DIVISION = "A"
const DEMO_CLASS_KEY = `${DEMO_ADMISSION_YEAR}-${DEMO_BRANCH_CODE}-${DEMO_DIVISION}`

function connect(url: string) {
  return drizzle(neon(url), { schema })
}

type Db = ReturnType<typeof connect>

async function ensureDepartment(db: Db) {
  const existing = await db.query.departments.findFirst({
    where: eq(schema.departments.code, DEMO_DEPT),
  })
  if (existing) return existing
  const [row] = await db
    .insert(schema.departments)
    .values({ code: DEMO_DEPT, name: DEMO_DEPT_NAME })
    .returning()
  return row
}

async function ensureClass(db: Db) {
  const existing = await db.query.classes.findFirst({
    where: eq(schema.classes.classKey, DEMO_CLASS_KEY),
  })
  if (existing) return existing
  const [row] = await db
    .insert(schema.classes)
    .values({
      classKey: DEMO_CLASS_KEY,
      admissionYear: DEMO_ADMISSION_YEAR,
      branchCode: DEMO_BRANCH_CODE,
      departmentCode: DEMO_DEPT,
      division: DEMO_DIVISION,
    })
    .returning()
  return row
}

/** employee_id is NOT NULL UNIQUE; email is already unique, so derive from it. */
function employeeIdFor(email: string): string {
  const local = email.split("@")[0] ?? email
  return `VERP-${local.toUpperCase().replace(/[^A-Z0-9]/g, "")}`.slice(0, 32)
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/)
  return { firstName: parts[0] ?? full, lastName: parts.slice(1).join(" ") }
}

async function ensureFaculty(
  db: Db,
  input: { name: string; email: string; role: "hod" | "faculty" }
) {
  const email = input.email.trim().toLowerCase()
  const existing = await db.query.faculty.findFirst({
    where: eq(schema.faculty.email, email),
  })
  if (existing) {
    // An appointment row alone does not make an HOD: getSessionUser only reads
    // deptAppointments when the tier is already "hod", so returning a stale
    // "faculty" row here would appoint someone who then signs in with no dept
    // scope at all. Escalate the tier to match what is being seeded.
    //
    // Only ever upwards. Downgrading would let seeding a TR quietly strip an
    // existing HOD — or worse, a super_admin — of their tier.
    if (input.role === "hod" && existing.role === "faculty") {
      const [promoted] = await db
        .update(schema.faculty)
        .set({ role: "hod" })
        .where(eq(schema.faculty.id, existing.id))
        .returning()
      return promoted
    }
    return existing
  }
  const { firstName, lastName } = splitName(input.name)
  const [row] = await db
    .insert(schema.faculty)
    .values({
      firstName,
      lastName,
      employeeId: employeeIdFor(email),
      email,
      department: DEMO_DEPT,
      role: input.role,
    })
    .returning()
  return row
}

async function ensureHodAppointment(db: Db, facultyId: string) {
  // At most one live HOD per dept (dept_appointment_live_uniq). Check rather
  // than race the partial unique index.
  const existing = await db.query.deptAppointments.findFirst({
    where: and(
      eq(schema.deptAppointments.deptCode, DEMO_DEPT),
      eq(schema.deptAppointments.appointment, "hod"),
      eq(schema.deptAppointments.isActive, true)
    ),
  })
  if (existing) return
  await db
    .insert(schema.deptAppointments)
    .values({ deptCode: DEMO_DEPT, facultyId, appointment: "hod" })
  await db
    .update(schema.departments)
    .set({ hodFacultyId: facultyId })
    .where(eq(schema.departments.code, DEMO_DEPT))
}

async function ensureClassAssignment(
  db: Db,
  classId: string,
  facultyId: string,
  role: "academic_coordinator" | "tr"
) {
  const mine = await db.query.facultyClassAssignments.findFirst({
    where: and(
      eq(schema.facultyClassAssignments.classId, classId),
      eq(schema.facultyClassAssignments.facultyId, facultyId),
      eq(schema.facultyClassAssignments.isActive, true)
    ),
  })
  if (mine) return
  if (role === "academic_coordinator") {
    // class_coordinator_live_uniq allows exactly one live coordinator per class.
    const taken = await db.query.facultyClassAssignments.findFirst({
      where: and(
        eq(schema.facultyClassAssignments.classId, classId),
        eq(schema.facultyClassAssignments.role, "academic_coordinator"),
        eq(schema.facultyClassAssignments.isActive, true)
      ),
    })
    if (taken) {
      throw new Error(
        `Class ${DEMO_CLASS_KEY} already has an academic coordinator. Seed this person as a TR instead.`
      )
    }
  }
  await db
    .insert(schema.facultyClassAssignments)
    .values({ classId, facultyId, role })
}

async function ensureStudent(
  db: Db,
  input: { name: string; email: string; rollNumber: string }
) {
  const roll = input.rollNumber.trim().toUpperCase()
  const email = input.email.trim().toLowerCase()
  const existing = await db.query.students.findFirst({
    where: eq(schema.students.rollNumber, roll),
  })
  if (existing) return existing
  const { firstName, lastName } = splitName(input.name)
  const [row] = await db
    .insert(schema.students)
    .values({
      firstName,
      lastName,
      rollNumber: roll,
      email,
      department: DEMO_DEPT,
      division: parseRollNumber(roll).division,
      // Derived from the roll, not hardcoded: seeding a 2026 roll must not
      // produce a final-year student. Null only for a cohort outside FE-BE.
      year:
        expectedYear(parseRollNumber(roll).admissionYear, new Date()) ?? "BE",
      // Derived, never typed: the roll IS the cohort key (DSY folds back a year).
      classKey: classKeyFromRoll(roll),
    })
    .returning()
  return row
}

export interface SeedPersonInput {
  tier: SeedTier
  name: string
  email: string
  /** Required for the student tier; ignored otherwise. */
  rollNumber?: string
}

export interface SeedPersonResult {
  tier: SeedTier
  email: string
  detail: string
}

/**
 * Seed one roster row plus whatever scope its tier needs. Idempotent: every step
 * checks first, so re-running the wizard against a live database is safe.
 */
export async function seedPerson(
  input: SeedPersonInput,
  url: string
): Promise<SeedPersonResult> {
  const db = connect(url)
  const email = input.email.trim().toLowerCase()
  await ensureDepartment(db)

  if (input.tier === "student") {
    const roll = input.rollNumber?.trim().toUpperCase()
    if (!roll) throw new Error("A roll number is required for a student")
    if (!isValidRollNumber(roll)) {
      throw new Error(`"${roll}" is not a valid roll number (e.g. 23108A0054)`)
    }
    await ensureClass(db)
    await ensureStudent(db, { name: input.name, email, rollNumber: roll })
    return {
      tier: input.tier,
      email,
      detail: `roll ${roll}, class ${classKeyFromRoll(roll)}`,
    }
  }

  if (input.tier === "hod") {
    const fac = await ensureFaculty(db, {
      name: input.name,
      email,
      role: "hod",
    })
    await ensureHodAppointment(db, fac.id)
    return { tier: input.tier, email, detail: `HOD of ${DEMO_DEPT}` }
  }

  const cls = await ensureClass(db)
  const fac = await ensureFaculty(db, {
    name: input.name,
    email,
    role: "faculty",
  })
  const role = input.tier === "coordinator" ? "academic_coordinator" : "tr"
  await ensureClassAssignment(db, cls.id, fac.id, role)
  return {
    tier: input.tier,
    email,
    detail: `${role.replace("_", " ")} of ${DEMO_CLASS_KEY}`,
  }
}

export interface QuickSeedResult {
  created: SeedPersonResult[]
  skipped: { email: string; reason: string }[]
}

/**
 * One row per tier on a domain the caller controls, so they can sign in as each
 * and see every dashboard. The addresses must be ones VOSS will actually verify
 * — seeding a domain VOSS rejects produces rows nobody can ever bind to.
 */
export async function quickSeedRoster(
  url: string,
  domain: string
): Promise<QuickSeedResult> {
  const d = domain.trim().replace(/^@/, "").toLowerCase()
  const presets: SeedPersonInput[] = [
    { tier: "hod", name: "Demo HOD", email: `hod@${d}` },
    { tier: "coordinator", name: "Demo Coordinator", email: `ac@${d}` },
    { tier: "tr", name: "Demo Teacher", email: `tr@${d}` },
    {
      tier: "student",
      name: "Demo Student",
      email: `student@${d}`,
      rollNumber: "23108A0099",
    },
  ]

  const created: SeedPersonResult[] = []
  const skipped: { email: string; reason: string }[] = []
  for (const p of presets) {
    try {
      created.push(await seedPerson(p, url))
    } catch (err) {
      skipped.push({
        email: p.email,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { created, skipped }
}

export function validateEmail(value: string | undefined): string | undefined {
  if (!value) return "Email is required"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Not a valid email"
  return undefined
}

export function validateName(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return "Name is required"
  if (value.trim().length < 2) return "Name must be at least 2 characters"
  return undefined
}

export function validateRoll(value: string | undefined): string | undefined {
  if (!value) return "Roll number is required"
  if (!isValidRollNumber(value)) return "Expected the form 23108A0054"
  return undefined
}

export function validateDomain(value: string | undefined): string | undefined {
  if (!value) return "Domain is required"
  const d = value.trim().replace(/^@/, "")
  if (!/^[^\s@]+\.[^\s@]+$/.test(d)) return "Expected a domain like vit.edu.in"
  return undefined
}
