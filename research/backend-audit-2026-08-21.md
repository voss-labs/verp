# VERP backend audit

Date: 2026-08-21
Method: six parallel audit dimensions (schema/migrations, server actions, API routes, frontend-backend contract, RBAC matrix, live DB probes) synthesized and adversarially re-verified by a judge agent; plus four live CRUD loops exercised in the browser (admin coordinator appointment, HOD coordinator assignment, attendance keyboard save, marks entry save with publish-gate check). Read-only against the dev database.

Verdict: 3 critical, 10 high, 23 medium, 15 low (51 findings).


## Critical

### 1. A marks import silently erases every mark component the uploaded file does not map

Area: marks import → saveMarksAction

applyMapping always returns all four stored fields, filling null for any column mapped to "skip" (src/lib/marks-import.ts:117-131). The import client spreads that whole object into the row payload (marks/import/client.tsx:101-106). saveMarksAction copies isa/mse1/mse2/ese straight through (class/actions.ts:414-422) and upsertMarks sets all four unconditionally from `excluded` (src/db/queries/marks.ts:21-31). The only carry-forward of stored values is for LOCKED components (class/actions.ts:432-444); an unlocked component is overwritten with null. Nothing warns: the button reads "Save N matched", the audit row records only `{count}`, and there is no version history, so the erased marks are unrecoverable. The grid path is unaffected because it always sends all four fields read back from the server.

Evidence: src/lib/marks-import.ts:124-129 `isa: sumOrNull(pick("isa"))` → null when no column maps to isa. src/app/dashboard/class/[classId]/marks/import/client.tsx:101-106 `...applyMapping(r.marks, mapping)`. src/db/queries/marks.ts:21-31 `set: { isa: sql\`excluded.isa\`, mse1: …, mse2: …, ese: … }`. src/app/dashboard/class/actions.ts:432 `if (locked.length > 0 && previous)` — the merge runs only for locked components. Live: offering d4ded969 (EC34T) has 62 marks rows with isa set on 62 of them and no row in marks_locks, so an ESE-only import against it today nulls 62 ISA marks.

Fix: In saveMarksAction, merge instead of replacing whenever `input.importFile` is present: `previous` is already loaded on that branch (class/actions.ts:423-431), so for each of isa/mse1/mse2/ese keep `before?.field` when the incoming value is null. Change is local to src/app/dashboard/class/actions.ts:414-446.

### 2. An HOD can mint a super_admin — `role` is written straight into the faculty_role enum with no runtime validation

Area: src/app/dashboard/admin/actions.ts:93-139 createFacultyAction

Line 125 passes `role: input.role` into createFaculty, which does a bare insert with no validation (src/db/queries/faculty.ts:65-68). The TypeScript union `"faculty" | "hod"` is erased at runtime and a Server Action deserializes its payload with no schema check — there is no zod in any action file. The faculty_role pgEnum accepts `super_admin`. faculty:create is an HOD default (rbac.ts:161) and the scope check at line 113 constrains only `input.department`, never `input.role`. getSessionUser maps `fac.role === "super_admin"` to `tier: "super_admin"` (session.ts:159-162), and can() then short-circuits every capability (rbac.ts:247). The department-workspace twin hardcodes `role: "faculty"` with a comment saying an HOD cannot mint another HOD (dept/actions.ts:175), so the intent is explicit and this path contradicts it. Reachability is the premise this repo already accepted in commit a691983: the comment at admin/actions.ts:110-112 says a scope check was added here precisely because a Server Action is reachable by POST regardless of the super-admin-gated page that renders it — the department was scoped, the role was not.

Evidence: src/app/dashboard/admin/actions.ts:99 `role: "faculty" | "hod"`, :103 `authorize(user, "faculty:create")`, :113 inDeptScope on the department only, :125 `role: input.role`. src/db/queries/faculty.ts:65-68 `db.insert(faculty).values(data)`. src/lib/session.ts:159-162. Live: `select enumlabel from pg_enum … where typname='faculty_role'` → super_admin, hod, faculty; permission_overrides is empty, so ROLE_DEFAULTS is the running truth and no override is needed. bindIdentity binds on verified email alone (src/lib/bind.ts:22-45).

Fix: Validate at the boundary before the write: `if (input.role !== "faculty" && input.role !== "hod") return { error: "Unknown role." }`, and additionally refuse `role === "hod"` unless `can(user, "faculty:setRole")` so tier assignment stays with the capability that exists for it.

### 3. Faculty bulk import passes an auth user id into a uuid FK column, unseating the class's sitting coordinator and installing nobody

Area: src/app/dashboard/dept/actions.ts:179-190 bulkImportFacultyAction

Line 184 passes `user!.id` — the Better Auth user id, a text value — as `assignedBy`. Every other caller passes `user!.facultyId` (dept/actions.ts:317, class-staff call at :710). faculty_class_assignments.assigned_by is `uuid REFERENCES faculty(id)` (src/db/schema/assignments.ts:29-31), so the insert always throws `invalid input syntax for type uuid`. For role `academic_coordinator`, assignClassRole retires the live coordinator with an UPDATE *before* the failing INSERT (src/db/queries/class-staff.ts:31-42 then :47-57), and prod runs neon-http with no transactions, so the retirement is never rolled back. The throw is swallowed by the per-row `catch { failed++ }` at :188, after `created++` already ran at :177 — so every row is reported as both created and failed, `assigned` stays 0, and no message names the cause. The class is left with no academic_coordinator: nobody can approve or reject enrolment, publish results, reopen a lock, or allocate subjects on it.

Evidence: src/app/dashboard/dept/actions.ts:179-190 vs :313-318. src/db/schema/assignments.ts:29-31. Live probe: `select data_type from information_schema.columns where table_name='faculty_class_assignments' and column_name='assigned_by'` → uuid; `select id from "user"` → dev-admin, dev-hod-excs, …; `select 'dev-admin'::uuid` → ERROR: invalid input syntax for type uuid. Production ids are Better Auth nanoids, equally non-UUID. Reachable from the UI: src/app/dashboard/dept/faculty-import/client.tsx:159 offers a "Coordinator" option beside the class picker.

Fix: Change src/app/dashboard/dept/actions.ts:184 from `user!.id` to `user!.facultyId`. Separately, move the coordinator-retire UPDATE in src/db/queries/class-staff.ts:31-42 to run only after a successful insert, so a failed appointment on a driver with no transactions cannot leave a class unstaffed.


## High

### 4. Class coordinators cannot allocate subjects: offering:create and offering:update are missing from the faculty tier

Area: RBAC — src/lib/rbac.ts:196-210 vs the Subjects page

ROLE_DEFAULTS.faculty holds offering:read and nothing else in that domain. The Subjects page computes canAllocate from tier plus coordinatorClassIds with no capability check (subjects/page.tsx:31-34) and passes it to the client, which renders the per-subject teacher select and the whole "Add from catalogue" panel on it (subjects/client.tsx:191, :242). createSubjectAction then calls `authorize(user, "offering:create")` (class/actions.ts:278) and assignOfferingFacultyAction calls `authorize(user, "offering:update")` (class/actions.ts:744). Every academic coordinator is faculty-tier, so both throw. "Forbidden" is a SAFE_PREFIX in error-utils.ts:49, so the coordinator's toast reads literally "Forbidden: missing capability offering:create". The coordinator's own dashboard routes them here to fix unallocated subjects, and the page text tells them coordinators can do it.

Evidence: src/lib/rbac.ts:196-210 (faculty list contains offering:read only). src/app/dashboard/class/[classId]/subjects/page.tsx:31-34. src/app/dashboard/class/actions.ts:278 and :744. src/lib/error-utils.ts:47-59, :70-72. Live: every active academic_coordinator row belongs to a faculty whose faculty.role is 'faculty' (dev.coordinator@vit.edu.in, dev.teacher.b@vit.edu.in, manasi.mane102@…, …); permission_overrides is empty.

Fix: Add "offering:create" and "offering:update" to ROLE_DEFAULTS.faculty at src/lib/rbac.ts:196. Scope already bounds them: both actions gate on canAllocate(), which admits only the class's coordinator — the same shape as attendance:write and marks:write being faculty defaults bounded by canWriteOffering().

### 5. Switching the date or the subject keeps the previous session's register on screen, and Save writes it to the new session

Area: src/app/dashboard/class/[classId]/attendance

AttendanceClient seeds its entire register from props in a useState initializer (client.tsx:57-59). Changing the date or the Session dropdown calls go(), which router.push()es to the same route with different search params (client.tsx:76-87). A soft navigation within the same route segment re-renders the client component in place — it is not unmounted, so the initializer does not re-run — and the page renders <AttendanceClient …/> with no `key` (attendance/page.tsx:83-103). After taking Subject A's register, selecting Subject B shows every student still carrying A's statuses, unsavedCount counts them all as unsaved, Save is enabled, and pressing it writes A's register into B's session. The comment at client.tsx:74-75 states the opposite intent. The marks grid already carries the fix — `key={gridIdentity(grid)}` at marks/client.tsx:34 — which is direct in-repo evidence that navigation alone does not remount.

Evidence: src/app/dashboard/class/[classId]/attendance/client.tsx:57-59, :76-87, :91-93. src/app/dashboard/class/[classId]/attendance/page.tsx:83 (no key prop). Contrast src/app/dashboard/class/[classId]/marks/client.tsx:34.

Fix: Key the client on the session identity in attendance/page.tsx:83: `<AttendanceClient key={`${date}|${slot}|${offeringId ?? "class"}`} … />`.

### 6. After switching subject on the Batches tab, Assign puts students into the previous subject's batch

Area: src/app/dashboard/class/[classId]/batches

