# VERP UI/UX Overhaul Plan

Date: 2026-08-21
Branch: feat/uiux-overhaul
Basis: live audit of all 16 routes across all 10 dev personas (this session), research/verp-rbac-ux-audit-2026-08-13.md, research/_verp-erp-uiux.md, and a full frontend architecture map of the current code.

## Design direction

Swiss utilitarian precision. The app already leans this way (Geist + Geist Mono, 0.2rem radius, oklch neutrals, one blue accent, mono identifiers); the overhaul commits to it fully rather than inventing a new look.

- Typography carries hierarchy: distinct page-title, section, card-title, body, and caption steps. Tabular-nums mono for every number, roll, code, and key via the existing .identifier utility.
- Data-first density: tables are the primary reading surface. Wide screens hold more information, not more whitespace. Every table is copyable and exportable (CSV/XLSX) as a standing rule.
- One accent (--blue) for interactive elements only. Status uses the existing semantic tokens (--success, --attention, --warning, --destructive) plus an icon or label so color is never the only signal.
- Marks splits (ISA/MSE/ESE) rendered as proportional segmented bars everywhere weights appear: the one memorable visual signature of the product.
- Motion: fast (100-150ms), one staggered reveal per page load, nothing decorative.
- Dark and light both first-class (next-themes already wired).

## Phase 1 - Correctness and trust (P0 fixes)

All root causes confirmed in code. Independent file scopes, run in parallel.

1. Command palette crash: CommandDialog in src/components/ui/command.tsx renders children without the cmdk Command root, so the store context is undefined on open. Wrap children in Command inside DialogContent, move DialogHeader/Title/Description inside the portal, fix the check-icon selector (cmdk emits data-selected, not data-checked).
2. Dead roster links: data-table-view.tsx row handlers (rowHandlers, lines ~177-190) swallow anchor clicks and preventDefault keyboard activation. Guard with e.target.closest("a,button,input,[role=checkbox]") on both onClick and onKeyDown; row background still opens the drawer.
3. Teacher-allocation truth: subjects/client.tsx builds its dropdown solely from listClassStaff while marks reads offering.faculty; any allocated teacher without an active tr/coordinator assignment renders "Unallocated" and risks destructive writes. Source options from the union of class staff and allocated offering faculty; render offering.faculty for labels; recompute the class overview "Teachers" stat from the same union so one screen cannot contradict itself.
4. Translucent role-switcher popover and flaky menu hit areas in dev-actor-switcher.tsx / dropdown-menu.tsx: ensure the popup surface uses bg-popover opaquely and rows have full-row click targets.
5. Marks grid stale state: MarksGrid seeds useState(grid.rows) and never re-syncs after router.refresh(). Key the grid by offering id and add dirty tracking: Save disabled until dirty, beforeunload warning while dirty.
6. Attendance polish: replace hardcoded green-600/amber-600 with semantic tokens; Save button microcopy (disabled until dirty, count as detail not label).

Ship gate: npm run check green; manual browser pass on the three fixed flows.

## Phase 2 - Design system consolidation

1. PageHeader standard: title/description/actions slots; sentence case everywhere (breadcrumbs, nav, filters); typographic scale applied to all page and section titles.
2. Button doctrine: primary, secondary/outline, quiet, destructive. Every irreversible action (Deactivate, Remove, Graduate, Reject) becomes destructive style + AlertDialog confirmation, matching the existing Approve/Reject pattern on the coordinator queue.
3. Filter standard: labeled selects only ("All departments"), scope-fixed filters hidden for scoped roles (HOD sees no department filter, coordinator sees none of the three).
4. Attention feed system: group repeated issues by type with department/class chips; severity chip (icon + label) using semantic tokens; one AttentionCard component consumed by all role dashboards.
5. EmptyState component with explanation + next-action CTA; applied to audit, batches, results, imports, unclaimed.
6. StatCard/KPI primitive with consistent numeric typography; MarksSplitBar component (proportional ISA/MSE/ESE segments) used in catalogue, subjects, marks, my-marks.
7. Kill the stray saturated-blue audit chip; single accent discipline.

## Phase 3 - Workflow surfaces

1. Role-aware overviews: grouped attention feed; per-role stat rows; My classes grouped by year with coordinator, roster size, and attention dot per card; scope always visible in the sidebar (you-are-here context: dept name for HOD, class key for TR, roll for student).
2. Student profile (click any student): identity + status card, class link, attendance summary, semester marks with published/provisional state, record history, scoped actions. Deep-linked from roster, class pages, and search.
3. Roster tables: position pagination ("1-50 of 1,736"), page size, sticky header, working bulk actions (or checkbox removal where no actions exist), one-click copy and CSV/XLSX export on every table.
4. Marks entry as a spreadsheet: arrow/Enter/Tab cell traversal, paste-from-Excel, range validation feedback, sticky header and first column, per-component distribution summary (count entered, mean, min/max) and the split bar; publish state visible in-grid.
5. Student marks page redesign (my-marks): dense single table per semester with every component column visible (ISA, MSE1, MSE2, ESE, total, %, grade), provisional vs published labeled, copy/download, attendance-per-subject table beside it. No progressive-disclosure cards; the table is the interface.
6. Imports center: one /dashboard/imports surface listing all four import types with upload, preview, commit, and history (new import_batches table recording who/when/type/row counts/outcome, linked from audit); template downloads; "last import" stamp on roster pages. Per-role visibility follows existing capabilities.
7. Access-denied clarity: scope redirects carry a toast ("You do not have access to that class"); dual-role chips (Teacher + Coordinator of X) in header and switcher.

