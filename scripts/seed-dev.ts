// The local development dataset.
//
// Two layers, because a fixture that is only one of them is misleading in a
// different way each time.
//
// BREADTH gives the app a college's worth of rows: three departments, all four
// year-cohorts, ~1,100 students. Filters, search, pagination and the scoped
// queries behave the way they will in front of a real roster, and an N+1 that
// is invisible against twelve rows is obvious against a thousand.
//
// DEPTH wires one class — BE EXCS A — end to end, and that class is where the
// authorization rules become visible. Two teachers on it so "allocated to
// another teacher" is reachable; a coordinator who teaches nothing so the
// decisions that are theirs can be told apart from the ones that are not; a
// subject nobody teaches so the attention inbox has something real to rank; and
// marks in three different states so published, provisional and untouched can
// be seen side by side.
//
// Idempotent: it clears the tables it owns and rewrites them, so running it
// twice is the same as running it once and a broken experiment is one command
// from a known state.

import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import * as schema from "../src/db/schema"
import { isLocalPostgres } from "../src/db/driver"
import { DEV_PERSONAS, DEV_CLASS_A, DEV_CLASS_B } from "../src/lib/dev-personas"

const url = process.env.DATABASE_URL ?? ""

// The one check that matters in this file. Everything below deletes rows, and
// the difference between the container and the college's database is one line
// in .env.local that is easy to have forgotten about.
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.development.example first.")
  process.exit(1)
}
if (!isLocalPostgres(url)) {
  console.error(
    `Refusing to seed ${new URL(url).hostname}.\n` +
      "This script deletes and rewrites academic tables, and only ever runs\n" +
      "against a local database. Point DATABASE_URL at the container from\n" +
      "docker-compose.yml (localhost:5433) and try again."
  )
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
const db = drizzle(pool, { schema })

const uid = () => randomUUID()
const now = new Date()
const daysAgo = (n: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// Deterministic, so two contributors comparing screens see the same college.
let seed = 20260815
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]

/** Postgres has a parameter ceiling per statement; large tables go in chunks. */
async function insertAll<T>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  size = 400
) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any)
  }
}

const FIRST = [
  "Neha",
  "Omkar",
  "Sanika",
  "Aditya",
  "Isha",
  "Rohan",
  "Tanvi",
  "Yash",
  "Gauri",
  "Siddharth",
  "Manasi",
  "Kunal",
  "Shreya",
  "Atharva",
  "Mrunal",
  "Vedant",
  "Ketaki",
  "Soham",
  "Rutuja",
  "Pranav",
  "Aarti",
  "Nikhil",
  "Sayali",
  "Harsh",
  "Devika",
  "Chinmay",
  "Anushka",
  "Parth",
]
const LAST = [
  "Bhosale",
  "Sawant",
  "Kadam",
  "Jadhav",
  "Pawar",
  "Shinde",
  "More",
  "Chavan",
  "Salunkhe",
  "Thorat",
  "Dalvi",
  "Ghadge",
  "Deshmukh",
  "Kulkarni",
  "Patil",
  "Joshi",
  "Naik",
  "Rane",
  "Gaikwad",
  "Mane",
  "Bhagat",
  "Waghmare",
]

// Today is in academic year 2026-27, so a 2023 intake is in its BE year.
const COHORTS = [
  { year: "BE", admissionYear: 2023, semester: 7 },
  { year: "TE", admissionYear: 2024, semester: 5 },
  { year: "SE", admissionYear: 2025, semester: 3 },
  { year: "FE", admissionYear: 2026, semester: 1 },
] as const

const DEPTS = [
  // `prefix` is the course-code stem and has to differ per department: course
  // codes are unique college-wide, and EXCS and EXTC both start "EX".
  {
    code: "EXCS",
    name: "Electronics & Computer Science",
    branch: "108",
    prefix: "EC",
    divisions: ["A", "B"],
  },
  {
    code: "CMPN",
    name: "Computer Engineering",
    branch: "102",
    prefix: "CM",
    divisions: ["A", "B", "C"],
  },
  {
    code: "EXTC",
    name: "Electronics & Telecommunication",
    branch: "104",
    prefix: "ET",
    divisions: ["A", "B"],
  },
] as const

