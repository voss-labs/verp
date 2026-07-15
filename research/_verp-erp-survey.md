### CODEBASE MAP
# VERP Codebase Survey — Ground Truth

Read from `/Users/harshalmore31/code/voss/verp`. No `.preset/` exists (fresh start). Stack confirmed: Next.js 16.1.6, React 19.2.3, better-auth 1.6.23, drizzle-orm 0.45.1, `@neondatabase/serverless` neon-http, exceljs 4.4.0, zod 4. `drizzle-kit push` (config `out: ./src/db/migrations` but no migration files exist — push-only).

---

## (a) TABLES — every table + key columns

Schema lives in `src/db/schema/*.ts`, barrel-exported from `src/db/schema/index.ts`. Six tables total, all in four files.

**`src/db/schema/auth.ts`** (better-auth, do not touch structurally):
- `user` — id (text PK), name (NOT NULL), email (unique NOT NULL), emailVerified (bool), image, created/updatedAt.
- `session` — id, expiresAt, token (unique), ip, userAgent, userId → user (cascade).
- `account` — id, accountId, providerId, userId → user, tokens, scope, password (unused), timestamps.
- `verification` — id, identifier, value, expiresAt, timestamps.

**`src/db/schema/students.ts`** — `students`:
- `id` uuid PK defaultRandom; `authUserId` text unique → user (onDelete set null), **nullable** (null until claimed); `firstName` NOT NULL; `lastName` NOT NULL default ""; `rollNumber` text **unique** NOT NULL (the lookup key); `email` text **unique nullable**; `department` NOT NULL; `division` **nullable**; `year` NOT NULL; `isActive` bool default true; created/updatedAt defaultNow.
- Indexes on authUserId, department, year, isActive, email, rollNumber.
- Note: `division`/`department`/`year` are stored as loose `text`, redundant with what the roll parser derives.

**`src/db/schema/faculty.ts`** — `faculty`:
- `id` uuid PK; `authUserId` unique nullable → user; `firstName`, `lastName` default ""; `employeeId` text **unique** NOT NULL; `email` text **unique NOT NULL** (differs from students — faculty email required); `department` NOT NULL; `isAdmin` bool default false; `isActive` bool default true; timestamps.
- Indexes: authUserId, department, isActive.

**`src/db/schema/audit.ts`** — `auditLogs`:
- id uuid PK; `action` text; `actorId` → user; `targetType` text; `targetId` text nullable; `details` jsonb; createdAt. Indexes on action, actor, (targetType,targetId), createdAt.

**`src/db/schema/relations.ts`** — drizzle `relations()` only (no FKs beyond authUserId): students→authUser (one), faculty→authUser (one), audit→actor (one), plus user/session/account.

**MISSING for target (confirmed by grep — zero matches for dept/roles/class/permission/coordinator/hod tables):** no `departments` table, no `roles`/`capabilities`/`permission_overrides` table, no `classes` table, no `faculty_class_assignments` table, no `onboarding_requests` table. All four RBAC layers must be BUILT.

---

## (b) AUTH / SESSION / BIND / ROLE-DERIVATION — file by file

**`src/lib/auth.ts`** (better-auth server config): `emailAndPassword` disabled (VERP holds no passwords). genericOAuth single provider `providerId: "voss"`, `pkce: true` (mandatory — VOSS is OAuth 2.1), `requireIssuerValidation: true`, scopes openid/profile/email, `mapProfileToUser` derives name from email if VOSS sends none. accountLinking: `trustedProviders: ["voss"]`, `allowDifferentEmails: false`, `requireLocalEmailVerified: false` (safe ONLY while passwords stay off — heavily commented). The critical hook: `databaseHooks.session.create.after` → looks up user by session.userId, calls `bindIdentity(u.id, u.email)`. Wrapped in try/catch so a bind failure never kills the login (unbound → pending screen). **This hook is the extension point for onboarding-based binding.**

**`src/lib/bind.ts`** — `bindIdentity(authUserId, email)`: lowercases email, looks up `getFacultyByEmail` → if found and unlinked, `linkFacultyToAuthUser` + audit `identity.bound`; else `getStudentByEmail` → same for student. Throws if a row is already linked to a *different* authUserId (prevents takeover). Returns `{kind: "faculty"|"student"|"unbound", id}`. **Binds on verified email ONLY** — never on roll number/name (a student cannot forge the verified email). This is exactly the trust anchor the target onboarding preserves: the TR-approval flow will need to (i) create/activate the student row with the verified email, then (ii) this same bind path links it.

**`src/lib/session.ts`** — `getSessionUser()`: THE role-derivation engine. Gets better-auth session, then `getFacultyByAuthUserId` → role `admin` if `isAdmin` else `faculty`; else `getStudentByAuthUserId` → `student`; else `role = null`. Returns `SessionUser {id,name,email,image, role:"admin"|"faculty"|"student"|null, facultyId, studentId}`. Helpers: `isUnbound(user)` (role===null), `isStaff(user)` — **type predicate** `user is {role:"faculty"|"admin"}`, used as an allowlist. Comment explicitly warns: guards must be allowlists ("is this staff") not denylists, because a roleless user is not a student. **This file is the heart of what the 4-layer RBAC replaces** — role is currently binary-derived from `isAdmin`; it must become super_admin/HOD/faculty/student with dept+class scope, plus a DB permission-override overlay.

**`src/proxy.ts`** (Next middleware, exported as `proxy`): coarse gate only — public routes `/login`, `/api/auth`; everything else requires a session cookie (`getSessionCookie`) else redirect `/login`. Does NOT check role. Matcher excludes static assets.

**`src/lib/auth-client.ts`** — client: `createAuthClient` with genericOAuthClient plugin; exports signIn/signOut/useSession. `signUp` deliberately not exported (no VERP-side account creation).

