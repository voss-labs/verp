# VERP API

## What this document covers

VERP's HTTP surface is deliberately small: seven handlers, of which two are the
Better Auth passthrough and one reports the caller's own session. Everything
that writes academic data is a **Next.js Server Action**, not a REST endpoint —
33 of them, listed below with the capability and scope each enforces.

That shape is intentional. A server action runs on the server, is bound to the
component that calls it, and carries no public URL to guess at; a REST endpoint
is a permanent contract with the whole internet. VERP holds a college's student
records, so the surface is kept as small as the product allows.

If you are looking for the endpoint that saves marks, there isn't one. There is
`saveMarksAction`.

## Authentication

VERP holds no credentials. [VOSS](https://accounts.vosslabs.org) is the identity
provider and the only way in; Better Auth runs here as the relying party,
signing VERP's own session cookie and the PKCE/state cookies for the handshake.

There is no password endpoint, no sign-up, no email verification and no reset
flow, because there is nothing here to reset.

**Two questions, answered in two places.** VOSS answers _who you are_ — a
one-time code to the real mailbox is the login, and the `@vit.edu.in` gate is
enforced there. VERP answers _who that is here_, by matching the verified email
against a roster row:

| Match                              | Tier                                                |
| ---------------------------------- | --------------------------------------------------- |
| a `faculty` row                    | that row's role: `super_admin`, `hod`, or `faculty` |
| a `students` row                   | `student`                                           |
| an address in `SUPER_ADMIN_EMAILS` | `super_admin`, with or without a faculty row        |
| nothing                            | no tier — the account is redirected to `/unclaimed` |

Binding runs on **every** sign-in, not only the first, so a student who signed in
before their TR imported them is linked on their next visit.

`src/proxy.ts` (Next 16's middleware) redirects any request without a session
cookie to `/login`, with `/login` and `/api/auth` as the only public paths. It
decides whether a request gets through, never what the caller may do.

## Authorization

Two orthogonal checks. Both must pass.

**Capability** — may this tier do X at all. One of 35 strings in the
`Capability` union (`src/lib/rbac.ts`), such as `marks:write` or `audit:read`.
Defaults live in code; a super-admin can grant or revoke over them per role or
per user from `/dashboard/admin/roles`. `super_admin` is a wildcard that no
override can reduce.

**Scope** — on whose records. Resolved once per request in `src/lib/session.ts`
into `deptCodes`, `classIds`, `classKeys`, `coordinatorClassIds` and
`studentId`, and applied by these helpers:

| Helper                                                     | Passes for                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `classInScope(user, classId)`                              | super-admin; anyone assigned to the class; an HOD of its department                                |
| `canAllocate(user, classId, dept)`                         | super-admin; HOD of the department; the class **coordinator** — not a plain teacher                |
| `canWriteOffering(user, offeringFacultyId, classId, dept)` | `canAllocate`, **or** the teacher the subject is allocated to                                      |
| `canReopenLock(user, classId, dept, lockedBy)`             | `canAllocate`, **or** the teacher who placed that lock                                             |
| `studentsInClass(roster, ids)`                             | every submitted id is on the class roster — rejects the **whole** request otherwise                |
| `rollsInScope(user, rolls, storedKeys)`                    | every roll's class key is in the caller's scope; a stored key beats the derived one, for repeaters |

A capability is never a scope. A teacher holding `marks:write` still cannot
touch a class they are not assigned to.

## HTTP endpoints

### `GET` `POST` `/api/auth/[...all]`

Better Auth passthrough (`toNextJsHandler`). Handles the VOSS OAuth handshake,
session read and sign-out across many sub-paths. VERP applies **no** capability
check here — Better Auth performs its own — and `src/proxy.ts` treats the prefix
as public.

Only the `voss` provider is configured (`genericOAuth`, PKCE required, issuer
validation on). `emailAndPassword` is disabled, so the password and sign-up
sub-paths Better Auth would otherwise expose are not active.

### `GET /api/me`

The caller's own session, for client components that need tier and scope to
route. Session required; **no capability check** — an unbound account with
`tier: null` gets a 200 describing exactly that.

```jsonc
{
  "id": "...",
  "name": "...",
  "email": "...",
  "image": null,
  "tier": "faculty", // or super_admin | hod | student | null
  "facultyId": "...", // null for students
  "studentId": null, // null for staff
  "deptCodes": [], // HOD scope
  "classIds": ["..."], // coordinator / teacher scope
  "capabilities": ["marks:write", "..."], // empty for super_admin: can() short-circuits
}
```

`401 {"error":"Unauthorized"}` when there is no session.

Two things will catch you out:

- **`capabilities` is empty for a super-admin.** `can()` short-circuits that
  tier to allow-all, so the set is never populated. A client that hides controls
  on `capabilities.includes(...)` alone hides everything from the one person who
  can do everything. Check `tier === "super_admin"` first.
- `classKeys` and `coordinatorClassIds` are deliberately **not** in this
  response. The client needs them for nothing, and the server never trusts a
  scope that arrived from a browser.

Sessions last 7 days and slide forward a day at a time while in use, so an
active account is never signed out mid-task.

### `POST /api/students/import`

Commits a parsed roster. **Capability:** `student:update`. **Scope:**
`rollsInScope` — narrowing is on the **roll number**, never on the `department`
or `division` fields in the payload, because those are caller-supplied.

- super-admin: unconditional
- HOD: each roll's branch segment must map to a department in `deptCodes`
- faculty: each roll's class key must be in `classKeys`
- any other tier: refused

Where a student already exists their **stored** `class_key` wins over the key
derived from the roll — that is the repeater case, whose roll says one cohort
and whose record says another. An unparseable roll counts as offending rather
than being admitted unscoped.

The batch fails **whole** on a scope violation. There is no partial import of
the in-scope rows: a partial write looks successful, so a forged id would leave
no trace.

Per-**row** problems are different, and are not HTTP failures. A duplicate roll
or one already in the database comes back inside a `200`:

```jsonc
{
  "data": {
    "inserted": 61,
    "failed": 2,
    "errors": [
      {
        "row": 14,
        "field": "rollNumber",
        "message": "Roll number \"23108A0007\" already exists in the database",
      },
    ],
  },
}
```

`row` is 1-based, for display. Inserts run through `Promise.allSettled`, so one
bad row does not abort the rest.

### `POST /api/students/import/preview`

Parses an uploaded sheet and returns the rows it found, flagged. **Capability:**
`student:update` — the same as the commit route on purpose, because a preview
reads the whole submitted sheet back to the caller, and gating it more loosely
would leak a roster to anyone with a staff account. No scope narrowing: nothing
is written, and the scope gate lands at commit.

### `POST /api/courses/import/preview`

Parses a Scheme & Syllabus PDF or spreadsheet. **Capability:** `course:create`.
The only route that distinguishes `401 Unauthorized` from `403 Forbidden`.

Scope is not a gate here — no request is refused on it. `deptCodes` is used only
to mark which course codes are already in the catalogue. Note that for a
super-admin that lookup runs over an empty scope, so **no "already exists"
warnings are produced at all** for them.

### `POST /api/marks/import/preview`

Parses a marksheet against one class. **Capability:** `marks:write`. **Scope:**
an inline class check — super-admin, or `classIds` contains the class, or an HOD
of its department. Rows for another division match nothing and come back
`matched: false`.

Two quirks worth knowing: the rule here is character-for-character the private
`classInScope` helper in `src/app/dashboard/class/actions.ts`, duplicated rather
than imported; and a null session is not special-cased, so an unauthenticated
caller receives `403`, never `401`.

## Server actions

Called from React components, not over HTTP. Every one returns
`{ error: string | null }` — sometimes with extra fields — and reports failure
as a message rather than throwing at the caller.

A missing capability throws inside `authorize()` and is caught, so it surfaces as
`Forbidden: missing capability <name>`.

### Class workspace — `src/app/dashboard/class/actions.ts`

| Action                        | Capability           | Scope                                                                           |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| `approveEnrollmentAction`     | `onboarding:approve` | `classInScope`, then `canAllocate`                                              |
| `rejectEnrollmentAction`      | `onboarding:reject`  | `classInScope`, then `canAllocate`                                              |
| `saveAttendanceAction`        | `attendance:write`   | `classInScope` → `studentsInClass` → `canWriteOffering` when a subject is named |
| `createSubjectAction`         | `offering:create`    | `classInScope`, then `canAllocate`                                              |
| `saveMarksAction`             | `marks:write`        | `classInScope` → `canWriteOffering` → `studentsInClass`                         |
| `setMarksLockAction`          | `marks:lock`         | `classInScope` → `canWriteOffering`; unlocking also needs `canReopenLock`       |
| `setPublishedAction`          | `marks:lock`         | `classInScope`, then **`canAllocate`** — deliberately not `canWriteOffering`    |
| `assignOfferingFacultyAction` | `offering:update`    | `classInScope`, then `canAllocate`; the target must already be class staff      |
| `createBatchAction`           | `marks:write`        | `classInScope`, then `canWriteOffering`                                         |
| `assignBatchAction`           | `marks:write`        | batch → offering, `classInScope`, `canWriteOffering`, `studentsInClass`         |
| `removeFromBatchAction`       | `marks:write`        | batch → offering, `classInScope`, `canWriteOffering`                            |

Three of these are worth reading twice:

- **Publishing is not writing.** `setPublishedAction` uses `canAllocate`, so the
  teacher who owns the subject cannot publish their own results. Locking says
  "I have finished"; publishing says "the student may see this", and they are
  different people's decisions.
- **Locking now requires completeness.** A component cannot be locked until
  every active student on the roster has it, and publishing re-checks the whole
  set. Before that, a register of 89 blank rows could be locked and published.
- **Marks are validated at this boundary**, against the course's own maxima, and
  a payload with any bad value is rejected whole.

### Department workspace — `src/app/dashboard/dept/actions.ts`

Every action here is scoped to the caller's departments, via `inDeptScope`
(super-admin, or `deptCodes` contains the code) or an equivalent inline check.

| Action                         | Capability                          |
| ------------------------------ | ----------------------------------- |
| `createClassAction`            | `class:create`                      |
| `setClassActiveAction`         | `class:update` / `class:deactivate` |
| `assignClassRoleAction`        | `assignment:create`                 |
| `removeClassRoleAction`        | `assignment:remove`                 |
| `createDeptFacultyAction`      | `faculty:create`                    |
| `bulkImportFacultyAction`      | `faculty:create`                    |
| `createCourseAction`           | `course:create`                     |
| `bulkCreateCoursesAction`      | `course:create`                     |
| `updateCourseAction`           | `course:update`                     |
| `setCourseActiveAction`        | `course:update`                     |
| `assignSubjectToTeacherAction` | `offering:create`                   |
| `graduateClassAction`          | `student:update`                    |

`updateCourseAction` and `setCourseActiveAction` scope on the **course's own**
department. A course with a null department is college-wide and therefore
super-admin only.

### Administration — `src/app/dashboard/admin/actions.ts`

| Action                      | Capability                        | Scope    |
| --------------------------- | --------------------------------- | -------- |
| `createDepartmentAction`    | `dept:create`                     | none     |
| `setDepartmentActiveAction` | `dept:update` / `dept:deactivate` | none     |
| `createFacultyAction`       | `faculty:create`                  | **none** |
| `setFacultyRoleAction`      | `faculty:setRole`                 | none     |
| `deactivateFacultyAction`   | `faculty:update`                  | **none** |
| `appointAction`             | `hod:appoint`                     | none     |
| `setRoleCapabilityAction`   | `permission:manage`               | none     |

These are institution-wide by design and most of their capabilities are
super-admin defaults. **Two are not.** `faculty:create` and `faculty:update` are
HOD defaults, and neither action narrows to the caller's departments — so an HOD
can currently create a faculty row in, or deactivate a faculty member of, a
department that is not theirs. That is a known gap, not an intended rule; the
department-scoped path (`createDeptFacultyAction`) does check.

### Elsewhere

| Action                          | File                    | Capability           | Scope                                                                   |
| ------------------------------- | ----------------------- | -------------------- | ----------------------------------------------------------------------- |
| `bulkDeactivateStudentsAction`  | `students/actions.ts`   | `student:deactivate` | inline by tier; out-of-scope ids are **silently dropped**, not rejected |
| `getRecordHistoryAction`        | `audit/actions.ts`      | `audit:read`         | none — any holder can read any record's history                         |
| `submitEnrollmentRequestAction` | `onboarding/actions.ts` | none                 | session only, and only for an account with `tier: null`                 |

`submitEnrollmentRequestAction` takes the identity from the session, never the
form: the email is the VOSS-verified address and the roll is routed through
`classKeyFromRoll`.

## Errors

Successful import responses are wrapped: `{ "data": ... }`. Failures are not:
`{ "error": "..." }` at the top level. `GET /api/me` is the exception — it
returns its object unwrapped.

HTTP failures use:

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 400  | the request body failed validation                        |
| 401  | no session                                                |
| 403  | session, but not the capability or the scope              |
| 404  | the named record does not exist, or is not visible to you |
| 500  | unhandled                                                 |

Server actions do not use status codes. They return `{ error }`, where a scope
refusal reads as a sentence — "That class is not in your scope.", "That subject
is allocated to another teacher." — and a capability refusal as
`Forbidden: missing capability <name>`.

## CORS

`next.config.ts` sets `Access-Control-Allow-Origin: *` on `/api/*`.

This does **not** make the API usable from another origin. `Allow-Credentials`
is not set, so a browser will not attach VERP's session cookie to a cross-origin
request, and every endpoint above except the auth passthrough requires a
session. A previous version of this document claimed external integrations could
call these endpoints with a valid session cookie; that was never true.

The header is permissive for no benefit, which makes it worth removing rather
than relying on.

## Adding an endpoint

1. Prefer a server action. Add an HTTP route only when something outside the app
   must call it.
2. Check the capability with `authorize(user, "...")`, and add the string to the
   `Capability` union and `CAPABILITY_CATALOG` so it appears in the permissions
   console.
3. Check the scope separately, with the helper that matches the question —
   `classInScope` for "may they see this class", `canWriteOffering` for "is this
   their subject", `studentsInClass` for "are these their students".
4. Reject the whole request when any part of it is out of scope. Dropping the
   offending rows looks like success to the caller and leaves nothing to find
   afterwards.
5. Write an audit row for anything that changes academic data.