/** Four subjects per cohort per department, named plausibly for the year. */
const SUBJECTS: Record<string, [string, string, "theory" | "practical"][]> = {
  BE: [
    ["33T", "Data Analytics & Visualization", "theory"],
    ["34T", "Computer Networks", "theory"],
    ["35T", "Machine Learning", "theory"],
    ["36P", "Data Analytics Laboratory", "practical"],
  ],
  TE: [
    ["23T", "Operating Systems", "theory"],
    ["24T", "Database Management Systems", "theory"],
    ["25T", "Software Engineering", "theory"],
    ["26P", "Database Laboratory", "practical"],
  ],
  SE: [
    ["13T", "Data Structures", "theory"],
    ["14T", "Discrete Mathematics", "theory"],
    ["15T", "Digital Electronics", "theory"],
    ["16P", "Data Structures Laboratory", "practical"],
  ],
  FE: [
    ["03T", "Engineering Mathematics I", "theory"],
    ["04T", "Engineering Physics", "theory"],
    ["05T", "Problem Solving with C", "theory"],
    ["06P", "Physics Laboratory", "practical"],
  ],
}

async function main() {
  // Deleted child-first: each of these has a foreign key into the one above, so
  // the order is the schema's, not a preference.
  console.log("clearing…")
  for (const table of [
    "attendance",
    "marks_locks",
    "marks",
    "batch_assignments",
    "batches",
    "course_offerings",
    "enrollment_requests",
    "faculty_class_assignments",
    "dept_appointments",
    "audit_logs",
    "permission_overrides",
    "students",
    "courses",
    "classes",
    "faculty",
    "departments",
    "import_batches",
    "session",
    "account",
    '"user"',
  ]) {
    await pool.query(`DELETE FROM ${table}`)
  }

  await db
    .insert(schema.departments)
    .values(DEPTS.map((d) => ({ code: d.code, name: d.name })))

  // ── classes: every department, every cohort, every division ────────────
  type ClassRow = typeof schema.classes.$inferInsert & { id: string }
  const classes: ClassRow[] = []
  for (const d of DEPTS) {
    for (const c of COHORTS) {
      for (const div of d.divisions) {
        classes.push({
          id: uid(),
          classKey: `${c.admissionYear}-${d.branch}-${div}`,
          admissionYear: c.admissionYear,
          branchCode: d.branch,
          departmentCode: d.code,
          division: div,
        })
      }
    }
  }
  await insertAll(schema.classes, classes)
  const classBy = (key: string) => classes.find((c) => c.classKey === key)!
  const classA = classBy(DEV_CLASS_A).id
  const classB = classBy(DEV_CLASS_B).id

  // ── auth users, one per persona ────────────────────────────────────────
  // No account rows: nobody signs in locally, the switcher names them instead.
  const userIdByEmail = new Map<string, string>()
  await db.insert(schema.user).values(
    DEV_PERSONAS.map((p) => {
      const id = `dev-${p.key}`
      userIdByEmail.set(p.email, id)
      return {
        id,
        name: p.name,
        email: p.email,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      }
    })
  )
  const authId = (email: string) => userIdByEmail.get(email) ?? null

  // ── faculty ────────────────────────────────────────────────────────────
  const fAdmin = uid(),
    fHodExcs = uid(),
    fHodExtc = uid(),
    fHodCmpn = uid()
  const fCoord = uid(),
    fDav = uid(),
    fCn = uid(),
    fTeacherB = uid()

  type FacRow = typeof schema.faculty.$inferInsert
  const named: FacRow[] = [
    {
      id: fAdmin,
      authUserId: authId("dev.admin@vit.edu.in"),
      firstName: "Asha",
      lastName: "Deshpande",
      employeeId: "VIT0001",
      email: "dev.admin@vit.edu.in",
      department: "EXCS",
      role: "super_admin",
    },
    {
      id: fHodExcs,
      authUserId: authId("dev.hod.excs@vit.edu.in"),
      firstName: "Ravi",
      lastName: "Kulkarni",
      employeeId: "VIT0002",
      email: "dev.hod.excs@vit.edu.in",
      department: "EXCS",
      role: "hod",
    },
    {
      id: fHodExtc,
      authUserId: authId("dev.hod.extc@vit.edu.in"),
      firstName: "Sunita",
      lastName: "Rane",
      employeeId: "VIT0003",
      email: "dev.hod.extc@vit.edu.in",
      department: "EXTC",
      role: "hod",
    },
    {
      id: fHodCmpn,
      authUserId: null,
      firstName: "Deepak",
      lastName: "Bhandari",
      employeeId: "VIT0008",
      email: "dev.hod.cmpn@vit.edu.in",
      department: "CMPN",
      role: "hod",
    },
    {
      id: fCoord,
      authUserId: authId("dev.coordinator@vit.edu.in"),
      firstName: "Priya",
      lastName: "Nair",
      employeeId: "VIT0004",
      email: "dev.coordinator@vit.edu.in",
      department: "EXCS",
      role: "faculty",
    },
    {
      id: fDav,
      authUserId: authId("dev.teacher.dav@vit.edu.in"),
      firstName: "Mandar",
      lastName: "Patil",
      employeeId: "VIT0005",
      email: "dev.teacher.dav@vit.edu.in",
      department: "EXCS",
      role: "faculty",
    },
    {
      id: fCn,
      authUserId: authId("dev.teacher.cn@vit.edu.in"),
      firstName: "Kavita",
      lastName: "Joshi",
      employeeId: "VIT0006",
      email: "dev.teacher.cn@vit.edu.in",
      department: "EXCS",
      role: "faculty",
    },
    {
      id: fTeacherB,
      authUserId: authId("dev.teacher.b@vit.edu.in"),
      firstName: "Imran",
      lastName: "Shaikh",
      employeeId: "VIT0007",
      email: "dev.teacher.b@vit.edu.in",
      department: "EXCS",
      role: "faculty",
    },
  ]

  // Enough other staff that the faculty table, its filters and the appointment
  // pickers have a realistic amount to sift through.
  const bulkFaculty: FacRow[] = []
  let empNo = 100
  for (const d of DEPTS) {
    for (let i = 0; i < 16; i++) {
      const first = pick(FIRST)
      const last = pick(LAST)
      empNo++
      bulkFaculty.push({
        id: uid(),
        authUserId: null,
        firstName: first,
        lastName: last,
        employeeId: `VIT0${empNo}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${empNo}@vit.edu.in`,
        department: d.code,
        role: "faculty",
      })
    }
  }
  await insertAll(schema.faculty, [...named, ...bulkFaculty])

  await db.insert(schema.deptAppointments).values([
    { deptCode: "EXCS", facultyId: fHodExcs, appointment: "hod" },
    { deptCode: "EXTC", facultyId: fHodExtc, appointment: "hod" },
    { deptCode: "CMPN", facultyId: fHodCmpn, appointment: "hod" },
  ])

  // The coordinator coordinates and does not teach; the teachers teach and do
  // not coordinate. Keeping them apart is what makes it obvious when a rule
  // that should be the coordinator's has leaked to everybody on the class.
  type AssignRow = typeof schema.facultyClassAssignments.$inferInsert
  const assignments: AssignRow[] = [
    { facultyId: fCoord, classId: classA, role: "academic_coordinator" },
    { facultyId: fDav, classId: classA, role: "tr" },
    { facultyId: fCn, classId: classA, role: "tr" },
    { facultyId: fTeacherB, classId: classB, role: "academic_coordinator" },
  ]
  // Most other classes get a coordinator; a few are deliberately left unstaffed
  // so the HOD's department health has a real gap to report.
  const staffed = classes.filter((c) => c.id !== classA && c.id !== classB)
  staffed.forEach((c, i) => {
    if (i % 5 === 0) return
    const pool = bulkFaculty.filter((f) => f.department === c.departmentCode)
    if (pool.length === 0) return
    assignments.push({
      facultyId: pool[i % pool.length].id!,
      classId: c.id,
      role: "academic_coordinator",
    })
  })
  await insertAll(schema.facultyClassAssignments, assignments)

  // ── courses: one set per department per cohort ─────────────────────────
  type CourseRow = typeof schema.courses.$inferInsert & { id: string }
  const courses: CourseRow[] = []
  for (const d of DEPTS) {
    for (const c of COHORTS) {
      for (const [suffix, name, type] of SUBJECTS[c.year]) {
        const practical = type === "practical"
        courses.push({
          id: uid(),
          courseCode: `${d.prefix}${suffix}`,
          courseName: name,
          departmentCode: d.code,
          courseType: type,
          credits: practical ? 1 : 4,
          maxIsa: practical ? 50 : 20,
          maxMse: practical ? 0 : 30,
          maxEse: 50,
          maxTotal: 100,
          year: c.year,
        })
      }
    }
  }
  await insertAll(schema.courses, courses)
  const courseFor = (dept: string, year: string, suffix: string) =>
    courses.find(
      (c) =>
        c.departmentCode === dept &&
        c.year === year &&
        c.courseCode.endsWith(suffix)
    )!

  // ── offerings ──────────────────────────────────────────────────────────
  type OffRow = typeof schema.courseOfferings.$inferInsert & { id: string }
  const offerings: OffRow[] = []
  const semesterOf = (admissionYear: number) =>
    COHORTS.find((c) => c.admissionYear === admissionYear)!.semester
  const yearOf = (admissionYear: number) =>
    COHORTS.find((c) => c.admissionYear === admissionYear)!.year

  for (const cls of classes) {
    const year = yearOf(cls.admissionYear)
    const teachers = bulkFaculty.filter(
      (f) => f.department === cls.departmentCode
    )
    SUBJECTS[year].forEach(([suffix], i) => {
      const course = courseFor(cls.departmentCode, year, suffix)
      // Roughly one subject in six has nobody on it, which is the shape of a
      // department mid-allocation and what the attention inbox is for.
      const unstaffed = (i + cls.division.charCodeAt(0)) % 6 === 0
      offerings.push({
        id: uid(),
        courseId: course.id,
        classId: cls.id,
        facultyId:
          unstaffed || teachers.length === 0
            ? null
            : teachers[i % teachers.length].id!,
        semester: semesterOf(cls.admissionYear),
      })
    })
  }
  // The focus class is wired by hand rather than by the rule above.
  const focus = offerings.filter((o) => o.classId === classA)
  const oDav = focus[0],
    oCn = focus[1],
    oMl = focus[2],
    oLab = focus[3]
  oDav.facultyId = fDav
  oCn.facultyId = fCn
  oMl.facultyId = null // nobody teaches it: top of the attention inbox
  oLab.facultyId = fDav
  await insertAll(schema.courseOfferings, offerings)

  // ── students ───────────────────────────────────────────────────────────
  type StuRow = typeof schema.students.$inferInsert & { id: string }
  const students: StuRow[] = []
  const idsA: string[] = []

  for (const cls of classes) {
    const year = yearOf(cls.admissionYear)
    const isFocus = cls.id === classA
    const size = isFocus ? 62 : 55 + Math.floor(rand() * 12)
    for (let i = 0; i < size; i++) {
      const id = uid()
      const roll = `${String(cls.admissionYear).slice(2)}${cls.branchCode}${cls.division}${String(i + 1).padStart(4, "0")}`
      // The first two of the focus class are personas, so the switcher can
      // become them; the rest are unclaimed, which is the normal state of a
      // roster before a cohort signs in.
      const persona =
        isFocus && i === 0
          ? "dev.student@vit.edu.in"
          : isFocus && i === 1
            ? "dev.student.fresh@vit.edu.in"
            : null
      if (isFocus) idsA.push(id)
      students.push({
        id,
        authUserId: persona ? authId(persona) : null,
        firstName: persona ? (i === 0 ? "Neha" : "Omkar") : pick(FIRST),
        lastName: persona ? (i === 0 ? "Bhosale" : "Sawant") : pick(LAST),
        rollNumber: roll,
        email: persona ?? `${roll.toLowerCase()}@vit.edu.in`,
        department: cls.departmentCode,
        division: cls.division,
        year,
        classKey: cls.classKey,
      })
    }
  }
  await insertAll(schema.students, students)

  // ── marks, in three deliberately different states ──────────────────────
  //
  // DAV is finished, locked and published, so the student persona has a real
  // result and an SGPI to read. Publication now requires every active student
  // to be complete, so this has to be the whole roster — a seed that skipped
  // one would be refused, which is the rule working.
  type MarkRow = typeof schema.marks.$inferInsert
  const marks: MarkRow[] = idsA.map((studentId, i) => ({
    courseOfferingId: oDav.id,
    studentId,
    isa: 11 + (i % 10),
    mse1: 16 + (i % 15),
    mse2: 18 + (i % 13),
    ese: 24 + (i % 27),
    recordedByFacultyId: fDav,
  }))
  // CN is mid-term: ISA for everybody, nothing else. This is what "provisional"
  // and "In progress" are for, and it keeps the dashboard's completion count
  // honest — 62 rows touched, 0 complete.
  marks.push(
    ...idsA.map((studentId, i) => ({
      courseOfferingId: oCn.id,
      studentId,
      isa: 9 + (i % 12),
      mse1: null,
      mse2: null,
      ese: null,
      recordedByFacultyId: fCn,
    }))
  )
  await insertAll(schema.marks, marks)

  await db.insert(schema.marksLocks).values(
    (["isa", "mse", "ese"] as const).map((component) => ({
      courseOfferingId: oDav.id,
      component,
      isLocked: true,
      lockedByFacultyId: fDav,
      lockedAt: now,
    }))
  )
  await db
    .update(schema.courseOfferings)
    .set({ publishedAt: now, publishedByFacultyId: fCoord })
    .where(eq(schema.courseOfferings.id, oDav.id))

  // ── attendance ─────────────────────────────────────────────────────────
  // A fortnight of class registers and one subject register, with today left
  // empty on purpose so the attention inbox has a register to ask for the
  // moment you sign in.
  type AttRow = typeof schema.attendance.$inferInsert
  const attendance: AttRow[] = []
  for (let d = 1; d <= 14; d++) {
    const day = daysAgo(d)
    // No registers at the weekend, so the percentages read like a real term.
    if ([0, 6].includes(new Date(day).getDay())) continue
    idsA.forEach((studentId, i) => {
      attendance.push({
        studentId,
        classId: classA,
        courseOfferingId: null,
        sessionDate: day,
        sessionSlot: "1",
        status: rand() < 0.12 ? "absent" : rand() < 0.04 ? "late" : "present",
        recordedByFacultyId: fCoord,
      })
      // One student is deliberately short of the 75% rule, so the student view
      // has a real warning to show rather than a uniform wall of green.
      if (i === 3) {
        attendance[attendance.length - 1].status =
          d % 3 === 0 ? "present" : "absent"
      }
    })
  }
  for (const d of [1, 3, 6, 8]) {
    const day = daysAgo(d)
    if ([0, 6].includes(new Date(day).getDay())) continue
    idsA.forEach((studentId) => {
      attendance.push({
        studentId,
        classId: classA,
        courseOfferingId: oDav.id,
        sessionDate: day,
        sessionSlot: "3",
        status: rand() < 0.15 ? "absent" : "present",
        recordedByFacultyId: fDav,
      })
    })
  }
  await insertAll(schema.attendance, attendance)

  // ── a decision waiting for somebody ────────────────────────────────────
  await db.insert(schema.enrollmentRequests).values({
    authUserId: authId("dev.unbound@vit.edu.in")!,
    rollNumber: "23108A0099",
    firstName: "Rohit",
    lastName: "Gaikwad",
    email: "dev.unbound@vit.edu.in",
    classId: classA,
    status: "pending",
  })

  const unstaffed = offerings.filter((o) => o.facultyId === null).length
  console.log(`
seeded
  departments        ${DEPTS.length}  (EXCS, CMPN, EXTC)
  classes            ${classes.length}  — FE / SE / TE / BE across every division
  faculty            ${named.length + bulkFaculty.length}
  students           ${students.length}
  offerings          ${offerings.length}, of which ${unstaffed} have no teacher
  marks              ${marks.length}
  attendance         ${attendance.length}
  enrolment requests 1 pending on ${DEV_CLASS_A}

BE EXCS A is the class wired end to end:
  EC33T  published — the student persona has a result and an SGPI
  EC34T  ISA only — provisional, "In progress", 0 of 62 complete
  EC35T  no teacher — top of the attention inbox
  EC36P  untouched lab
  today's register deliberately not taken

Pick who you are from the switcher beside the VOSS mark in the sidebar.
`)
  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end()
  process.exit(1)
})