`target` is seeded once from `batches[0]?.id` (batches/client.tsx:40). The subject chips navigate with router.push(...?offering=…) (client.tsx:105-113), which re-renders the client in place without remounting, so `target` keeps pointing at a batch belonging to the subject just left. The new subject's batch buttons show none selected, but assign() is still enabled (`!target` is false) and posts the stale batchId. The server catches nothing: assignBatchAction resolves the batch to its own offering, finds the same class, and the roster check passes because both offerings sit on that class (class/actions.ts:642-670). The toast says "Students assigned" and the students land in the wrong subject's lab group.

Evidence: src/app/dashboard/class/[classId]/batches/client.tsx:40, :69-81, :105-113. src/app/dashboard/class/actions.ts:642-673 — validates only that the students belong to offering.classId's class, never that the batch belongs to the offering the user is looking at.

Fix: Key the client on the selected offering in batches/page.tsx, and defensively narrow in the client: `batches.some(b => b.id === target) ? target : null` before enabling Assign.

### 7. The roster import writes the payload's `department` verbatim — a scope key — without cross-checking it against the roll the scope check trusted

Area: src/app/api/students/import/route.ts:151-163

Scope is deliberately judged on the roll number and not on the department column; the comment at route.ts:86-90 says so. The insert then writes that same untrusted column straight to storage at :157. students.department is a scope key: getStudentsByDepartments(user.deptCodes) is what an HOD's roster and department dashboard read (src/db/queries/students.ts:19-28). There is no FK on the column, so any string is accepted. The cross-check that would catch this exists only in the browser — flagRow compares the department cell against the roll-derived department (src/lib/xlsx-import.ts:192-224) and the client refuses to commit while anything is flagged — and the server re-validates none of it. `division` (:158) has the same hole: it is `z.enum(["A","B","C"])` while several branches run only A/B.

Evidence: src/app/api/students/import/route.ts:151-163 `department: r.department, division: r.division ?? null, … classKey: tryClassKeyFromRoll(r.rollNumber)`. src/db/queries/students.ts:19-28. Live: `\d students` shows `department` with an index but no foreign-key constraint. An in-scope HOD posting rolls 23108Axxxx with `"department":"EXTC"` produces students whose class_key is 2023-108-A but whose department reads EXTC — they appear on the EXTC HOD's roster, vanish from the EXCS one, and their class page still lists them because the roster is class_key-keyed.

Fix: Derive the trusted fields server-side: call parseRollNumber(r.rollNumber) in the row loop (the scope check already parses it) and write `department: parsed.department ?? r.department` and `division: parsed.division`; where parsed.department disagrees with the payload, push a row error instead of inserting — the same rule flagRow already applies in the browser.

### 8. The out-of-scope refusal writes a ledger row into the victim department's scope, with an attacker-chosen label and attacker-supplied free text

Area: src/app/api/students/import/route.ts:96-113

The whole-batch scope rejection itself is intact, but before returning 403 it writes an import_batches row whose scope_label comes from rosterScopeLabel(rows) — derived from the payload's department column, which the refused caller fully controls (:39-42). import_batches is a scoped surface: importScopeFor gives an HOD `or(actorUserId = self, scopeLabel IN deptCodes)` (src/db/queries/import-batches.ts:18-24, 43-48), so a row labelled EXTC lands in the EXTC HOD's import centre no matter who wrote it, and error_summary is rendered verbatim there. error_summary is `scope.reason + scope.offending.join(", ")`, and offending is up to ten unvalidated roll strings from the payload (src/lib/scope.ts:29-38). Both sibling commit paths get this right: saveMarksAction returns on out-of-scope before its recordImport helper can run and labels with the server-derived cls.classKey (class/actions.ts:344-345, 367); bulkCreateCoursesAction returns before recording.

Evidence: src/app/api/students/import/route.ts:96-113 (createImportBatch then `return apiError(message, 403)`), :39-42 `rows.map(r => r.department.trim().toUpperCase())`, and the same payload-derived label on the committed path at :214. src/db/queries/import-batches.ts:47 `or(own, inArray(importBatches.scopeLabel, scope.scopeLabels))`.

Fix: Move the 403 ahead of createImportBatch so a refused caller records nothing. If a refusal record is wanted, derive the label from the caller (user.deptCodes[0], or a literal "out-of-scope") and keep payload roll strings out of errorSummary. Apply the same server-derived label on the committed path at :214.

### 9. Three admin actions carry no department scope check at all, and the roles console offers their capabilities to the HOD tier with one toggle

Area: src/app/dashboard/admin/actions.ts — appointHodAction, appointCoordinatorAction, setFacultyRoleAction

hod:appoint and faculty:setRole are not HOD defaults today, so this is latent rather than live — but every other HOD-grantable capability in the catalogue has a scope check behind it, and these three have none. appointHodAction (:193-233) validates the department and the target but never checks input.deptCode against user.deptCodes. appointCoordinatorAction (:235-255) goes from authorize() straight to the write with no validation of any kind. setFacultyRoleAction (:141-162) takes a bare facultyId and calls updateFaculty with no lookup, no scope test and no self-guard — while its sibling deactivateFacultyAction twenty lines below does exactly that lookup on the same table (a691983). The permissions console renders a switch for all 35 capabilities across three tiers, "Appoint HOD / coordinator" and "Change faculty tier" included (rbac.ts:64-76). Granting hod:appoint to the hod tier is instant cross-department escalation: appointHod sets faculty.role='hod' and inserts the appointment (appointments.ts:26-43), so the HOD of one department appoints themselves head of every other. Granting faculty:setRole is the same shape one level down.

Evidence: src/app/dashboard/admin/actions.ts:193-233, :235-255, :141-162 — no inDeptScope import is used in any of the three, though the file imports it at :5 for createFaculty/deactivateFaculty. src/lib/rbac.ts:64-76 (both capabilities are in CAPABILITY_CATALOG, hence togglable). src/lib/allocation.ts exists for exactly this check.

Fix: Add the guard the siblings already use. In appointHodAction and appointCoordinatorAction after authorize(): `if (!inDeptScope(user!, input.deptCode)) return { error: "That department is not in your scope." }`. In setFacultyRoleAction, load the target with getFacultyById, check inDeptScope on target.department, refuse when facultyId === user.facultyId, and refuse `role === "hod"` unless the caller is super_admin.

### 10. scope_label is an unconstrained polymorphic column and the HOD import-history filter compares it against the wrong vocabulary

Area: src/db/queries/import-batches.ts + the four writers of scope_label

import_batches.scope_label is bare text with no CHECK, no discriminator and no FK, while kind and status are both CHECK-constrained. Four writers put three different vocabularies into it: a class key from the marks import (class/actions.ts:367 `scopeLabel: cls.classKey`, e.g. "2023-108-A"), a department code (dept/actions.ts:130 and :593), and a department code or the literal "institution" from the roster route (api/students/import/route.ts:109, :214). The single reader assumes only department codes: importScopeFor sets `scopeLabels: viewer.deptCodes` and scopeCondition emits `inArray(importBatches.scopeLabel, scope.scopeLabels)`. A class key can never equal a department code, so a marks import run by a coordinator is invisible to their own HOD's import centre unless the HOD happened to be the actor. Nothing compensates — the imports page passes importScopeFor(user) straight through.

Evidence: src/db/schema/import-batches.ts:32 (bare text). src/db/queries/import-batches.ts:21 and :47. Writers at src/app/dashboard/class/actions.ts:367, src/app/dashboard/dept/actions.ts:130 and :593, src/app/api/students/import/route.ts:109 and :214. Live: `select conname … where conrelid='import_batches'::regclass` returns only the pkey, the actor FK and the two CHECKs on kind and status — nothing on scope_label. The table is empty (0 rows), so the feature has not been exercised yet.

Fix: Add a resolved department column and filter on it: `ALTER TABLE import_batches ADD COLUMN scope_dept_code text REFERENCES departments(code)` plus an index, mirror it in the schema, write `cls.departmentCode` at class/actions.ts:367 and the verified deptCode at the other call sites, and change import-batches.ts:47 to `inArray(importBatches.scopeDeptCode, scope.scopeLabels)`. Keep scope_label as the human-readable display value only.

### 11. "Register not taken today" is suppressed by a single attendance row, and a subject register stands in for the class register

Area: src/db/queries/overview.ts:209-224 + src/lib/attention.ts:100

markedToday counts attendance rows filtered on classId and sessionDate only. It does not filter `courseOfferingId IS NULL` and it does not compare the count against the roster. attention.ts:100 then gates the nudge on `c.students > 0 && c.markedToday === 0`. Two failures follow: a partially-saved register (a teacher marks a handful of students and saves) sets markedToday > 0, so the coordinator's inbox reports nothing outstanding while most of the class has no record for the day; and a subject register — courseOfferingId set — also counts, so taking one lab's register silently satisfies the class-level nudge. The rest of the codebase is careful about this distinction: getAttendanceForSession branches on isNull(courseOfferingId) with a comment saying reading them together would show one as the other.

Evidence: src/db/queries/overview.ts:209-224 (the todayMarked select: `inArray(classId, classIds)` and `eq(sessionDate, today)`, nothing else). src/lib/attention.ts:99-111. Contrast src/db/queries/attendance.ts:76-82.

Fix: Add `isNull(attendanceTable.courseOfferingId)` to the todayMarked query so it measures the class-level register only, and change the gate at attention.ts:100 to `c.students > 0 && c.markedToday < c.students` so a partial register still asks to be finished.

### 12. npm run dev:seed empties 18 tables and then aborts on a foreign key violation once any import has been recorded

Area: scripts/seed-dev.ts:204-227