**`src/app/api/me/route.ts`** — GET returns `getSessionUser()` as JSON (401 if none). Feeds the client role hook.

**`src/hooks/use-user-role.ts`** — client hook, `useSyncExternalStore` + module-level cache, fetches `/api/me` once. **BUG/RISK for target:** `cachedData` defaults to `role: "admin"` while loading — harmless today because server layout guards, but a denylist-in-disguise; must default to null/loading in the RBAC rework.

**Route guards today (grep):** `dashboard/layout.tsx` redirects unbound→`/unclaimed`, no session→`/login`; `dashboard/audit/page.tsx` checks `user.role !== "admin"`; import page + both import API routes check `isStaff(user)`. That's the entire guard surface — thin, and per-route. No dept/class scoping anywhere.

---

## (c) IMPORTER + ROLL PARSER — what they already give us

**`src/lib/roll-number.ts`** (reusable, pure, client-safe):
- `parseRollNumber(raw)` → `{admissionYear, branchCode, department|null, division, classNumber, isDSY}`. Regex `^(\d{2})(\d{3})([A-C])(\d{4})$`. `BRANCH_CODES`: 101=IT, 102=CMPN, 104=EXTC, 105=BIOMED, 108=EXCS, 103=legacy EXCS. `DIVISIONS_BY_BRANCH`: IT/CMPN get A/B/C, others A/B. `isDSY = classNumber >= 2000`. Unknown branch → department null (not an error), any A–C accepted.
- `looksLikeRoll(raw)` — loose structural test (for junk-row filtering).
- `isValidRollNumber(raw)`.
- `expectedYear(admissionYear, on: Date)` → FE/SE/TE/BE, June academic-year boundary.
- **This is exactly the roll→(branch,division,year) resolver the onboarding flow needs to route a self-registering student to the right CLASS/TR.** It gives everything except the class-identity lookup (no class table yet).

**`src/lib/xlsx-import.ts`** (proven on the 19-sheet workbook, pure/client-safe):
- `mapColumns(headers)` fuzzy synonym+levenshtein mapper; `detectHeaderRow`/`dataStartIndex` handle stacked/junk headers; `yearFromSheetName` (tabs prefixed FE/SE/TE/BE); `buildPreviewRows` → validated `PreviewRow[]` with per-cell `flags`; `flagRow` cross-checks each row against its own roll number (fills department/division from roll, flags mismatches). `StudentField` union covers rollNumber/first/last/name/email/department/division/year/semester/phoneNo. **Deliberately ingests NO marks/attendance** (VERP is their single source). Reuse verbatim for both the (now-secondary) roster import and the later attendance/marks CSV import.

**Import API:** `api/students/import/preview` (server: exceljs parse → buildPreviewRows, `isStaff` guard, MAX_ROWS 2000, never round-trips raw file); `api/students/import` (commit: `isStaff` guard, zod validation, intra-batch dup detection, DB roll-number conflict check, `Promise.allSettled` inserts via `createStudent`, audit `students.bulk_import`). Import UI at `dashboard/students/import/{page,client}.tsx`.

---

## (d) MOCK DASHBOARD DATA — exact locations

- **`src/components/section-cards.tsx`** — hardcoded StatCards: "3,456" Total Students, "248" Faculty, "87.3%" Attendance, "92.1%" Fee Collection, with fake +8.2%/-2.4% trends. **Fully mock, delete/replace.**
- **`src/components/chart-area-interactive.tsx`** — `chartData` array of fabricated desktop/mobile daily values (2024 dates). **Fully mock.**
- Both are rendered by **`src/app/dashboard/page.tsx`** (`<SectionCards/>` + `<ChartAreaInteractive/>`), which is a client-mock shell with no server data fetch. This overview page must be replaced with real, role-scoped, empty-state-aware content (super_admin: real counts; HOD: dept scope; TR: her class; student: own attendance/marks).
- Also likely mock/unused: `nav-documents.tsx`, `nav-projects.tsx`, `section-cards` template leftovers from the shadcn dashboard starter.

---

## (e) KEEP / EXTEND / REPLACE for target org + RBAC

**KEEP (as-is, reusable core):**
- `src/lib/roll-number.ts` — the branch/division/year resolver. Central to class routing + onboarding.
- `src/lib/xlsx-import.ts` + both import API routes — reuse for roster and attendance/marks.
- `src/lib/auth.ts` VOSS OIDC config + `bind.ts`'s "bind on verified email only" principle (the un-forgeable anchor). The `session.create.after` hook stays as the bind trigger.
- better-auth tables (`auth.ts`), `audit_logs`, `src/db/index.ts` (neon-http proxy db), `api-response.ts`, `error-utils.ts`, `db/queries/audit.ts`.
- The allowlist/type-predicate discipline in `session.ts` — carry it into the new guards.

**EXTEND:**
- `students` table — add `classId` (FK to new classes table) or keep deriving via roll; add onboarding status (the roll-routed TR approval replaces bulk-roster-first as the primary path). Currently `authUserId`/`email`/`division` nullable already supports "self-registered, pending TR approval." Add a `pending`/approval concept (either a status column or a separate `onboarding_requests` table keyed by roll → resolved class → TR).
- `faculty` table — `isAdmin` boolean is too coarse. Either add `role`/`isHod`/`isSuperAdmin` or (better) move role into the new roles model. Faculty↔class assignment (TR, coordinator) needs a new mapping table.
- `session.ts::getSessionUser` — expand `SessionUser.role` to `super_admin|hod|faculty|student|null` and add **scope** (departmentId, assigned classIds). This is the single chokepoint every guard reads.
- `db/queries/{students,faculty}.ts` — add dept/class-scoped variants (`getStudentsByClass`, `getClassesByDept`, `getFacultyClassAssignments`); current `getAllStudents({department,year})` filters exist but no class/TR scoping.
- `bind.ts` — extend to bind a newly-TR-approved student (create/activate row with verified email, then link). Keep the "already linked → throw" guard.
- `app-sidebar.tsx` — currently three static nav arrays (adminNav/facultyNav/studentNav) switched by `useUserRole`. Extend to four roles + scope-aware items (HOD dept view, TR single-class view).

