import { describe, expect, it } from "vitest"
import {
  clamp,
  scrubReport,
  scrubText,
  summarizeTitle,
  type BugDevice,
  type BugReport,
} from "./bug-report"

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkEgQiJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"

const device: BugDevice = {
  browser: "Chrome",
  browserVersion: "141",
  engine: "Blink",
  os: "macOS",
  osVersion: "15.6",
  deviceType: "desktop",
  userAgent: "Mozilla/5.0",
  viewport: "1512x805",
  screen: "1512x982",
  devicePixelRatio: 2,
  touchPoints: 0,
  cores: 10,
  memoryGb: 8,
  connection: "4g",
  languages: ["en-IN", "en"],
  timezone: "Asia/Kolkata",
  theme: "dark",
  online: true,
}

const report = (over: Partial<BugReport> = {}): BugReport => ({
  description: "Marks page crashes when I save",
  device,
  context: {
    route: "/dashboard/marks",
    appVersion: "0.1.0",
    capturedAt: "2026-08-21T10:00:00.000Z",
  },
  logs: [],
  screenshot: null,
  ...over,
})

const BODY = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"

const fake = (prefix: string, body = BODY) => prefix + body

describe("scrubText", () => {
  it("masks an Anthropic key without labelling it OpenAI", () => {
    const out = scrubText(`key ${fake("sk-" + "ant-api03-")} here`)
    expect(out).toContain("<ANTHROPIC_KEY>")
    expect(out).not.toContain("<OPENAI_KEY>")
    expect(out).not.toContain("ant-api03")
  })

  it("masks an OpenRouter key before the generic sk- rule sees it", () => {
    expect(scrubText(fake("sk-" + "or-v1-"))).toBe("<OPENROUTER_KEY>")
  })

  it("masks a generic sk- key", () => {
    expect(scrubText(fake("sk-"))).toBe("<OPENAI_KEY>")
  })

  it("masks the remaining provider tokens", () => {
    const cases: Array<[string, string]> = [
      [fake("AIza" + "Sy"), "<GOOGLE_KEY>"],
      [fake("github" + "_pat_11ABCDEFG0", BODY + "abcdef"), "<GITHUB_PAT>"],
      [fake("ghp" + "_"), "<GITHUB_PAT>"],
      [fake("hf" + "_"), "<HF_TOKEN>"],
      [fake("gsk" + "_"), "<GROQ_KEY>"],
      [fake("BS" + "A", "AbCdEfGhIjKlMnOpQrStUvWxYz"), "<BRAVE_KEY>"],
      [
        fake("xox" + "b-1234567890-1234567890-", "AbCdEfGhIjKlMnOp"),
        "<SLACK_TOKEN>",
      ],
    ]
    for (const [secret, mask] of cases) {
      expect(scrubText(`value ${secret} end`)).toBe(`value ${mask} end`)
    }
  })

  it("masks a bearer token, whatever it holds", () => {
    const out = scrubText(`Authorization: Bearer ${JWT}`)
    expect(out).toBe("Authorization: Bearer <TOKEN>")
    expect(out).not.toContain("eyJ")
  })

  it("masks a bare JWT", () => {
    const out = scrubText(`session cookie is ${JWT} apparently`)
    expect(out).toBe("session cookie is <JWT> apparently")
  })

  it("masks a JWT-shaped token that does not start with eyJ", () => {
    const out = scrubText(
      "tok AbCdEfGhIjKlMnOpQr.StUvWxYz0123456789.AbCdEfGhIjKlMnOpQrSt end"
    )
    expect(out).toBe("tok <JWT> end")
  })

  it("masks a Postgres connection string carrying a password", () => {
    const out = scrubText(
      "DATABASE_URL=postgresql://verp:s3cr3t-pass@ep-cool-name-123456.ap-south-1.aws.neon.tech/verp?sslmode=require"
    )
    expect(out).toBe("DATABASE_URL=<POSTGRES_URL>")
    expect(out).not.toContain("s3cr3t-pass")
  })

  it("masks a postgres:// string too", () => {
    expect(
      scrubText("postgres://user:pw@localhost:5432/verp failed to connect")
    ).toBe("<POSTGRES_URL> failed to connect")
  })

  it("masks a long blob that follows a secret-ish label", () => {
    expect(
      scrubText(
        "SESSION_TOKEN=9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a3928"
      )
    ).toBe("SESSION_TOKEN=<REDACTED>")
    expect(
      scrubText('api_key: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"')
    ).toContain("<REDACTED>")
    expect(
      scrubText("betterAuthSecret : Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4MTIzNDU2")
    ).toContain("<REDACTED>")
  })

  it("leaves a short labelled value alone", () => {
    expect(scrubText("token=abc123")).toBe("token=abc123")
  })

  it("leaves ordinary bug prose untouched", () => {
    const prose =
      "Saving marks for class 2023-108-A throws on /dashboard/marks. Roll 23108A0054."
    expect(scrubText(prose)).toBe(prose)
  })

  it("is idempotent, so scrubbing twice changes nothing", () => {
    const once = scrubText(`Bearer ${JWT} and ${fake("sk-" + "ant-api03-")}`)
    expect(scrubText(once)).toBe(once)
  })

  it("handles an empty string", () => {
    expect(scrubText("")).toBe("")
  })
})

