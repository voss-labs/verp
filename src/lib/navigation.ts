// Navigation derived from capabilities and scope, not from a role array.
//
// The sidebar previously held four hardcoded lists, one per tier. Every new
// page meant editing each of them, they drifted (a coordinator and a plain TR
// are both `faculty` and saw an identical menu despite different
// responsibilities), and a capability granted through an override changed what
// the server allowed without changing what the product offered.
//
// Domains come from the spec's stable information architecture: the same entity
// appears in the same place for everyone, and only the scope differs.

import type { Capability } from "@/lib/rbac"

export type NavLink = { title: string; url: string }
export type NavDomain = { domain: string; url: string; items: NavLink[] }

export type NavContext = {
  tier: "super_admin" | "hod" | "faculty" | "student" | null
  can: (c: Capability) => boolean
  /** Someone coordinates at least one class — a responsibility, not a tier. */
  isCoordinator: boolean
  hasClasses: boolean
}

export function buildNavigation(ctx: NavContext): NavDomain[] {
  const { can, tier } = ctx
  const domains: NavDomain[] = []

  domains.push({
    domain: "Overview",
    url: "/dashboard",
    items: [{ title: "Overview", url: "/dashboard" }],
  })

  // A student's whole product is their own record.
  if (tier === "student") {
    domains.push({
      domain: "My academics",
      url: "/dashboard/my-marks",
      items: [{ title: "Marks & SGPI", url: "/dashboard/my-marks" }],
    })
    return domains
  }

  const academics: NavLink[] = []
  if (ctx.hasClasses || tier === "super_admin" || tier === "hod") {
    academics.push({ title: "Classes", url: "/dashboard/class" })
  }
  // The catalogue sits inside the department workspace, whose layout admits
  // only an HOD or an admin. Offering it on course:read alone — which every
  // teacher has — produced a link that bounced them to the Overview. A teacher
  // still picks from the catalogue, on their class's Subjects page, which is
  // where that choice belongs.
  if (can("course:read") && (tier === "hod" || tier === "super_admin")) {
    academics.push({
      title: "Course catalogue",
      url: "/dashboard/dept/courses",
    })
  }
  if (academics.length) {
    domains.push({
      domain: "Academics",
      url: academics[0].url,
      items: academics,
    })
  }

  const org: NavLink[] = []
  if (can("dept:read"))
    org.push({ title: "Departments", url: "/dashboard/dept" })
  // Appointing is assignment work; offering it without both halves would lead
  // to a page whose actions are refused.
  if (can("assignment:create") && can("offering:create")) {
    org.push({ title: "Appoint faculty", url: "/dashboard/dept/appoint" })
  }
  if (org.length) {
    domains.push({ domain: "Organization", url: org[0].url, items: org })
  }

  const people: NavLink[] = []
  if (can("student:read")) {
    people.push({ title: "Student roster", url: "/dashboard/students" })
  }
  if (can("faculty:read")) {
    people.push({ title: "Faculty", url: "/dashboard/faculty" })
  }
  if (people.length) {
    domains.push({ domain: "People", url: people[0].url, items: people })
  }

  const imports: NavLink[] = []
  if (can("student:update")) {
    imports.push({ title: "Import roster", url: "/dashboard/students/import" })
  }
  if (can("faculty:create")) {
    imports.push({
      title: "Import faculty",
      url: "/dashboard/dept/faculty-import",
    })
  }
  if (imports.length) {
    domains.push({ domain: "Import", url: imports[0].url, items: imports })
  }

  const admin: NavLink[] = []
  if (tier === "super_admin") {
    admin.push({ title: "Console", url: "/dashboard/admin" })
    admin.push({ title: "Departments", url: "/dashboard/admin/departments" })
    admin.push({ title: "Faculty", url: "/dashboard/admin/faculty" })
  }
  if (can("permission:manage")) {
    admin.push({ title: "Roles & permissions", url: "/dashboard/admin/roles" })
  }
  if (can("audit:read")) {
    admin.push({ title: "Activity log", url: "/dashboard/audit" })
  }
  if (admin.length) {
    domains.push({ domain: "Administration", url: admin[0].url, items: admin })
  }

  return domains
}

/**
 * What this person is in the class or department they are looking at, rather
 * than which row their tier sits in. A faculty member can coordinate one class
 * and merely teach another, and the header should say which.
 */
export function contextualRole(ctx: NavContext): string {
  switch (ctx.tier) {
    case "super_admin":
      return "Super-admin"
    case "hod":
      return "HOD"
    case "student":
      return "Student"
    case "faculty":
      return ctx.isCoordinator ? "Coordinator" : "Teacher"
    default:
      return "Pending"
  }
}
