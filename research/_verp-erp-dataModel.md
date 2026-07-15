I have complete ground truth. Here is the data-model architecture.

---

# VERP Target Data Model — Drizzle Schema (Postgres, `drizzle-kit push`)

Grounded in the real repo. All new tables are additive files under `src/db/schema/`, wired into `schema/index.ts` (barrel `export *`) and `schema/relations.ts`. Two in-place edits to existing tables (`faculty`, `students`) are called out in §RECONCILE. Conventions kept from the codebase: `uuid().primaryKey().defaultRandom()`, `text` FKs to `user.id`, `withTimezone` timestamps `defaultNow()`, `isActive` soft-delete, per-column snake_case names, `index(...)` in the table callback.

## Core decision: a class is keyed on the COHORT, not the year label

The target calls a class `(year, branch, division)` e.g. `TE-EXCS-A`, but **year drifts** — this July every TE becomes BE and every `classId`/TR-assignment would silently rot. So the stored key is the roll number's own 6-char prefix, and the `TE` label is derived at render time via the existing `expectedYear()`:

```
classKey = `${admissionYear}-${branchCode}-${division}`   // "2023-108-A"
```

`parseRollNumber("23108A0054")` already returns `{admissionYear:2023, branchCode:"108", division:"A", department:"EXCS"}` — so **roll → class is a pure function + one indexed equality lookup**, no composite matching, and membership is time-stable (the cohort moves FE→SE→TE→BE together, the roll never changes). `branchCode` is the class key part (103 and 108 are distinct codes) while `department` ("EXCS") is carried alongside for HOD-level scoping.

## New enums (`src/db/schema/enums.ts`)

```ts
import { pgEnum } from "drizzle-orm/pg-core"

// The 4-layer RBAC tier, authoritative on the faculty row. Replaces faculty.isAdmin.
// Student is the 4th tier, stays implicit (a bound students row), as session.ts does today.
export const facultyRoleEnum = pgEnum("faculty_role", ["super_admin", "hod", "faculty"])

// Org appointment a super_admin grants per department (scope, not tier).
export const deptAppointmentEnum = pgEnum("dept_appointment", ["hod", "coordinator"])

// A faculty's role within one class (scope). "coordinator" is NOT a 5th tier.
export const classRoleEnum = pgEnum("class_role", ["tr", "coordinator"])

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "pending", "approved", "rejected", "unrouted",
])

export const overrideSubjectEnum = pgEnum("override_subject", ["role", "user"])
export const overrideEffectEnum = pgEnum("override_effect", ["grant", "deny"])

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present", "absent", "late", "excused",
])
```

`pgEnum` is created by `drizzle-kit push` (it emits `CREATE TYPE`). Adding a value later is push-safe; **removing/reordering** a value is a manual `ALTER TYPE` — flag for future.

---

## 1. `departments` — the 5 branches (`schema/departments.ts`)

Single source of truth for BIOMED, EXTC, EXCS, IT, CMPN. Keyed on `code` (text PK) so classes/faculty scope by a stable natural key, not a uuid.

```ts
import { pgTable, text, timestamp, boolean, uuid, index } from "drizzle-orm/pg-core"
import { faculty } from "./faculty"

export const departments = pgTable(
  "departments",
  {
    code: text("code").primaryKey(),                    // "IT" | "CMPN" | "EXTC" | "BIOMED" | "EXCS"
    name: text("name").notNull(),
    // Convenience denorm of the current HOD; source of truth is dept_appointments.
    hodFacultyId: uuid("hod_faculty_id").references(() => faculty.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("departments_is_active_idx").on(t.isActive)],
)
```
- **PK** `code`. **FK** `hodFacultyId → faculty.id` (nullable, `set null`). **Rationale:** the 5 branches as a first-class table so `classes`/HOD scope reference a stable code instead of loose `text department`.
- **Relations:** many `classes`, many `dept_appointments`.

## 2. `dept_appointments` — super_admin appoints HOD + coordinator per dept (`schema/appointments.ts`)

Multi-HOD-ready org hierarchy: **which** dept an HOD leads is scope, kept off the faculty row.

