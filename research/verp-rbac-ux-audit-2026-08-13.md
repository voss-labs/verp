# VERP RBAC and ERP UX Audit

Date: 2026-08-13  
Target: `https://verp.vosslabs.org/`  
Scope: repository architecture, production demo identities, role and scope boundaries, first-login identity binding, academic workflows, responsive behavior, and UI/UX consistency.

## Executive verdict

VERP has a sound RBAC foundation: VOSS is the only authentication door, identity binding uses verified email, session resolution carries role and scope separately, capability precedence is unit-tested, page guards generally fail closed, and the tested roles could not navigate into higher-privilege surfaces.

It is not ready to hold production academic records without hardening three write paths. An authenticated faculty member can submit roster rows outside their scope, and forged marks or batch payloads can name students outside the target class. The capability model also disagrees with the coordinator and HOD workflows rendered by the UI, leaving legitimate controls unusable.

Recommended direction: repair the scoped write boundary first, then reconcile role defaults with the workflow rules already encoded in `allocation.ts`. Do not begin with visual polish while cross-scope academic writes remain possible.

## Test environment and data state

- Production demo identities verified: `admin@vosslabs.org`, `hod@vosslabs.org`, `ac@vosslabs.org`, `tr@vosslabs.org`, and `student@vosslabs.org`.
- HOD scope: department `EXCS`.
- Coordinator and TR scope: class `2023-108-A` / `BE · EXCS · A`.
- No permission overrides existed during the audit.
- The seeded student row for `student@vosslabs.org` was unclaimed before testing. The normal VOSS first-login flow created its auth identity and VERP bound it to roll `23108A0099`. The `identity.bound` audit event was verified.
- No attendance, marks, permissions, roster, course, class, faculty, or department data was modified.
- `npm run check` passed: typecheck, formatting, 80 Vitest tests, and lint with two non-blocking warnings.
- Production emitted one React hydration error (`#418`, text mismatch) while switching and loading role surfaces.

## RBAC model observed

| Tier | Intended scope | Verified accessible surfaces | Verified denied surfaces |
|---|---|---|---|
| Super-admin | Institution-wide wildcard | Admin console, departments, faculty, role matrix, audit, all students, all class academic pages | None in the tested ERP surface |
| HOD | Appointed department(s) | Department/classes, faculty, course catalogue, students, class overview, subject allocation | Admin console, audit, student self view; attendance and marks entry are also denied |
| Coordinator | Assigned coordinator class(es) | Class roster, enrolment queue, attendance, marks, locks, results, batches, subject UI | Admin, department console, faculty, audit, out-of-class students |
| TR/faculty | Assigned class(es), allocated offerings | Class roster, enrolment queue, attendance, own offering marks, results, batches | Admin, department console, faculty, audit, out-of-class students, student self view |
| Student | Own linked student ID | Own dashboard and marks/SGPI | Every staff/admin surface, roster/import, class pages, audit, own and other student-detail URLs |

Direct URL checks confirmed that navigation hiding is not the only control: server-rendered guards redirected or denied unauthorized pages. A coordinator request for a known student in another class redirected to the coordinator's scoped roster.

## Findings

### P0: roster import permits cross-scope student creation

`src/app/api/students/import/route.ts:32-34` checks only `isStaff(user)`. It then trusts each submitted `department`, `division`, and roll-derived `classKey` and inserts the row at lines 97-109. There is no comparison with `user.deptCodes`, `user.classKeys`, or a capability dedicated to roster creation.

Impact: any authenticated faculty member, including a TR assigned to one class, can forge a POST payload that creates students for another class or department. The UI exposes Import roster to every faculty user, so this is not an unreachable code path.

Required fix: derive department and class from the roll on the server, reject mismatches in the supplied descriptive fields, and enforce one scope rule before any insert:

- super-admin: any valid known class/department;
- HOD: derived department in `deptCodes`;
- faculty: derived class key in `classKeys`.

Apply the same scope validation in preview and commit, but treat commit as authoritative.

### P0: marks and batch writes accept students outside the class