The clear loop deletes a hardcoded list of 19 tables with `"user"` last. import_batches is not in that list, and import_batches_actor_user_id_fkey has no ON DELETE rule. The moment a single import batch exists, the final `DELETE FROM "user"` raises a foreign-key violation — after all 18 other DELETEs have already committed as separate statements with no transaction. main() throws and exits 1, leaving an empty database: no departments, no classes, no students, no faculty, no persona user rows. The dev identity switcher has nothing to offer, and re-running dev:seed fails identically until someone deletes from import_batches by hand. The file's header claims running it twice is the same as running it once; that guarantee is void.

Evidence: scripts/seed-dev.ts:206-227 (the table list; import_batches absent, `"user"` last). Live: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='import_batches'::regclass` → `import_batches_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES "user"(id)` with no delete rule. import_batches is currently empty (0 rows), which is the only reason the seed still runs; createImportBatch is wired at api/students/import/route.ts:101 and :199, dept/actions.ts:120 and :584, and class/actions.ts:357.

Fix: Add `"import_batches"` to the clear list in scripts/seed-dev.ts, before `"session"`.

### 13. Deactivating a faculty leaves every live role and every allocated subject still pointing at them

Area: src/app/dashboard/admin/actions.ts:164-191 deactivateFacultyAction

deactivateFaculty is a single `UPDATE faculty SET is_active=false` (src/db/queries/faculty.ts:82-84). Nothing touches dept_appointments, faculty_class_assignments, or course_offerings.facultyId. Both listActiveAppointments (appointments.ts:80-93) and listClassStaff (class-staff.ts:79-97) inner-join faculty with no isActive filter, so a deactivated person keeps appearing as HOD, coordinator and TR. Their offerings keep their facultyId, so the subject reads as allocated and never surfaces as work needing an owner — the exact state removeClassRoleAction exists to prevent (its comment says an unallocated subject is visible and fixable, a ghost allocation is not). Separately, an HOD can deactivate their own row (it is in their own department, so inDeptScope passes), dropping themselves to tier null with no way back except a super_admin.

Evidence: src/app/dashboard/admin/actions.ts:179 is the only write. src/db/queries/faculty.ts:82-84. src/db/queries/appointments.ts:90-92 and src/db/queries/class-staff.ts:89-96 — both innerJoin faculty with no isActive predicate. Contrast src/app/dashboard/dept/actions.ts:757-763.

Fix: In deactivateFacultyAction, release their offerings via setOfferingFaculty(id, null), deactivate their faculty_class_assignments and dept_appointments rows, and refuse when input.facultyId === user.facultyId. At minimum, add `eq(faculty.isActive, true)` to both listing queries so a deactivated person stops being displayed as sitting staff.


## Medium

### 14. Duplicate student ids are deduped for the scope check but not for the write, turning an upsert into a raw Postgres error shown to the teacher

Area: src/app/dashboard/class/actions.ts:229-237, 414-422, 671-675

studentsInClass dedupes with `[...new Set(studentIds)]` (src/lib/scope.ts:29), so the membership check tolerates repeats. The writes do not: saveAttendanceAction builds entries from raw input.marks, saveMarksAction builds rows from raw input.rows, and assignBatchAction forwards raw input.studentIds. Postgres raises "ON CONFLICT DO UPDATE command cannot affect row a second time" (SQLSTATE 21000) when one statement targets the same conflict key twice. That string matches none of the INTERNAL_ERROR_PATTERNS in error-utils.ts:8-45 and is under 300 characters, so getErrorMessage returns it to the browser verbatim — a failed save and a leak through the sanitizer that exists to prevent exactly that.

Evidence: src/lib/scope.ts:29. src/app/dashboard/class/actions.ts:229-237, :414-422, :671-675. src/db/queries/marks.ts:16-31 and src/db/queries/attendance.ts (both onConflictDoUpdate). src/lib/error-utils.ts:8-45 contains no pattern for that message; :79 only sanitizes messages over 300 chars.

Fix: Dedupe by student id (last wins) when building the write rows in all three actions, not only inside the scope helper.

### 15. createSubjectAction accepts a teacher who is not on the class and skips the course validation its two siblings enforce

Area: src/app/dashboard/class/actions.ts:259-326 createSubjectAction

Lines 306-313 create the offering with `facultyId: input.facultyId ?? null` and never check the target is on the class — while assignOfferingFacultyAction, 440 lines below, refuses exactly that with "That teacher is not assigned to this class" and explains why: allocating a subject to somebody with no assignment hands them a class they cannot open. Two writes to the same column, one guarded and one not. It also omits every course validation the department actions apply: no `maxIsa + maxMse + maxEse === maxTotal` check, no `credits >= 1`, no bound on semester — all three of which createCourseAction enforces. A wrong maxTotal silently halves every percentage computed from that subject.

Evidence: src/app/dashboard/class/actions.ts:292-313 vs :756-763 (`const staff = await listClassStaff([offering.classId]); if (!staff.some(...)) return { error: "That teacher is not assigned to this class." }`). src/app/dashboard/dept/actions.ts:508-515 (`credits < 1` and the sum check). The dev fixture already carries the resulting state: 79 of 88 allocated offerings name a faculty with no class-assignment row.

Fix: Mirror assignOfferingFacultyAction's listClassStaff check whenever facultyId is supplied, and apply the same sum/credits/semester validation createCourseAction already uses.

### 16. The faculty being put on a class is never validated — existence, active state or department

Area: src/app/dashboard/dept/actions.ts:300-334 assignClassRoleAction

The class is checked against inDeptScope at :310, then input.facultyId goes straight into assignClassRole at :313 with no getFacultyById, no isActive check and no department check — while assignSubjectToTeacherAction, twenty lines away, refuses a teacher from another department by name and calls cross-department teaching something that should be a deliberate act on the class's staff list. This IS the class's staff list, and it applies no such rule. bulkImportFacultyAction has the same hole from the other side: getFacultyByEmail is college-wide, so a CSV row carrying an out-of-department address reuses that row and assigns it.

Evidence: src/app/dashboard/dept/actions.ts:306-318 vs :694-702. src/lib/session.ts:164 — classAssignments become classIds on the assignee's next session, which is what admits them to the class's marks, attendance, batches and enrolment queue. Live data is currently consistent (no assignment crosses a department boundary), so this is an open path rather than existing damage.

Fix: Load the target with getFacultyById and refuse unless it exists, is active, and `target.department === cls.departmentCode`, in both assignClassRoleAction and the bulkImportFacultyAction assignment branch.

### 17. Two migration indexes exist only in SQL, are absent from every push-built database, and the ledger records their migrations as applied anyway

Area: schema/migration drift

Migration 0002 creates courses_year_idx and 0004 creates offerings_published_idx. Neither is declared in src/db/schema, so neither appears in the DDL drizzle-kit push builds. scripts/dev-setup.ts runs `drizzle-kit push --force` then `tsx src/db/migrate.ts --baseline`, and --baseline inserts filenames into _migrations without executing them (src/db/migrate.ts:84-95). The result is a ledger that reports 0002 and 0004 as applied on a database where their DDL never ran. The reverse is worse: a production database built by push-then-migrate does have both indexes, and the next push drops them. Today's two casualties are cosmetic, but the mechanism will silently discard the next migration's index, partial unique, or trigger the same way.

Evidence: grep for both index names finds them only in src/db/migrations/0002_course_year.sql:13 and 0004_offering_publication.sql:15 — nothing in src/db/schema/. Live: `select indexname from pg_indexes where indexname in ('courses_year_idx','offerings_published_idx')` → 0 rows, while `select count(*) from _migrations` → 7, including both files.

Fix: Declare both in the schema so push and migrate agree — `index("courses_year_idx").on(t.year)` on courses and `index("offerings_published_idx").on(t.publishedAt)` on offerings — then add a CI assertion that every index name created in src/db/migrations also appears in the generated schema DDL.

### 18. The documented contributor workflow points drizzle-kit generate at the hand-written migrations folder, where its first output file is silently ignored by the runner

Area: migrations tooling — drizzle.config.ts:9 + CONTRIBUTING.md:63-66

drizzle.config.ts sets `out: "./src/db/migrations"` — the directory holding the seven hand-written, hand-guarded SQL files, with no meta/_journal.json. CONTRIBUTING.md tells every contributor to run `npm run db:generate` then `npm run db:migrate` for any schema change. With no journal, generate starts numbering at zero and emits `0000_<name>.sql` containing a full CREATE TABLE of every table, plus a meta/ directory. src/db/migrate.ts:73 filters with `!f.startsWith("0000")`, so db:migrate skips it and prints "No pending migrations" — the contributor sees a green run and ships a PR whose migration file will never execute anywhere. On the second use the journal has advanced, generate emits 0001_<name>.sql, and that one is not filtered: db:migrate will try to run a full unguarded CREATE TABLE script against a live database and exit(1).

Evidence: drizzle.config.ts:6-9. src/db/migrate.ts:70-75. CONTRIBUTING.md:63-66. `ls src/db/migrations/` shows the seven hand-written files and no meta/ directory, confirming generate has never been run against it.

Fix: Stop pointing the two systems at one directory: either drop db:generate from package.json (the migrations are hand-written by design) or set `out: "./.drizzle-scratch"` and gitignore it. Then rewrite CONTRIBUTING.md to describe what the runner expects — hand-write the next numbered .sql with IF NOT EXISTS / DO $$ guards, verify with db:migrate, include both in the PR.

### 19. db:migrate:status cannot reach a local database and reports a fully-migrated ledger as missing

Area: src/db/migrate-status.ts

Line 4 imports Pool from @neondatabase/serverless and line 20 constructs it unconditionally, with no isLocalPostgres() branch — the fix src/db/migrate.ts:13-27 already carries in makePool(). The Neon WebSocket driver cannot talk to a plain Postgres container, so the probe at :23 throws. The catch at :24-28 does not distinguish a connection failure from a missing relation and prints "Migration table does not exist yet. Run db:migrate first." The one tool whose job is detecting exactly the schema/ledger drift this audit found is blind on every contributor's machine, and it reports its blindness as a factual claim about the database.

Evidence: Reproduced live: `npm run db:migrate:status` prints "Migration table does not exist yet. Run db:migrate first." while `select count(*) from _migrations` on the same connection string returns 7. Code: src/db/migrate-status.ts:4, :20, :22-28; contrast src/db/migrate.ts:13-27.

Fix: Export makePool from src/db/migrate.ts and use it at migrate-status.ts:20 instead of the bare Neon Pool, and narrow the catch so only Postgres error 42P01 produces the "does not exist" message — any other error should be rethrown.

### 20. The most destructive non-admin action records only a count, so nothing says which students were removed

Area: src/app/dashboard/students/actions.ts:40-45 bulkDeactivateStudentsAction

The audit row is targetType "students" with no targetId and `details: { count }`. getRecordHistory matches on the exact (targetType, targetId) pair, so this row can never surface on any student's record drawer, and the audit log itself cannot answer "who was removed". The action soft-deletes an arbitrary set of students in one call; its entire trail is one integer. Every other destructive action names its target — enrollment.rejected carries the roll number, class.staff_removed carries the facultyId.

Evidence: src/app/dashboard/students/actions.ts:40-45. The scoping above it (:26-38) is correct — it refuses the whole request rather than filtering — which makes the missing trail the only defect. Same shape in src/app/dashboard/dept/actions.ts:193-206 (faculty.bulk_import, no targetId).

Fix: Write one audit row per student (targetType "student", targetId the student id), or keep the summary row and put the id list into details so the removal is recoverable from the log.

### 21. Controls are rendered without the check the server enforces, so several affordances always refuse or dead-end

Area: UI/server contract — class overview, students page, dept console

Three instances of the same defect. (a) The class overview renders QueueClient unconditionally for anyone who passes requireClassContext, which admits every TR; onboarding:approve/reject are faculty defaults so authorize() passes, but approveEnrollmentAction and rejectEnrollmentAction then refuse with "Only the class coordinator, the HOD, or an admin can decide enrolment requests" — and buildAttention actively routes TRs there with a blocking "N enrolment requests" card. (b) /dashboard/students renders the "Import roster" link with no capability check while the page itself needs only student:read; the destination requires student:update, which the faculty tier lacks, so a coordinator or TR is silently redirected to /dashboard. The same page gets it right two lines down with canDeactivate. (c) src/app/dashboard/dept/client.tsx imports five mutating actions and renders every one unconditionally — no canX prop anywhere — so revoking class:create or faculty:create from the hod tier does not hide the control, it turns it into a raw "Forbidden: missing capability class:create" toast.

Evidence: (a) src/app/dashboard/class/[classId]/page.tsx:145-152 (no canAllocate gate) vs src/app/dashboard/class/actions.ts:84-89 and :150-155; src/lib/attention.ts:71-81. (b) src/app/dashboard/students/page.tsx:67-76 (ungated Link) vs :80 (correctly gated canDeactivate) vs src/app/dashboard/students/import/page.tsx:13; src/lib/navigation.ts:248 gates the palette entry correctly. (c) src/app/dashboard/dept/client.tsx:47-51 with no capability props; contrast src/app/dashboard/dept/courses/page.tsx:39-40.

Fix: Pass the answer the server will give down into the client in each case: canAllocate into QueueClient, `can(user,"student:update")` around the Import roster link, and canCreateClass/canAssign/canAddFaculty/canGraduate into DeptClient — the pattern already used on the courses and students pages.

### 22. One piece of state backs two unrelated division pickers, so choosing a coordinator's class also retargets the subject assignment

Area: src/app/dashboard/dept/appoint/client.tsx

addClassId is shared by the "Give them a subject" division select and the "Make them a class coordinator" division select. The two list different option sets and are separated by a full section on screen, but selecting in one changes the other. An HOD who picks a division at the bottom to appoint a coordinator, then scrolls up and presses Assign on a course, allocates that subject to the division they picked for the appointment rather than the one they had chosen earlier.

Evidence: src/app/dashboard/dept/appoint/client.tsx:67 `const [addClassId, setAddClassId] = useState("")`, used as the value of the subject select at :277 and again as the value of the coordinator select at :369; both assignSubjectToTeacherAction at :341 and assignClassRoleAction at :390 post `classId: addClassId`.

Fix: Split into two states — subjectClassId for the select at :277 and coordinatorClassId for the one at :369 — and use each in its own action call.

### 23. /dashboard/dept ships the entire college's faculty roster to an HOD's browser, filtered only at render

Area: src/app/dashboard/dept/page.tsx:33

The page calls getAllFaculty() with no scope argument and passes every row's id, name, department and tier to the client, which filters at render time. The full payload — including other departments' faculty and the super_admin row — is in the RSC flight data any HOD can read. This contradicts /dashboard/faculty, which is deliberately scoped through getFacultyByDepartments(user.deptCodes) for anyone who is not super_admin.

Evidence: src/app/dashboard/dept/page.tsx:31-34 `Promise.all([listClassesForDepts(scope), getAllFaculty()])` and :61-66 (all rows passed through). src/app/dashboard/dept/[code]/client.tsx filters client-side. Contrast src/app/dashboard/faculty/page.tsx:18-21. Live: 56 faculty rows across three departments, so an EXCS HOD receives roughly 40 rows they are not scoped to.

Fix: Replace getAllFaculty() with the scoped read the page already computes a scope for: `user.tier === "super_admin" ? getAllFaculty() : getFacultyByDepartments(scope)`.

### 24. Department appointments are destructive-first and non-atomic, and the coordinator path validates nothing before destroying

Area: src/db/queries/appointments.ts:7-43, 68-77

appointHod runs deactivate-live, insert appointment, promote faculty.role, update the denormalised pointer as four separate statements; the doc comment acknowledges neon-http has no multi-statement transaction. If statement 2 fails, the outgoing HOD's appointment is retired and no replacement exists, so both people resolve to deptCodes [] and every inDeptScope-guarded operation in that department freezes until someone re-runs the action. appointCoordinator has the same shape with none of the validation: appointCoordinatorAction goes from authorize() straight to deactivateLive-then-insert, so a stale or deactivated facultyId retires the sitting coordinator and then fails the insert — and createAuditLog is after the call, so nothing records it. appointHodAction does perform every one of those checks directly above.

Evidence: src/db/queries/appointments.ts:26-43 (four awaits, no BEGIN) and :68-77. src/app/dashboard/admin/actions.ts:240-242 (authorize, then the call, nothing between) vs :201-213. src/lib/session.ts:172-173 `deptCodes = tier === "hod" ? … : []`.

Fix: Mirror appointHodAction's preamble in appointCoordinatorAction — load and check the department and the target faculty before writing. For both, re-assert the final state at the end of the action and surface a "department has no active HOD/coordinator" state the departments page can render, since the live-uniqueness index forbids inserting before retiring.

### 25. Raw Postgres constraint errors are returned to the client and stored in the ledger, bypassing the sanitizer, and are pinned to the wrong cell

Area: src/app/api/students/import/route.ts:168-182

Insert failures are surfaced by reading result.reason.message directly. That string is a driver error — 'duplicate key value violates unique constraint "students_email_unique"' — and it goes out in the JSON response and into import_batches.errorSummary, where the imports table renders it. src/lib/error-utils.ts exists to stop this and matches that exact text at line 12, but getErrorMessage is never applied on this path, only in the outer catch. It is reachable without any race: the route checks intra-batch duplicate ROLL numbers and DB roll conflicts but never checks emails at all, so two sheet rows sharing an email reach the insert and fail on students_email_unique. The client then writes the message onto the wrong cell — it hard-codes `field: "rollNumber"` for every returned error — so the TR sees a duplicate-email complaint on the roll number column.

Evidence: src/app/api/students/import/route.ts:173-180 `message: result.reason instanceof Error ? result.reason.message : "Failed to insert row"`; src/lib/error-utils.ts:12. Client mis-attribution at src/app/dashboard/students/import/client.tsx:182-189. Live: students_email_unique and students_roll_number_unique are plain UNIQUE CONSTRAINTs on students.

Fix: Wrap it: `message: getErrorMessage(result.reason, "Failed to insert row")`. Add an intra-batch email duplicate check beside the roll one and include emails in the existing DB probe, so the common case is reported as a row error with the right field.

### 26. No size cap before formData() and the workbook parse, and the students preview materializes every sheet in the file

Area: src/app/api/students/import/preview + marks/import/preview

The courses preview caps uploads before parsing; neither the students nor the marks preview has any cap — both go straight from `await req.formData()` to a full ExcelJS parse. The students route makes it worse: when no sheet is requested it calls readSheet() on every worksheet in turn looking for a roster header, and readSheet materializes every cell of every row as a JS string. xlsx is a zip, so a small upload expands to an arbitrarily large in-memory grid. There is no file-type check either. The work is synchronous string building on the event loop, so it blocks every other request on the instance for its duration.

Evidence: Measured against the running dev server: a 3.3 MB xlsx with 200,000 filler rows across four sheets plus a one-row roster sheet returned 200 in 4.0 s with totalRows 1 — every sheet was read to find the header. Code: students preview route.ts:43-50 and :63-79 (no cap, all-sheets loop); marks preview route.ts:70 (no cap); courses preview route.ts:15, :26 (the cap that exists).

Fix: Reject on `req.headers.get('content-length')` before calling req.formData() in both routes, so the body is never buffered, plus an extension check. In the students preview, bound the auto-detect loop instead of reading every worksheet.

### 27. attendance.course_offering_id is ON DELETE SET NULL, which silently relabels a subject register as a class register

Area: src/db/schema/attendance.ts:31-34

course_offerings has four child tables with four delete behaviours: marks RESTRICT, marks_locks CASCADE, batches CASCADE, attendance SET NULL. attendance is the odd one out, and course_offering_id is exactly what distinguishes a subject register from a class-level one — the two partial unique indexes depend on the distinction. Setting it to NULL does not orphan the row, it relabels it: every subject-wise mark for the deleted offering becomes an untagged class session, getAttendanceBySubject folds them into the class bucket, and the per-subject percentage the feature exists to produce is silently wrong. If a student holds both a subject row and a class-level row for the same (date, slot), the SET NULL instead collides with the class-session unique index and the DELETE aborts. Latent today: nothing in src/ or scripts/ deletes an offering, and setCourseActive is soft.

Evidence: src/db/schema/attendance.ts:31-34 `{ onDelete: "set null" }`. Live: `attendance_course_offering_id_course_offerings_id_fk … ON DELETE SET NULL` alongside `marks_… ON DELETE RESTRICT` and the two CASCADEs. The rationale for the distinction is written into migration 0005_attendance_per_subject.sql.

Fix: Change to `{ onDelete: "restrict" }` so an attendance record blocks the deletion of its offering the same way a mark does, and ship the matching guarded ALTER. Soft-delete via is_active is already the only offering lifecycle the app uses, so nothing legitimate is blocked.

### 28. Roll numbers and emails are not normalized before the conflict probe or the insert, and the unique constraints are case-sensitive

Area: src/app/api/students/import/route.ts:62-79, 136, 151-163

Every uniqueness decision in the commit route is made on the raw payload string: the intra-batch duplicate map, the DB probe, the conflict test and the insert. The unique constraints are plain btrees on text, so '23108a0054' and '23108A0054' are distinct keys. Meanwhile rollsInScope normalizes internally (parseRollNumber trims and uppercases), so a lower-cased roll passes the scope check on its normalized form and inserts on its unnormalized one, producing two rows for one person with marks and attendance splitting between them. The codebase normalizes everywhere else — getStudentByRollNumber uppercases, getStudentByEmail lowercases, createCourse uppercases the code — this route is the outlier. It is medium rather than high only because the shipped browser client normalizes first (flagRow trims/uppercases the roll and lowercases the email), so reaching it needs a non-browser POST or a second client.

Evidence: src/app/api/students/import/route.ts:62-67, :70-77, :136, :151-163; src/db/queries/students.ts:176-179 (createStudent inserts as given). src/lib/xlsx-import.ts:192-198 (the client-side normalization). Live: `students_roll_number_unique UNIQUE CONSTRAINT, btree (roll_number)` and `students_email_unique UNIQUE CONSTRAINT, btree (email)`; all 1736 rows are currently normalized, purely by client discipline.

Fix: Normalize once at the top of the handler — map rows to trimmed/uppercased rollNumber and trimmed/lowercased email — and use that array for the dedupe map, the probe, the conflict test and the insert.

### 29. A no-op save on a fully locked offering rewrites recorded_by_faculty_id for the whole roster

Area: src/app/dashboard/class/actions.ts:414-446

Every row is built with `recordedByFacultyId: user!.facultyId` at :421. The lock carry-forward restores the stored isa/mse1/mse2/ese values but getMarksForOffering does not select recordedByFacultyId (marks.ts:34-45), so the original recorder is never carried back, and upsertMarks writes `recordedByFacultyId: sql\`excluded.recorded_by_faculty_id\``. Nothing refuses the write when every required component is already locked, so the values are unchanged and the attribution is replaced. The audit row is `marks.recorded {count: N}` and gives no hint that no figure moved. This destroys the fact assignOfferingFacultyAction's own comment says survives a reallocation — that each row carries its own recordedByFacultyId, so the history of who entered what survives.