```ts
import { pgTable, text, timestamp, boolean, uuid, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { deptAppointmentEnum } from "./enums"
import { departments } from "./departments"
import { faculty } from "./faculty"

export const deptAppointments = pgTable(
  "dept_appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deptCode: text("dept_code").notNull().references(() => departments.code, { onDelete: "cascade" }),
    facultyId: uuid("faculty_id").notNull().references(() => faculty.id, { onDelete: "cascade" }),
    appointment: deptAppointmentEnum("appointment").notNull(),   // "hod" | "coordinator"
    assignedBy: uuid("assigned_by").references(() => faculty.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One active HOD (and one active coordinator) per department.
    uniqueIndex("dept_appointments_one_active_idx")
      .on(t.deptCode, t.appointment)
      .where(sql`is_active`),
    index("dept_appointments_faculty_idx").on(t.facultyId, t.isActive),
  ],
)
```
- **FKs** `deptCode → departments.code`, `facultyId → faculty.id`, `assignedBy → faculty.id`. **Partial-unique** `(deptCode, appointment) WHERE is_active` → one live HOD per dept. **Rationale:** decouples the RBAC *tier* (`faculty.role='hod'`) from the *scope* (which dept), so a person's HOD-dept(s) come from here.
- **Invariant** (enforced in the appoint-HOD server action, not the DB): appointing an HOD writes both `faculty.role='hod'` and a `hod` row here in one action.

## 3. `classes` — HOD creates these, cohort-keyed (`schema/classes.ts`)

A class = `(admissionYear, branchCode, division)`, e.g. `2023-108-A` rendered `TE-EXCS-A`.

```ts
import { pgTable, text, integer, timestamp, boolean, uuid, index, uniqueIndex } from "drizzle-orm/pg-core"
import { departments } from "./departments"
import { faculty } from "./faculty"

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The natural key = `${admissionYear}-${branchCode}-${division}`. Unique -> the roll->class resolver.
    classKey: text("class_key").notNull().unique(),
    admissionYear: integer("admission_year").notNull(),      // 2023
    branchCode: text("branch_code").notNull(),               // "108" (103 & 108 distinct)
    departmentCode: text("department_code").notNull().references(() => departments.code),
    division: text("division").notNull(),                    // "A"
    coordinatorFacultyId: uuid("coordinator_faculty_id").references(() => faculty.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("classes_department_idx").on(t.departmentCode),    // HOD scope
    index("classes_cohort_idx").on(t.admissionYear, t.branchCode, t.division),
    index("classes_is_active_idx").on(t.isActive),
  ],
)
```
- **Unique** `classKey` — the single equality the onboarding router hits (`WHERE class_key = ?`). **FK** `departmentCode → departments.code` (HOD scope), `coordinatorFacultyId → faculty.id`. **Rationale:** cohort key = time-stable + roll-derivable; year label is computed, never stored (avoids the July-rollover rot).
- **Note:** `classKey` is built in the `createClass` query (`${admissionYear}-${branchCode}-${division}`), so its uniqueness also enforces "one `TE-EXCS-A`". Do **not** add a redundant composite unique — `classKey` covers it.
- **Relations:** one `department`, one coordinator `faculty`, many `faculty_class_assignments`, many `students`, many `enrollment_requests`.

## 4. `faculty_class_assignments` — TR / coordinator → class (`schema/assignments.ts`)

The map that gives a TR her scope. `SessionUser.classIds` = active rows here for that faculty.

```ts
import { pgTable, timestamp, boolean, uuid, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { classRoleEnum } from "./enums"
import { faculty } from "./faculty"
import { classes } from "./classes"

export const facultyClassAssignments = pgTable(
  "faculty_class_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facultyId: uuid("faculty_id").notNull().references(() => faculty.id, { onDelete: "cascade" }),
    classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    role: classRoleEnum("role").notNull(),                   // "tr" | "coordinator"
    assignedBy: uuid("assigned_by").references(() => faculty.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One active TR per class (a class may still have a separate coordinator row).
    uniqueIndex("fca_one_active_tr_idx").on(t.classId).where(sql`role = 'tr' and is_active`),
    index("fca_faculty_idx").on(t.facultyId, t.isActive),    // drives the TR's scope query
    index("fca_class_idx").on(t.classId),
  ],
)
```
- **FKs** `facultyId → faculty.id`, `classId → classes.id`, `assignedBy → faculty.id`. **Partial-unique** `(classId) WHERE role='tr' AND is_active` → one TR per class. **Rationale:** the isolation source — a TR sees only rows whose `classId ∈ scope.classIds`.
- **Relations:** one `faculty`, one `class`.

