Verified against the real files. The sub-designs' grounding is accurate: `faculty.isAdmin` boolean, `students` with no `classId`, `session.ts` binary role derivation, and the 5-line barrel all match. Here is the consolidated plan.

---

# VERP — Consolidated Architecture & Phased Build Plan

## 1. Architecture summary

VERP becomes a 4-tier RBAC ERP (super_admin → HOD → faculty/TR → student) layered onto the existing VOSS-OIDC + better-auth binding model, without touching the un-forgeable anchor: a student's identity is still bound only on their VOSS-verified `@vit.edu.in` email, never a typed field. The load-bearing insight unifying all four sub-designs is that **the roll number is a self-describing class key**: the 6-char prefix `23·108·A` (`admissionYear·branchCode·division`) IS the class identity, so roll→class routing is a pure offline function, class membership is time-stable across the July FE→SE→TE→BE rollover, and the TR onboarding queue isolates via a plain `classId` foreign key with zero string matching. Role stays derived from the binding but gains an explicit tier (`faculty.role` enum) plus per-request scope facts (dept codes, class ids) resolved once in `getSessionUser()`; capabilities are FIXED defaults-in-code overlaid by a single super-admin-editable `permission_overrides` table. Isolation is enforced first at the app layer (a lint-guarded scoped-query boundary + `authorize()` at every mutation, complete and shippable today on `neon-http`) and later hardened with Postgres RLS via a dedicated `neon-serverless` WebSocket pool for tenant tables only — never by forcing session GUCs onto the stateless HTTP driver. Students enter through self-registration + roll-routed TR approval, replacing roster-first upload.

---

## 2. Final consolidated schema

`drizzle-kit push` only (no migration files, no seed). New files added to `src/db/schema/`, wired into `index.ts` barrel + `relations.ts`. Conventions kept: `uuid().primaryKey().defaultRandom()`, `text` FKs to `user.id`, `withTimezone` timestamps `defaultNow()`, `isActive` soft-delete, partial-unique via `.where(sql\`…\`)`.

### Enums (`enums.ts`)
- `facultyRoleEnum` = `super_admin | hod | faculty` — **replaces `faculty.isAdmin`** (RESOLVED: pgEnum, not `text` — type-safe, push emits `CREATE TYPE`).
- `deptAppointmentEnum` = `hod | coordinator`
- `classRoleEnum` = `tr | coordinator` (coordinator is a scope, **not** a 5th tier)
- `enrollmentStatusEnum` = `pending | approved | rejected | unrouted`
- `overrideSubjectEnum` = `role | user`; `overrideEffectEnum` = `grant | deny`
- `attendanceStatusEnum` = `present | absent | late | excused`

### Tables