`saveMarksAction` verifies the offering and caller's class/subject authority, but maps every submitted `studentId` directly into the upsert (`src/app/dashboard/class/actions.ts:303-310`). Unlike attendance (`lines 165-179`), it never intersects the submitted IDs with the target class roster. The marks table has no database constraint linking a student to the offering's class.

`assignBatchAction` has the same gap (`src/app/dashboard/class/actions.ts:479-483`): arbitrary student IDs are passed into `assignStudentsToBatch`, and the batch-assignment schema only checks that both referenced rows exist.

Impact: a teacher can attach marks or lab-batch membership from their offering to a student in another class. `getMarksForStudent` reads by student ID alone, so the foreign mark can appear in that student's academic record.

Required fix: create one reusable `requireStudentsInClass(classKey, ids)` boundary and call it from marks, batch assignment, attendance, imports, and future enrolment writes. Reject the entire request when any ID is outside scope; silently dropping forged IDs makes corruption attempts harder to detect. Add database-level enrolment/class invariants or RLS as the second layer.

### P1: coordinator controls are rendered but capability checks reject them

The Subjects page recognizes `coordinatorClassIds` and renders allocation controls (`src/app/dashboard/class/[classId]/subjects/page.tsx:29-34`). `allocation.ts` also states that coordinators may allocate subjects. However:

- `createSubjectAction` first requires `offering:create`;
- `assignOfferingFacultyAction` first requires `offering:update`;
- the faculty defaults in `src/lib/rbac.ts:183-197` grant neither capability.

Impact: the coordinator sees teacher selectors and Add from catalogue, but the corresponding server actions return Forbidden.

Required fix: grant `offering:create` and `offering:update` to the faculty tier, retaining `canAllocate(...)` as the class-assignment scope check that excludes plain TRs. Add integration tests for coordinator success and TR denial.

### P1: HOD workflow copy and allocation rules disagree with HOD capabilities

The Subjects UI says, “Coordinators and the HOD can write any of them” (`subjects/client.tsx:191-192`), and `allocation.ts` treats the HOD as able to cover an allocated teacher. But HOD defaults include only `attendance:read` and `marks:read` (`src/lib/rbac.ts:158-182`). Production therefore redirects the HOD away from attendance and marks entry.

Required fix: decide the workflow once. The existing product copy and allocation code consistently imply cover authority, so add `attendance:write`, `marks:write`, and `marks:lock` to HOD defaults and test the full path. If HOD must be read-only, remove every contrary rule and sentence instead.

### P1: staff overview leaks global counts outside role scope

Every staff tier executes the same four unscoped counts over departments, classes, students, and faculty (`src/app/dashboard/page.tsx:21-50`). In production, both TR and coordinator saw the institution-wide totals even though their roster access was limited to one class.

Required fix: make the overview role-specific and scope-specific. A TR needs assigned classes, roster size, pending approvals, attendance sessions, and outstanding marks. An HOD needs department totals. Only super-admin should receive institution totals.

### P1: attendance defaults unsaved sessions to 100% present

For a new date/slot, every missing attendance row becomes `present` (`attendance/page.tsx:59-64`). Production displayed `89 / 89 present` before any record existed, and Save would persist the entire class as present.

The UI also hardcodes slot `1` unless a URL parameter is manually supplied and offers no subject/session selector (`attendance/page.tsx:34-39`). This cannot model multiple lectures in one day reliably. The UTC-based `toISOString()` default can also select the previous local date during early-morning IST use.

Required fix: use an explicit unmarked state, require session/subject selection, show progress as “0 of 89 marked,” confirm bulk-present actions, and derive the default date in the college timezone. Persist only explicitly marked students or require 100% completion before final submission.

### P1: production hydration error and identity/navigation flicker

Production logged React error `#418` for a text hydration mismatch. The UI repeatedly rendered `User` before replacing it with the signed-in identity. `DashboardLayout` already resolves the full server-side `SessionUser`, but `AppSidebar` independently calls `useSession`, while `PageHeader` and the sidebar independently fetch `/api/me` through a module-global client cache.

Required fix: pass a serialized server-resolved identity and tier from `DashboardLayout` into a small client provider. Use it as the initial source for sidebar, header, and navigation; refresh it only after an actual session change. This removes duplicate auth reads, the empty navigation frame, and the hydration mismatch.

