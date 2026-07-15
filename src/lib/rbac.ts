// The RBAC engine: fixed default capabilities per tier, in code, overlaid by a
// super-admin-editable overrides table. A capability is `domain:action` — a typo
// is a compile error, and the toggle UI renders from CAPABILITY_CATALOG.
//
// Capability answers "is this action allowed for this tier at all". SCOPE ("on
// which dept/class/student") is orthogonal and enforced at the query layer from
// the caller's deptCodes/classIds/studentId — a capability is never a scope.

export type Tier = "super_admin" | "hod" | "faculty" | "student"

export type Capability =
  | "dept:read"
  | "dept:create"
  | "dept:update"
  | "dept:deactivate"
  | "hod:appoint"
  | "faculty:read"
  | "faculty:create"
  | "faculty:update"
  | "faculty:setRole"
  | "class:read"
  | "class:create"
  | "class:update"
  | "class:deactivate"
  | "assignment:read"
  | "assignment:create"
  | "assignment:remove"
  | "course:read"
  | "course:create"
  | "course:update"
  | "offering:read"
  | "offering:create"
  | "offering:update"
  | "student:read"
  | "student:update"
  | "student:deactivate"
  | "onboarding:read"
  | "onboarding:approve"
  | "onboarding:reject"
  | "attendance:read"
  | "attendance:write"
  | "marks:read"
  | "marks:write"
  | "marks:lock"
  | "permission:manage"
  | "audit:read"

type CatalogEntry = { capability: Capability; group: string; label: string }

// Drives the super-admin toggle matrix. Order here is display order.
export const CAPABILITY_CATALOG: CatalogEntry[] = [
  { capability: "dept:read", group: "Departments", label: "View departments" },
  {
    capability: "dept:create",
    group: "Departments",
    label: "Create department",
  },
  { capability: "dept:update", group: "Departments", label: "Edit department" },
  {
    capability: "dept:deactivate",
    group: "Departments",
    label: "Deactivate department",
  },
  {
    capability: "hod:appoint",
    group: "Departments",
    label: "Appoint HOD / coordinator",
  },
  { capability: "faculty:read", group: "Faculty", label: "View faculty" },
  { capability: "faculty:create", group: "Faculty", label: "Add faculty" },
  { capability: "faculty:update", group: "Faculty", label: "Edit faculty" },
  {
    capability: "faculty:setRole",
    group: "Faculty",
    label: "Change faculty tier",
  },
  { capability: "class:read", group: "Classes", label: "View classes" },
  { capability: "class:create", group: "Classes", label: "Create class" },
  { capability: "class:update", group: "Classes", label: "Edit class" },
  {
    capability: "class:deactivate",
    group: "Classes",
    label: "Deactivate class",
  },
  {
    capability: "assignment:read",
    group: "Classes",
    label: "View class staffing",
  },
  {
    capability: "assignment:create",
    group: "Classes",
    label: "Assign coordinator / TR",
  },
  {
    capability: "assignment:remove",
    group: "Classes",
    label: "Remove class staff",
  },
  { capability: "course:read", group: "Courses", label: "View courses" },
  { capability: "course:create", group: "Courses", label: "Create course" },
  { capability: "course:update", group: "Courses", label: "Edit course" },
  { capability: "offering:read", group: "Courses", label: "View offerings" },
  { capability: "offering:create", group: "Courses", label: "Create offering" },
  { capability: "offering:update", group: "Courses", label: "Edit offering" },
  { capability: "student:read", group: "Students", label: "View students" },
  { capability: "student:update", group: "Students", label: "Edit student" },
  {
    capability: "student:deactivate",
    group: "Students",
    label: "Deactivate student",
  },
  {
    capability: "onboarding:read",
    group: "Onboarding",
    label: "View enrolment queue",
  },
  {
    capability: "onboarding:approve",
    group: "Onboarding",
    label: "Approve enrolment",
  },
  {
    capability: "onboarding:reject",
    group: "Onboarding",
    label: "Reject enrolment",
  },
  {
    capability: "attendance:read",
    group: "Attendance",
    label: "View attendance",
  },
  {
    capability: "attendance:write",
    group: "Attendance",
    label: "Upload attendance",
  },
  { capability: "marks:read", group: "Marks", label: "View marks" },
  { capability: "marks:write", group: "Marks", label: "Enter marks" },
  { capability: "marks:lock", group: "Marks", label: "Lock marks" },
  {
    capability: "permission:manage",
    group: "System",
    label: "Manage permissions",
  },
  { capability: "audit:read", group: "System", label: "View audit log" },
]

// Fixed defaults per tier. super_admin is a wildcard handled in can() — never
// enumerated, never subject to overrides (no row can lock out the door-holder).
// The academic-coordinator's extra power (approve onboarding, write attendance)
// is a FACULTY capability; a faculty with no class assignment simply has empty
// scope and can act on nothing.
export const ROLE_DEFAULTS: Record<
  Exclude<Tier, "super_admin">,
  Capability[]
> = {
  hod: [
    "dept:read",
    "faculty:read",
    "faculty:create",
    "faculty:update",
    "class:read",
    "class:create",
    "class:update",
    "class:deactivate",
    "assignment:read",
    "assignment:create",
    "assignment:remove",
    "course:read",
    "course:create",
    "course:update",
    "offering:read",
    "offering:create",
    "offering:update",
    "student:read",
    "student:update",
    "student:deactivate",
    "onboarding:read",
    "attendance:read",
    "marks:read",
  ],
  faculty: [
    "class:read",
    "assignment:read",
    "course:read",
    "offering:read",
    "student:read",
    "onboarding:read",
    "onboarding:approve",
    "onboarding:reject",
    "attendance:read",
    "attendance:write",
    "marks:read",
    "marks:write",
    "marks:lock",
  ],
  student: ["attendance:read", "marks:read"],
}

export type Override = {
  capability: string
  effect: "grant" | "deny"
}

/**
 * Resolve the effective capability set: tier defaults, then role-level overrides,
 * then user-level overrides (user wins over role, deny wins by being applied
 * last within each level). super_admin is not computed here — can() short-circuits.
 */
export function effectiveCapabilities(
  tier: Exclude<Tier, "super_admin">,
  roleOverrides: Override[] = [],
  userOverrides: Override[] = []
): Set<Capability> {
  const caps = new Set<Capability>(ROLE_DEFAULTS[tier])
  const apply = (list: Override[]) => {
    for (const o of list) {
      const cap = o.capability as Capability
      if (o.effect === "grant") caps.add(cap)
      else caps.delete(cap)
    }
  }
  apply(roleOverrides)
  apply(userOverrides)
  return caps
}

/** A minimal shape can()/authorize() need — SessionUser satisfies it. */
export type Authz = { tier: Tier | null; capabilities: ReadonlySet<Capability> }

export function can(user: Authz | null, capability: Capability): boolean {
  if (!user || !user.tier) return false
  if (user.tier === "super_admin") return true
  return user.capabilities.has(capability)
}

/** Server-side guard: throw unless the caller holds the capability. */
export function authorize(user: Authz | null, capability: Capability): void {
  if (!can(user, capability)) {
    throw new Error(`Forbidden: missing capability ${capability}`)
  }
}