Evidence: src/app/dashboard/class/actions.ts:421 and :446; src/db/queries/marks.ts:27 and :34-45.

Fix: Add recordedByFacultyId to getMarksForOffering's selection and carry it forward alongside the values whenever a component is locked, and refuse the write outright when every required component is already locked.

### 30. The department workspace has an unreachable assign-subject dialog and a Students tab that renders a blank page

Area: src/app/dashboard/dept/[code]/client.tsx

DeptDashboardClient holds `assigning` state and renders AssignSubjectDialog when it is set, but setAssigning is only ever called with null from onClose — no call site anywhere in src opens it. So the dialog, the courses/classOptions props the page computes for it, and the trailing empty header column the faculty table adds for its button are all dead, and both tables render a header column with no cells under it. Separately, DeptTabs always offers a "Students" section, but the only block gated on show("students") is additionally gated on `totals.unplaced > 0` — so in the normal case, where every student's cohort has a class row, clicking Students shows the tab strip over empty space: no roster, no empty state, no link.

Evidence: src/app/dashboard/dept/[code]/client.tsx:78 (`useState<FacultyRow | null>(null)`), :251 (`{assigning && (`), :256 (`onClose={() => setAssigning(null)}`) — grep finds no other reference. Tabs: :91 (`{ key: "students", … }` always present) vs :260 (`{(show("overview") || show("students")) && totals.unplaced > 0 && (`), with no else branch and no other show("students") block.

