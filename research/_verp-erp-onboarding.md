# VERP Onboarding — End-to-End State Machine Specification

Grounded in the real code: `bindIdentity` (bind.ts) binds ONLY on the verified session email; `getSessionUser` (session.ts) derives role from binding; `parseRollNumber` (roll-number.ts) is pure and returns `{admissionYear, branchCode, department|null, division, classNumber, isDSY}`; the `session.create.after` hook (auth.ts) already calls `bindIdentity` idempotently on every login and swallows throws. This spec extends those seams — it does not fight them.

---

## 0. Prerequisite chain (must exist BEFORE any student can route)

Onboarding routes a roll → a `classes` row → the TR assigned to it. If that chain is absent the request cannot land in a TR queue. So four super_admin/HOD flows are hard prerequisites, in order:

| # | Actor | Action / server action | Capability + scope gate | Data writes |
|---|-------|------------------------|------------------------|-------------|
| P0 | (bootstrap) | `SUPER_ADMIN_EMAILS` env; in `bindIdentity`, a verified email in the list with no faculty row | none (env-driven seam) | insert `faculty{role:'super_admin', email, employeeId:auto}`; audit `faculty.bootstrap` |
| P1 | super_admin | `createDepartment(code,name)` | `authorize(u,"dept:create")` | insert `departments{code, name, isActive:true}`; audit `dept.create` |
| P2 | super_admin | `appointHod(deptCode, facultyId)` | `authorize(u,"hod:assign")` | insert `faculty` if new (`role:'hod'`); insert `dept_appointments{deptCode, facultyId, appointment:'hod', assignedBy, isActive}`; set `faculty.role='hod'`; denorm `departments.hodFacultyId`; audit `hod.appoint` |
| P3 | HOD | `createClass(admissionYear,branchCode,division)` | `authorize(u,"class:create",{department: branchDept})` — dept must be in HOD scope | insert `classes{admissionYear, branchCode, department, division, isActive}`; audit `class.create` |
| P4 | HOD | `assignTr(classId, facultyId)` | `authorize(u,"assignment:create",{classId})` | insert `faculty` if new (`role:'faculty'`); insert `faculty_class_assignments{facultyId, classId, role:'tr', assignedBy, isActive}` (partial-unique on `classId where role='tr' and isActive` enforces one active TR); audit `assignment.create` |