## 5. `faculty` — EXTEND (`schema/faculty.ts`, in-place edit)

Replace the coarse `isAdmin` boolean with the RBAC tier enum. Nothing else on the row changes; HOD-dept and TR-class scope live in the two tables above.

```ts
// REMOVE:  isAdmin: boolean("is_admin").notNull().default(false),
// ADD:
role: facultyRoleEnum("role").notNull().default("faculty"),   // "super_admin" | "hod" | "faculty"
// + index("faculty_role_idx").on(table.role)
```
- **Rationale:** `isAdmin` (2-state) cannot express super_admin vs HOD vs plain faculty; `role` is the single tier every guard reads.
- **Relations (add):** many `faculty_class_assignments`, many `dept_appointments` (as appointee).

## 6. `students` — EXTEND (`schema/students.ts`, in-place edit)

Add the scope FK. Keep `rollNumber` the immutable truth and the loose `department/division/year` text columns as-is — they stay for the **portable roll-keyed core** (other VOSS products, import cross-check, display) and are re-derivable, so the redundancy is deliberate.

```ts
// ADD:
classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),   // nullable; set at TR approval
// + index("students_class_id_idx").on(table.classId)
```
- **Rationale:** `classId` is the authoritative scoping FK (`students.classId ∈ scope.classIds`); it's set at approval and always re-derivable from `rollNumber`.
- **Onboarding "status" is intentionally NOT a column here.** A `students` row existing (with `isActive`) *is* "approved"; anything pending lives in `enrollment_requests`. Adding a status enum would (a) duplicate the request table and (b) couple the portable core to VERP's onboarding. **Flag:** if the orchestrator insists on the literal "onboarding status" column, it belongs in `enrollment_requests`, not `students`.
- **Relations (add):** one `class`.

## 7. `enrollment_requests` — self-registration awaiting TR approval (`schema/onboarding.ts`)

The roll-routed queue. `email` is the **verified `session.email`**, never user-typed (the un-forgeable anchor `bind.ts` already depends on).

```ts
import { pgTable, text, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { enrollmentStatusEnum } from "./enums"
import { user } from "./auth"
import { classes } from "./classes"
import { faculty } from "./faculty"

export const enrollmentRequests = pgTable(
  "enrollment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    rollNumber: text("roll_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email").notNull(),                          // = verified session email, locked
    // Resolved by parseRollNumber -> classKey at submit. Null = "unrouted" (HOD hasn't created the class).
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    status: enrollmentStatusEnum("status").notNull().default("pending"),
    reviewedByFacultyId: uuid("reviewed_by_faculty_id").references(() => faculty.id, { onDelete: "set null" }),  // decided_by
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One open request per person.
    uniqueIndex("enrollment_one_pending_idx").on(t.authUserId).where(sql`status = 'pending'`),
    index("enrollment_queue_idx").on(t.classId, t.status),   // THE TR-queue isolation index
    index("enrollment_roll_idx").on(t.rollNumber),
  ],
)
```
- **FKs** `authUserId → user.id`, `classId → classes.id` (nullable = unrouted → surfaced to HOD), `reviewedByFacultyId → faculty.id`. **Partial-unique** `(authUserId) WHERE status='pending'`. **Index** `(classId, status)` = the queue scan `WHERE classId ∈ scope.classIds AND status='pending'`. **Rationale:** roll-scoped isolation falls out of the `classId` FK; on approve, the server action creates the `students` row (`authUserId`, `email`, derived `dept/division/year`, `classId`) then `bindIdentity` is idempotent.
- **Relations:** one `authUser`, one `class`, one reviewer `faculty`.

## 8. `attendance` — per student per date/session, CSV-sourced (`schema/attendance.ts`)