Fix: Either add the missing action cell that opens the dialog, or delete `assigning`, AssignSubjectDialog, its props and the two trailing empty headers. For the tab, render an EmptyState or a link to /dashboard/students?department={code} when show("students") and unplaced is 0.

### 31. If the re-routing pass fails, self-registered students are stranded with no operator surface and no re-run path

Area: src/app/dashboard/dept/actions.ts:245-259 createClassAction

createClass, listUnroutedRequests and routeRequestsToClass are three ordered statements with no transaction. If the last one fails, the class exists and the requests stay unrouted. createClassAction then refuses to re-run ("That class already exists."), and listUnroutedRequests is called from nowhere else — grep across src finds only its definition and this one call site. There is no screen anywhere in the app that lists unrouted requests, so no operator can see or fix the state. The only recovery is the student withdrawing and resubmitting, which nothing tells them to do.

Evidence: src/app/dashboard/dept/actions.ts:243 (the re-run refusal) and :255-259 (the three statements). `grep -rn "listUnroutedRequests" src/` returns src/db/queries/classes.ts:48 (definition) and dept/actions.ts:31, :255 (the sole caller).

Fix: Expose unrouted requests on the department workspace so the state is visible and fixable, and re-run the routing pass whenever a class page is opened rather than only at creation.

### 32. Batch reassignment clears the students' current batch before writing the new one

Area: src/db/queries/batches.ts via assignBatchAction

assignStudentsToBatch reads the sibling batches, deactivates the students' live assignments across all of them, and only then inserts — three statements, no transaction. If the insert fails (a duplicate student id in the payload, per the dedupe finding, or a dropped connection) the students end up in no batch at all for that offering. listBatchesForOffering filters on isActive, so they disappear from every batch list rather than showing up somewhere wrong, and no audit row is written because createAuditLog runs after the call.

Evidence: src/db/queries/batches.ts:60-92 (select siblings → update isActive=false → insert onConflictDoUpdate). src/app/dashboard/class/actions.ts:671-682.

Fix: Insert or upsert the new assignments first, then deactivate whichever sibling rows the insert did not cover.

### 33. The rows array is unbounded and inserted as N parallel single-row statements with no transaction, so a large batch is a partial write reported as a failure

Area: src/app/api/students/import/route.ts:30, 71-77, 151-166

The preview caps at MAX_ROWS 2000 but the commit route accepts any length — `z.array(importRowSchema).min(1)` with no .max(). The conflict probe builds one inArray over every roll, which past the bind-parameter ceiling makes the statement fail outright. Valid rows are inserted one statement each, all fired concurrently through Promise.allSettled, and production is neon-http with no transaction support. If the function times out, or createImportBatch or createAuditLog throws after the loop, the outer catch returns 500 and the client shows "Import failed. Try again." while N students are already committed. The whole-batch refusal at :96-113 is justified in its own comment by "a half-applied roster is harder to reason about than a refused one" — this path produces exactly that roster.

Evidence: src/app/api/students/import/route.ts:30, :70-77, :151-166 (`const results = await Promise.allSettled(inserts)`), :199-216 (ledger write after the inserts, inside the same try). Driver: src/db/index.ts.

Fix: Add `.max(2000)` to the rows array so the commit contract matches the preview's cap, and replace the per-row fan-out with chunked multi-row inserts (`.values(chunk).onConflictDoNothing({ target: students.rollNumber }).returning(...)`), which is one atomic statement per chunk and also closes the probe/insert race.

### 34. Five capabilities in the permissions console are enforced nowhere, so revoking them reports success and changes nothing

Area: src/lib/rbac.ts CAPABILITY_CATALOG vs enforcement sites

An exact-string grep of every capability across src (excluding rbac.ts and tests) shows class:read, assignment:read, onboarding:read and attendance:read have zero enforcement sites, and marks:read is checked only on class-scoped staff surfaces, never on the two student-facing pages that show marks. The console renders all 35 capabilities across three tiers as switches with a headcount confirmation implying real effect. Concretely: revoking marks:read and attendance:read from the student tier leaves /dashboard/my-marks and the student overview rendering marks and attendance unchanged, because both gate only on user.studentId; revoking class:read leaves /dashboard/class fully open, since its layout checks isStaff and its page checks nothing.

Evidence: grep for each capability string outside rbac.ts and tests: class:read, assignment:read, onboarding:read, attendance:read → 0 hits; marks:read → only the class context and results page. src/app/dashboard/my-marks/page.tsx:12-15; src/app/dashboard/class/layout.tsx:14. Live: permission_overrides is empty, so nobody has hit this yet.

