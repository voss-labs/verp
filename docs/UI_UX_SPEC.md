# VERP UI/UX Product Specification

Status: Proposed product and interaction specification  
Audience: Product, design, frontend, backend, and QA  
Applies to: Current VERP academic ERP surface  
Last updated: 13 August 2026

## 1. Product direction

VERP should feel like an academic operations system, not a collection of CRUD pages. The interface must help each person understand four things immediately:

1. What academic scope they are operating in.
2. What needs their attention now.
3. What they are allowed to view or change.
4. What happened before and what happens next.

The central organizing model is:

```text
Institution
└── Department
    ├── Faculty
    ├── Classes and cohorts
    │   ├── Coordinator and teachers
    │   ├── Students
    │   ├── Subject offerings
    │   ├── Attendance sessions
    │   ├── Marks components
    │   ├── Lab batches
    │   └── Results
    └── Course catalogue
```

The same entity should appear in the same part of the product for every role. Roles change the available scope, information, and actions; they should not create unrelated navigation systems.

## 2. Personas, responsibilities, and scope

VERP has four technical tiers but five operational personas. Academic coordinator and teacher are both `faculty` tier users whose responsibilities come from their class assignments.

| Persona              | Effective scope                           | Primary responsibility                                                                              | Must not see                                                          |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Super-admin          | Entire institution                        | Configure departments, staff, roles, and cross-department governance                                | Nothing inside the institution, subject to data-retention rules       |
| HOD                  | Appointed department(s)                   | Operate department, classes, staffing, catalogue, academic completion and exceptions                | Other departments unless separately appointed                         |
| Academic coordinator | Coordinated class(es)                     | Own class operations, enrolment, subject allocation, coverage, attendance and assessment completion | Unassigned classes or other department records                        |
| Teacher/TR           | Assigned class(es) and allocated subjects | Deliver attendance, marks and batches for assigned teaching work                                    | Unassigned subjects, unassigned classes and department administration |
| Student              | Own student record                        | Understand attendance, marks, results and account state                                             | Any other student's record or staff workflows                         |

### 2.1 Contextual role rules

- A faculty member can be a coordinator in one class and a teacher in another.
- The UI must display the role for the current context, not only the database tier.
- HODs have cover authority for attendance and marks within their department.
- Coordinators can allocate and reallocate subjects within coordinated classes.
- Teachers can write only the subjects allocated to them, while class-level attendance follows their class assignment.
- Super-admin is an institution-wide wildcard and cannot be restricted by permission overrides.
- Capabilities decide whether an action is available; scope decides which records it applies to.

### 2.2 Permission presentation rules

- Hide actions the user never has permission to perform.
- Disable actions only when the user has permission but the current record state prevents the action. Explain the reason beside or inside the disabled control.
- A direct unauthorized URL must render a clear access-denied page or redirect to the nearest valid parent. It must never partially render sensitive content.
- Destructive or institution-wide actions require an impact preview and confirmation.
- Every mutation must show a success result using the same verb as its initiating action.
- Permission and scope checks remain server authoritative. UI hiding is usability, not security.

## 3. Design language

### 3.1 Visual character

The interface should resemble a calm academic control room: compact, credible, information-rich and operational. It should avoid decorative dashboard gradients, excessive cards and oversized marketing typography.

### 3.2 Core palette

| Token             | Value     | Use                                             |
| ----------------- | --------- | ----------------------------------------------- |
| Institutional ink | `#0B132B` | Sidebar, primary text, selected controls        |
| Academic blue     | `#1D4ED8` | Primary actions, focus, links and current scope |
| Canvas            | `#F6F8FC` | Application background                          |
| Paper             | `#FFFFFF` | Work surfaces and tables                        |
| Success           | `#15803D` | Completed, published, present and active        |
| Attention         | `#B45309` | Pending, incomplete and approaching deadline    |
| Critical          | `#B91C1C` | Failed, rejected, absent and destructive action |

Status colors must always include text or an icon. Color alone cannot carry meaning.

### 3.3 Typography