```ts
import { pgTable, text, date, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core"
import { attendanceStatusEnum } from "./enums"
import { students } from "./students"
import { classes } from "./classes"
import { faculty } from "./faculty"

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),  // denorm for scope/RLS
    sessionDate: date("session_date").notNull(),
    sessionSlot: text("session_slot").notNull(),             // subject/period label from the CSV, e.g. "DBMS-P1"
    status: attendanceStatusEnum("status").notNull(),
    recordedByFacultyId: uuid("recorded_by_faculty_id").references(() => faculty.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Idempotent re-import: one row per student per slot per day.
    uniqueIndex("attendance_unique_idx").on(t.studentId, t.sessionDate, t.sessionSlot),
    index("attendance_class_date_idx").on(t.classId, t.sessionDate),  // TR class view
    index("attendance_student_idx").on(t.studentId),                  // student self view
  ],
)
```
- **FKs** `studentId → students.id`, `classId → classes.id` (denormalized so scope/RLS never joins to derive the class), `recordedByFacultyId → faculty.id`. **Unique** `(studentId, sessionDate, sessionSlot)` → re-uploading the same CSV upserts, never duplicates. **Rationale:** the write-side of TR authority + the read-side of the student dashboard, both scoped by `classId`.
- **Relations:** one `student`, one `class`, one recorder `faculty`.
- **Marks (parallel, `schema/marks.ts`):** identical shape — `studentId`, `classId`, `assessment` text (replaces `sessionSlot`), `score` numeric, `maxScore` numeric, `recordedByFacultyId`, unique `(studentId, assessment)`. The RBAC `marks:*` caps mirror `attendance:*`. Build alongside attendance; omitted in full here as the ROLE brief scopes to attendance.

## 9. `permission_overrides` — the super-admin toggle overlay (`schema/permissions.ts`)

The **only** RBAC table. Default capabilities per role stay FIXED IN CODE (a `DEFAULT_CAPABILITIES` map in `src/lib/rbac.ts` + a `Capability` string-literal union so a typo is a build error, per the locked decision). This table is the editable overlay layer only.

```ts
import { pgTable, text, timestamp, boolean, uuid, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { overrideSubjectEnum, overrideEffectEnum } from "./enums"
import { user } from "./auth"

export const permissionOverrides = pgTable(
  "permission_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: overrideSubjectEnum("subject_type").notNull(),   // "role" | "user"
    subjectId: text("subject_id").notNull(),                      // a role name ("faculty") OR user.id
    capability: text("capability").notNull(),                     // a Capability string, e.g. "attendance:delete"
    effect: overrideEffectEnum("effect").notNull(),               // "grant" | "deny"
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // <= 1 active row per (level, subject, capability) -> no grant-vs-deny conflict within a level.
    uniqueIndex("perm_override_active_idx")
      .on(t.subjectType, t.subjectId, t.capability)
      .where(sql`is_active`),
  ],
)
```
- **FK** `createdBy → user.id`. **Partial-unique** `(subjectType, subjectId, capability) WHERE is_active` — makes resolution deterministic (default < role-override < user-override, last write wins). **Rationale:** `effectiveCapabilities(role, overrides)` loaded once in `getSessionUser()`; super_admin is wildcard-exempt so no row can lock out the door-holder. **Not a policy engine** — `capability` must be a string the code already enforces via `authorize()`; the overlay toggles code-defined switches, it cannot invent enforcement.
- **`subjectId` is intentionally un-FK'd** (polymorphic: a role name or a user id), like `audit_logs.targetId`.

## 10. `audit_logs` — KEEP AS-IS

Already polymorphic (`targetType`/`targetId` text, `details` jsonb). New entities need only new `action`/`targetType` strings (`hod.appointed`, `class.created`, `assignment.created`, `enrollment.submitted`, `enrollment.approved`, `enrollment.rejected`, `permission.overridden`, `attendance.imported`). **No schema change.**

---

## ROLL NUMBER → `class_id` (the routing primitive)

Pure, offline, one indexed equality — no per-request rule config:

```ts
// src/lib/class-key.ts  (new, client-safe, reuses roll-number.ts unchanged)
import { parseRollNumber, type ParsedRoll } from "./roll-number"

export function classKeyFor(p: ParsedRoll): string {
  return `${p.admissionYear}-${p.branchCode}-${p.division}`   // "2023-108-A"
}
export function classKeyFromRoll(roll: string): string {
  return classKeyFor(parseRollNumber(roll))                   // throws on malformed roll (specific reason)
}

// resolver (query layer): SELECT ... FROM classes WHERE class_key = classKeyFromRoll(roll) AND is_active
//   found     -> attach classId to the enrollment_request (status 'pending', lands in that class's TR queue)
//   not found -> classId null, status 'unrouted' -> surfaced to the HOD of parse.department, never dropped
```