Fix: Either enforce them where they belong (marks:read on my-marks and the student dashboard, class:read in requireClassContext, onboarding:read around the class queue, assignment:read around the staff lists) or drop the unenforced entries from CAPABILITY_CATALOG so the console cannot present a toggle that does nothing.

### 35. db:push and db:setup run drizzle-kit push against any host with no local-only guard, while the README documents both against a hosted database

Area: src/db/setup.ts + drizzle.config.ts + README

scripts/dev-setup.ts carries a careful assertLocal() that refuses any non-local DATABASE_URL, and docs/local-dev.md states that guard is why dev:setup refuses to run against anything but the local container. But src/db/setup.ts reads the same two variables and goes straight to `execSync("npx drizzle-kit push")` with no such check, and drizzle.config.ts resolves the same url with no guard, so bare `npm run db:push` inherits the reach. Two consequences: the truncate-on-unique-constraint behaviour the README itself warns about is one command from production data, and a push against a migrate-built production database unconditionally drops courses_year_idx and offerings_published_idx (see the drift finding).

Evidence: src/db/setup.ts:7-20 — no isLocalPostgres() call, although src/db/driver.ts exports exactly that predicate and src/db/migrate.ts:41-49 uses it to refuse a remote --baseline. drizzle.config.ts:10. README.md lists db:push and db:setup as ordinary commands.

Fix: Import isLocalPostgres in src/db/setup.ts and refuse a remote host before the push unless an explicit --allow-remote flag is passed, mirroring migrate.ts:41-49; replace the raw `drizzle-kit push` package script with a tsx wrapper applying the same guard; correct docs/local-dev.md, which currently implies the guard is repo-wide.

### 36. A migration is recorded as applied in a separate round trip from running it, so a crash between the two makes the ledger lie

Area: src/db/migrate.ts:105-117

The migration body and the `INSERT INTO _migrations` are two distinct queries. Postgres wraps each multi-statement simple query in its own implicit transaction, so a file's DDL is atomic with itself — but the ledger write is not part of it. A process kill, a Neon WebSocket drop, or a statement timeout between the two leaves the change applied and unrecorded. The recovery path is a re-run, and the only thing making a re-run safe is a convention — all seven files are hand-guarded with IF NOT EXISTS / DO $$ blocks — that nothing enforces and the next contributor has no mechanical reason to follow.

Evidence: src/db/migrate.ts:105-111: `await pool.query(content)` then `await pool.query("INSERT INTO _migrations (filename) VALUES ($1)", [file])` — two awaits, two round trips, no BEGIN.

Fix: Send both in one statement so the ledger row commits with the DDL: wrap content in BEGIN … INSERT INTO _migrations … COMMIT in a single pool.query. None of the seven current files use CREATE INDEX CONCURRENTLY or anything else illegal inside a transaction block; note in the migrations README that a file needing CONCURRENTLY must be split out.


## Low

### 37. Refusals return the exact capability name, giving any authenticated account a capability oracle

Area: src/lib/rbac.ts:252-256 via src/lib/error-utils.ts:47-72

authorize throws `Forbidden: missing capability ${capability}`, and getErrorMessage lists "Forbidden" among SAFE_PREFIXES and returns such messages verbatim. Every action funnels its throw through that helper, so an authenticated faculty or student can call each action in turn and read back the precise capability model, including which capabilities a super-admin has toggled for their tier. This is also why the coordinator allocation bug surfaces as a raw internal string in a user-facing toast.

Evidence: src/lib/rbac.ts:253-254; src/lib/error-utils.ts:47-59 and :70-72.

Fix: Return a fixed "You do not have permission to do that." to the client and log the missing capability server-side.

### 38. The department-level 'coordinator' appointment is inert — nothing in the authorization path ever reads it

Area: src/app/dashboard/admin/appointments + src/lib/session.ts:151-155

The appointments console offers both 'hod' and 'coordinator', and appointCoordinatorAction writes a dept_appointments row with appointment='coordinator'. Every read of that table filters appointment='hod': getSessionUser resolves scope from the hod branch only, getActiveHod filters to hod, and the overview query filters to hod. listActiveAppointments is display-only. So a super-admin appoints a department coordinator, the console shows them as coordinator, and they receive exactly zero additional capability or scope. Class-level coordination is a different table entirely and is the only coordinator concept that carries authority.

Evidence: grep -rn deptAppointments src/ → the only reads are src/lib/session.ts:151-155 (`eq(d.appointment, "hod")`), src/db/queries/appointments.ts:59 (hod), src/db/queries/overview.ts:334 (hod), and listActiveAppointments (display). Live: an EXTC faculty holds an active 'coordinator' dept appointment and separately an academic_coordinator class row — only the latter grants anything.

Fix: Either resolve a dept-coordinator into scope in getSessionUser alongside the hod branch, or remove 'coordinator' from the console's KINDS and drop appointCoordinatorAction, so the console stops advertising authority it does not confer.

### 39. appointHod never demotes the outgoing HOD, leaving a permanent hod tier with empty scope

Area: src/db/queries/appointments.ts:26-43

appointHod retires the previous appointment row and promotes the new appointee's faculty.role to 'hod', but never resets the outgoing HOD's role. getSessionUser then resolves them as tier 'hod' with deptCodes [], so they keep the whole HOD capability set forever with no department behind it. Every scoped query short-circuits on the empty array, so this is inert today — but it is a standing trap: src/app/dashboard/dept/layout.tsx:15 already admits on tier alone, so a scopeless ex-HOD walks into the department console, and any future check written against `tier === "hod"` rather than deptCodes turns it into real authority.

Evidence: src/db/queries/appointments.ts:31-42 — deactivateLive, insert, `update(faculty).set({role:"hod"})` on the new appointee only. src/lib/session.ts:172-173. src/app/dashboard/dept/layout.tsx:15 checks tier only.

Fix: In appointHod, after retiring the current appointment, reset the outgoing holder's faculty.role to 'faculty' when they head nothing else.

### 40. A request is permanently rejected on the refusal path with no audit row

Area: src/app/dashboard/class/actions.ts:91-99 approveEnrollmentAction

When the roll number is already registered, the action writes the request to status "rejected" with a reason, the reviewer's facultyId and reviewedAt, then returns { error }. createAuditLog is further down and never runs. This is a state change on what the user experiences as a refusal, and it is the one rejection in the app that leaves no trace — the explicit rejectEnrollmentAction path does log.

Evidence: src/app/dashboard/class/actions.ts:91-99 (the write and the early return) vs :120-126 (the audit call it skips) and :165-171 (the equivalent path that does log).

Fix: Call createAuditLog with action "enrollment.rejected" and details { rollNumber, reason: "Roll number already registered" } before returning the error.

### 41. The only batch action that destroys data is the only one with no audit log

Area: src/app/dashboard/class/actions.ts:690-729 removeFromBatchAction

createBatchAction logs batch.created and assignBatchAction logs batch.assigned. removeFromBatchAction performs its write and goes straight to revalidatePath with no createAuditLog anywhere in the function — the same asymmetry its own comment says survives review because the reader checks the interesting direction.

Evidence: src/app/dashboard/class/actions.ts:723-724 (`await removeStudentFromBatch(input)` immediately followed by revalidatePath) vs :676-682.

Fix: Add createAuditLog({ action: "batch.unassigned", targetType: "offering", targetId: batch.courseOfferingId, details: { batch: batch.name, studentId: input.studentId } }) before the revalidate.

### 42. The capability and tier in the payload are never checked against the catalog, so an arbitrary string can be stored as a granted capability

Area: src/app/dashboard/admin/actions.ts:261-292 setRoleCapabilityAction

input.capability is typed Capability but never validated at runtime; setRoleOverride writes it as given, and effectiveCapabilities then adds whatever string it is to the tier's effective set and shows it in the console matrix. input.tier is likewise unchecked — a bogus tier makes ROLE_DEFAULTS[input.tier] undefined and .includes throws, which fails safe, but a bogus capability is stored silently.

Evidence: src/app/dashboard/admin/actions.ts:272-276 — ROLE_DEFAULTS[input.tier].includes(input.capability) then setRoleOverride, with no membership test against CAPABILITY_CATALOG. src/lib/rbac.ts:229-236.

Fix: Refuse unless CAPABILITY_CATALOG.some(c => c.capability === input.capability) and input.tier is one of hod/faculty/student, before computing the effect.

### 43. The register has no slot control, so a subject taught twice in one day overwrites its own earlier register

Area: src/app/dashboard/class/[classId]/attendance

A session is identified by (student, date, slot, offering) via the two partial unique indexes. The client's go() accepts a slot and the page reads sp.slot, but no control in the UI ever sets it, so every register the product writes lands on slot "1". Two lab sessions of the same subject on the same day collide on the unique index and the second upsert overwrites the first rather than recording a second session. Slot-3 rows exist in the dev database and are unreachable and invisible from the register UI, which reports them as unmarked.

Evidence: src/app/dashboard/class/[classId]/attendance/client.tsx:76-87 (go takes slot; only Date and Session controls are rendered) and page.tsx:51 `const slot = sp.slot || "1"`. src/db/schema/attendance.ts:52-60. Live: `select session_slot, count(*) from attendance group by 1` → {"3": 186, "1": 625}.

Fix: Add a slot selector beside the Date and Session controls feeding the existing go({ slot }) path, or drop sessionSlot from the identity and key subject registers on (student, date, offering).

### 44. Unauthenticated API calls 307 to /login, so every import client's res.json() throws and shows a generic failure instead of a session-expired message

Area: src/proxy.ts:25-27

