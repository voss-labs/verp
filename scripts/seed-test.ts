// Dev-only TEST FIXTURES — not product data. Creates a department, a class, and
// fixed @vosslabs.org accounts so each RBAC tier can be tested by signing in:
// bind matches the verified email to these rows and grants the role.
//
//   admin@vosslabs.org    super_admin   (via SUPER_ADMIN_EMAILS env, NOT here)
//   hod@vosslabs.org      HOD of EXCS
//   ac@vosslabs.org       academic coordinator of TE-EXCS-A
//   tr@vosslabs.org       TR of TE-EXCS-A
//   student@vosslabs.org  student (roll 23108A0099) in TE-EXCS-A
//
// Run: npx tsx --env-file=.env.local scripts/seed-test.ts   (idempotent).

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { and, eq } from "drizzle-orm"
import * as schema from "../src/db/schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set (use --env-file=.env.local)")
const db = drizzle(neon(url), { schema })

const DEPT = "EXCS"
const CLASS_KEY = "2023-108-A"

async function ensureDept() {
  const existing = await db.query.departments.findFirst({
    where: eq(schema.departments.code, DEPT),
  })
  if (existing) return existing
  const [row] = await db
    .insert(schema.departments)
    .values({ code: DEPT, name: "Electronics & Computer Science" })
    .returning()
  console.log("+ department", DEPT)
  return row
}

async function ensureClass() {
  const existing = await db.query.classes.findFirst({
    where: eq(schema.classes.classKey, CLASS_KEY),
  })
  if (existing) return existing
  const [row] = await db
    .insert(schema.classes)
    .values({
      classKey: CLASS_KEY,
      admissionYear: 2023,
      branchCode: "108",
      departmentCode: DEPT,
      division: "A",
    })
    .returning()
  console.log("+ class", CLASS_KEY)
  return row
}

async function ensureFaculty(input: {
  email: string
  firstName: string
  employeeId: string
  role: "hod" | "faculty"
}) {
  const existing = await db.query.faculty.findFirst({
    where: eq(schema.faculty.email, input.email),
  })
  if (existing) return existing
  const [row] = await db
    .insert(schema.faculty)
    .values({
      firstName: input.firstName,
      lastName: "Test",
      employeeId: input.employeeId,
      email: input.email,
      department: DEPT,
      role: input.role,
    })
    .returning()
  console.log("+ faculty", input.email, `(${input.role})`)
  return row
}

async function ensureDeptAppointment(facultyId: string) {
  const existing = await db.query.deptAppointments.findFirst({
    where: and(
      eq(schema.deptAppointments.deptCode, DEPT),
      eq(schema.deptAppointments.appointment, "hod"),
      eq(schema.deptAppointments.isActive, true)
    ),
  })
  if (existing) return
  await db
    .insert(schema.deptAppointments)
    .values({ deptCode: DEPT, facultyId, appointment: "hod" })
  await db
    .update(schema.departments)
    .set({ hodFacultyId: facultyId })
    .where(eq(schema.departments.code, DEPT))
  console.log("+ HOD appointment")
}

async function ensureClassAssignment(
  classId: string,
  facultyId: string,
  role: "academic_coordinator" | "tr"
) {
  const existing = await db.query.facultyClassAssignments.findFirst({
    where: and(
      eq(schema.facultyClassAssignments.classId, classId),
      eq(schema.facultyClassAssignments.facultyId, facultyId),
      eq(schema.facultyClassAssignments.isActive, true)
    ),
  })
  if (existing) return
  await db
    .insert(schema.facultyClassAssignments)
    .values({ classId, facultyId, role })
  console.log("+ class assignment", role)
}

async function ensureStudent(classId: string) {
  const roll = "23108A0099"
  const existing = await db.query.students.findFirst({
    where: eq(schema.students.rollNumber, roll),
  })
  if (existing) return
  await db.insert(schema.students).values({
    firstName: "Test",
    lastName: "Student",
    rollNumber: roll,
    email: "student@vosslabs.org",
    department: DEPT,
    division: "A",
    year: "BE",
    classId,
  })
  console.log("+ student", roll, "student@vosslabs.org")
}

async function main() {
  await ensureDept()
  const cls = await ensureClass()

  const hod = await ensureFaculty({
    email: "hod@vosslabs.org",
    firstName: "Hod",
    employeeId: "HOD001",
    role: "hod",
  })
  await ensureDeptAppointment(hod.id)

  const ac = await ensureFaculty({
    email: "ac@vosslabs.org",
    firstName: "Coordinator",
    employeeId: "AC001",
    role: "faculty",
  })
  await ensureClassAssignment(cls.id, ac.id, "academic_coordinator")

  const tr = await ensureFaculty({
    email: "tr@vosslabs.org",
    firstName: "Tr",
    employeeId: "TR001",
    role: "faculty",
  })
  await ensureClassAssignment(cls.id, tr.id, "tr")

  await ensureStudent(cls.id)

  console.log(
    "\nDone. Sign in with each @vosslabs.org email — bind links it to its role.\n" +
      "admin@vosslabs.org gets super_admin from SUPER_ADMIN_EMAILS, not this script."
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
