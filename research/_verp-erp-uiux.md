I have the ground truth. Here is the UI/UX + Routing architecture, grounded in the real files.

---

# VERP UI/UX + Routing Architecture

## 0. What the repo already gives us (build ON this)

- `dashboard/layout.tsx` is a **server** component that calls `getSessionUser()` and redirects unbound → `/unclaimed`. This is the existing layout-guard chokepoint pattern — the target's per-segment guards are the same idea, nested one level deeper per role.
- Every data page is an RSC (`export const dynamic = "force-dynamic"`) that fetches server-side and hands data to a `"use client" client.tsx`. Two header components: `SiteHeader` (overview) and `PageHeader` (breadcrumb + parent link).
- `AppSidebar` (client) switches **static nav arrays** by `useUserRole()`. `NavMain` renders collapsible groups. `TeamSwitcher` shows a static "VOSS / VERP" pill.
- Reusable primitives already present: `DataTableView` (search + CSV/XLSX export, used by students), `Card`, `Badge`, `Progress`, `Switch`, `Tabs`, `Dialog`, `Drawer`, `Sheet`, `Command`, `Select`, `AlertDialog`. base-nova composition uses the `render={<Comp/>}` prop (not Radix `asChild`). Blue theme tokens: `bg-blue` / `text-blue-foreground`.

Two things to fix while extending: `useUserRole` defaults `role: "admin"` while loading (change to a `loading`-gated null), and the static nav arrays become scope-derived.

---

## (a) Route map + the layout-level guard that routes and authorizes

### Decision: real path segments per role, not Next route groups

Route **groups** `(admin)` don't appear in the URL, so you can't guard by URL and the isolation isn't legible. Use **real segments** under `/dashboard`, one per role-scope, each with its own `layout.tsx` that authorizes at the segment boundary. The URL itself then encodes scope, and reaching another role's area is a redirect from that area's own layout — no page has to remember a check.

```
/                              → redirect to /dashboard (or /login)
/login                         VOSS sign-in (exists)
/unclaimed                     → BECOMES the self-registration form + pending status (§c)

/dashboard                     → dispatcher: redirect to homeFor(user) — renders nothing
/dashboard/admin/*             super_admin console      guard: role === super_admin
/dashboard/dept/*              HOD dept dashboard       guard: role === hod
/dashboard/class/*             TR class dashboard       guard: role === faculty (has ≥1 class)
/dashboard/me/*                student self dashboard   guard: role === student
```

### The dispatcher (replaces the current mock `/dashboard/page.tsx`)

```tsx
// dashboard/page.tsx  (server)
export const dynamic = "force-dynamic"
export default async function DashboardHome() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  redirect(homeFor(user))   // never renders
}
```

```ts
// lib/nav.ts
export function homeFor(u: SessionUser): string {
  switch (u.role) {
    case "super_admin": return "/dashboard/admin"
    case "hod":         return "/dashboard/dept"
    case "faculty":     return u.classIds.length === 1
                          ? `/dashboard/class/${u.classIds[0]}`
                          : "/dashboard/class"          // class picker
    case "student":     return "/dashboard/me"
    default:            return "/unclaimed"
  }
}
```

### The two-tier layout guard

`dashboard/layout.tsx` keeps the coarse gate (session + unbound → `/unclaimed`) and renders the shell (`SidebarProvider` + `AppSidebar` + `SidebarInset`). Each **role segment** adds a `layout.tsx` that is the authoritative role gate, so the child pages never re-check role:

```tsx
// dashboard/admin/layout.tsx (server)
export default async function AdminLayout({ children }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "super_admin") redirect(homeFor(user))  // bounce, not 403 — it's their own nav that's wrong
  return children
}
```

The **scope** gate lives one level deeper, on the dynamic-param layout, and this is where "a TR cannot navigate to another class" becomes structural:

```tsx
// dashboard/class/[classId]/layout.tsx (server)
export default async function ClassLayout({ params, children }) {
  const user = await getSessionUser()
  const { classId } = await params
  if (user?.role !== "faculty" || !user.classIds.includes(classId))
    redirect(homeFor(user))     // out-of-scope classId → bounced to own home/picker
  return children
}
```