The 6-char roll prefix (`23108A…`) *is* the `class_key` minus the century — that identity is why "the TR of TE-EXCS-A sees only 23·108·A requests" needs zero string matching at query time: routing happens once at submit, isolation is then a plain `classId` FK filter.

---

## COMPLETE RELATION MAP (`schema/relations.ts` additions)

```ts
departments        → many(classes), many(deptAppointments); one(faculty as hod, hodFacultyId)
deptAppointments   → one(departments, deptCode), one(faculty, facultyId), one(faculty as assigner, assignedBy)
classes            → one(departments, departmentCode), one(faculty as coordinator, coordinatorFacultyId),
                     many(facultyClassAssignments), many(students), many(enrollmentRequests),
                     many(attendance)
facultyClassAssignments → one(faculty, facultyId), one(classes, classId), one(faculty as assigner, assignedBy)
faculty (EXTEND)   → + many(facultyClassAssignments), many(deptAppointments as appointee)
students (EXTEND)  → + one(classes, classId)
enrollmentRequests → one(user, authUserId), one(classes, classId), one(faculty as reviewer, reviewedByFacultyId)
attendance         → one(students, studentId), one(classes, classId), one(faculty as recorder, recordedByFacultyId)
permissionOverrides→ one(user as creator, createdBy)
auditLogs          → (unchanged) one(user, actorId)
```
All existing relations (`userRelations`, `studentsRelations→authUser`, `facultyRelations→authUser`, etc.) are **kept** — the new `.one/.many` entries are added to the same relation objects.

---

## RECONCILE with the existing schema via `drizzle-kit push` (no migration files)

1. **`faculty.isAdmin` → `faculty.role`** — the one destructive change. Push will offer to drop `is_admin` and add the `faculty_role` enum column (default `'faculty'`). No production data exists, so accept it. **Bootstrap the first super_admin** via a `SUPER_ADMIN_EMAILS` env check in `bindIdentity`: a verified email in that list with no faculty row → create a `faculty` row with `role='super_admin'` (single door-opener seam; no seed data, consistent with "data enters through the app"). Every `faculty.isAdmin` / `role === "admin"` call site (`session.ts`, `dashboard/audit/page.tsx`, import routes, `app-sidebar.tsx`, `use-user-role.ts`) migrates to the new `role`/`can()` checks — a code migration, not a schema one.

2. **`students.classId` add** — additive, nullable, `set null`. Zero risk; existing rows get `null` and are re-derivable from `rollNumber`.

3. **Loose `students.department` / `faculty.department` text vs new `departments` table** — **intentionally NOT converted to an FK.** Keeping them text preserves the portable roll-keyed core and avoids a backfill; `classes.departmentCode` is the FK'd scope path. No conflict; documented redundancy.

4. **7 new tables + `marks` + enums** — pure `CREATE TABLE` / `CREATE TYPE`, no conflicts (grep confirmed none exist).

5. **Partial-unique indexes** (`WHERE is_active` / `WHERE status='pending'` / `WHERE role='tr'`) — drizzle emits these via `.where(sql\`…\`)`; `drizzle-kit push` creates them as partial unique indexes on Postgres. Verify they land (push occasionally under-detects partial-index drift — if so, they are the one thing to hand-check after push).

6. **`drizzle.config.ts` `out: ./src/db/migrations`** is vestigial under push-only; leave it. New schema files must be added to `schema/index.ts` (`export * from "./enums" / "./departments" / …`) or drizzle won't see them.

7. **RLS is out of scope for push** — `drizzle-kit push` manages tables/indexes, **not** RLS policies or DB roles. App-level `authorize()` (the scoped-query boundary) is the Phase-1 isolation layer and ships complete; Phase-2 DB RLS goes in a hand-maintained `src/db/rls.sql` (via a `neon-serverless` WebSocket pool for tenant tables only — `neon-http` + `transaction:false` cannot carry the `set_config` JWT-claims pattern).

**New schema files to add:** `enums.ts`, `departments.ts`, `appointments.ts`, `classes.ts`, `assignments.ts`, `onboarding.ts`, `attendance.ts`, `marks.ts`, `permissions.ts`; **edit:** `faculty.ts`, `students.ts`, `relations.ts`, `index.ts`. **New lib:** `src/lib/class-key.ts` (reuses `roll-number.ts` unchanged).