### P2: filter controls expose the internal `__all` sentinel

The student roster displays `__all` in the Department, Year, and Division controls. `DataTableView` uses `__all` as an internal Select sentinel but the trigger renders the raw value (`src/components/data-table-view.tsx:44-46, 189-207`).

Required fix: provide a label/value item map to the Select primitive or render “All departments,” “All years,” and “All divisions” explicitly in the trigger.

### P2: incomplete marks use inconsistent semantics

For the same ungraded subject, the dashboard displayed `0 / 75` while My marks displayed `—`. A partial MSE entry can also leave Total at zero because the two MSE values are averaged only after both exist. The calculation is defensible, but the UI reads as lost data.

Required fix: use one presentation component everywhere. Show “In progress” for incomplete subjects, show a provisional sum only when clearly labelled provisional, and expose entered components without implying a final total or zero grade.

### P2: permissions console needs operational safeguards

The role matrix is understandable on desktop, but high-impact changes are immediate switches with no summary of affected users/scopes, no search, no sticky headers/first column, and no confirmation for revoking a default. The underlying session resolver supports user-level overrides, but the console exposes only role-level overrides.

Required fix: add capability search, sticky role headers, an impact preview, confirmation for destructive revocations, a visible audit reason, and a user-exception screen only when a concrete use case requires it.

### P2: repository documentation describes an obsolete product

`README.md:13,33-40` says email/password auth and seeded password accounts. `docs/api.md:9-17,39-88` documents old roles, password endpoints, broad write endpoints, and CORS behavior that do not match the current application routes.

Impact: operators and contributors can configure or integrate against an authentication path that no longer exists.

Required fix: rewrite setup and API docs around VOSS OIDC, verified-email binding, the four tiers, capabilities plus scope, current routes, demo seeding, and the actual first-login lifecycle.

### Hardening: the planned database isolation layer is still absent

The research architecture intentionally sequenced PostgreSQL RLS after the app-layer scoped-query boundary. No RLS policies or non-owner application role are present. Because the app boundary currently has the marks, batch, and roster holes above, database defense-in-depth is now more valuable than the original plan assumed.

Do not bolt session GUCs onto stateless `neon-http`. After the application fixes, implement the already-researched transaction/JWT approach for tenant tables or enforce equivalent database invariants that make cross-class academic rows impossible.

## UI/UX direction for a real college ERP

The visual system is clean and restrained, but most overview screens still behave like generic CRUD. The product should orient each user around today's academic work:

- TR/coordinator home: today's classes, pending attendance, pending marks components, unreviewed enrolments, and exceptions.
- HOD home: department health, unstaffed classes, unallocated subjects, unclaimed students, incomplete attendance/marks, and decisions requiring approval.
- Student home: attendance by subject with threshold warnings, marks publication state, upcoming assessments, and a clear distinction between provisional and final results.
- Super-admin home: configuration completeness, identity/claim anomalies, audit exceptions, and cross-department operational health.

Keep the existing restrained visual language. The key improvement is information architecture and workflow state, not decoration.

## Verification matrix to add to CI

1. Table-driven capability tests for defaults and role/user override precedence.
2. Integration tests for every server action: unauthenticated, missing capability, in-scope success, out-of-scope denial, inactive subject/user, and forged related IDs.
3. Route tests for all role/page combinations.
4. Coordinator versus TR tests for allocation, marks locking, and reopening.
5. HOD cover-authority tests after the role decision is applied.
6. Import tests proving mixed-scope batches fail atomically.
7. Marks and batch tests proving an out-of-class student ID is rejected.
8. Identity lifecycle tests: roster-first binding, request-first approval, already-bound conflict, inactive row, and unbound user.
9. Browser tests for hydration, mobile roster scrolling, attendance completion, empty states, and filter labels.

## Recommended implementation order

1. Close roster, marks, and batch scope escapes and add integration tests.
2. Reconcile coordinator/HOD capabilities with `allocation.ts` and UI copy.
3. Redesign attendance around explicit sessions and unmarked state.
4. Scope staff dashboards and remove hydration/client-auth duplication.
5. Fix filter labels and student marks semantics.
6. Rewrite operational documentation.
7. Add the planned database isolation layer before wider real-student rollout.