The proxy redirects any non-public path without a session cookie to /login, and it matches /api/* as well as pages. fetch follows the redirect, /login returns 200 HTML, res.ok is true, and res.json() throws on the HTML, landing in each client's bare catch. The routes' own 401/403 JSON bodies are unreachable for an expired session, so a TR whose session lapses mid-import sees "Upload failed. Try again." forever with no indication they need to sign in again.

Evidence: `curl -i http://localhost:3000/api/me` with no cookie → 307 with `location: /login`, not the route's 401 JSON. Client catches at src/app/dashboard/students/import/client.tsx:95-97 and :197-198, and the marks and courses import clients.

Fix: In proxy.ts, return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` when pathname.startsWith('/api/') and redirect only for page routes; the clients already render json.error.

### 45. /api/me answers with the caller's identity under Access-Control-Allow-Origin: *, no Cache-Control, and a Vary that omits Cookie

Area: next.config.ts + src/app/api/me/route.ts

The payload is correctly scoped — it is the caller's own session and nothing else. The problem is the labelling. next.config.ts attaches `Access-Control-Allow-Origin: *` to `/api/:path*`, covering /api/me, all three import endpoints and the auth handler. Not directly exploitable today: there is no Access-Control-Allow-Credentials and better-auth cookies are SameSite=Lax. But the wildcard advertises a per-session response as public to every origin, and the response carries no Cache-Control while its Vary lists only RSC keys, so nothing tells an intermediary the body is per-user.

Evidence: `curl -i -b verp_dev_actor=student http://localhost:3000/api/me` → 200 with `access-control-allow-origin: *`, `vary: rsc, next-router-state-tree, …`, and no Cache-Control. Headers defined in next.config.ts's `/api/:path*` block.

Fix: Set `Cache-Control: private, no-store` and `Vary: Cookie` on the /api/me response, and scope the CORS block to endpoints actually meant to be cross-origin — or drop it, since every client here is same-origin. Do not add Allow-Credentials while the origin is a wildcard.

### 46. Duplicate detection is department-scoped while course codes are globally unique, and super_admin gets no duplicate warnings at all

Area: src/app/api/courses/import/preview/route.ts:51-53

The preview flags codes the catalogue already holds by reading only the caller's own departments, but courses.course_code is globally unique and the commit checks it globally via getCourseByCode. A code owned by another department previews as new, is pre-selected for import, then is silently counted as skipped. For super_admin the ternary sets scope to [] and listCoursesForDepts returns [] for an empty array, so the one role that can import into every department receives zero duplicate warnings — the opposite of what the branch intends.

Evidence: src/app/api/courses/import/preview/route.ts:51-53 against src/db/queries/courses.ts:11-12 and src/app/dashboard/dept/actions.ts:617-620.

Fix: Ask the same question the commit asks: look the parsed codes up globally with one inArray over courses.courseCode, which also removes the super_admin special case.

### 47. departments.hod_faculty_id is a write-only pointer with the wrong type and no FK, and it is NULL on every live row

Area: src/db/schema/departments.ts:11-13

The column is documented as a denormalised pointer to the current HOD. It is declared text while faculty.id is uuid, it has no foreign key, and nothing reads it — three writers (appointments.ts:41, scripts/lib/users.ts, scripts/seed.ts) and zero readers; every consumer goes through getActiveHod, which reads the authoritative dept_appointments row. Because deactivateLive retires an appointment without touching the pointer, and there is no FK, the column can outlive both the appointment and the faculty row it names.

Evidence: Live: `select d.code, d.hod_faculty_id from departments d` → NULL for all three departments, each of which has an active hod appointment. information_schema shows departments.hod_faculty_id as text; pg_constraint shows no FK on it.

Fix: Drop the column and its three writers, since getActiveHod already answers the question. If the denormalisation is wanted later, retype it as `uuid REFERENCES faculty(id) ON DELETE SET NULL` and clear it inside deactivateLive.

### 48. The truncated flag is computed from raw grid length, and a genuinely truncated roster is disclosed only as a transient toast

Area: src/app/api/students/import/preview/route.ts:97-116 + commit route

Two related defects. dataRows filters blank rows out and then slices to MAX_ROWS, but the truncated flag compares the unfiltered distance from the header to the end of the grid — so a sheet with trailing blanks warns the TR that data was dropped when none was, and they will split the file for no reason. Conversely, when a sheet really does exceed MAX_ROWS, nothing carries that fact forward: the preview table, the commit button, the success toast and the import_batches rowCount all describe the truncated set as if it were the whole file.

Evidence: src/app/api/students/import/preview/route.ts:97-100 and :116. Measured: a workbook with 50 real rows and 2500 trailing blanks returned totalRows 50 with truncated true; a 2500-real-row workbook returned totalRows 2000, truncated true (correct). Client toast at src/app/dashboard/students/import/client.tsx:92-94; ledger rowCount at api/students/import/route.ts:203.

Fix: Keep the filtered array before slicing and report `truncated: nonBlank.length > MAX_ROWS`; return the pre-truncation count so the preview header and commit button can say "2000 of 2500 rows" and the ledger can store the real file size.

### 49. Both roster-import routes document themselves as the TR's tool, but the capability they gate on is HOD-only, leaving rollsInScope's faculty branch unreachable

Area: src/app/api/students/import/route.ts:81-84 + preview/route.ts:36-40

The preview comment says faculty (TRs) run this, and the commit comment justifies its scope check with "Import roster is shown to every faculty user, so it was not an unreachable path". Neither is true: ROLE_DEFAULTS.faculty does not include student:update, so every faculty account is refused. The consequence is that rollsInScope's faculty branch — the one that bounds a TR to the classes they hold — is dead for the only caller that uses rollsInScope: covered by unit tests, never executed in the product. Whichever way this is resolved, one of the two is currently wrong, and the comments will mislead the next person auditing the scope model.

Evidence: src/lib/rbac.ts:196-210 (no student:update in the faculty list). src/app/api/students/import/route.ts:51 and :81-84; preview/route.ts:36-40. Measured: `curl -b verp_dev_actor=teacher-b … /api/students/import/preview` → 403 Forbidden, same for the coordinator persona. rollsInScope is imported by exactly one non-test file.

Fix: Decide and make it one thing: either add student:update to ROLE_DEFAULTS.faculty (the scope layer already bounds a TR to their own classes) or delete the faculty branch from rollsInScope and correct both comments.

### 50. import_batches' actor FK carries a different name in a migrated database than in a pushed one, so every push churns it

Area: src/db/migrations/0007_import_batches.sql:29

The migration writes the FK inline without naming it, so Postgres assigns import_batches_actor_user_id_fkey, while drizzle derives import_batches_actor_user_id_user_id_fk from the schema. drizzle-kit diffs constraints by name, so a push against a database that ran 0007 emits a drop-and-add pair. Harmless in isolation — the definitions are semantically identical — but it is unnecessary churn in a push that should be a no-op, and it makes a real diff harder to spot.

Evidence: Live: `import_batches_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES "user"(id)`; the generated DDL names the same constraint import_batches_actor_user_id_user_id_fk. This is the only name divergence across all 22 tables.

Fix: Name it explicitly in the migration (`CONSTRAINT import_batches_actor_user_id_user_id_fk REFERENCES "user"(id)`) and ship a guarded RENAME CONSTRAINT for databases that already have it.

### 51. Two dead or fragile UI affordances: a Notifications menu item with no handler, and a template download that revokes its blob URL synchronously

Area: src/app/dashboard/imports/client.tsx:53-63 and src/components/nav-user.tsx:135-138

The sidebar user menu renders a Notifications item with a bell icon and no onClick, render or href — a CTA present on every page of the product that has never been wired; clicking it closes the menu and does nothing. Separately, downloadTemplate creates an anchor, never inserts it into the document, clicks it and revokes the object URL on the very next line, while the project's own downloadBase64File helper appends, clicks, removes, then revokes. Browsers that require the anchor to be in the document, or that read the blob asynchronously after click(), produce no file and no error.

Evidence: src/components/nav-user.tsx:135-138 (contrast :113-124 which links via render, and :125-133 which has an onClick). src/app/dashboard/imports/client.tsx:53-63 versus src/lib/utils.ts:16-22.

Fix: Remove the Notifications item until notifications exist, or point it at a real destination. Build the CSV as base64 and call the existing downloadBase64File, or at minimum append/remove the anchor and defer the revoke.


## Verified clean

- Academic write scoping is layered and refuses whole requests rather than filtering. saveMarksAction and saveAttendanceAction each run capability → offering lookup → classInScope → canWriteOffering → roster membership via studentsInClass → per-component bounds via validateMarks, with no write reaching the database before any refusal (class/actions.ts:190-227, 340-413). Three auditors independently walked this chain and agreed. The named-offering cross-class check at :209-227 closes the path where another class's offering would be used to work around the class scope check.
- Column, enum and constraint parity between src/db/schema and the live database is exact: all 22 tables, every column name/type/nullability/default, all 8 pgEnums label-for-label, verified by information_schema and pg_enum against the drizzle-generated DDL. The only divergences found anywhere were the two migration-only indexes and one FK name, both reported.
- Database-level uniqueness invariants are real, not app conventions: attendance_student_subject_session_uniq and attendance_student_class_session_uniq (the two partial indexes that keep a subject register distinct from a class one), dept_appointment_live_uniq (one live HOD and one live coordinator per department), class_coordinator_live_uniq (one live academic coordinator per class), class_faculty_role_uniq, marks_offering_student_uniq, override_live_uniq, and the four non-negativity CHECKs on marks. All present live and matching the schema.
- Live data integrity is clean: nine read-only probes found no marks row whose student sits outside the offering's class, no attendance row whose class_id disagrees with the offering or the student's class_key, no (student, date, slot) carrying two offerings, no student class_key without a classes row, no mark above its course maximum, no course whose components fail to sum to the total, and no faculty_class_assignment crossing a department boundary.
- The drizzle-kit push hazard on the migration ledger is genuinely fixed (e863ddd): migrations-ledger.ts is exported from the schema index, appears in the generated push DDL, and its unique constraint is explicitly named to match what migrate.ts creates — push will neither drop _migrations nor stall on a truncate prompt. Verified independently by two auditors.
- Self-scope actions are sound. withdrawEnrollmentRequestAction takes no id at all — it resolves the request from the session and re-checks ownership server-side; submitEnrollmentRequestAction takes the email from the verified session and never the form, blocks an already-placed account, and is backed by the enrollment_one_open_uniq partial index rather than a read.
- Student blast radius is contained. A student session reaches only /dashboard, /my-marks and /unclaimed; every other route redirects on a capability the student tier lacks, /dashboard/admin/* is super_admin-only, /dashboard/dept/* is hod|super_admin, /dashboard/class/* is isStaff, and all four data API routes gate on a capability students do not hold. Two auditors enumerated the full route surface independently.
- Dev-auth cannot leak into production: devAuthEnabled() requires NODE_ENV !== production AND VERP_DEV_AUTH=1, next.config.ts throws during a production build if the flag is present, setDevActor re-checks the gate inside the action rather than trusting the render, and both devIdentity and setDevActor allowlist against DEV_PERSONAS. devIdentity substitutes only id/name/email/image — tier, scope and capabilities still resolve from real rows.
- effectiveCapabilities precedence is correct and unambiguous: tier defaults, then role overrides, then user overrides, with ambiguity prevented at the database by the override_live_uniq partial index plus setRoleOverride retiring the previous row before inserting. useCan on the client mirrors lib/rbac can() exactly and reads the same server-resolved set, so there is no second capability source to bypass.
- Every scope-parameterised read guards its empty array and returns [] rather than emitting an unbounded query — students, faculty, classes, courses, class-staff, onboarding, import-batches and every branch of overview.ts. This is what keeps a scopeless HOD (empty deptCodes) harmless.
- The attendance upsert is correct and idempotent: two partial unique indexes (offering NOT NULL / offering NULL) with the insert naming the matching one, so re-saving a register updates rather than duplicating.
- Marks lifecycle controls hold: setMarksLockAction refuses to lock a component nobody has finished and gates reopening on canReopenLock; setPublishedAction requires every component the course actually has to be locked AND independently re-checks roster completeness rather than trusting the locks; assignOfferingFacultyAction validates via listClassStaff that the target teacher is on the class.
- Marks preview cannot hand out a studentId outside the target class — rows are matched against the class roster and unmatched rows carry studentId null — and saveMarksAction independently re-checks everything, so a stale or forged preview cannot commit out-of-scope marks. Scope enforcement on the marks preview was verified live: an out-of-scope class returns 403, a student tier 403, an unknown uuid 404.
- Typecheck is clean (tsc --noEmit, 0 errors), lint has 0 errors, and all 189 unit tests pass including 25 navigation and 34 allocation cases. There are no `any` casts, `@ts-ignore` or `@ts-expect-error` anywhere in src, so every client→server-action payload shape matches its signature.
- No Set or Map crosses a server→client prop boundary; capabilities are deliberately serialised as an array and rebuilt into a Set in SessionProvider. Dates cross correctly everywhere checked, and every 'today' value uses the Asia/Kolkata formatter rather than toISOString().
- Every mutation call site surfaces { error } to the user via toast.error, every in-flight mutation has a pending/disabled state, and ConfirmAction has real double-submit protection (a busy guard that returns early, disabled on both buttons, and an onOpenChange that refuses to close mid-flight). No swallowed error results were found across 24 client components.
- revalidatePath coverage gaps on the new surfaces are cosmetic, not bugs: all 30 dashboard pages plus four layouts export force-dynamic so no Full Route Cache entry exists to purge, Next 16's staleTimes.dynamic is 0 so the client Router Cache does not retain these segments, and every mutating client calls router.refresh() on success. Worth recording because the correctness of that whole surface currently rests on a per-file convention with nothing enforcing it.
- No hard deletes exist anywhere in src/ or scripts/ except deleteOwnEnrollmentRequest, which is keyed on the primary key plus the owner. Every other lifecycle is soft-delete via is_active.
- All seven migration files are written re-runnable (IF NOT EXISTS / DO $$ guards / DROP … IF EXISTS), and each file body is sent as one multi-statement simple query, so the DDL inside a single file is atomic under both drivers. The ledger matches the filesystem exactly: 7 files, 7 rows, none missing, none extra.
- The auth route is a thin better-auth handler with no custom logic, and the underlying config is sound: passwords disabled, OAuth account linking restricted to the trusted VOSS provider with allowDifferentEmails:false, PKCE on, issuer validation on, and the requireLocalEmailVerified:false relaxation correctly conditioned on passwords staying off.

## Coverage

SYNTHESIS METHOD — Six auditors covered schema/migrations/DB integrity, server-action authorization, API routes and imports, frontend-backend contract, the RBAC matrix, and dev tooling/fixtures. I deduplicated across them and then re-read the cited code myself for every finding of medium and above, plus read-only SQL probes against the running local container (docker exec psql, SELECT and \d only; no writes, no repo edits, no git mutation). Independent verifications I performed: the faculty_role enum and the createFaculty insert path; user.id text vs faculty_class_assignments.assigned_by uuid ('dev-admin'::uuid errors); ROLE_DEFAULTS.faculty (offering:create/update absent) against subjects/page.tsx and the two actions that authorize them; every active academic_coordinator being faculty-tier; the marks applyMapping → client → upsertMarks null-overwrite chain; the attendance and batches useState-initializer-plus-router.push pattern against the marks grid's `key=` workaround; import_batches' actor FK with no delete rule against seed-dev's 19-table clear list; courses_year_idx and offerings_published_idx present in migration SQL, absent from the schema, and absent from the live database while the ledger records both applied; `npm run db:migrate:status` reproducing its false "table does not exist" against a 7-row ledger; the markedToday query and the attention gate; getStudentsByDepartments reading the payload-written department column; students unique constraints being case-sensitive btrees; scope_label writers vs the single reader; and the dead setAssigning dialog, the always-listed-but-conditionally-rendered Students tab, and the shared addClassId state.

DEDUPLICATIONS — Six pairs merged: db:migrate:status (reports 1 and 6); import_batches scope_label (1 and 3); appointCoordinatorAction validation (2 and 5); setFacultyRole/appointHod scope gaps, merged with setDepartmentActiveAction into one latent-escalation finding (2 and 5); QueueClient Approve/Reject for TRs, merged with the ungated Import-roster link and the ungated dept console into one "controls without the server's check" finding (4 and 5); and the 79-of-88 unassigned-teacher offerings (2 and 6), folded into the createSubjectAction finding since the seed fixture merely reproduces what that action permits.

CORRECTED — One high finding was factually wrong and I rewrote it rather than dropping it. Report 2 claimed bulk-assigning "Coordinator" installs only the last CSV row while reporting all N as assigned. The evidence does not support it: assignClassRole's insert throws on the uuid cast (dept/actions.ts:184 passes user!.id) before `assigned++` runs, so no row is ever installed and the counter stays 0. The real behaviour — every row reported as both created and failed, and the class left with no coordinator — is the merged critical.

DEMOTED — (a) Roll/email normalization in the commit route, high → medium: the only shipped client normalizes in flagRow before posting, so reaching it needs a non-browser POST; the defect is real but not exercised by normal use. (b) setDepartmentActiveAction's missing scope check, medium → folded in as one instance of the latent-escalation finding, since dept:update/dept:deactivate are super-admin-only defaults and it is one console toggle away, exactly like hod:appoint and faculty:setRole. (c) The courses preview's unreachable 15 MB cap, medium → low: the consequence is a bad error message, not corruption. (d) attendance's ON DELETE SET NULL kept at medium but restated as latent — no code path anywhere in src/ or scripts/ deletes an offering today. Nothing else was softened.

RESIDUAL COVERAGE — Three gaps. (1) The sixth auditor's report arrived truncated mid-sentence after four findings (migrate-status, seed-dev's import_batches FK, the markedToday gate, and the seeded offerings with no class assignment); anything it found beyond those four is lost and the dev-tooling/fixtures dimension should be considered partially audited. (2) Nobody audited the production Neon database — no credentials — so the push-drops-indexes and no-transaction findings describe what would happen there, inferred from the generated DDL and the driver, not observed. (3) Never audited by anyone: src/lib/xlsx-export.ts (it carries a "use server" directive and its export scoping was outside every dimension), the faculty importer's own commit path beyond its scope checks, visual/CSS and accessibility correctness, the OIDC handshake end-to-end against real VOSS, and browser-driven per-persona session testing — all findings here are static reads plus live SQL, not exercised sessions.

## Live CRUD verification (browser, this session)

- Admin coordinator appointment: write, toast, re-render, and dept.coordinator_appointed audit row all correct.
- HOD coordinator assignment: write lands and the dashboard coordinator-gap aggregate updates (2 to 1).
- Attendance: keyboard 1/2/3/4 marking with auto-advance, partial save persists, register-today KPI flips, trend gains the day, student attendance view updates.
- Marks: Enter-to-advance entry, live distribution row, save persists with fresh grid state; the unpublished mark stays masked from the student (publish gate holds).
- Nits observed live: the admin Appointments picker lists all-department faculty for a department-scoped slot (the HOD picker scopes correctly); the teacher dashboard counts completed MSE pairs while the grid counts MSE 1/MSE 2 separately, which reads as a mismatch.