**REPLACE / BUILD NEW:**
- **`departments` table** — the 5 branches (BIOMED, EXTC, EXCS, IT, CMPN). Single source; faculty/students/classes FK to it instead of loose `text department`.
- **RBAC model (4 layers)** — new `roles` concept: FIXED default capabilities per role IN CODE (super_admin/hod/faculty/student) + a super-admin-editable **`permission_overrides`** DB table (the toggle overlay for future features). New guard module (e.g. `src/lib/rbac.ts` / `src/lib/authz.ts`) replacing the binary `isStaff`/`isAdmin` derivation. Defense-in-depth: app guards + Neon RLS policies (RLS does not exist yet — must be added; note neon-http `transaction:false` constrains RLS session-var patterns, plan for `crudPolicy`/role GUCs).
- **`classes` table** — a class = (year, branch/dept, division), e.g. TE-EXCS-A. Created by HOD.
- **`faculty_class_assignments` table** — faculty_id → class_id, role-in-class (TR / coordinator). One TR per class default.
- **Onboarding flow** — self-registration page (student enters roll+name+email post-VOSS) → roll parser → resolve class → resolve TR → request lands ONLY in that TR's queue (roll-scoped isolation) → TR approves → bind. Replaces the "TR uploads roster first" gate as the primary student entry. `unclaimed/page.tsx` (current "Access pending" screen) becomes the entry to self-registration rather than a passive dead-end.
- **Dashboard overview** (`dashboard/page.tsx` + `section-cards.tsx` + `chart-area-interactive.tsx`) — remove all mock; render real counts / empty states, role+scope-isolated.
- **Route structure** — today everything is flat under `/dashboard/*` with per-page role checks. Target needs cleanly isolated per-role/scope routing (super_admin: everything; HOD: dept; TR: her class; student: own). Plan nav + layout guards accordingly. Fix `use-user-role.ts` default-to-"admin" while extending.
- **`admin` role naming** — current `isAdmin`-derived `"admin"` becomes `super_admin`; introduce `hod`. Every `role === "admin"` / `isStaff` call site (listed above: audit page, import page, both import routes, sidebar) must migrate to the new capability checks.

**Migration reality:** schema is push-only (`drizzle-kit push`, no migration files, no seed) — new tables/columns go straight into `src/db/schema/*.ts` (add files: `departments.ts`, `classes.ts`, `roles.ts`/`permissions.ts`, `assignments.ts`, `onboarding.ts`), wire into `schema/index.ts` + `relations.ts`, add domain query files under `db/queries/`. Rosters/data enter through the app, not seeds.

### RBAC RESEARCH
I've read the real code. Here is the RBAC design, grounded in what exists in the repo.

---

# VERP RBAC — Concrete Model

## 0. Where this plugs into the existing code (grounding)

- Role is derived today in `src/lib/session.ts` → `getSessionUser()` from the binding (`faculty.isAdmin` → `"admin"`, else `"faculty"`; student row → `"student"`; neither → `null`). This function is the single chokepoint — **all four layers, capability resolution, and scope get computed here, once per request.**
- The enforcement idiom already exists: `isStaff(user)` type-predicate guard, used as `if (!isStaff(user)) return apiError("Forbidden", 403)` in `src/app/api/students/import/route.ts`. We generalize that one guard into `can()` / `authorize()`.
- DB is `neon-http`, `transaction:false` (`src/db/index.ts`). This **constrains the DB-isolation layer** — see §5.
- No roles table today. We add role as a first-class column on `faculty` (replacing the `isAdmin` boolean) plus one small overrides table. Nothing else about the binding model changes.

Two naming migrations: `faculty.isAdmin: boolean` → `faculty.role: 'super_admin' | 'hod' | 'faculty'`; and the `SessionUser.role` union `"admin"|"faculty"|"student"|null` → `"super_admin"|"hod"|"faculty"|"student"|null`. **Coordinator is NOT a 5th role** — it's a `faculty` whose class-assignment row carries `roleInClass='coordinator'`, granted extra caps via the overrides table. Keeps the model at exactly 4 layers as locked.

---

## 1. Capability taxonomy

Flat `domain:action` string namespace, defined as a **string-literal union type** (compile-time safety + autocomplete; a typo is a build error). A parallel `CAPABILITY_CATALOG` array (`{ id, domain, label, description }`) is the single source the super_admin toggle UI renders from.

```ts
export type Capability =
  // departments (the 5 branches)
  | "dept:read" | "dept:create" | "dept:update" | "dept:deactivate"
  // org hierarchy — appoint HOD + coordinator to a dept
  | "hod:assign"
  // classes  (a class = year × branch × division, e.g. TE-EXCS-A)
  | "class:read" | "class:create" | "class:update" | "class:deactivate"
  // TR ↔ class assignment
  | "assignment:read" | "assignment:create" | "assignment:delete"
  // faculty roster
  | "faculty:read" | "faculty:create" | "faculty:update" | "faculty:deactivate"
  // student roster
  | "student:read" | "student:update" | "student:deactivate"
  // onboarding (self-registration + roll-routed TR approval)
  | "onboarding:request"   // student submits their own request
  | "onboarding:read"      // see the queue
  | "onboarding:approve" | "onboarding:reject"
  // attendance
  | "attendance:read" | "attendance:write" | "attendance:update" | "attendance:delete"
  // marks (parallel to attendance, per target point 11)
  | "marks:read" | "marks:write" | "marks:update" | "marks:delete"
  // audit
  | "audit:read"
```