Key decision inherited from isolation research: a **class is keyed on the cohort** `admissionYear·branchCode·division` (the roll's own 6-char prefix), NOT on the year label. `TE-EXCS-A` is a rendered label (`expectedYear(admissionYear, now)`), never a stored key — otherwise every membership rots at the July rollover.

---

## 1. The state machine

State lives on one row: `enrollment_requests.status`. The student's *effective* state is a function of (that row) × (whether a bound `students` row exists) × (session binding). Enumerated states:

```
                 VOSS sign-in (email verified)
                          │
                          ▼
              ┌───────────────────────┐
              │  SIGNED_IN_UNCLAIMED   │  no faculty/student row, no open request
              │  (role=null, /unclaimed)│  → renders self-registration FORM
              └───────────┬───────────┘
                          │ submitEnrollmentRequest(roll, first, last)
                          │   email := session.email (locked, never typed)
                          │   parseRollNumber(roll)
             ┌────────────┼───────────────────────────┐
     malformed roll   class found                 class NOT found
     (parser throws)  → classId set               (HOD hasn't made it)
             │            │                            │
             ▼            ▼                            ▼
   stay UNCLAIMED   ┌──────────────┐          ┌──────────────────┐
   + inline error   │ PENDING_TR   │          │    UNROUTED      │
   (no row written) │ status=      │          │ status='unrouted'│
                    │ 'pending'    │          │ classId=null     │
                    │ classId set  │          │ (dept known)     │
                    └──────┬───────┘          └────────┬─────────┘
                           │                           │ HOD creates the class
         ┌─────────────────┼─────────┐                 │ → sweep re-routes
         │                 │         │                 ▼  (classId set, status→pending)
   TR approve         TR reject   (student edits)   PENDING_TR
         │                 │
         ▼                 ▼
  ┌────────────┐    ┌────────────┐
  │  APPROVED  │    │  REJECTED  │
  │ students   │    │ +reason    │──── student resubmits ──▶ PENDING_TR/UNROUTED
  │ row created│    └────────────┘
  │ +bound     │
  └─────┬──────┘
        │ next getSessionUser() sees the bound students row
        ▼
  ┌────────────┐
  │   LINKED   │  role='student', student dashboard, own attendance/marks
  └────────────┘
```

### Transition table

| From | Event | Guard | To | Writes |
|------|-------|-------|-----|--------|
| — | VOSS login | email verified by VOSS | SIGNED_IN_UNCLAIMED | `user`/`session`/`account` (better-auth); bind hook runs, finds nothing → no-op |
| UNCLAIMED | submit, roll malformed | `parseRollNumber` throws | UNCLAIMED | none (inline error with parser's specific message) |
| UNCLAIMED | submit, class exists | roll resolves to active `classes` row | PENDING_TR | insert `enrollment_requests{status:'pending', classId, email:session.email}` |
| UNCLAIMED | submit, no class | roll parses, no matching class | UNROUTED | insert `enrollment_requests{status:'unrouted', classId:null, department}` |
| PENDING_TR | TR approve | `request.classId ∈ scope.classIds` | APPROVED→LINKED | insert `students` (+`authUserId`); update request `approved` |
| PENDING_TR | TR reject | same scope check | REJECTED | update request `rejected`+reason |
| UNROUTED | HOD creates class | class key matches request | PENDING_TR | update request `classId`, `status:'pending'` (sweep) |
| REJECTED / UNROUTED | student resubmit | one-open-request rule | PENDING_TR/UNROUTED | update same row (or re-open) |
| APPROVED | next request | — | LINKED | none (binding already done at approval) |

Invariant enforced by schema: `partial-unique(authUserId) WHERE status IN ('pending','unrouted')` → at most one open request per person. `approved`/`rejected` rows are terminal history and don't block a later resubmit.

---

## 2. Fallbacks — exactly what happens when the parser can't place a roll

Three distinct failure modes, three distinct handlings (do NOT collapse them):

**(a) Malformed roll** — `parseRollNumber` throws (wrong shape, or a known branch with an illegal division like EXCS-C). No row is written. The form shows the parser's own message verbatim (`"…is not a valid roll number (expected e.g. 23108A0054)"` / `"EXCS has no division C"`). Student stays in UNCLAIMED and corrects. This is a client+server double-check; the server action re-parses and rejects — never trust the client parse.

**(b) Unknown branch code** — parser returns `department: null` (structurally valid, branch not in `BRANCH_CODES`). VERP's 5 branches are the only routable ones. Decision: **treat unknown-branch as UNROUTED, surfaced to super_admin** (no HOD owns an unknown dept). Row written `status:'unrouted', classId:null, department:null`. Super_admin either creates the dept/class or rejects. Never silently drop — a real student with a college-wide roll must not vanish.

**(c) Roll parses, but no class exists yet** (HOD hasn't run P3) — `status:'unrouted', classId:null, department:<known>`. Surfaced to the **HOD of that department** (scope: `department ∈ hod.deptCodes`), not to any TR. This is the deliberate pressure that makes HODs create their classes. When the HOD later creates the matching class (P3), a **sweep** (`rerouteUnrouted(classId)`, run inside `createClass`) finds all `unrouted` requests whose parsed `admissionYear·branchCode·division` equals the new class and flips them to `pending` with `classId` set. They then appear in the TR's queue automatically.

**(d) Class exists but no TR assigned yet** — request still routes to the class (`status:'pending', classId` set). The queue is keyed on `classId`, not on TR identity, so the request sits in the class's queue. Whoever the HOD later appoints as TR (P4) inherits the pending queue with zero extra work. No special state needed.

---

## 3. Server actions / routes and their gates

Every action opens with `getSessionUser()` then `authorize(user, cap, target)`. Enumerated:

| Action / route | Caller state | Capability | Scope check | Notes |
|---|---|---|---|---|
| `submitEnrollmentRequest(roll, first, last)` | UNCLAIMED (role=null) | `authorize(u,"onboarding:request")` | self only — the request's `authUserId := session.user.id`, `email := session.email` (never from body) | re-parse roll server-side; resolve class; conflict-guard against an already-bound `students` row on that roll (flag, don't overwrite); enforce one-open-request |
| `GET /dashboard/tr/queue` (loader) | LINKED faculty (TR) | `authorize(u,"onboarding:read")` | `WHERE classId IN scope.classIds AND status='pending'` — the isolation IS this WHERE | index scan on `(classId,status)`; TR of `2023-108-A` has one classId → sees only `23108A*` |
| `approveEnrollment(requestId)` | TR | `authorize(u,"onboarding:approve",{classId: req.classId})` | **load the row first, then assert `req.classId ∈ scope.classIds`** — never trust the id | the real gate; queue filter is only what she *sees* |
| `rejectEnrollment(requestId, reason)` | TR | `authorize(u,"onboarding:reject",{classId})` | same load-then-check | writes reason |
| `GET /dashboard/hod/unrouted` | HOD | `authorize(u,"onboarding:read")` | `WHERE status='unrouted' AND department IN scope.deptCodes` | the pressure list |
| P1–P4 (dept/hod/class/TR) | super_admin/HOD | see §0 table | dept/class scope | prerequisites |

The current `isStaff(user)` idiom generalizes cleanly: `if (!isStaff)` becomes `await authorize(...)`. The allowlist discipline from session.ts carries over — a `role=null` user passes ONLY `onboarding:request`, nothing else.

---

## 4. What the TR sees

**The queue** (`/dashboard/tr/queue`): only `pending` requests where `classId ∈ her scope.classIds`. For a single-class TR that's exactly the `23·108·A·*` cohort — roll-scoped isolation falls out of the `classId` FK, no roll-prefix string matching at query time (the routing already happened at submit via the parser).

**The profile card** (on opening one request) shows exactly three trust facts:
- **Roll number** (`23108A0054`) — with the derived label `BE-EXCS-A` from `parseRollNumber` + `expectedYear`.
- **Verified email** (`…@vit.edu.in`) — the un-forgeable anchor, taken from the session, labeled "VOSS-verified".
- **Name** (first + last, as the student typed it).

**Attendance cross-reference signal (if present):** if a roster/attendance sheet was previously imported for this class (via the existing `xlsx-import.ts` path), the card shows a soft match badge — "matches roster entry for 23108A0054: Firstname Lastname" or "no roster match / name differs". This is a *confidence hint*, not a gate: the trust model is the TR recognizing the student against her own class attendance sheet, so the badge assists recognition but approval is her human judgment. If no sheet was imported, the card simply omits the badge — onboarding does not depend on a prior roster (that's the whole point of replacing roster-first).

She clicks **Approve** or **Reject (+reason)**.

---

## 5. The binding step — reuse, not replace

The existing `bindIdentity` hook stays exactly as-is. Onboarding does not add a second binding mechanism; it **creates the row that the existing hook will bind to**, and binds it inline at approval.

`approveEnrollment(requestId)` writes, in order:
1. Re-assert `req.classId ∈ scope.classIds` (the gate).
2. Insert the `students` row from the request + parsed roll: `{rollNumber, firstName, lastName, email: req.email, department, division, year(derived), classId, authUserId: req.authUserId, isActive:true}`. Note `email` = the request's email = the student's VOSS-verified session email — the same anchor `bindIdentity` binds on. `authUserId` is set **here, at creation**, so no second sign-in is needed.
3. Update request → `status:'approved', reviewedBy, reviewedAt`.
4. Audit `student.onboarded` + `identity.bound`.

**Interaction with `session.create.after` → `bindIdentity`:** on the student's next request, `getSessionUser()` finds the now-bound `students` row → `role='student'` → LINKED. The bind hook still fires every login but is a **no-op**: the row already carries this `authUserId` and this email, so `bindIdentity`'s `if (!student.authUserId)` branch is skipped and its `already linked to a different account` guard passes (same id). This is exactly the idempotence the hook's comment already promises ("once the row carries this authUserId it is a no-op"). 

So: **reuse.** The only reason `bindIdentity` doesn't do the binding itself in this flow is that at approval time we're acting as the TR, not in the student's session — so we set `authUserId` directly on insert (equivalent to what `linkStudentToAuthUser` does) rather than waiting for the student's next `bindIdentity` call. Both paths converge on the same invariant: a `students` row whose `authUserId` = the VOSS identity whose verified email = the row's email. The email anchor is never a typed field — preserving the exact takeover protection `bind.ts` documents.

One edge to honor from `bind.ts`: if a roll is *already* bound to a different `authUserId` when a new request comes in for that roll, `submitEnrollmentRequest`'s conflict guard flags it and refuses (someone already claimed it) — it never overwrites, mirroring the existing "already linked → throw" guard.

---

## 6. Data-write summary per transition (the ledger)

- **Submit (routed):** +1 `enrollment_requests` (pending, classId, verified email), +1 audit.
- **Submit (unrouted):** +1 `enrollment_requests` (unrouted, classId=null, department), +1 audit.
- **HOD creates class → sweep:** N `enrollment_requests` updated (classId set, status→pending), +1 audit per class.
- **Approve:** +1 `students` (bound), 1 `enrollment_requests` updated (approved), +2 audit.
- **Reject:** 1 `enrollment_requests` updated (rejected+reason), +1 audit.
- **Resubmit:** 1 `enrollment_requests` re-opened/updated, +1 audit.
- **Login post-approval:** 0 writes (bind hook no-ops).

---

## Files this flow touches (all absolute)

- `/Users/harshalmore31/code/voss/verp/src/lib/bind.ts` — extend: super_admin bootstrap seam (P0); no-op path for create-at-approval rows (already idempotent, verify the roll-conflict guard covers the new path).
- `/Users/harshalmore31/code/voss/verp/src/lib/session.ts` — extend `SessionUser` with `role: super_admin|hod|faculty|student|null` + scope (`deptCodes`, `classIds`); source of the `authorize` scope facts.
- `/Users/harshalmore31/code/voss/verp/src/lib/roll-number.ts` — reused unchanged; `parseRollNumber` is the router (submit-time) and the class-key deriver.
- `/Users/harshalmore31/code/voss/verp/src/lib/auth.ts` — `session.create.after` hook unchanged; it remains the idempotent bind trigger.
- `/Users/harshalmore31/code/voss/verp/src/app/unclaimed/page.tsx` — becomes the self-registration form (email locked to `session.email`).
- New: `src/db/schema/{departments,classes,assignments,onboarding}.ts` (+ `faculty.role` column replacing `isAdmin`); `src/lib/rbac.ts` (`can`/`authorize`/`inScope`); server actions `submitEnrollmentRequest`, `approveEnrollment`, `rejectEnrollment`, `createClass`(+sweep), `assignTr`, `appointHod`, `createDepartment`; TR queue route `/dashboard/tr/queue` and HOD `/dashboard/hod/unrouted`.

**The load-bearing invariants:** (1) email is always `session.email`, never typed — preserves `bind.ts`'s takeover protection; (2) class key = cohort (`admissionYear·branchCode·division`), never the year label — time-stable membership; (3) queue isolation = the `classId ∈ scope.classIds` WHERE clause, and every mutation re-checks `req.classId` against scope *after loading the row* — the visible queue is not the gate; (4) unrouted requests are never dropped — they escalate to HOD (known dept) or super_admin (unknown branch) and re-route on class creation.