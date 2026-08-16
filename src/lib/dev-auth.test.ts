import { afterEach, describe, expect, it, vi } from "vitest"
import { devAuthEnabled } from "./dev-auth"
import { DEV_PERSONAS, findPersona } from "./dev-personas"

// process.env.NODE_ENV is readonly in the types but writable at runtime, which
// is exactly what has to be exercised: the question is what the gate does in a
// process that thinks it is production.
const setEnv = (nodeEnv: string, flag: string | undefined) => {
  vi.stubEnv("NODE_ENV", nodeEnv)
  if (flag === undefined) vi.stubEnv("VERP_DEV_AUTH", "")
  else vi.stubEnv("VERP_DEV_AUTH", flag)
}

afterEach(() => vi.unstubAllEnvs())

describe("devAuthEnabled", () => {
  // The one that matters. Everything else is convenience; this is the reason
  // the feature is allowed to exist.
  it("is off in production even with the flag explicitly set", () => {
    setEnv("production", "1")
    expect(devAuthEnabled()).toBe(false)
  })

  it("is off in development until the flag is set", () => {
    setEnv("development", undefined)
    expect(devAuthEnabled()).toBe(false)
  })

  it("is on only for development with the flag set to exactly 1", () => {
    setEnv("development", "1")
    expect(devAuthEnabled()).toBe(true)
  })

  // "true", "yes" and "0" are all things somebody would plausibly type, and
  // none of them should turn an authentication bypass on by accident.
  it.each(["true", "yes", "0", "on", " 1"])(
    "does not accept %o as the flag",
    (value) => {
      setEnv("development", value)
      expect(devAuthEnabled()).toBe(false)
    }
  )

  it("is off in test runs unless asked for", () => {
    setEnv("test", undefined)
    expect(devAuthEnabled()).toBe(false)
  })
})

describe("findPersona", () => {
  // The cookie is input. Resolving it against the fixed list is what stops it
  // naming an arbitrary address.
  it("refuses anything that is not a seeded persona", () => {
    expect(findPersona("admin' OR 1=1")).toBeNull()
    expect(findPersona("dev.admin@vit.edu.in")).toBeNull()
    expect(findPersona("")).toBeNull()
    expect(findPersona(undefined)).toBeNull()
  })

  it("resolves each seeded persona", () => {
    for (const p of DEV_PERSONAS) {
      expect(findPersona(p.key)?.email).toBe(p.email)
    }
  })

  it("keeps persona keys and emails unique", () => {
    expect(new Set(DEV_PERSONAS.map((p) => p.key)).size).toBe(
      DEV_PERSONAS.length
    )
    expect(new Set(DEV_PERSONAS.map((p) => p.email)).size).toBe(
      DEV_PERSONAS.length
    )
  })
})
