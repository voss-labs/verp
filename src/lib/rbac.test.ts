import { describe, expect, it } from "vitest"
import {
  ROLE_DEFAULTS,
  can,
  authorize,
  effectiveCapabilities,
  type Authz,
  type Capability,
} from "./rbac"

const as = (tier: Authz["tier"], caps: Capability[] = []): Authz => ({
  tier,
  capabilities: new Set(caps),
})

describe("effectiveCapabilities", () => {
  it("starts from the tier's defaults", () => {
    const caps = effectiveCapabilities("student")
    expect(caps.has("marks:read")).toBe(true)
    expect(caps.has("marks:write")).toBe(false)
  })

  it("lets a role override grant and deny", () => {
    const caps = effectiveCapabilities("student", [
      { capability: "marks:write", effect: "grant" },
      { capability: "marks:read", effect: "deny" },
    ])
    expect(caps.has("marks:write")).toBe(true)
    expect(caps.has("marks:read")).toBe(false)
  })

  it("lets a user override beat the role override", () => {
    const caps = effectiveCapabilities(
      "student",
      [{ capability: "marks:write", effect: "grant" }],
      [{ capability: "marks:write", effect: "deny" }]
    )
    expect(caps.has("marks:write")).toBe(false)
  })

  it("applies deny last within a level, so deny wins a tie", () => {
    const caps = effectiveCapabilities("faculty", [
      { capability: "marks:write", effect: "grant" },
      { capability: "marks:write", effect: "deny" },
    ])
    expect(caps.has("marks:write")).toBe(false)
  })

  it("does not mutate the shared defaults", () => {
    const before = [...ROLE_DEFAULTS.student]
    effectiveCapabilities("student", [
      { capability: "permission:manage", effect: "grant" },
    ])
    expect(ROLE_DEFAULTS.student).toEqual(before)
  })
})

describe("can", () => {
  // super_admin is a wildcard by design: no override row may lock out the
  // person who holds the door open.
  it("allows super_admin everything, even with an empty capability set", () => {
    expect(can(as("super_admin"), "permission:manage")).toBe(true)
    expect(can(as("super_admin"), "marks:lock")).toBe(true)
  })

  it("refuses a roleless account outright", () => {
    expect(can(as(null), "marks:read")).toBe(false)
    expect(can(null, "marks:read")).toBe(false)
  })

  it("answers from the resolved set for every other tier", () => {
    expect(can(as("faculty", ["marks:write"]), "marks:write")).toBe(true)
    expect(can(as("faculty", ["marks:write"]), "permission:manage")).toBe(false)
  })
})

describe("authorize", () => {
  it("throws naming the missing capability", () => {
    expect(() => authorize(as("student"), "marks:write")).toThrow(/marks:write/)
  })

  it("passes silently when the capability is held", () => {
    expect(() =>
      authorize(as("faculty", ["marks:write"]), "marks:write")
    ).not.toThrow()
  })
})

describe("tier defaults", () => {
  it("keeps a student read-only over their own record", () => {
    expect(ROLE_DEFAULTS.student).toEqual(["attendance:read", "marks:read"])
  })

  it("gives faculty marks entry and locking but not permission management", () => {
    expect(ROLE_DEFAULTS.faculty).toContain("marks:write")
    expect(ROLE_DEFAULTS.faculty).toContain("marks:lock")
    expect(ROLE_DEFAULTS.faculty).not.toContain("permission:manage")
  })

  // Allocating a subject is a faculty capability so a class coordinator can do
  // it; scope (canAllocate in allocation.ts) is what keeps a plain TR out, not
  // the capability. Without these a coordinator saw the controls and every
  // attempt threw Forbidden.
  it("lets faculty create and update offerings", () => {
    expect(ROLE_DEFAULTS.faculty).toContain("offering:create")
    expect(ROLE_DEFAULTS.faculty).toContain("offering:update")
  })

  // An HOD runs the department rather than teaching it, but holds cover
  // authority: when a teacher is absent mid-term somebody senior must be able
  // to finish the work. Scope still bounds it to their own department, which is
  // enforced separately in allocation.ts.
  it("gives an HOD cover authority over attendance and marks", () => {
    expect(ROLE_DEFAULTS.hod).toContain("marks:read")
    expect(ROLE_DEFAULTS.hod).toContain("marks:write")
    expect(ROLE_DEFAULTS.hod).toContain("marks:lock")
    expect(ROLE_DEFAULTS.hod).toContain("attendance:write")
  })

  // Cover is not administration: an HOD still cannot rewrite the permission
  // model or read the institution-wide audit trail.
  it("does not give an HOD institution-level authority", () => {
    expect(ROLE_DEFAULTS.hod).not.toContain("permission:manage")
    expect(ROLE_DEFAULTS.hod).not.toContain("audit:read")
  })
})
