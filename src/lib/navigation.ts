import type { Capability } from "@/lib/rbac"

export type NavIcon =
  | "overview"
  | "students"
  | "faculty"
  | "departments"
  | "roles"
  | "audit"
  | "imports"
  | "classes"
  | "courses"
  | "dept"
  | "appoint"
  | "marks"

export type NavItem = { title: string; url: string; icon: NavIcon }
export type NavSection = {
  label?: string
  trailing?: boolean
  items: NavItem[]
}
export type NavAction = { title: string; url: string; hint: string }

export type NavContext = {
  tier: "super_admin" | "hod" | "faculty" | "student" | null
  can: (c: Capability) => boolean
  isCoordinator: boolean
  hasClasses: boolean
  isTeacher?: boolean
  classIds?: string[]
}

const OVERVIEW: NavItem = {
  title: "Overview",
  url: "/dashboard",
  icon: "overview",
}

const MY_ACTIVITY: NavItem = {
  title: "My activity",
  url: "/dashboard/activity",
  icon: "audit",
}

const canImport = (can: NavContext["can"]) =>
  can("student:update") ||
  can("faculty:create") ||
  can("course:create") ||
  can("marks:write")

function superAdminSections(can: NavContext["can"]): NavSection[] {
  const primary: NavItem[] = [OVERVIEW]
  if (can("student:read")) {
    primary.push({
      title: "Students",
      url: "/dashboard/students",
      icon: "students",
    })
  }
  if (can("faculty:read")) {
    primary.push({
      title: "Faculty",
      url: "/dashboard/faculty",
      icon: "faculty",
    })
  }
  primary.push({
    title: "Departments",
    url: "/dashboard/admin/departments",
    icon: "departments",
  })
  primary.push({
    title: "Appointments",
    url: "/dashboard/admin/appointments",
    icon: "appoint",
  })
  if (can("permission:manage")) {
    primary.push({
      title: "Roles & permissions",
      url: "/dashboard/admin/roles",
      icon: "roles",
    })
  }
  if (can("audit:read")) {
    primary.push({
      title: "Activity log",
      url: "/dashboard/audit",
      icon: "audit",
    })
  }
  if (canImport(can)) {
    primary.push({
      title: "Import center",
      url: "/dashboard/imports",
      icon: "imports",
    })
  }
  const department: NavItem[] = [
    { title: "Classes", url: "/dashboard/class", icon: "classes" },
  ]
  if (can("course:read")) {
    department.push({
      title: "Course catalogue",
      url: "/dashboard/dept/courses",
      icon: "courses",
    })
  }
  department.push({
    title: "Department console",
    url: "/dashboard/dept",
    icon: "dept",
  })

  return [
    { items: primary },
    { label: "Department access", trailing: true, items: department },
  ]
}

function hodSections(ctx: NavContext): NavSection[] {
  const { can } = ctx
  const primary: NavItem[] = [
    OVERVIEW,
    { title: "Classes", url: "/dashboard/dept", icon: "classes" },
  ]
  if (can("assignment:create") && can("offering:create")) {
    primary.push({
      title: "Appoint faculty",
      url: "/dashboard/dept/appoint",
      icon: "appoint",
    })
  }
  if (can("course:read")) {
    primary.push({
      title: "Course catalogue",
      url: "/dashboard/dept/courses",
      icon: "courses",
    })
  }
  if (can("student:read")) {
    primary.push({
      title: "Students",
      url: "/dashboard/students",
      icon: "students",
    })
  }
  if (can("faculty:read")) {
    primary.push({
      title: "Faculty",
      url: "/dashboard/faculty",
      icon: "faculty",
    })
  }
  if (canImport(can)) {
    primary.push({
      title: "Import center",
      url: "/dashboard/imports",
      icon: "imports",
    })
  }
  primary.push(MY_ACTIVITY)

  const sections: NavSection[] = [{ items: primary }]
  if (ctx.hasClasses) {
    sections.push({
      label: "Teaching",
      trailing: true,
      items: [
        { title: "My classes", url: "/dashboard/class", icon: "classes" },
      ],
    })
  }
  return sections
}

function facultySections(ctx: NavContext): NavSection[] {
  const { can } = ctx
  const classIds = ctx.classIds ?? []
  const primary: NavItem[] = [OVERVIEW]

  if (classIds.length === 1) {
    primary.push({
      title: "My class",
      url: `/dashboard/class/${classIds[0]}`,
      icon: "classes",
    })
  } else if (ctx.hasClasses || classIds.length > 1) {
    primary.push({
      title: "My classes",
      url: "/dashboard/class",
      icon: "classes",
    })
  }
  if (canImport(can)) {
    primary.push({
      title: "Import center",
      url: "/dashboard/imports",
      icon: "imports",
    })
  }
  primary.push(MY_ACTIVITY)
  return [{ items: primary }]
}

export function buildNavigation(ctx: NavContext): NavSection[] {
  switch (ctx.tier) {
    case "student":
      return [
        {
          items: [
            OVERVIEW,
            { title: "My marks", url: "/dashboard/my-marks", icon: "marks" },
          ],
        },
      ]
    case "super_admin":
      return superAdminSections(ctx.can)
    case "hod":
      return hodSections(ctx)
    case "faculty":
      return facultySections(ctx)
    default:
      return [{ items: [OVERVIEW] }]
  }
}

/** Quick actions from the same context as buildNavigation, gated by the same capabilities the pages check. */
export function buildActions(ctx: NavContext): NavAction[] {
  const { can } = ctx
  const actions: NavAction[] = []
  const classId = ctx.classIds?.[0]

  if (classId && can("attendance:write")) {
    actions.push({
      title: "Take attendance",
      url: `/dashboard/class/${classId}/attendance`,
      hint: "Today's register",
    })
  }
  if (classId && can("marks:write")) {
    actions.push({
      title: "Enter marks",
      url: `/dashboard/class/${classId}/marks`,
      hint: "Marks grid",
    })
  }
  if (can("student:update")) {
    actions.push({
      title: "Import roster",
      url: "/dashboard/students/import",
      hint: "Spreadsheet",
    })
  }
  return actions
}

/** The responsibility this person holds, not the tier row they sit in. */
export function contextualRole(ctx: NavContext): string {
  switch (ctx.tier) {
    case "super_admin":
      return "Super-admin"
    case "hod":
      return "HOD"
    case "student":
      return "Student"
    case "faculty":
      if (!ctx.isCoordinator) return "Teacher"
      return ctx.isTeacher ? "Teacher · Coordinator" : "Coordinator"
    default:
      return "Pending"
  }
}