- Primary UI: Source Sans 3 or the existing system sans stack until font loading is intentionally introduced.
- Data and academic identifiers: IBM Plex Mono for roll numbers, course codes, class keys and employee IDs.
- Headings: compact, sentence case, medium or semibold; avoid oversized headings.
- Table text: 13–14 px with tabular numerals for marks, attendance and counts.
- Secondary labels: 12 px, never below 11 px.

### 3.4 Signature element: Academic context trail

Every protected page carries an academic context trail:

```text
VIT / EXCS / BE A / Data Analytics / Semester 1
```

Each segment is interactive when the user may switch it. This trail is the product's main structural signature and replaces decorative dashboard elements.

### 3.5 Layout density

- Desktop content width uses the available viewport; operational tables should not be trapped inside narrow centered columns.
- Use cards only for independent summaries or decisions. Use sections and dividers for related information.
- Page headers remain sticky below the application header when a page contains long tables.
- Primary actions live in the page header; local row actions live with the record.
- Use right-side detail drawers for quick inspection and full pages for multi-step or high-risk editing.

## 4. Global application shell

### 4.1 Desktop shell

```text
┌──────────────┬──────────────────────────────────────────────────────────┐
│ VOSS / VERP  │ VIT / EXCS / BE A       Search     Alerts     User     │
├──────────────┼──────────────────────────────────────────────────────────┤
│ Overview     │ Page title                              Primary action  │
│ Organization │ Context, status and supporting copy                     │
│ Academics    ├──────────────────────────────────────────────────────────┤
│ People       │ Attention strip / page tabs                             │
│ Attendance   ├──────────────────────────────────────────────────────────┤
│ Assessment   │ Main workspace                                           │
│ Reports      │                                                          │
│ Admin        │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

### 4.2 Header

The persistent header displays:

- Scope switcher: institution, department, class and subject when applicable.
- Academic period switcher: academic year and semester.
- Global search across records allowed by current scope.
- Attention inbox, not a generic notification placeholder.
- Contextual role such as `HOD · EXCS` or `Coordinator · BE A`.
- User menu with VOSS account, theme and sign out.

### 4.3 Sidebar

Use stable domain navigation:

| Domain         | Contents                                           |
| -------------- | -------------------------------------------------- |
| Overview       | Role-specific command centre                       |
| Organization   | Departments and institutional structure            |
| Academics      | Classes, course catalogue and subject offerings    |
| People         | Faculty and students                               |
| Attendance     | Sessions, completion and exceptions                |
| Assessment     | Marks, locks, results and publication              |
| Reports        | Scoped exports and analytical views                |
| Administration | Roles, permissions, audit and system configuration |

Only domains containing at least one accessible page are shown. Navigation is generated from effective capabilities and scope, not a hardcoded role array.

### 4.4 Command palette and global search

The command palette opens with `Cmd/Ctrl + K` and supports:

- Find a student by name or roll number.
- Find faculty by name, email or employee ID.
- Jump to a class, department or course.
- Start a permitted action such as Take attendance or Import marks.
- Switch current department or class context.

Results must be scope-filtered on the server.

### 4.5 Attention inbox

The inbox shows work requiring action:

- Enrolment requests.
- Unsubmitted attendance sessions.
- Incomplete marks components.
- Unallocated subjects.
- Classes without coordinators.
- Failed imports.
- Permission changes requiring review.

Each item links to the exact filtered workspace needed to resolve it.

## 5. Shared interaction patterns

### 5.1 Record tables

Every major table supports:

- Search with visible matching fields.
- Named filters with human-readable default labels.
- Sortable columns.
- Saved views for repeat workflows.
- Column visibility where the dataset is wide.
- Sticky header and sticky identity column.
- Filter state encoded in the URL.
- Current result count.
- Bulk selection limited to the filtered scope.
- Export of the current filtered and sorted view.
- Empty, loading, error and no-results states.

On mobile, operational tables become record lists or cards. Horizontal scrolling is reserved for comparison-heavy marks and results tables.

### 5.2 Detail drawer

Selecting a person, course or class from a table opens a drawer with:

- Identity and status.
- Key facts.
- Current assignments or relationships.
- Recent activity.
- Permitted quick actions.
- Link to the full record.

The user retains table filters and scroll position when the drawer closes.

### 5.3 Status language

Use consistent workflow states:

```text
Identity: Unclaimed → Awaiting review → Approved → Active
Attendance: Not opened → In progress → Complete → Submitted → Corrected
Marks: Not started → In progress → Submitted → Locked → Published
Staffing: Unallocated → Assigned → Active → Reassigned
Import: Uploaded → Reviewing → Ready → Importing → Completed / Failed
```

### 5.4 Audit history

Audit history appears both globally and contextually. A student, faculty member, class, course or subject drawer should show relevant recent events. Each event states actor, action, time, scope, and changed values where safe.

## 6. Page specifications

### 6.1 Login

Route: `/login`

Audience: Signed-out users.

Purpose: Explain the single VOSS authentication path and initiate sign-in.

Display:

- VERP and VIT identity.
- One-sentence product description.
- `Continue with VOSS` primary action.
- Clear explanation: no VERP password exists; VOSS verifies the email.
- Support link for inaccessible college email or account issues.
- Service-status message only when authentication is degraded.

UX requirements:

- No feature-pill marketing clutter on small screens.
- While redirecting, show a progress state and prevent duplicate clicks.
- On OAuth failure, state whether the user can retry or must contact support.
- Preserve the intended destination so successful login returns to the requested page when authorized.

### 6.2 Unclaimed account and enrolment

Route: `/unclaimed`

Audience: VOSS-authenticated users without a linked faculty or student record.

Purpose: Explain why access is pending and give the correct next action.

Display variants:

| State                   | Display                                                                 | Primary action                          |
| ----------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| No request              | Verified email, enrolment form and roll-number interpretation preview   | Request enrolment                       |
| Pending                 | Submitted identity, target class, submission time and review owner      | None; show expected next step           |
| Unrouted                | Explanation that the class is not configured and responsible department | Contact department or retry after setup |
| Rejected                | Decision reason and whether resubmission is allowed                     | Correct and resubmit                    |
| Faculty not provisioned | Verified email and department support direction                         | Contact department administrator        |

The email is displayed as verified and locked. Roll number parsing should preview admission year, branch, division and expected class before submission.

### 6.3 Overview command centre

Route: `/dashboard`

This route renders a different operational home for each persona.

#### Super-admin overview

Display:

- Institution configuration health.
- Departments without HODs.
- Classes without coordinators or TRs.
- Faculty and student identity exceptions.
- Recent privileged activity.
- Permission override count and recent changes.
- Failed imports and system errors.
- Cross-department academic completion summary.

Primary actions: Add department, add faculty, appoint HOD, review permissions.

Do not display generic totals without exceptions or drill-downs.

#### HOD overview

Display:

- Department identity and leadership.
- Classes by year/division with staffing and completion status.
- Faculty workload and unallocated subjects.
- Students pending claim or enrolment.
- Today's attendance completion.
- Marks completion by component and semester.
- Decisions requiring HOD attention.

Primary actions: Create class, add faculty, allocate subjects, resolve exception.

#### Coordinator overview

Display:

- Current class and ability to switch coordinated classes.
- Enrolment requests.
- Today’s attendance sessions and completion.
- Subject allocation status.
- Marks components awaiting entry, lock or publication.
- Lab batch completeness.
- Students with missing academic records.

Primary actions: Take attendance, review enrolment, allocate subject, enter marks.

#### Teacher/TR overview

Display:

- Today’s assigned classes and subjects.
- Attendance work due.
- Marks work due per subject and component.
- Locked and submitted work.
- Students with incomplete records in assigned classes.
- Recently saved activity for confidence and recovery.

Primary actions: Take attendance, enter marks, import marks, manage lab batch.

#### Student overview

Display:

- Attendance by subject with overall and threshold state.
- Published and provisional marks clearly separated.
- SGPI/CGPA only when computable.
- Current subjects and credit progress.
- Academic notices affecting the student.
- Identity, class and department context.

Primary actions: View detailed marks, inspect attendance by subject.

### 6.4 Administration landing

Route: `/dashboard/admin`

Audience: Super-admin.

Purpose: Institution configuration and governance entry point.

Display:

- Setup completion checklist across departments, faculty, leadership and classes.
- Configuration exceptions ordered by operational impact.
- Recent admin changes.
- Links to Departments, Faculty, Roles and permissions, and Activity log.

The page should not be three generic navigation cards. It should show whether the institution is ready to operate.

### 6.5 Department administration

Route: `/dashboard/admin/departments`

Audience: Super-admin.

Scope: All departments.

Display:

- Department table: code, name, HOD, coordinator, active classes, faculty, students, configuration status and activity state.
- Setup-progress indicator for each department.
- Quick creation of standard VIT branches without hiding the normal add flow.
- Department detail drawer on row selection.

Actions:

- Add department.
- Appoint or change HOD.
- Activate/deactivate department with impact preview.
- Open department workspace.

Empty state: Explain that departments are the root of classes, faculty, courses and students; offer Add department.

### 6.6 Faculty administration

Route: `/dashboard/admin/faculty`

Audience: Super-admin.

Scope: All faculty.

Display:

- Searchable faculty directory with employee ID, department, tier, contextual assignments, subjects, identity claim state and active status.
- Filters for department, tier, assignment, claim and status.
- Workload summary inside the faculty drawer.
- Separate visual treatment for institutional tier and contextual class role.

Actions:

- Add faculty.
- Change tier with an impact preview.
- Appoint department leadership.
- Activate/deactivate faculty.
- Review or revoke sessions where supported.

Do not label deactivation as Remove. Preserve the distinction between inactive records and deletion.

### 6.7 Roles and permissions

Route: `/dashboard/admin/roles`

Audience: Super-admin.

Display:

- Searchable capability matrix grouped by domain.
- Sticky capability column and sticky role headers.
- Baseline, granted override and denied override shown distinctly.
- Effective user count affected by each tier change.
- Side panel explaining selected capability, enforcement points and scope behavior.
- Recent permission changes.

Actions:

- Grant or revoke a tier capability.
- Return an override to baseline.
- Add an audit reason for high-impact changes.

Confirmation is required when revoking a default capability or granting an administrative capability. User-specific exceptions should be introduced only with a defined operational need.

### 6.8 Department hub

Route: `/dashboard/dept`

Audience: Super-admin and HOD.

Scope:

- Super-admin sees every department and can switch among them.
- HOD sees only appointed department(s).

Display:

- Department switcher or single-department identity.
- Class grid grouped by programme year and division.
- Staffing completeness, roster size, attendance state and assessment state per class.
- Department-level attention list.
- Compact faculty and course health summaries.

Actions:

- Open department workspace.
- Create class.
- Add faculty.
- Resolve an unstaffed class.
- Graduate a cohort with impact confirmation.

### 6.9 Department workspace

Route: `/dashboard/dept/[code]`

Audience: Super-admin and in-scope HOD.

Tabs:

```text
Overview | Classes | Faculty | Students | Courses | Attendance | Assessment | Activity
```

Overview displays:

- Leadership.
- Active academic period.
- Class and staffing health.
- Claimed/unclaimed student state.
- Attendance completion.
- Marks completion.
- Operational exceptions.

Classes tab displays class, coordinator, teachers, student count, attendance status, marks status and cohort state.

Faculty tab displays assignments and workload rather than only directory fields.

Activity tab displays department-scoped audit events.

### 6.10 Faculty appointments and workload

Route: `/dashboard/dept/appoint`

Audience: Super-admin and HOD.

Scope: Current department.

Purpose: Assign people to classes and subjects while seeing workload impact.

Display:

- Faculty list with search, workload and current responsibilities.
- Selected faculty detail with classes, contextual role and subjects.
- Unstaffed classes and unallocated subjects as actionable queues.
- Before/after workload preview for a proposed assignment.

Actions:

- Assign/remove coordinator or teacher role.
- Allocate/reallocate a subject.
- Open the faculty or class record.

Avoid a long single-page form. Use a two-pane assignment workspace on desktop and sequential drawers on mobile.

### 6.11 Course catalogue

Route: `/dashboard/dept/courses`

Audience: Super-admin and in-scope HOD; read-only visibility may be available to scoped faculty.

Display:

- Course code, name, programme year, type, credits, marks structure, active offerings and state.
- Filters for department, year, type, active state and in-use state.
- Course detail drawer showing all active offerings and change history.
- Clear distinction between catalogue definition and a class-specific subject offering.

Actions:

- Add course.
- Edit course.
- Activate/deactivate with usage impact.
- Import syllabus.
- Open affected class offerings.

### 6.12 Syllabus import

Route: `/dashboard/dept/courses/import`

Audience: Super-admin and in-scope HOD.

Use a step-based workflow:

```text
Upload PDF → Parse → Review courses → Resolve warnings → Confirm import → Result
```

Display:

- File requirements before upload.
- Parsing progress with page count.
- Editable review table.
- Existing-course conflicts.
- Marks-total validation.
- Selected versus skipped course count.
- Final created, skipped and failed results.

The final confirmation names the target department and academic year.

### 6.13 Faculty import

Route: `/dashboard/dept/faculty-import`

Audience: Super-admin and in-scope HOD.

Use the same import grammar as syllabus and roster imports.

Display:

- Downloadable template.
- Parsed faculty preview.
- Duplicate email and employee-ID warnings.
- Optional class/role assignment, with scope shown explicitly.
- Final created, reused, assigned and failed counts.

No row may silently land in a department different from the selected scope.

### 6.14 Faculty directory

Route: `/dashboard/faculty`

Audience: Super-admin and in-scope HOD.

Display:

- Scoped faculty directory.
- Employee identity, department tier, contextual class roles, subject allocation, workload, claim state and status.
- Faculty detail drawer with assignments and recent activity.

HOD actions are restricted to faculty within their department. Super-admin can cross departments.

### 6.15 Class list

Route: `/dashboard/class`

Audience: Coordinator and teacher; optionally HOD through department navigation.

Display:

- Classes assigned to the user.
- Contextual role per class.
- Today’s attendance state.
- Enrolment request count.
- Subject and marks completion.
- Next required action.

Sort by urgency first, then academic year/division. Do not show empty global statistics.

### 6.16 Class workspace

Route: `/dashboard/class/[classId]`

Audience: Super-admin, in-scope HOD, assigned coordinator and assigned teacher.

Tabs:

```text
Overview | Students | Subjects | Attendance | Marks | Batches | Results | Activity
```

Header displays:

- `BE · EXCS · A` and class key.
- Coordinator and teachers.
- Student count and claim state.
- Contextual role of the current user.
- Academic period.

Overview displays:

- Enrolment requests.
- Staffing gaps.
- Today’s attendance completion.
- Subject allocation.
- Marks completion and lock status.
- Result readiness.
- Recent class activity.

Role differences:

- Coordinator sees all class workflows and exceptions.
- Teacher sees assigned teaching work first and class-wide read-only summaries where allowed.
- HOD sees completion, intervention and cover actions.
- Super-admin sees the full operational view.

### 6.17 Student roster

Route: `/dashboard/students`

Audience: Super-admin, in-scope HOD, assigned coordinator and teacher.

Scope:

- Super-admin: all students.
- HOD: department students.
- Coordinator/teacher: assigned class students.

Display:

- Roll number, name, class, department, claim state, attendance health, assessment completeness and active state.
- Human-readable filter defaults such as All departments and All years.
- Saved views: Unclaimed, Attendance risk, Missing marks, Graduated and Inactive.
- Student detail drawer on row selection.

Actions vary by role:

- Super-admin/HOD: deactivate within scope, export, inspect history.
- Coordinator: review enrolment and class record state.
- Teacher: read academic context; no identity or lifecycle mutation without capability.

Import roster is shown only when the user can import into the current explicit scope.

### 6.18 Student detail

Route: `/dashboard/students/[id]`

Audience: Authorized staff within student scope. Students use their self-service pages instead.

Header displays:

- Name, roll number, class, department and active/claim state.
- No decorative avatar is required when no real image exists; initials are sufficient.

Tabs:

```text
Summary | Attendance | Marks | Results | Identity | Activity
```

Summary displays:

- Current class and academic period.
- Attendance by subject.
- Assessment completion.
- Current SGPI/CGPA state.
- Exceptions needing staff attention.

Identity displays verified email, binding date and claim state without exposing authentication secrets.

Actions require explicit permissions and must show impact. A teacher should not receive student lifecycle actions merely because they can read the roster.

### 6.19 Roster import

Route: `/dashboard/students/import`

Audience: Super-admin, in-scope HOD and faculty importing into an assigned class.

The target scope must be selected before file upload and remain visible throughout:

```text
Target: EXCS / BE A / Admission year 2023
```

Workflow:

```text
Choose target → Upload workbook → Select sheet → Review rows → Resolve errors → Confirm → Result
```

Display:

- Downloadable template and accepted formats.
- Sheet and header detection.
- Derived class preview from every roll number.
- Duplicate, malformed and out-of-scope rows.
- Exact valid/invalid counts.
- Atomic-import choice: reject entire file when any row violates scope.
- Final audit reference.

Department and class fields derived from roll numbers cannot be freely changed to contradict the target scope.

### 6.20 Attendance workspace

Route: `/dashboard/class/[classId]/attendance`

Audience: Super-admin, in-scope HOD, coordinator and assigned teacher with write capability.

Header controls:

- Class context.
- Local college date.
- Subject or homeroom session.
- Lecture/lab slot and start time.
- Draft/submitted/corrected state.

Display:

- Students begin Unmarked, never Present by default.
- Completion progress: `63 of 89 marked`.
- Search by roll or name.
- Quick filters: Unmarked, Present, Absent, Late, Excused.
- Bulk Mark remaining present action with confirmation.
- Sticky Save draft and Submit attendance actions.
- Existing-session history and correction reason.

Desktop row:

```text
23108A0023  Mandar Patil        Unmarked  Present  Absent  Late  Excused
```

Mobile row:

```text
23108A0023  Mandar Patil
[Present] [Absent] [More]
```

After submission, the page becomes read-only until a permitted correction is started. Correcting requires a reason and produces an audit event.

### 6.21 Subject allocation

Route: `/dashboard/class/[classId]/subjects`

Audience: Super-admin, in-scope HOD, coordinator; assigned teacher has read-only access.

Display:

- Subject offerings grouped by semester.
- Course code/name, type, credits, marks structure, assigned teacher, batch requirement and status.
- Unallocated subjects at the top as an attention queue.
- Catalogue browser filtered to the class year and department.
- Teacher workload during allocation.

Actions:

- Add offering from catalogue.
- Allocate or reallocate teacher.
- Leave intentionally unallocated with a visible warning.
- Open marks or batches.

Teacher experience: show only the offering details and responsibility; hide allocation controls.

### 6.22 Marks workspace

Route: `/dashboard/class/[classId]/marks`

Audience: Super-admin, in-scope HOD, coordinator and assigned teacher.

Subject selection view displays:

- Assigned offerings first.
- Teacher, semester and marks structure.
- Completion for ISA, MSE and ESE.
- Lock and publication state.
- Missing-student count.

Marks grid displays:

- Sticky roll and name columns.
- Component inputs with maximum marks in the header.
- Inline range validation.
- Autosaved draft indicator or explicit unsaved-change indicator.
- Provisional total clearly separated from final grade.
- Lock state per component.
- Filter for incomplete or invalid rows.
- Import and export actions.
- Submit/lock action distinct from Save draft.

Role behavior:

- Assigned teacher edits allocated offering.
- Coordinator can cover, review, lock and reopen within coordinated class.
- HOD can cover and reopen within department.
- Super-admin can intervene institution-wide.

An incomplete subject displays In progress, never a misleading final zero.

### 6.23 Marks import

Route: `/dashboard/class/[classId]/marks/import`

Audience: Users allowed to write the selected offering.

Workflow:

```text
Select subject → Upload → Map columns → Match roster → Review → Confirm → Result
```

Display:

- Explicit target class and subject.
- Detected column headers and editable mapping.
- Matched and unmatched rolls.
- Maximum-mark violations.
- Existing marks that would be replaced.
- Locked components excluded from mutation.
- Before/after value preview for changed cells.

Reject out-of-class students and preserve all locked components server-side.

### 6.24 Lab batches

Route: `/dashboard/class/[classId]/batches`

Audience: Super-admin, in-scope HOD, coordinator and assigned practical/project teacher.

Display:

- Practical/project offering selector.
- Batch cards with name, size, teacher, schedule if available and unassigned count.
- Unassigned-student queue.
- Duplicate or conflicting assignment warnings.
- Balanced distribution suggestion as an assistive action, not automatic mutation.

Actions:

- Create/rename/deactivate batch.
- Assign or move scoped students.
- Remove student with confirmation when it affects attendance records.
- Export batch list.

Theory-only empty state explains why batches are unavailable and links to Subjects.

### 6.25 Class results

Route: `/dashboard/class/[classId]/results`

Audience: Super-admin, in-scope HOD, coordinator and assigned teacher with results-read permission.

Display:

- Publication/readiness banner.
- Result completeness: students complete, incomplete and failed.
- Filters for result state, semester and subject.
- Roll, name, SGPI/CGPA, credits, result state and breakdown.
- Student breakdown drawer with component provenance.
- Export metadata: class, academic period, generated time and actor.

Do not show `0 credits / 0 semesters` as if it were a valid result. Use Not yet computable and explain missing components.

Publication must be a separate governed state from marks entry and locking.

### 6.26 Student marks and results

Route: `/dashboard/my-marks`

Audience: Student only.

Display:

- Current CGPA and semester SGPI only when computable.
- Credits earned and attempted.
- Published versus provisional subjects.
- Subject rows with total, percentage, grade and publication state.
- Expandable component breakdown: ISA, both MSEs, counted MSE and ESE.
- Clear explanation when a result is held or incomplete.
- Academic-period switcher for history.

Future attendance detail should sit beside this as My attendance, using subject-level percentages and session history.

Mobile uses stacked semester sections and expandable subject cards rather than a wide table.

### 6.27 Activity log

Route: `/dashboard/audit`

Audience: Super-admin by default; department-scoped audit may be granted to HOD deliberately.

Display:

- Time, actor, action, scope, target and concise change summary.
- Filters for time, actor, domain, action, department, class and target.
- Detail drawer with structured before/after values where captured.
- Links to the affected record when still available.
- Export with active filters and generation metadata.

Unauthorized users receive a full access-denied state, not a mostly empty audit page.

### 6.28 Missing, unavailable and access-denied pages

Routes: `/dashboard/[...missing]`, `not-found`, and guarded fallbacks.

Differentiate:

- Record does not exist.
- Record exists but is outside scope.
- User lacks capability.
- Record is inactive or archived.
- Feature is not configured.

Do not reveal sensitive record existence to out-of-scope users. Provide a safe route back to the nearest valid workspace.

## 7. Responsive behavior

### 7.1 Desktop priorities

Desktop serves super-admin and HOD comparison-heavy work:

- Persistent sidebar.
- Multi-column operational layouts.
- Dense tables with sticky columns.
- Two-pane assignment workspaces.
- Side drawers for inspection.

### 7.2 Tablet priorities

- Collapsible sidebar.
- Two-column summaries become one or two columns based on available width.
- Page actions collapse into an overflow menu only after preserving the primary action.
- Drawers may become full-height sheets.

### 7.3 Mobile priorities

Mobile is a first-class surface for teachers and students:

- Bottom or compact drawer navigation for key domains.
- Sticky primary action at the bottom for long attendance/marks workflows.
- Tables become lists except where column comparison is essential.
- Touch targets are at least 44 px.
- Filters open in a sheet with an active-filter count.
- Context trail collapses to current class/subject with a back hierarchy.
- No important action depends on hover.

## 8. Loading, empty, error and success states

Every page specification includes four non-happy states.

### Loading

- Preserve the actual page structure with skeletons.
- Do not flash an empty navigation or `User` identity while client auth loads.
- Long imports show deterministic steps and progress when available.

### Empty

An empty state explains why the page is empty and the correct next action.

Examples:

- `No classes are assigned to you. Ask your HOD to add you to a class.`
- `No subjects are on this class. Add one from the EXCS catalogue.`
- `No marks are published yet. Entered components will appear after publication.`

### Error

- State what failed.
- Preserve user-entered data.
- Explain whether retry is safe.
- Include a reference ID for support when the failure is logged.

### Success

- Use the same action verb: `Attendance submitted`, `Marks saved`, `Subject allocated`.
- For high-impact changes, summarize the affected records.
- Keep an Undo action only when reversal is safe and audited.

## 9. Accessibility requirements

- Meet WCAG 2.2 AA contrast and interaction requirements.
- All functionality works by keyboard.
- Visible focus is never removed.
- Tables have correct header relationships and useful accessible names.
- Status changes are announced through a polite live region.
- Validation errors are connected to their fields.
- Dialogs and drawers trap and restore focus correctly.
- Charts, where introduced, include textual equivalents.
- Reduced-motion preference disables nonessential transitions.
- Dates and numbers are readable without relying on color.

## 10. Content and terminology

Use one vocabulary across the product:

| Use                  | Avoid                                                          |
| -------------------- | -------------------------------------------------------------- |
| Student roster       | All Students when the view is scoped                           |
| Faculty              | Staff member where the record is specifically academic faculty |
| Academic coordinator | AC without first defining it                                   |
| Teacher              | TR when the user-facing responsibility is teaching             |
| Deactivate           | Remove or Delete for retained records                          |
| Save draft           | Save when submission is a separate state                       |
| Submit attendance    | Save attendance when it becomes governed/final                 |
| Publish results      | Make live                                                      |
| Course catalogue     | Subjects when referring to reusable course definitions         |
| Subject offering     | Course when referring to a class-specific instance             |

Sentence case is used for page titles, buttons and labels. Avoid internal capability names such as `marks:write` outside the permissions console.

## 11. Analytics and UX quality signals

Collect privacy-respecting product signals:

- Time to complete attendance.
- Percentage of attendance sessions submitted without correction.
- Time from enrolment request to decision.
- Time from marks entry start to locked completion.
- Import error rate by type.
- Number of unallocated subjects and unstaffed classes over time.
- Search-to-record success rate.
- Permission-denied events by route and action.
- Mobile completion rate for faculty workflows.

Do not use engagement time as a success metric. ERP success means correct work completed with fewer errors and less administrative friction.

## 12. Implementation sequence

### Phase 1: secure interaction foundation

- Close cross-scope roster, marks and batch write gaps.
- Reconcile HOD and coordinator capabilities with the workflow model.
- Pass server-resolved identity and scope into the application shell.
- Build capability-driven navigation and the academic context trail.

### Phase 2: operational workspaces

- Build role-specific overview command centres.
- Convert department and class pages into tabbed workspaces.
- Introduce shared table, detail-drawer, attention and audit components.

### Phase 3: academic workflows

- Redesign attendance around explicit sessions and an Unmarked state.
- Separate marks draft, submit, lock and publish states.
- Standardize roster, marks, faculty and syllabus imports.
- Add subject and batch workflow completion states.

### Phase 4: student and mobile quality

- Build subject-level student attendance.
- Unify provisional and final marks semantics.
- Replace mobile admin tables with record lists where appropriate.
- Optimize attendance and marks entry for touch.

### Phase 5: governance and polish

- Improve the permission console and impact previews.
- Add contextual audit history.
- Add saved views, global search and the attention inbox.
- Apply final visual, accessibility and performance QA.

## 13. Definition of done for each redesigned page

A page is complete only when:

- Its permitted personas and exact scope are documented and tested.
- Its primary user job is clear above the fold.
- Its data is scope-filtered server-side.
- Its actions map to capabilities and contextual responsibility.
- Loading, empty, error, success and access-denied states exist.
- It works at desktop, tablet and mobile sizes appropriate to its persona.
- Keyboard navigation and screen-reader semantics are verified.
- High-impact mutations provide an impact preview and audit event.
- Filters and selection survive drawers and reasonable navigation.
- No placeholder count, fake chart, dead control or internal sentinel reaches production.