`dashboard/dept/layout.tsx` does the analogous check on `user.deptCodes` (HOD may hold >1 dept). Result: role gate + scope gate are two nested server layouts; every leaf page inherits both and stays thin. A hand-typed `/dashboard/class/<someone-elses-id>` URL is redirected before any query runs — matching the RBAC agent's "mutations re-check the loaded row" with a **navigation-level** re-check on the param.

---

## (b) Navigation per role + replacing the mock overview

### Sidebar becomes scope-derived, not static arrays

Replace the three hardcoded arrays in `app-sidebar.tsx` with a `navForUser(user)` that emits only the items the user's capabilities + scope allow (`can(user, cap)`). Because the nav is built from scope, a TR **has no rendered link** to dept or admin areas — isolation of surface, not just data. Keep `NavMain` unchanged (it's a pure renderer). The client still reads `/api/me`, which now returns `role`, `capabilities`, `deptCodes`, `classIds` (cosmetic; server layouts are authoritative).

**super_admin sidebar**
- Overview — `/dashboard/admin`
- Departments — `/dashboard/admin/departments`
- Faculty — `/dashboard/admin/faculty`
- Students — `/dashboard/admin/students`
- Roles & Permissions — `/dashboard/admin/roles`
- Activity Log — `/dashboard/admin/audit`

**HOD sidebar** (dept-scoped; header shows dept name)
- Overview — `/dashboard/dept`
- Classes — `/dashboard/dept/classes`
- Faculty — `/dashboard/dept/faculty`
- Students — `/dashboard/dept/students`
- Unrouted Requests — `/dashboard/dept/requests` (badge = count of `status='unrouted'` in dept)

**TR / faculty sidebar** (class-scoped)
- Overview — `/dashboard/class/[id]`
- Approval Queue — `/dashboard/class/[id]/requests` (badge = pending count)
- Class Roster — `/dashboard/class/[id]/students`
- Attendance — `/dashboard/class/[id]/attendance`
- Marks — `/dashboard/class/[id]/marks`

**student sidebar**
- Overview — `/dashboard/me`
- Attendance — `/dashboard/me/attendance`
- Marks — `/dashboard/me/marks`

### Repurpose `TeamSwitcher` → `ScopeSwitcher`

The static "VOSS / VERP" pill becomes a **scope indicator** in the sidebar header:
- super_admin: static "VERP · All Departments".
- HOD: current dept name; dropdown to switch if they hold multiple depts (rewrites the `/dashboard/dept` context).
- TR with one class: static `TE-EXCS-A` label. TR with **multiple** classes: a real switcher — selecting a class navigates to `/dashboard/class/[thatId]`. This reuses the existing dropdown markup; drop the "Add team" row.
- student: static roll number + class label.

### Replace the mock overview widgets (delete `section-cards.tsx` mock + `chart-area-interactive.tsx`)

Each role's `.../page.tsx` overview is an RSC that fetches **scoped, real** counts and renders a `StatCards` row (keep the `Card`/grid layout of `section-cards`, feed it real props) plus one honest content block. Every widget has a defined empty state — no fabricated numbers, ever.

| Role | StatCards (real, scoped) | Content block | Empty state |
|---|---|---|---|
| super_admin | Departments (active), Faculty, Students, Pending onboarding (college-wide) | Departments table w/ per-dept HOD + class + student counts; alert strip for `unrouted` requests | Fresh install: "No departments yet — create the 5 branches" CTA → departments page |
| HOD | Classes in dept, Faculty in dept, Students in dept, Unrouted requests | Class grid (cards per class: TR name, roster size, pending approvals) | "No classes yet. Create your first class." CTA |
| TR | Class roster size, Pending approvals, Attendance sessions logged, Marks entries | Split: pending-approval preview list + "Upload attendance" CTA | Queue empty: "No pending requests — your class is fully claimed." |
| student | Attendance %, Classes attended, Subjects, Latest marks | Own attendance trend + subject marks list | Before any upload: "No attendance recorded yet — check back after your TR uploads." |

