import { describe, expect, it } from "vitest"
import { facultyRoleEnum } from "@/db/schema/enums"
import { CAPABILITY_CATALOG, ROLE_DEFAULTS } from "@/lib/rbac"
import { isCapability, isFacultyRole, isManageableTier } from "./validate"

describe("isFacultyRole", () => {
  it("accepts every enum value, super_admin included", () => {
    for (const role of facultyRoleEnum.enumValues) {
      expect(isFacultyRole(role)).toBe(true)
    }
    expect(isFacultyRole("super_admin")).toBe(true)
  })

  it("rejects anything outside the enum", () => {
    expect(isFacultyRole("admin")).toBe(false)
    expect(isFacultyRole("Faculty")).toBe(false)
    expect(isFacultyRole("")).toBe(false)
    expect(isFacultyRole(null)).toBe(false)
    expect(isFacultyRole(undefined)).toBe(false)
    expect(isFacultyRole(1)).toBe(false)
    expect(isFacultyRole({ role: "hod" })).toBe(false)
  })
})

describe("isCapability", () => {
  it("accepts every capability in the catalog", () => {
    for (const entry of CAPABILITY_CATALOG) {
      expect(isCapability(entry.capability)).toBe(true)
    }
  })

  it("rejects unknown or malformed strings", () => {
    expect(isCapability("foo:bar")).toBe(false)
    expect(isCapability("faculty:createx")).toBe(false)
    expect(isCapability("")).toBe(false)
    expect(isCapability(null)).toBe(false)
    expect(isCapability(42)).toBe(false)
  })
})

describe("isManageableTier", () => {
  it("accepts the tiers an override can target", () => {
    for (const tier of Object.keys(ROLE_DEFAULTS)) {
      expect(isManageableTier(tier)).toBe(true)
    }
  })

  it("rejects super_admin and unknown tiers", () => {
    expect(isManageableTier("super_admin")).toBe(false)
    expect(isManageableTier("root")).toBe(false)
    expect(isManageableTier("")).toBe(false)
    expect(isManageableTier(null)).toBe(false)
    expect(isManageableTier(7)).toBe(false)
  })
})