**Default capability matrix** (`FIXED, in code`). `super_admin` = wildcard, the door to everything; the other three are least-privilege defaults that scope narrows further (§4).

| Capability domain | super_admin | hod | faculty (TR) | student |
|---|:--:|:--:|:--:|:--:|
| dept:read / create / update / deactivate | all | read | — | — |
| hod:assign | ✓ | — | — | — |
| class:read / create / update / deactivate | all | all (own dept) | read (own) | — |
| assignment:* | all | all (own dept) | read (own) | — |
| faculty:read / create / update / deactivate | all | all (own dept) | read (own dept) | — |
| student:read | ✓ (all) | ✓ (own dept) | ✓ (own class) | ✓ (self) |
| student:update / deactivate | ✓ | own dept | — | — |
| onboarding:request | — | — | — | ✓ (self) |
| onboarding:read / approve / reject | all | read (own dept) | ✓ (own class queue) | — |
| attendance:read | ✓ | own dept | own class | self |
| attendance:write / update / delete | ✓ | — | own class | — |
| marks:* | same shape as attendance | | | |
| audit:read | ✓ | own dept | — | — |

Note the deliberate split: **HOD organizes** (classes, assignments, faculty, dept-wide read) but does **not** approve student onboarding or write attendance — that authority belongs to the TR who owns the class. The trust model is roll-scoping + the TR's authority, exactly as locked.

In code:

```ts
const DEFAULT_CAPABILITIES: Record<Exclude<Role,"super_admin">, ReadonlySet<Capability>> = {
  hod: new Set(["dept:read","class:read","class:create","class:update","class:deactivate",
                "assignment:read","assignment:create","assignment:delete",
                "faculty:read","faculty:create","faculty:update","faculty:deactivate",
                "student:read","student:update","student:deactivate",
                "onboarding:read","attendance:read","marks:read","audit:read"]),
  faculty: new Set(["class:read","assignment:read","faculty:read","student:read",
                    "onboarding:read","onboarding:approve","onboarding:reject",
                    "attendance:read","attendance:write","attendance:update",
                    "marks:read","marks:write","marks:update"]),
  student: new Set(["student:read","onboarding:request","attendance:read","marks:read"]),
}
// super_admin is the wildcard; handled by short-circuit, never enumerated.
```

---

## 2. Defaults-in-code + DB-overrides overlay

Defaults live in the `DEFAULT_CAPABILITIES` map above. The overlay is **one table**, deliberately not a policy engine:

```
permission_overrides
  id            uuid pk
  subject_type  text     -- 'role' | 'user'
  subject_id    text     -- role name (e.g. 'faculty')  OR  user.id (authUserId)
  capability    text     -- a Capability string
  effect        text     -- 'grant' | 'deny'
  is_active     boolean  default true          -- soft-delete, per house style
  created_by    text references "user"(id)
  note          text
  created_at / updated_at  (auto-managed)
  -- guarantees ≤ 1 active row per (level, subject, capability): kills intra-level conflict
  unique index (subject_type, subject_id, capability) where is_active
```

**Resolution — precedence, low to high, last write wins:**

```
default set  <  role-level override  <  user-level override
```

Because the partial-unique index allows at most one active row per `(level, subject, capability)`, there is **no grant-vs-deny conflict within a level** — so a simple "apply role overrides, then apply user overrides, grant adds / deny removes" is fully deterministic. deny wins over a default or a role-grant only when it sits at an equal-or-higher level, which the ordering already encodes.

```ts
function effectiveCapabilities(role: Role, overrides: OverrideRow[]): Set<Capability> {
  if (role === "super_admin") return ALL_CAPS         // wildcard, no overrides apply
  const set = new Set<Capability>(DEFAULT_CAPABILITIES[role])
  const ordered = [
    ...overrides.filter(o => o.subjectType === "role"),   // role first
    ...overrides.filter(o => o.subjectType === "user"),   // user wins
  ]
  for (const o of ordered) o.effect === "grant" ? set.add(o.capability)
                                                 : set.delete(o.capability)
  return set
}
```