The fabricated area chart is removed. Where a trend is genuinely available (student attendance over time, once real attendance rows exist), reuse the existing `chart.tsx` primitive fed by real data; otherwise show the empty state, not a placeholder chart.

---

## (c) The key screens, concretely

### super_admin — Departments CRUD
`/dashboard/admin/departments`: `DataTableView` of the 5 branches (code, name, HOD, coordinator, class count, student count, active). Toolbar "Add Department" opens a `Dialog` (code select constrained to the 5 branch enums, name). Row action "Deactivate" → `AlertDialog` (soft-delete `isActive=false`, per house style).
`/dashboard/admin/departments/[code]`: dept detail with an **Appointments** card — "Appoint HOD" / "Appoint Coordinator" each open a faculty-search `Command` combobox (searches `faculty` by name/employeeId), writing `dept_appointments` (partial-unique enforces one active HOD). Shows current holders with a "Replace" action.

### super_admin — Faculty & role management
`/dashboard/admin/faculty`: `DataTableView` (name, employeeId, dept, role badge, active). "Add Faculty" `Dialog` (name, employeeId, email, dept, role select: faculty/hod/super_admin). Row edit sets `faculty.role`. This is where `super_admin`/`hod` get minted.

### super_admin — Roles & Permission toggles
`/dashboard/admin/roles`: the overlay UI from the RBAC design. A **matrix**: rows = `CAPABILITY_CATALOG` grouped by domain (dept, class, assignment, onboarding, attendance, marks, audit), columns = `hod | faculty | student` (super_admin column shown as a locked "all" — exempt from overrides). Each cell is a shadcn `Switch`: ON if the capability is in the resolved set. Flipping writes one `permission_overrides` row (`subject_type='role'`, `effect`), reflecting default-vs-override state with a subtle dot on cells that differ from `DEFAULT_CAPABILITIES`. A second `Tabs` panel "Per-user exceptions": a `Command` user search → that user's capability list with grant/deny toggles (`subject_type='user'`). New feature capabilities appear here automatically because the grid renders from the catalog.