| Table (file) | Key columns | Relations / constraints |
|---|---|---|
| **departments** (`departments.ts`) | `code` text **PK** (IT/CMPN/EXTC/BIOMED/EXCS), `name`, `hodFacultyId` uuid? → faculty (set null, denorm), `isActive` | → many classes, many deptAppointments |
| **deptAppointments** (`appointments.ts`) | `deptCode` → departments.code (cascade), `facultyId` → faculty (cascade), `appointment` enum, `assignedBy` → faculty (set null), `isActive` | **partial-unique** `(deptCode, appointment) WHERE is_active` = one live HOD + one live coordinator per dept; index `(facultyId, isActive)` |
| **classes** (`classes.ts`) | `classKey` text **unique** (`"2023-108-A"`), `admissionYear` int, `branchCode` text (`"108"`), `departmentCode` → departments.code, `division` text, `coordinatorFacultyId` uuid?, `isActive` | index `(departmentCode)` for HOD scope, index `(admissionYear, branchCode, division)`; RESOLVED below |
| **facultyClassAssignments** (`assignments.ts`) | `facultyId` → faculty, `classId` → classes, `role` enum (tr/coordinator), `assignedBy` → faculty (set null), `isActive` | **partial-unique** `(classId) WHERE role='tr' AND is_active` = one active TR/class; index `(facultyId, isActive)` drives TR scope |
| **faculty** EXTEND | `-isAdmin` → `+role` facultyRoleEnum default `faculty`; index `(role)` | + many assignments, many appointments |
| **students** EXTEND | `+classId` uuid? → classes (set null), index `(classId)` | + one class. **No status column** (RESOLVED) |
| **enrollmentRequests** (`onboarding.ts`) | `authUserId` → user (cascade), `rollNumber`, `firstName`, `lastName` default "", `email` (= verified session email, locked), `classId` uuid? → classes (set null; null=unrouted), `status` enum default `pending`, `reviewedByFacultyId` → faculty?, `reviewedAt`, `rejectionReason` | **partial-unique** `(authUserId) WHERE status IN ('pending','unrouted')` (RESOLVED); index `(classId, status)` = the TR-queue isolation index; index `(rollNumber)` |
| **attendance** (`attendance.ts`) | `studentId` → students, `classId` → classes (denorm for scope/RLS), `sessionDate` date, `sessionSlot` text, `status` enum, `recordedByFacultyId` → faculty? | **unique** `(studentId, sessionDate, sessionSlot)` = idempotent re-import; index `(classId, sessionDate)`, `(studentId)` |
| **marks** (`marks.ts`) | same shape: `studentId`, `classId`, `assessment` text, `score` numeric, `maxScore` numeric, `recordedByFacultyId` | **unique** `(studentId, assessment)` |
| **permissionOverrides** (`permissions.ts`) | `subjectType` enum, `subjectId` text (role name OR user.id, un-FK'd polymorphic), `capability` text, `effect` enum, `isActive`, `createdBy` → user?, `note` | **partial-unique** `(subjectType, subjectId, capability) WHERE is_active` = deterministic resolution |
| **auditLogs** | UNCHANGED (polymorphic `targetType`/`targetId`/`details` jsonb) | new action strings only |

### Resolved schema conflicts
- **Class key = cohort, never the year label** (data-model + onboarding + isolation agree; RBAC research's `unique(dept, year, division)` sketch is **rejected** — year drifts and rots every assignment at July rollover). The `TE-EXCS-A` label is computed at render via `expectedYear(admissionYear, now)`.
- **Store an explicit `classKey` text-unique column** (data-model's approach wins over isolation's composite-unique): the roll→class resolver is then a single indexed equality `WHERE class_key = ?`. `classKey` is built in the `createClass` query; do not add a redundant composite unique. Keep the plain `(admissionYear, branchCode, division)` index for cohort scans.
- **One-open-request partial-unique covers `('pending','unrouted')`** (onboarding wins over data-model/isolation's `pending`-only): unrouted is genuinely an open state; a student must not hold both.
- **HOD scope is `deptCodes: string[]`** (isolation's plural wins over RBAC's singular `department`): the org model is explicitly multi-HOD / multi-dept-ready via `dept_appointments`.
- **`students` keeps loose `department/division/year` text** and `faculty.department` text — intentionally NOT converted to FKs, preserving the portable roll-keyed core; `classes.departmentCode` is the FK'd scope path.

---

## 3. RBAC model

**Tier** (`faculty.role`): `super_admin | hod | faculty | student(implicit) | null(unbound)`. Coordinator = a `faculty` carrying a `coordinator` assignment row, not a tier.

**Capabilities**: a `Capability` string-literal union (`domain:action`, typo = build error) + a parallel `CAPABILITY_CATALOG` array the toggle UI renders from. Domains: `dept:*`, `hod:assign`, `class:*`, `assignment:*`, `faculty:*`, `student:*`, `onboarding:{request,read,approve,reject}`, `attendance:*`, `marks:*`, `audit:read`.

**Fixed defaults in code** (`src/lib/rbac.ts`, `DEFAULT_CAPABILITIES`):
- **super_admin** = wildcard (short-circuit, never enumerated, exempt from overrides — no row can lock out the door-holder).
- **hod** = organizes: `dept:read`, `class:*`, `assignment:*`, `faculty:*`, `student:{read,update,deactivate}`, `onboarding:read`, `attendance:read`, `marks:read`, `audit:read` — all dept-scoped. Deliberately **cannot** approve onboarding or write attendance.
- **faculty (TR)** = owns her class: `class:read`, `assignment:read`, `faculty:read`, `student:read`, `onboarding:{read,approve,reject}`, `attendance:{read,write,update}`, `marks:{read,write,update}` — class-scoped.
- **student** = self: `student:read`, `onboarding:request`, `attendance:read`, `marks:read`.

**Override layer** (`permission_overrides`, the ONLY RBAC table): a switchboard over code-defined switches, not a policy engine. Resolution precedence low→high, deterministic (partial-unique kills intra-level conflict): `default < role-override < user-override`, grant adds / deny removes.
```
effectiveCapabilities(role, overrides):
  super_admin → ALL_CAPS
  else: start DEFAULT_CAPABILITIES[role]; apply role overrides, then user overrides
```
Resolved once in `getSessionUser()` (one small SELECT), cached on `SessionUser`.

**Enforcement** — two functions:
- `can(user, cap)` — pure/sync, capability only → nav rendering + coarse gates (cosmetic).
- `authorize(user, cap, target?)` — async, capability **+ scope**, throws `ForbiddenError` → 403 → the real gate at every mutation. `inScope` resolves the target down to dept/class and checks against session scope facts; `classIdOf({rollNumber})` reuses `parseRollNumber` unchanged. **Every mutation loads the row, then re-asserts `row.classId ∈ scope.classIds`** — never trusts the id in the request; the visible queue is not the gate.

`SessionUser` extends to `{ role: super_admin|hod|faculty|student|null, facultyId, studentId, deptCodes: string[], classIds: string[], capabilities: ReadonlySet<Capability> }`.

**New feature capability** = a deploy (add string to union + catalog + wire `authorize()` at the call site); it then appears automatically in the super_admin matrix, off-by-default, one toggle to grant. Overrides can only toggle capabilities that already exist and are enforced somewhere.

---

## 4. Isolation approach (chosen, with the neon-http trade-off)

**Primary layer, ships Phase 1 — a scoped-query boundary, complete on its own.** Split `src/db/queries/` into `unscoped/` (auth, self-lookups, the `bind.ts` path) and `scoped/` (every tenant-table read). Each `scoped/` function takes `scope: Scope` as its first arg and injects the WHERE clause itself (super_admin → all; hod → `inArray(department, deptCodes)`; tr → `inArray(classId, classIds)`; student → `eq(id, studentId)`). Route/action code may import only from `scoped/` for tenant tables — enforced by an ESLint `no-restricted-imports` rule, turning "forgot to scope" into a lint failure. Plus `authorize()` re-checking the loaded row at every mutation. Correct, driver-agnostic, testable, zero infra change.

**The neon-http trade-off, stated plainly.** `neon-http` + `transaction:false` = one stateless HTTP request per statement, no session state. The classic RLS pattern (`SET LOCAL app.tenant=…` then `SELECT`) **cannot work** — the GUC is gone by the next request — and Drizzle's `$withAuth()` is deprecated. Do **not** bolt `set_config` onto `neon-http`; it silently no-ops.

**Second layer, Phase 6 hardening — RLS via a dedicated `neon-serverless` WebSocket `Pool` for tenant tables only** (`students`, `classes`, `faculty_class_assignments`, `enrollment_requests`, `dept_appointments`, `attendance`, `marks`), while `neon-http` keeps serving auth/unscoped traffic. A better-auth JWT plugin mints a short-lived token carrying `{ sub, role, deptCodes, classIds, studentId }`; scoped access runs inside a WebSocket transaction with `set_config('request.jwt.claims', …, true)`. Tenant tables under `FORCE ROW LEVEL SECURITY`, accessed via a **non-owner, non-`BYPASSRLS`** app role (the #1 RLS footgun). Policies + roles live in a hand-maintained `src/db/rls.sql` applied in deploy (not `drizzle-kit push`). Highest-value policy: `enrollment_requests USING (classId = ANY(claims.classIds))`.

Sequenced, not both-now: Phase-1 boundary + `audit_logs` is a strong sufficient single layer for MVP; RLS is belt-and-suspenders before real PII at scale. **Founder flag** below.

---

## 5. Onboarding state machine

State on `enrollment_requests.status`; effective state = (row) × (bound `students` row?) × (session binding).

```
VOSS sign-in (email verified) → bind hook finds nothing → SIGNED_IN_UNCLAIMED (role=null, /unclaimed form)
   │ submitEnrollmentRequest(roll, first, last)   email := session.email (locked, re-parsed server-side)
   ├─ roll malformed / illegal division → stay UNCLAIMED, inline parser message, NO row written
   ├─ parses, class exists            → PENDING_TR   (status=pending, classId set)
   ├─ parses, known dept, no class    → UNROUTED      (classId=null) → surfaced to HOD of that dept
   └─ unknown branch (dept=null)      → UNROUTED      (classId=null) → surfaced to super_admin
PENDING_TR ─ TR approve → APPROVED→LINKED  (students row created + bound at creation)
           └ TR reject  → REJECTED (+reason) → student resubmits → PENDING_TR/UNROUTED
UNROUTED   ─ HOD creates matching class → sweep rerouteUnrouted(classId) → PENDING_TR
APPROVED   ─ next getSessionUser() sees bound row → LINKED (role=student)
```

**Prerequisite chain (must exist before any student can route):** P0 bootstrap (`SUPER_ADMIN_EMAILS` env → verified email with no faculty row creates `faculty{role:super_admin}` in `bindIdentity`) → P1 `createDepartment` → P2 `appointHod` (writes `faculty.role='hod'` + `dept_appointments` row + denorm in one action) → P3 HOD `createClass` (+ sweep) → P4 HOD `assignTr`.

**Four distinct fallbacks, never collapsed:** (a) malformed roll = no row, inline error; (b) unknown branch = unrouted → super_admin; (c) known dept, no class yet = unrouted → HOD (the pressure that makes HODs create classes; sweep re-routes on class creation); (d) class exists, no TR yet = still `pending` in the class queue, inherited by whoever becomes TR.

**Binding = reuse, not replace.** `approveEnrollment` re-asserts scope, inserts the `students` row with `email = request.email` (the verified anchor) and `authUserId = request.authUserId` set at creation, marks approved, audits. `bindIdentity` stays idempotent (row already carries authUserId+email → no-op on next login). Conflict guard: if the roll already maps to an active bound row, refuse — never overwrite (mirrors `bind.ts`'s takeover protection).

**Load-bearing invariants:** (1) email always `session.email`, never typed; (2) class key = cohort, never year label; (3) queue isolation = the `classId ∈ scope.classIds` WHERE + per-mutation row re-check; (4) unrouted never dropped — escalates and re-routes.

---

## 6. Role-scoped route / UI map

**Real path segments** (RESOLVED over route-groups and over isolation's single-shell-switch): the URL encodes scope, each segment `layout.tsx` authorizes at its boundary, out-of-scope = `redirect(homeFor(user))` before any query runs.

```
/dashboard              dispatcher → redirect(homeFor(user)), renders nothing
/dashboard/admin/*      super_admin   guard: role===super_admin
/dashboard/dept/*       HOD           guard: role===hod, scope on deptCodes
/dashboard/class/[id]/* TR/faculty    guard: role===faculty && classIds.includes(id)
/dashboard/me/*         student       guard: role===student
/unclaimed              self-registration form + pending status
```
`dashboard/layout.tsx` keeps the coarse gate (session + unbound→/unclaimed) and renders the shell; role gate = role-segment layout; scope gate = the `[classId]`/dept param layout (structural — a hand-typed URL bounces).

**Nav is scope-derived** (`navForUser(user)` replaces the 3 static arrays; a TR has no rendered link to dept/admin). `TeamSwitcher` → `ScopeSwitcher` (super_admin: "All Departments"; HOD: dept name + switch if multi; TR: class label or class switcher if multi; student: roll + class). Fix `use-user-role.ts` default-`admin`-while-loading → loading-gated null; `/api/me` returns role + capabilities + deptCodes + classIds (cosmetic).

**Overviews** — delete `section-cards.tsx` mock + `chart-area-interactive.tsx`; each role's RSC fetches scoped real counts into a `StatCards` row + one honest content block, every widget with a defined empty state (no fabricated numbers). super_admin: dept/faculty/student/pending counts + departments table. HOD: classes/faculty/students/unrouted + class grid. TR: roster/pending/sessions/marks + approval-preview + upload CTA. student: attendance%/subjects/latest marks + real trend (reuse `chart.tsx`) or empty state.

**Key screens:** super_admin departments+appointments+faculty+roles-matrix+audit; HOD classes(create + assign TR)+unrouted requests("Create this class" prefilled); TR requests queue (Sheet profile card: roll mono-badge, verified email, name, derived branch/division/year, optional soft roster-match badge) + roster + attendance/marks import (reuses `students/import` preview→commit + `xlsx-import.ts`); student self view. `/unclaimed` = live roll validation showing derived confirmation chips + locked verified email → submit → pending/unrouted/rejected status inside the app shell.

---

## 7. Phased build plan

### Phase 1 — Foundation: schema, RBAC engine, bootstrap, de-mock
**Deliverable:** all schema + the authorization core + real login routing, no mock data.
- **Add** `src/db/schema/{enums,departments,appointments,classes,assignments,onboarding,attendance,marks,permissions}.ts`; **edit** `faculty.ts` (`isAdmin`→`role`), `students.ts` (`+classId`), `relations.ts`, `index.ts` barrel. Run `drizzle-kit push` (accept the `is_admin` drop — no prod data; **hand-verify partial-unique indexes landed**).
- **Add** `src/lib/rbac.ts` (`Capability` union, `CAPABILITY_CATALOG`, `DEFAULT_CAPABILITIES`, `effectiveCapabilities`, `can`, `authorize`, `inScope`) and `src/lib/class-key.ts` (`classKeyFromRoll`, reuses `roll-number.ts`).
- **Edit** `src/lib/session.ts` — extend `SessionUser` (role union + deptCodes + classIds + capabilities), resolve scope + overrides once; migrate `isStaff`/`role==="admin"` call sites (`dashboard/audit`, import route + 2 API routes, sidebar, `use-user-role.ts`).
- **Edit** `src/lib/bind.ts` — `SUPER_ADMIN_EMAILS` bootstrap seam (P0); verify no-op path for create-at-approval rows.
- **Split** `src/db/queries/` → `scoped/` + `unscoped/`; add ESLint `no-restricted-imports`.
- **Rewrite** `dashboard/page.tsx` → dispatcher + `src/lib/nav.ts` (`homeFor`); **delete** `section-cards.tsx` mock + `chart-area-interactive.tsx` + starter `nav-documents/nav-projects`.
- **Demoable:** a `SUPER_ADMIN_EMAILS` login lands on a real, empty-state admin overview; every other role routes correctly; zero mock numbers anywhere.

### Phase 2 — super_admin console (the door to everything)
**Deliverable:** super_admin can stand up the whole org.
- **Add** `dashboard/admin/{layout,page}.tsx` + `departments/`, `faculty/`, `roles/`, `audit/` (reuse `DataTableView`, `Dialog`, `Command`, `AlertDialog`, `Switch`, `Tabs`).
- Server actions: `createDepartment`, `deactivateDepartment`, `createFaculty`, `updateFacultyRole`, `appointHod`/`appointCoordinator`, `setPermissionOverride` — each opens with `authorize()`.
- Roles matrix renders from `CAPABILITY_CATALOG` × `{hod,faculty,student}`, writes `permission_overrides`; per-user exceptions tab.
- **Demoable:** super_admin creates the 5 branches, adds faculty, mints an HOD, flips a capability toggle and sees it take effect next request.

### Phase 3 — HOD dept flow
**Deliverable:** HOD builds their dept's classes and staffs them.
- **Add** `dashboard/dept/{layout(scope on deptCodes),page}.tsx` + `classes/`, `classes/[id]/`, `faculty/`, `students/`, `requests/` (unrouted).
- Server actions: `createClass` (builds `classKey`, runs `rerouteUnrouted` sweep), `assignTr`, `assignCoordinator` — dept-scoped `authorize()`. Class-create dialog drives division options from `DIVISIONS_BY_BRANCH` (C only for IT/CMPN), branch locked to HOD dept.
- **Demoable:** HOD creates TE-EXCS-A, assigns a TR; the unrouted-requests list offers a prefilled "Create this class".

### Phase 4 — Onboarding: self-registration + TR approval
**Deliverable:** the roll-routed student entry, end to end.
- **Rework** `unclaimed/page.tsx` → self-registration form (live roll validation, derived chips, locked verified email) + pending/unrouted/rejected status.
- Server actions: `submitEnrollmentRequest` (re-parse server-side, resolve class, conflict + one-open guards), `approveEnrollment` (row load → scope re-check → create bound `students` row → mark approved), `rejectEnrollment`.
- **Add** `dashboard/class/[classId]/{layout(scope gate),page,requests,students}.tsx`; TR queue = scoped `enrollment_requests WHERE classId ∈ scope AND status='pending'`; Sheet profile card + Approve/Reject.
- **Demoable:** a student self-registers → appears only in the correct TR's queue → TR approves → student's next login lands on the student dashboard as LINKED.

### Phase 5 — Attendance, marks, student dashboard
**Deliverable:** TRs record, students see their own.
- **Add** `dashboard/class/[classId]/{attendance,marks}.tsx` reusing the `students/import` preview→commit pattern + `xlsx-import.ts`, writing scoped to the class (idempotent unique upsert). Import commit actions gated by `attendance:write`/`marks:write`.
- **Add** `dashboard/me/{layout,page,attendance,marks}.tsx` — own attendance % ring, subject tables, real `chart.tsx` trend or empty state.
- **Demoable:** TR uploads an attendance CSV; the student sees their own attendance/marks, isolated to self.

### Phase 6 — DB-level RLS hardening (belt-and-suspenders)
**Deliverable:** Postgres-enforced isolation as a second layer.
- better-auth JWT plugin minting `{sub,role,deptCodes,classIds,studentId}`; second Drizzle instance on `neon-serverless` `Pool` for tenant tables; `set_config('request.jwt.claims',…,true)` in a WebSocket transaction.
- **Add** `src/db/rls.sql` (FORCE RLS, non-`BYPASSRLS` app role, policies), applied in deploy/CI.
- **Demoable:** a deliberately mis-scoped query still returns nothing for out-of-scope rows — isolation holds even if an app-layer scope call is ever miswritten.

---

## 8. Open risks & founder decisions

1. **DB RLS: Phase 6 or day-one?** All research recommends sequencing (app-layer boundary is sufficient for MVP; RLS costs a second WebSocket driver, JWT plumbing, out-of-band SQL, Vercel cold-start tax). **Founder call:** if DB enforcement is non-negotiable before holding real PII, promote Phase 6 ahead of Phase 5 — but never onto `neon-http`.
2. **`faculty.isAdmin` → `role` is the one destructive push.** Safe only because no prod data exists. Confirm before first `push` against any populated DB.
3. **Partial-unique indexes** (`WHERE is_active` / `WHERE status IN(...)` / `WHERE role='tr'`) — `drizzle-kit push` occasionally under-detects partial-index drift. Hand-verify all six landed after Phase 1 push; this is the one thing to check by hand.
4. **`SUPER_ADMIN_EMAILS` bootstrap** is the single door-opener seam (no seed data). Confirm the env list is the intended mechanism and who's on it.
5. **One TR per class** is assumed (partial-unique enforces it); a class may separately carry a coordinator. Confirm no team-teaching / multi-TR case is needed before locking the constraint.
6. **`marks` CSV shape** — attendance has a proven 19-sheet workbook; marks does not yet. The `assessment`/`score`/`maxScore` columns are a reasonable default but need a real marks file to validate the importer's fuzzy mapping before Phase 5.
7. **Coordinator capabilities** are currently empty-by-default (a plain faculty until granted via overrides). Confirm whether coordinators need any baked-in default caps or stay override-only.