**super_admin is intentionally exempt from overrides** — no override row can lock out the only holder of the door to everything. `per-role` overrides are the common path (shift a whole layer's defaults, e.g. "let all TRs delete attendance"); `per-user` overrides are the exception path (one HOD gets `audit:read` on the whole college). Both live in the same table, distinguished by `subject_type`.

The overrides for `(this role, this user)` are loaded **once** in `getSessionUser()` — one extra `SELECT` per request on a tiny table — and the resolved `Set<Capability>` is cached on the `SessionUser`.

---

## 3. Enforcement points in Next.js

Extend `SessionUser` (in `src/lib/session.ts`) with the resolved facts so every guard is a pure in-memory check:

```ts
export type SessionUser = {
  id: string; name: string; email: string; image: string | null
  role: "super_admin" | "hod" | "faculty" | "student" | null
  facultyId: string | null; studentId: string | null
  department: string | null           // for hod scope
  classIds: string[]                   // for faculty (TR) scope, from faculty_class_assignments
  capabilities: ReadonlySet<Capability> // resolved effective set (empty for super_admin; use can())
}
```

Two functions. `can()` is pure/sync — capability only — for **nav rendering and coarse gates**. `authorize()` is async — capability **+ scope** — the real gate at every mutation.

```ts
export function can(user: SessionUser | null, cap: Capability): boolean {
  return user?.role === "super_admin" || !!user?.capabilities.has(cap)
}

export type ScopeTarget =
  | { department: string }
  | { classId: string }
  | { studentId: string }
  | { rollNumber: string }        // onboarding: roll → class → TR ownership

// throws ForbiddenError → caught by route handler → apiError(403). Server-only.
export async function authorize(
  user: SessionUser | null,
  cap: Capability,
  target?: ScopeTarget,
): Promise<asserts user is SessionUser> {
  if (!can(user, cap)) throw new ForbiddenError(cap)
  if (user!.role === "super_admin") return           // global scope, always in
  if (target && !(await inScope(user!, target)))
    throw new ForbiddenError(`${cap}: out of scope`)
}
```

**Scope composes as a second, orthogonal gate.** The capability answers *"is this action allowed for this role at all?"*; the scope answers *"is this specific target inside the person's slice?"*. `inScope` resolves the target down to a department/class and checks it against the session's scope facts:

```ts
async function inScope(u: SessionUser, t: ScopeTarget): Promise<boolean> {
  switch (u.role) {
    case "hod":     return (await departmentOf(t)) === u.department
    case "faculty": return u.classIds.includes(await classIdOf(t)) // t may be rollNumber → parseRollNumber → class
    case "student": return "studentId" in t && t.studentId === u.studentId
    default:        return false
  }
}
```

`classIdOf({rollNumber})` runs `parseRollNumber` (reused, unchanged) → `(department, division, year)` → looks up the `classes` row → that's how "TR of TE-EXCS-A sees only 23·108·A requests" is enforced with **no per-request rule config** — the roll number self-describes the class, membership in `classIds` decides visibility.

**Every server action / route handler** opens with `await authorize(user, cap, target)`; the existing `import/route.ts` `isStaff` check becomes `await authorize(user, "student:update", { rollNumber })` per row (or a coarser `class`-level check for the batch). The client `useUserRole` hook and `/api/me` additionally return `capabilities` so the sidebar renders items with `can(user, "class:create")` — but the client check is cosmetic; the server gate is authoritative.

**UI isolation (target point 10)** falls out of scope + capability: the sidebar is built from `can()`, and every page's loader calls `authorize()` with the page's target, so a TR hitting `/dashboard/hod/*` or another division's class gets a 403/redirect from the same mechanism — no separate route-guard code.

---

## 4. How super_admin toggles a capability when a feature ships

Two distinct cases, and being precise about the boundary matters:

1. **Toggling an already-defined capability** (no deploy): the super_admin permissions screen renders a matrix of `roles × CAPABILITY_CATALOG` (plus a per-user search for exceptions). Flipping a cell writes/soft-deletes one `permission_overrides` row (`subject_type='role'`, `effect='grant'|'deny'`). Effect is immediate on the next request, because `getSessionUser()` re-resolves overrides every request. This is the everyday path — e.g. "grant TRs `attendance:delete`".

2. **A brand-new feature's capability** (requires a deploy — and this is the honest limit of the overlay, not a policy engine): a developer adds the new string to the `Capability` union, to `CAPABILITY_CATALOG`, and — critically — wires `authorize(user, "newthing:do", target)` at the new call site. Optionally seeds it into a role's `DEFAULT_CAPABILITIES`. On deploy it appears **automatically** in the super_admin matrix (the UI reads the catalog), starting off-by-default for roles that don't have it, and super_admin grants it with one toggle. Overrides can only toggle capabilities that **exist and are enforced somewhere** — they cannot invent enforcement. That's the correct MVP boundary: the DB overlay is a switchboard over code-defined switches, not a rules language.

---

## 5. DB-level isolation (defense-in-depth) — honest note on the constraint

App-level `authorize()` at every server action is the **primary** layer and is complete on its own. For the second layer the target names "Neon RLS or equivalent", and the stack imposes a real constraint worth stating:

- `neon-http` + `transaction:false` means **no interactive transactions**, so the classic `SET LOCAL app.current_user = …` + RLS-reads-the-GUC pattern is **not available** (the `SET` and the `SELECT` land on different stateless HTTP requests).
- Neon RLS / Neon Authorize is still compatible, because it derives `auth.user_id()` from a **JWT passed per HTTP request** — stateless, no transaction needed. The missing piece is that better-auth here issues OAuth sessions, not Postgres-facing JWTs.

Recommendation, phased (matching "start minimal, grow"): **Phase 1 = app-level `authorize()` everywhere** (ship this). **Phase 2 hardening** = add the better-auth JWT plugin to mint a short-lived token carrying `{ role, department, classIds, studentId }`, pass it to `neon(url, { authToken })` per request, and enable RLS policies on `students`, `attendance`, `marks`, `student_onboarding_requests` keyed to those claims (dept for HOD, `class_id = any(classIds)` for TR, `student_id = self` for student). This gives true DB isolation without violating `transaction:false`. Do not attempt the `SET LOCAL` GUC approach — it silently no-ops on this driver.

---

## 6. Supporting tables the scope layer needs (sketches)

RBAC scope depends on three tables another agent likely owns full ownership of; sketched here only to the depth `inScope` requires:

```
departments(id, code unique  -- IT|CMPN|EXTC|BIOMED|EXCS,
            name, hod_faculty_id → faculty (nullable convenience ptr),
            is_active, timestamps)

classes(id, department_code → departments.code, year, division,
        is_active, timestamps,
        unique(department_code, year, division) where is_active)   -- one TE-EXCS-A

faculty_class_assignments(id, faculty_id → faculty, class_id → classes,
        role_in_class text  -- 'tr' | 'coordinator',
        is_active, timestamps,
        unique(class_id) where role_in_class='tr' and is_active)   -- one TR per class

student_onboarding_requests(id, auth_user_id → user, roll_number,
        first_name, last_name, email,
        class_id → classes  -- resolved by parseRollNumber at submit time,
        status text -- pending|approved|rejected,
        reviewed_by_faculty_id → faculty (nullable), timestamps)
```

`SessionUser.classIds` = `faculty_class_assignments` where `faculty_id = self and is_active`. The TR's onboarding queue = `student_onboarding_requests where class_id = any(classIds) and status='pending'` — the roll-scoped isolation, enforced by the same `inScope` faculty branch.

---

### Relevant files
- `/Users/harshalmore31/code/voss/verp/src/lib/session.ts` — extend `SessionUser`, add `can()`/`authorize()`/`inScope()` here (or a new `src/lib/rbac.ts` for the capability map + resolution, kept under 200 lines).
- `/Users/harshalmore31/code/voss/verp/src/db/schema/faculty.ts` — `isAdmin` → `role`.
- `/Users/harshalmore31/code/voss/verp/src/db/schema/` — add `departments.ts`, `classes.ts`, `assignments.ts`, `permission_overrides.ts`, `onboarding.ts`.
- `/Users/harshalmore31/code/voss/verp/src/lib/roll-number.ts` — reused unchanged by `classIdOf({rollNumber})`.
- `/Users/harshalmore31/code/voss/verp/src/app/api/students/import/route.ts` — reference call site; `isStaff` → `authorize(...)`.
- `/Users/harshalmore31/code/voss/verp/src/db/index.ts` — where a phase-2 `authToken` would be threaded for Neon RLS.

### ISOLATION RESEARCH
I have everything I need. Returning the research findings.

---

# VERP Isolation / Multi-Tenancy Research

Grounded in the real repo (`neon-http` driver in `src/db/index.ts`, binding in `src/lib/bind.ts`, scope-less queries in `src/db/queries/*`, guards `isStaff`/`isUnbound` in `src/lib/session.ts`, roll parser in `src/lib/roll-number.ts`). The core finding: **VERP's isolation key already lives inside the roll number.** The first 6 characters of `23108A0054` (`23`·`108`·`A`) ARE the class identity. Everything below builds on that.

---

## 1. The class identity decision (do this first — everything hangs off it)

The target doc thinks of a class as `(year, branch, division)` e.g. `TE-EXCS-A`. **Do not store `year` as the class key — it drifts.** `TE-EXCS-A` means a different cohort every academic year (this year's TE is next year's BE). If `classId` is keyed on the mutable year label, every student's `classId` and every TR assignment silently rots at the July rollover.

**Recommendation: key the class on the cohort, render it with the derived year label.**

```
classKey = admissionYear · branchCode · division      // "2023-108-A"
```

This is exactly what `parseRollNumber()` already returns (`admissionYear`, `branchCode`, `division`). The roll number is a self-describing composite key; the class key is literally its 6-char prefix. Consequences:

- Roll → class is **deterministic, pure, offline** — no DB lookup to route.
- Class membership is **time-stable** (the cohort moves FE→SE→TE→BE together; the roll never changes).
- The UI label `TE-EXCS-A` is computed on the fly via `expectedYear(admissionYear, now)` — already implemented.
- `103` and `108` both map to dept `EXCS` but are distinct branch codes, so key on **`branchCode`** (exact) for the class, and carry **`department`** (`EXCS`) alongside for HOD-level scoping.

This single decision is what makes the onboarding queue route itself without any global roster.

---

## 2. New schema (additive; `drizzle-kit push`, no migrations)

Five new tables plus two column additions. Keep the roll-keyed `students` core reusable — the scoping columns are additive.

**`departments`** — the 5 branches.
```
code text PK            // "IT" | "CMPN" | "EXTC" | "BIOMED" | "EXCS"
name text
hodFacultyId uuid?      // convenience denorm; source of truth is dept_appointments
isActive boolean
```

**`dept_appointments`** — super_admin appoints HOD + coordinator per dept (multi-HOD-ready).
```
id, deptCode -> departments.code
facultyId -> faculty.id
appointment text         // "hod" | "coordinator"
assignedBy -> faculty.id
isActive boolean, timestamps
partial-unique(deptCode, appointment) WHERE isActive  // one active HOD per dept
```

**`classes`** — HOD creates these for their dept.
```
id uuid PK
admissionYear int
branchCode text          // "108"
department text          // "EXCS"  (FK-ish to departments.code, for HOD scope)
division text            // "A"
coordinatorFacultyId uuid?
isActive boolean, timestamps
unique(admissionYear, branchCode, division)
index(department)
```
Year label is derived, never stored.

**`faculty_class_assignments`** — the TR↔class map.
```
id uuid PK
facultyId -> faculty.id
classId -> classes.id
role text                // "tr" | "coordinator"
assignedBy -> faculty.id
isActive boolean, timestamps
partial-unique(classId) WHERE role='tr' AND isActive   // one active TR per class
index(facultyId, isActive)   // drives the TR's scope query
index(classId)
```

**`enrollment_requests`** — the self-registration queue (§5).
```
id uuid PK
authUserId -> user.id         // the VOSS identity that signed in
rollNumber text
firstName, lastName text
email text                    // = verified session email, NOT user-typed
classId uuid? -> classes.id   // resolved from roll at submit; null = "unrouted"
status text                   // "pending" | "approved" | "rejected" | "unrouted"
reviewedBy uuid? -> faculty.id
reviewedAt timestamptz?
rejectionReason text?
timestamps
partial-unique(authUserId) WHERE status='pending'    // one open request per person
index(classId, status)        // drives the TR queue — the isolation index
```

**Column additions:**
- `students.classId uuid?` → `classes.id`, `index(classId)`. Denormalized routing key set at approval; `rollNumber` stays the immutable truth, `classId` is re-derivable.
- `faculty.role text` (`"faculty" | "hod" | "super_admin"`), replacing the current `isAdmin` boolean. Student role stays implicit (binding to `students`). This is the explicit half of the 4-layer model; the derived half (student vs staff) stays as in `session.ts`.

Note: `drizzle-kit push` manages tables/indexes but **not** RLS policies or DB roles — those go in a hand-maintained `src/db/rls.sql` run in deploy/CI (see §4).

---

## 3. (a) App-level scoping — the primary, always-on layer

Extend `getSessionUser()` into a `getScope()` that resolves once per request:

```ts
type Scope =
  | { kind: "super_admin" }
  | { kind: "hod"; facultyId: string; deptCodes: string[] }      // from dept_appointments
  | { kind: "tr"; facultyId: string; classIds: string[] }        // from faculty_class_assignments
  | { kind: "student"; studentId: string; classId: string | null }
  | { kind: "unbound" }
```

Derivation:
- `super_admin` → `faculty.role === "super_admin"` → unrestricted.
- `hod` → `SELECT deptCode FROM dept_appointments WHERE facultyId=? AND appointment='hod' AND isActive`.
- `tr` (faculty) → `SELECT classId FROM faculty_class_assignments WHERE facultyId=? AND isActive`.
- `student` → own `studentId` + `students.classId`.
- `unbound` → the `/unclaimed` self-registration screen (now the onboarding form).

**Enforcement that is structurally impossible to forget.** Today `src/db/queries/students.ts` exposes `getAllStudents()` returning *everything* — a TR calling it sees the whole college. The fix is not "remember to filter," it's a boundary:

- Split queries into `queries/unscoped/` (auth, `getFacultyByEmail`, self-lookups by `authUserId` — the binding path in `bind.ts` legitimately needs these) and `queries/scoped/`.
- Every function in `scoped/` takes `scope: Scope` as its first parameter and injects the WHERE clause itself:
  ```ts
  getStudents(scope): // super_admin → all; hod → inArray(students.department, scope.deptCodes);
                      // tr → inArray(students.classId, scope.classIds); student → eq(students.id, scope.studentId)
  ```
- Route/action code (`src/app/api/**`, server actions) may import **only** from `scoped/` for tenant tables. Enforce with an ESLint `no-restricted-imports` rule forbidding raw `@/db` and `queries/unscoped/*` outside the query layer. This turns "forgot to scope" into a lint failure, not a data leak — the same spirit as the existing `isStaff` type-predicate that made role omissions a build error.
- **Every mutation re-checks scope server-side against the row it loads**, never trusts the id in the request. `approveEnrollment(reqId)` loads the request, asserts `request.classId ∈ scope.classIds`, else 403. This is the real gate; the queue filter is just what the TR *sees*.

This layer is correct, complete, driver-agnostic, testable, and ships now under `neon-http` + `transaction:false` with zero infra change.

---

## 4. (b) Database-level isolation — the honest neon-http reality

**The constraint is real and load-bearing.** `neon-http` is one HTTP request per statement with no session state, so the classic RLS pattern — `SET LOCAL app.tenant=…` then `SELECT` in a later call — **cannot work**: the GUC is gone by the next request. Verified against current Neon/Drizzle docs (July 2026):

- Neon RLS's canonical path sets `set_config('request.jwt.claims', …, true)` **inside a transaction over the WebSocket/TCP `Pool`** (`@neondatabase/serverless`), not `neon-http`.
- **Drizzle's `$withAuth()` is now deprecated**; the documented replacement is manual `set_config` in a transaction — which requires interactive transactions `neon-http` doesn't have.
- `neon-http` *can* run a non-interactive **batched** transaction (`set_config(...,true)` + query in one HTTP round-trip), but you lose read-then-decide branching, and it's the awkward path, not the supported one.

So the choice is a genuine trade-off, and here is the recommendation:

**Recommend: query-layer scope (§3) is the primary enforcement and ships in Phase 1. Add DB-level RLS as a real second layer in Phase 2 via a dedicated `neon-serverless` WebSocket `Pool` used ONLY for the tenant tables** (`students`, `classes`, `faculty_class_assignments`, `enrollment_requests`, `dept_appointments`), while `neon-http` keeps serving auth/unscoped traffic.

Phase 2 shape:
- Second Drizzle instance on `Pool` (WebSocket). Scoped access runs `db.transaction(tx => { tx.execute(sql\`select set_config('request.jwt.claims', ${claims}, true)\`); ... })` where `claims = { sub, role, deptCodes, classIds, studentId }` built from `Scope`.
- Tenant tables under **`FORCE ROW LEVEL SECURITY`**, accessed via a **non-owner, non-`BYPASSRLS` app role** (the Neon default role owns the tables and silently bypasses RLS otherwise — this is the #1 RLS footgun).
- Policies use `pg_session_jwt`'s `auth.session()`/`current_setting('request.jwt.claims', true)::json` to read `role`/`deptCodes`/`classIds`. e.g. on `enrollment_requests`: `USING (classId = ANY (SELECT jsonb_array_elements_text(claims->'classIds')::uuid))`.
- Policies + roles live in `src/db/rls.sql`, applied in deploy (not `drizzle-kit push`).

**Why sequenced, not both-now:** DB-RLS on this stack costs a second driver, WebSocket connections on Vercel serverless (mitigated by Neon's pooler but a real cold-start/complexity tax), JWT-claims plumbing, and out-of-band role/policy SQL. That is over-engineering to *block MVP onboarding* on. The query-layer boundary + the existing `audit_logs` is a strong, sufficient single layer for Phase 1; RLS becomes the belt-and-suspenders before you hold real student PII at scale. If Boss deems DB enforcement non-negotiable from day one, the WebSocket-Pool-for-tenant-tables path above is the clean way to get it — do **not** try to bolt `set_config` onto `neon-http`; it's the unsupported, brittle corner.

---

## 5. (c) Onboarding queue — exact roll-routed isolation

The trust model is: **roll-scoping + the TR's authority over her own class replaces the global roster gate.** No `bindIdentity` roster pre-upload for students anymore; the row is *created at approval*.

**Flow:**

1. Student signs in via VOSS (email verified). `bindIdentity` (session hook) finds no `faculty`/`students` row → `unbound` → `/unclaimed`, which becomes the **self-registration form**: collect `rollNumber`, `firstName`, `lastName`. **Email is taken from `session.email` (the un-forgeable verified anchor) and locked — never a typed field.** Binding on a typed email is exactly the takeover `bind.ts` already warns against.

2. `submitEnrollmentRequest` server action:
   - `parseRollNumber(roll)` — reject malformed (parser throws with a specific reason).
   - Resolve `classKey = admissionYear·branchCode·division` → find the `classes` row → attach `classId`. **If no class exists** (HOD hasn't created it): store `status='unrouted'` — surfaced to the **HOD** (`dept ∈ hod scope`), never dropped. This is the pressure that makes HODs create their classes.
   - Conflict guards: block if `rollNumber` already maps to an active bound `students` row (someone claimed it — flag, don't overwrite); enforce one `pending` request per `authUserId` (partial-unique).
   - Write request with `classId`, `email = session.email`. Audit log.

3. **TR queue = the isolation, and it's just an index scan:**
   ```
   SELECT * FROM enrollment_requests
   WHERE classId IN (scope.classIds) AND status='pending'
   ```
   The TR of `2023-108-A` has exactly one `classId` in `scope.classIds`, so she sees only `23108A*` requests. Roll-scoping falls out of the `classId` FK — no roll-prefix string matching needed at query time. (The routing already happened at submit via the parser.) A request with no assigned TR yet still sits in its class queue; whoever becomes TR inherits it.

4. TR opens a request → profile card (`rollNumber`, verified `email`, name) → recognizes them against her own attendance sheet → **Approve**:
   - Re-assert `request.classId ∈ scope.classIds` server-side (the real gate).
   - Create the `students` row: `rollNumber`, names, `email = request.email`, `department`/`division`/`year`(derived) from the parse, `classId`, **`authUserId = request.authUserId`** (bound at creation — no second sign-in needed). `isActive=true`.
   - Mark request `approved`, `reviewedBy`, `reviewedAt`. Audit.
   - `bindIdentity` stays idempotent afterward (row already carries `authUserId`+`email`), so nothing breaks on next login.
   - **Reject** → `status='rejected'` + reason; student sees it on `/unclaimed` and can resubmit.

**DB-net for the queue (Phase 2):** the `enrollment_requests` RLS `USING`/`WITH CHECK` policy restricting SELECT/UPDATE to `classId ∈ claims.classIds` is the single highest-value policy — it makes the isolation invariant DB-enforced even if a scoped-query call is ever miswritten.

---

## 6. Bootstrap + navigation isolation (flagged, out of core scope but blocking)

- **First super_admin:** no seed data + roster-created students means there's no door-opener. Add `SUPER_ADMIN_EMAILS` env; in `bindIdentity`, a verified email in that list with no `faculty` row → create a `faculty` row with `role='super_admin'`. That's the single bootstrap seam.
- **Routing:** one `/dashboard` shell, sections gated by `Scope` in the layout (extend the existing `dashboard/layout.tsx` guard from `isUnbound` to a full scope switch). `nav-main`/`app-sidebar` render from effective capabilities (§below), so a TR never sees dept/faculty-management nav at all — isolation of *surface*, not just data.
- **Capabilities overlay (the RBAC target):** `capabilities.ts` maps `role → Set<Capability>` in code (fixed defaults); a `permission_overrides` table (`subjectType 'role'|'user'`, `subjectId`, `capability`, `effect 'grant'|'revoke'`, `isActive`) is the super-admin-editable DB layer. `effectiveCaps(user) = defaults(role) − revokes + grants`. Guards check `has(scope, "student.approve")`, not raw role strings — this is what lets super_admin grant future features without a code change.

---

## Bottom line

1. Key classes on the **cohort** (`admissionYear·branchCode·division`) = the roll's own prefix → routing is a pure function, membership is time-stable.
2. **Primary isolation = a scoped query boundary** (`queries/scoped/` taking `Scope`, lint-enforced, mutations re-check the loaded row). Correct and shippable today on `neon-http`.
3. **DB-level RLS is real but Phase 2**, via a `neon-serverless` WebSocket `Pool` for tenant tables only, `FORCE RLS` + non-`BYPASSRLS` role + `set_config` JWT claims. Do not try to force RLS onto `neon-http` — `$withAuth` is deprecated and session GUCs can't survive stateless HTTP.
4. **Onboarding queue isolates via the `classId` FK on `enrollment_requests`** — the TR's queue is an index scan over her `scope.classIds`, the row is created-and-bound at approval, and the email anchor is always `session.email`, never typed.

Key files to touch: `src/db/schema/` (5 new tables + 2 columns), new `src/lib/scope.ts`, split `src/db/queries/{scoped,unscoped}/`, `src/lib/bind.ts` (super_admin bootstrap + no-op for the create-at-approval path), `src/app/unclaimed/page.tsx` (→ self-registration form), new TR-queue action/route, and `src/db/rls.sql` (Phase 2).

Sources:
- [Neon RLS query execution (Drizzle, `$withAuth` deprecated, `set_config` in transaction)](https://neon.com/docs/guides/rls-query-execution)
- [Neon serverless driver — HTTP vs WebSocket session/transaction support](https://neon.com/docs/serverless/serverless-driver)
- [Drizzle ORM — Row-Level Security](https://orm.drizzle.team/docs/rls)
- [Neon — Simplify RLS with Drizzle](https://neon.com/docs/guides/rls-drizzle)
- [neondatabase/pg_session_jwt — `auth.user_id()` / `auth.session()`](https://github.com/neondatabase/pg_session_jwt)