### HOD — create classes + assign TRs
`/dashboard/dept/classes`: card grid of the dept's classes (label `TE-EXCS-A` computed via `expectedYear(admissionYear, now)`, TR name, roster size, pending count). "Create Class" `Dialog`: `admissionYear` (or a friendlier "current FE/SE/TE/BE" select that maps to admissionYear), branchCode locked to the HOD's dept, division select (A/B, plus C only for IT/CMPN — driven by `DIVISIONS_BY_BRANCH` from the roll parser). Unique constraint prevents duplicate `TE-EXCS-A`.
`/dashboard/dept/classes/[id]`: class detail — **Assign TR** card (faculty-search `Command` scoped to dept faculty → writes `faculty_class_assignments` role='tr', partial-unique = one active TR), optional "Assign Coordinator". Shows roster + any pending/unrouted requests now routed here.
`/dashboard/dept/requests`: `DataTableView` of `status='unrouted'` requests in the dept (student typed a roll whose class doesn't exist yet) — each row's CTA is "Create this class" prefilled, which then routes the request to the new class. This is the pressure loop that makes HODs create classes.

### TR — class dashboard (the isolation showcase)
`/dashboard/class/[id]/requests` — **the onboarding approval queue**: `DataTableView` of `enrollment_requests where classId = [id] and status='pending'` (query is scoped by the `[classId]` layout guard, so it structurally cannot return another class's rows). Row opens a `Sheet` **profile card**: roll number (mono `Badge`), verified email (mono, labelled "verified by VOSS"), first/last name, derived branch/division/year from `parseRollNumber`. Two buttons: **Approve** (creates the `students` row bound to `request.authUserId` + verified email, marks approved) and **Reject** (`AlertDialog` with reason). Optimistic removal from the list on action.
`/dashboard/class/[id]/students`: approved roster (reuse `students-columns` / `DataTableView`), scoped to the class.
`/dashboard/class/[id]/attendance`: reuses the **existing import UI pattern** (`students/import/{page,client}.tsx` + `xlsx-import.ts` preview → commit). A drop zone → `buildPreviewRows` editable preview (`data-table` with per-cell flags, cross-checked against the class's roll set) → "Commit" writes attendance for this class only. Below: a table of past sessions. `/marks` mirrors this.

### student — self view
`/dashboard/me`: profile card (roll, class label, verified email) + attendance % ring (`Progress`) + latest marks. `/dashboard/me/attendance`: subject-wise attendance table + trend chart (real `chart.tsx`, empty state if none). `/dashboard/me/marks`: subject marks table.

### Entry flow — `/unclaimed` becomes self-registration
Currently a passive "ask your TR" dead-end. Rework into a two-state screen for the unbound verified user:
1. **Form**: roll number (validated live with `isValidRollNumber`; on valid, show derived branch/division/year as read-only confirmation chips so the student sees they'll land in `TE-EXCS-A`), first name, last name. **Email is displayed locked** = `session.email` ("verified by VOSS — this is how your TR will recognize you"), never an input. Submit → `submitEnrollmentRequest`.
2. **Pending status** (after submit or on return): shows the routed class + "waiting for your TR to approve," or, if `status='unrouted'`, an honest "Your class (TE-EXCS-A) isn't set up yet — your HOD has been notified." Rejected → shows reason + "Edit and resubmit." All rendered inside the app shell (same as today), so it feels like being *in* VERP, pending.

---

## (d) How isolation shows up in the UI

Isolation is enforced at three layers of the frontend, each independently sufficient for surface-hiding, with the server layout as the authoritative one:

1. **Nav is scope-derived** — `navForUser(user)` emits only in-scope items. A TR's sidebar contains only her class's links (and a class switcher only if she has >1). There is literally no rendered path to `/dashboard/dept` or another class. The `ScopeSwitcher` header reinforces "you are in TE-EXCS-A."
2. **Segment layouts re-authorize on every navigation** — the role gate (`/dashboard/admin` etc.) and the param scope gate (`/dashboard/class/[classId]`, `/dashboard/dept` on `deptCodes`) run server-side before any child renders. A hand-typed out-of-scope URL is `redirect(homeFor(user))`-ed — you can't reach another class by editing the address bar.
3. **Scoped queries** — every overview/list page fetches through the RBAC agent's `queries/scoped/` functions that take `Scope` and inject the WHERE clause, so even if a nav link leaked, the data wouldn't. Breadcrumbs (`PageHeader`) are built from the scoped route, so context always reads truthfully (`Dept · EXCS · Classes · TE-EXCS-A`).

Client-side `can()` gating (sidebar, buttons) is explicitly **cosmetic**; the server layout guards + scoped queries + per-mutation `authorize()` are authoritative. This mirrors the codebase's existing discipline (the layout guard runs "above every dashboard route so no page has to remember to check").

---

## Files to add / change (routing + UI surface)

- **Add** `lib/nav.ts` (`homeFor`, `navForUser`).
- **Rewrite** `dashboard/page.tsx` → dispatcher; **delete** mock `section-cards.tsx` chart data + `chart-area-interactive.tsx` (or repoint to real data); remove `nav-documents.tsx`/`nav-projects.tsx` (starter leftovers).
- **Add** segment trees: `dashboard/admin/*`, `dashboard/dept/*`, `dashboard/class/[classId]/*`, `dashboard/me/*`, each with a guarding `layout.tsx`.
- **Rewrite** `app-sidebar.tsx` (scope-derived nav) + `team-switcher.tsx` → `ScopeSwitcher`.
- **Rework** `unclaimed/page.tsx` → self-registration form + pending status; add the `submitEnrollmentRequest` server action.
- **Extend** `use-user-role.ts` (return capabilities/scope, fix the default-`admin`-while-loading bug) and `api/me/route.ts`.
- **Reuse verbatim**: `DataTableView`, `PageHeader`/`SiteHeader`, `Card`/`Badge`/`Switch`/`Command`/`Sheet`/`Dialog`/`AlertDialog`, the `students/import` preview→commit pattern (`xlsx-import.ts`) for attendance/marks, and `parseRollNumber`/`expectedYear` for all class-label derivation.