describe("scrubReport", () => {
  it("scrubs the description and every log line, and nothing else", () => {
    const input = report({
      description: `crash after login with ${JWT}`,
      logs: [
        {
          at: "2026-08-21T10:00:01.000Z",
          level: "error",
          text: "fetch failed: Bearer AbCdEfGhIjKlMnOpQrStUvWxYz",
        },
        {
          at: "2026-08-21T10:00:02.000Z",
          level: "warn",
          text: "retrying /dashboard/marks",
        },
      ],
    })

    const out = scrubReport(input)

    expect(out.description).toBe("crash after login with <JWT>")
    expect(out.logs[0].text).toBe("fetch failed: Bearer <TOKEN>")
    expect(out.logs[0].level).toBe("error")
    expect(out.logs[0].at).toBe("2026-08-21T10:00:01.000Z")
    expect(out.logs[1].text).toBe("retrying /dashboard/marks")
    expect(out.device).toEqual(input.device)
    expect(out.context).toEqual(input.context)
    expect(out.screenshot).toBeNull()
  })

  it("does not mutate the report it was given", () => {
    const input = report({
      description: `token ${JWT}`,
      logs: [{ at: "2026-08-21T10:00:01.000Z", level: "info", text: JWT }],
    })

    scrubReport(input)

    expect(input.description).toContain("eyJ")
    expect(input.logs[0].text).toContain("eyJ")
  })
})

describe("summarizeTitle", () => {
  it("falls back when there is no description", () => {
    expect(summarizeTitle("")).toBe("[bug] Bug report")
    expect(summarizeTitle("   \n  ")).toBe("[bug] Bug report")
  })

  it("uses a single line as-is", () => {
    expect(summarizeTitle("  Marks page crashes  ")).toBe(
      "[bug] Marks page crashes"
    )
  })

  it("takes only the first line of a multi-line description", () => {
    expect(summarizeTitle("Marks page crashes\nSteps:\n1. open marks")).toBe(
      "[bug] Marks page crashes"
    )
  })

  it("clamps an over-long first line", () => {
    const line = "a".repeat(100)
    expect(summarizeTitle(line)).toBe(
      `[bug] ${"a".repeat(80)} <truncated 20 chars>`
    )
  })

  it("keeps a first line of exactly 80 chars whole", () => {
    const line = "b".repeat(80)
    expect(summarizeTitle(line)).toBe(`[bug] ${line}`)
  })

  it("never carries a secret into the title", () => {
    expect(summarizeTitle(`crash with ${JWT}`)).toBe("[bug] crash with <JWT>")
  })
})

describe("clamp", () => {
  it("leaves text of exactly max alone", () => {
    expect(clamp("abcde", 5)).toBe("abcde")
  })

  it("truncates at max + 1 and says how much it dropped", () => {
    expect(clamp("abcdef", 5)).toBe("abcde <truncated 1 chars>")
  })

  it("counts every dropped char", () => {
    expect(clamp("x".repeat(30), 10)).toBe(
      `${"x".repeat(10)} <truncated 20 chars>`
    )
  })

  it("handles an empty string", () => {
    expect(clamp("", 10)).toBe("")
  })
})
