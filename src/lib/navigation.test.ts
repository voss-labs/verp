import { describe, expect, it } from "vitest"
import { buildNavigation, contextualRole, type NavContext } from "./navigation"
import { ROLE_DEFAULTS, type Capability } from "./rbac"

const ctxFor = (
  tier: NavContext["tier"],
  caps: Capability[] = [],
  extra: Partial<NavContext> = {}
): NavContext => ({
  tier,
  can: (c) => tier === "super_admin" || caps.includes(c),
  isCoordinator: false,
  hasClasses: false,
  ...extra,
})

const urls = (ctx: NavContext) =>
  buildNavigation(ctx).flatMap((d) => d.items.map((i) => i.url))

describe("buildNavigation", () => {
  it("gives a student only their own record", () => {
    expect(urls(ctxFor("student", ROLE_DEFAULTS.student))).toEqual([
      "/dashboard",
      "/dashboard/my-marks",
    ])
  })

  // The bug this replaces: a student could not be shown staff domains, but the
  // hardcoded arrays made that a matter of remembering rather than of rules.
  it("never offers a student a staff surface", () => {
    const u = urls(ctxFor("student", ROLE_DEFAULTS.student))
    expect(u.some((x) => x.includes("/students"))).toBe(false)
    expect(u.some((x) => x.includes("/dept"))).toBe(false)
    expect(u.some((x) => x.includes("/admin"))).toBe(false)
  })

  it("gives super_admin the administration domain", () => {
    const u = urls(ctxFor("super_admin"))
    expect(u).toContain("/dashboard/admin")
    expect(u).toContain("/dashboard/admin/roles")
    expect(u).toContain("/dashboard/audit")
  })

  it("gives an HOD their department without the admin console", () => {
    const u = urls(ctxFor("hod", ROLE_DEFAULTS.hod))
    expect(u).toContain("/dashboard/dept")
    expect(u).toContain("/dashboard/dept/courses")
    expect(u).not.toContain("/dashboard/admin")
    expect(u).not.toContain("/dashboard/audit")
  })

  it("hides Appoint faculty unless both halves of the job are held", () => {
    // assignment:create alone would show a page whose actions are refused.
    expect(urls(ctxFor("hod", ["assignment:create"]))).not.toContain(
      "/dashboard/dept/appoint"
    )
    expect(
      urls(ctxFor("hod", ["assignment:create", "offering:create"]))
    ).toContain("/dashboard/dept/appoint")
  })

  it("shows a teacher their classes without department administration", () => {
    const u = urls(
      ctxFor("faculty", ROLE_DEFAULTS.faculty, { hasClasses: true })
    )
    expect(u).toContain("/dashboard/class")
    expect(u).not.toContain("/dashboard/dept")
  })

  it("follows an override, so a granted capability reaches the menu", () => {
    expect(urls(ctxFor("faculty", ["audit:read"]))).toContain(
      "/dashboard/audit"
    )
  })

  it("omits a domain entirely when it would be empty", () => {
    const domains = buildNavigation(ctxFor("faculty", []))
    expect(domains.map((d) => d.domain)).toEqual(["Overview"])
  })
})

describe("contextualRole", () => {
  // Coordinator and teacher are the same tier; the responsibility differs.
  it("distinguishes a coordinator from a teacher", () => {
    expect(contextualRole(ctxFor("faculty", [], { isCoordinator: true }))).toBe(
      "Coordinator"
    )
    expect(contextualRole(ctxFor("faculty"))).toBe("Teacher")
  })

  it("names the other tiers plainly", () => {
    expect(contextualRole(ctxFor("super_admin"))).toBe("Super-admin")
    expect(contextualRole(ctxFor("hod"))).toBe("HOD")
    expect(contextualRole(ctxFor("student"))).toBe("Student")
    expect(contextualRole(ctxFor(null))).toBe("Pending")
  })
})