## Phase 4 - Polish and accessibility

1. aria-labels on all icon buttons; contrast pass to 4.5:1 for secondary text; focus-visible states.
2. Roles matrix: on/off visual clarity, sticky headers/first column, capability search, legend for the tier counts, confirmation on revoking defaults.
3. /unclaimed: cancel-or-correct a wrong roll claim, coordinator name shown, sidebar search removed or fixed.
4. Wide-screen composition: admin console and student profile use the width or center a max-width column deliberately.
5. Page-load stagger reveals; final visual QA across all 10 personas in both themes.

## Phase 5 - Role dashboards and navigation (added 2026-08-21 after Boss review)

Dashboards: work console, not analytics wall. Grafana panel grammar (titled panels, own open link) with ERP content: stat tiles + operational tables + work queues first; charts only for genuine trends (14-day attendance, registers-today per dept), single-hue blue sequential, status tokens with icon+label, tooltips, no pies, no dual axes, no legends on single series.
- Super-admin: KPI row (departments, classes, faculty, students, never-signed-in, pending enrolments) - department health table - registers-today bars - marks-completion progress - attention feed - recent activity - recent imports.
- HOD: dept-scoped KPI row - classes table (coordinator, roster, register-today, marks percent, requests) - 14-day attendance trend - per-year allocation with split bars - attention feed.
- Teacher/Coordinator: register-today status, marks-entered percent - Today queue (attendance CTA, enter-marks links) - my-subjects completion table - 7-day mini bar - pending enrolments for coordinators.
- Student: attendance vs 75 threshold bars - SGPI/CGPA/credits tiles - marks snapshot table - awaiting-publication panel.
Shared: DashPanel primitive, aggregate queries in overview.ts (registers-today, marks-completion, attendance-trend, recent audit/imports), dashboard split into per-role server component files.

Navigation: flat always-visible list per role (no collapsible groups, no Overview>Overview), tiny muted section labels, role-altitude ordering with inherited access in a labeled trailing section after a divider.
- Super-admin: Overview, Students, Faculty, Departments, Roles & permissions, Activity log, Import center; trailing "Department access": Classes, Course catalogue, Department console.
- HOD: Overview, Classes, Appoint faculty, Course catalogue, Students, Faculty, Import center; trailing "Teaching": My classes (only when hasClasses).
- Teacher/Coordinator: Overview, My class (direct link when exactly one). Student: Overview, My marks.
- buildNavigation stays the single source for sidebar and palette.
Appointment ease: admin Departments rows gain an HOD column with an appoint/change picker (faculty search, confirm, audit); HOD coordinator gaps surface on the dashboard queue deep-linking to the dept classes table.

## Phase 6 - Feedback round (added 2026-08-21 after Boss review of Phase 5)

1. Replace the right-side sheet pattern app-wide: roster record inspection becomes a centered dialog; my-marks subject breakdown becomes an inline expanding row inside the table.
2. Student dashboard leads with the subjects-by-marks table (ISA, MSE counted, ESE, total, grade/awaiting; row expands to MSE 1 / MSE 2); attendance demoted to secondary panel + KPI.
3. Admin IA: remove Console; new Appointments page + nav item carrying HOD and coordinator appointment per department (moved out of the Faculty page bottom); admin Faculty page gets add-in-dialog and a real table.
4. Departments page renders big per-department stat cards (students, faculty, classes, HOD, coordinator, actions).
5. Classes page: "All classes" title for admin, department filter chips alongside year grouping.
6. HOD dept Classes page converted to the dashboard table idiom with quiet per-row action menu.
7. Self-scoped "My activity" log page + nav for HOD/Coordinator/Teacher; super-admin keeps the full log.
8. TrendLine becomes an area chart: gradient fill, dots, fixed 0-100 domain for percents, denser ticks.
9. Coordinator and Teacher dashboards diverge: coordination panels (enrolment queue, allocation status, publish state) for coordinators, teaching panels only when offerings exist; pure teachers see teaching only.

## Execution

Wave A (Phase 1): one workflow, six parallel Opus fix agents + verify agent running npm run check.
Wave B (Phase 2): primitives first, then parallel page sweeps.
Wave C (Phase 3): parallel by route group (overview, class, students, my-marks, imports); imports agent owns the new schema + queries.
Wave D (Phase 4): sweep + browser QA across personas.

Constraints for every agent: Base UI render prop (not Radix asChild); zero comments; semantic tokens only; server actions keep authorize + scope checks; nav only via buildNavigation; force-dynamic on dashboard pages; flat DTOs across the server/client boundary; Asia/Kolkata dates; npm run check must stay green.
