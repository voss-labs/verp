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
  buildNavigation(ctx).flatMap((s) => s.items.map((i) => i.url))

const primary = (ctx: NavContext) => buildNavigation(ctx)[0]

const sectionNamed = (ctx: NavContext, label: string) =>
  buildNavigation(ctx).find((s) => s.label === label)

describe("buildNavigation", () => {
  it("returns flat sections, never a nested group", () => {
    for (const ctx of [
      ctxFor("super_admin"),
      ctxFor("hod", ROLE_DEFAULTS.hod, { hasClasses: true }),
      ctxFor("faculty", ROLE_DEFAULTS.faculty, {
        hasClasses: true,
        classIds: ["c1", "c2"],
      }),
      ctxFor("student", ROLE_DEFAULTS.student),
    ]) {
      for (const section of buildNavigation(ctx)) {
        for (const item of section.items) {
          expect(Object.keys(item).sort()).toEqual(["icon", "title", "url"])
        }
      }
    }
  })

  it("opens every role with a flat, unlabelled Overview row", () => {
    for (const ctx of [
      ctxFor("super_admin"),
      ctxFor("hod", ROLE_DEFAULTS.hod),
      ctxFor("faculty", ROLE_DEFAULTS.faculty),
      ctxFor("student", ROLE_DEFAULTS.student),
      ctxFor(null),
    ]) {
      const first = primary(ctx)
      expect(first.label).toBeUndefined()
      expect(first.trailing).toBeUndefined()
      expect(first.items[0]).toMatchObject({
        title: "Overview",
        url: "/dashboard",
      })
    }
  })

  it("puts every labelled section after the primary one, behind a separator", () => {
    const sections = buildNavigation(ctxFor("super_admin"))
    const firstTrailing = sections.findIndex((s) => s.trailing)
    expect(firstTrailing).toBeGreaterThan(0)
    expect(sections.slice(firstTrailing).every((s) => s.trailing)).toBe(true)
    expect(sections.filter((s) => s.trailing).every((s) => !!s.label)).toBe(
      true
    )
  })

  it("gives a student only their own record", () => {
    expect(urls(ctxFor("student", ROLE_DEFAULTS.student))).toEqual([
      "/dashboard",
      "/dashboard/my-marks",
    ])
  })

  it("never offers a student a staff surface", () => {
    const u = urls(ctxFor("student", ROLE_DEFAULTS.student))
    expect(u.some((x) => x.includes("/students"))).toBe(false)
    expect(u.some((x) => x.includes("/dept"))).toBe(false)
    expect(u.some((x) => x.includes("/admin"))).toBe(false)
  })

  it("orders super_admin from institution down to the console", () => {
    expect(primary(ctxFor("super_admin")).items.map((i) => i.url)).toEqual([
      "/dashboard",
      "/dashboard/students",
      "/dashboard/faculty",
      "/dashboard/admin/departments",
      "/dashboard/admin/roles",
      "/dashboard/audit",
      "/dashboard/imports",
      "/dashboard/admin",
    ])
  })

  it("hands super_admin department work in a trailing section", () => {
    const section = sectionNamed(ctxFor("super_admin"), "Department access")
    expect(section?.trailing).toBe(true)
    expect(section?.items.map((i) => i.url)).toEqual([
      "/dashboard/class",
      "/dashboard/dept/courses",
      "/dashboard/dept",
    ])
  })

  it("orders an HOD from their department down to imports", () => {
    expect(
      primary(ctxFor("hod", ROLE_DEFAULTS.hod)).items.map((i) => i.url)
    ).toEqual([
      "/dashboard",
      "/dashboard/dept",
      "/dashboard/dept/appoint",
      "/dashboard/dept/courses",
      "/dashboard/students",
      "/dashboard/faculty",
      "/dashboard/imports",
    ])
  })

  it("points an HOD's Classes at the department table, not the teaching list", () => {
    const classes = primary(ctxFor("hod", ROLE_DEFAULTS.hod)).items.find(
      (i) => i.title === "Classes"
    )
    expect(classes?.url).toBe("/dashboard/dept")
  })

  it("gives an HOD no admin console and no audit log", () => {
    const u = urls(ctxFor("hod", ROLE_DEFAULTS.hod))
    expect(u).not.toContain("/dashboard/admin")
    expect(u).not.toContain("/dashboard/admin/roles")
    expect(u).not.toContain("/dashboard/audit")
  })

  it("shows an HOD the Teaching section only when they hold classes", () => {
    expect(
      sectionNamed(ctxFor("hod", ROLE_DEFAULTS.hod), "Teaching")
    ).toBeUndefined()
    const section = sectionNamed(
      ctxFor("hod", ROLE_DEFAULTS.hod, { hasClasses: true }),
      "Teaching"
    )
    expect(section?.trailing).toBe(true)
    expect(section?.items.map((i) => i.url)).toEqual(["/dashboard/class"])
  })

  it("hides Appoint faculty unless both halves of the job are held", () => {
    expect(urls(ctxFor("hod", ["assignment:create"]))).not.toContain(
      "/dashboard/dept/appoint"
    )
    expect(
      urls(ctxFor("hod", ["assignment:create", "offering:create"]))
    ).toContain("/dashboard/dept/appoint")
  })

  it("sends a faculty with one class straight to that class", () => {
    const items = primary(
      ctxFor("faculty", ROLE_DEFAULTS.faculty, {
        hasClasses: true,
        classIds: ["cls-1"],
      })
    ).items
    expect(items[1]).toMatchObject({
      title: "My class",
      url: "/dashboard/class/cls-1",
    })
  })

  it("sends a faculty with several classes to the list", () => {
    const items = primary(
      ctxFor("faculty", ROLE_DEFAULTS.faculty, {
        hasClasses: true,
        classIds: ["cls-1", "cls-2"],
      })
    ).items
    expect(items[1]).toMatchObject({
      title: "My classes",
      url: "/dashboard/class",
    })
  })

  it("offers a faculty with no class no class row at all", () => {
    expect(urls(ctxFor("faculty", ROLE_DEFAULTS.faculty))).not.toContain(
      "/dashboard/class"
    )
  })

  it("keeps the import gate a faculty already passes on marks:write", () => {
    expect(urls(ctxFor("faculty", ROLE_DEFAULTS.faculty))).toContain(
      "/dashboard/imports"
    )
    expect(urls(ctxFor("faculty", ["class:read"]))).not.toContain(
      "/dashboard/imports"
    )
  })

  it("never offers a faculty a department or admin surface", () => {
    const u = urls(
      ctxFor("faculty", ROLE_DEFAULTS.faculty, {
        hasClasses: true,
        classIds: ["cls-1"],
      })
    )
    expect(u.some((x) => x.startsWith("/dashboard/dept"))).toBe(false)
    expect(u.some((x) => x.startsWith("/dashboard/admin"))).toBe(false)
    expect(u).not.toContain("/dashboard/audit")
  })

  it("drops an item when the capability its page checks is revoked", () => {
    const revoked = ROLE_DEFAULTS.hod.filter((c) => c !== "student:read")
    expect(urls(ctxFor("hod", revoked))).not.toContain("/dashboard/students")
    expect(urls(ctxFor("hod", ROLE_DEFAULTS.hod))).toContain(
      "/dashboard/students"
    )
  })

  it("gives an unplaced account nothing but the Overview", () => {
    expect(urls(ctxFor(null))).toEqual(["/dashboard"])
  })
})

describe("contextualRole", () => {
  it("distinguishes a coordinator from a teacher", () => {
    expect(contextualRole(ctxFor("faculty", [], { isCoordinator: true }))).toBe(
      "Coordinator"
    )
    expect(contextualRole(ctxFor("faculty"))).toBe("Teacher")
  })

  it("names both when someone coordinates one class and teaches another", () => {
    expect(
      contextualRole(
        ctxFor("faculty", [], { isCoordinator: true, isTeacher: true })
      )
    ).toBe("Teacher · Coordinator")
  })

  it("names the other tiers plainly", () => {
    expect(contextualRole(ctxFor("super_admin"))).toBe("Super-admin")
    expect(contextualRole(ctxFor("hod"))).toBe("HOD")
    expect(contextualRole(ctxFor("student"))).toBe("Student")
    expect(contextualRole(ctxFor(null))).toBe("Pending")
  })
})
