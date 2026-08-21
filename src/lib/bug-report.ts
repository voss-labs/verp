import type { Tier } from "@/lib/rbac"

export const MAX_DESCRIPTION = 4000
export const MAX_LOGS = 60
export const MAX_SCREENSHOT_BYTES = 1_500_000

export type BugDevice = {
  browser: string
  browserVersion: string
  engine: string
  os: string
  osVersion: string
  deviceType: "desktop" | "tablet" | "mobile"
  userAgent: string
  viewport: string
  screen: string
  devicePixelRatio: number
  touchPoints: number
  cores: number | null
  memoryGb: number | null
  connection: string
  languages: string[]
  timezone: string
  theme: string
  online: boolean
}

export type BugLogEntry = {
  at: string
  level: "error" | "warn" | "info"
  text: string
}

export type BugContext = {
  route: string
  appVersion: string
  capturedAt: string
}

export type BugReport = {
  description: string
  device: BugDevice
  context: BugContext
  logs: BugLogEntry[]
  screenshot: string | null
}

export type BugReporter = {
  name: string
  email: string
  tier: Tier | null
  role: string | null
  scopeLabel: string
}

export type BugScreenshot = {
  mime: string
  dataBase64: string
}

export type BugBundle = Omit<BugReport, "screenshot"> & {
  reporter: BugReporter
  serverVersion: string
  receivedAt: string
  screenshot: BugScreenshot | null
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, "<ANTHROPIC_KEY>"],
  [/sk-or-[A-Za-z0-9_-]{20,}/g, "<OPENROUTER_KEY>"],
  [/sk-[A-Za-z0-9_-]{20,}/g, "<OPENAI_KEY>"],
  [/AIza[A-Za-z0-9_-]{30,}/g, "<GOOGLE_KEY>"],
  [/github_pat_[A-Za-z0-9_]{40,}/g, "<GITHUB_PAT>"],
  [/ghp_[A-Za-z0-9]{30,}/g, "<GITHUB_PAT>"],
  [/hf_[A-Za-z0-9]{30,}/g, "<HF_TOKEN>"],
  [/gsk_[A-Za-z0-9]{30,}/g, "<GROQ_KEY>"],
  [/BSA[A-Za-z0-9_-]{20,}/g, "<BRAVE_KEY>"],
  [/xox[aboprs]-[A-Za-z0-9-]{20,}/g, "<SLACK_TOKEN>"],
  [/[Bb]earer\s+[A-Za-z0-9._=-]{15,}/g, "Bearer <TOKEN>"],
  [/postgres(?:ql)?:\/\/[^\s:/@]+:[^\s/@]+@[^\s"']+/gi, "<POSTGRES_URL>"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "<JWT>"],
  [/[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, "<JWT>"],
  [
    /([A-Za-z0-9_.-]{0,40}(?:token|secret|key|password)[A-Za-z0-9_.-]{0,40}\s*[=:]\s*["']?)[A-Za-z0-9+/=_-]{32,}/gi,
    "$1<REDACTED>",
  ],
]

export function scrubText(text: string): string {
  if (!text) return ""
  let out = text
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

export function scrubReport(report: BugReport): BugReport {
  return {
    ...report,
    description: scrubText(report.description),
    logs: report.logs.map((entry) => ({
      ...entry,
      text: scrubText(entry.text),
    })),
  }
}

export function clamp(text: string, max: number): string {
  if (!text) return ""
  if (text.length <= max) return text
  return `${text.slice(0, max)} <truncated ${text.length - max} chars>`
}

export function summarizeTitle(description: string): string {
  const firstLine = scrubText(description).split("\n")[0].trim()
  return `[bug] ${clamp(firstLine, 80) || "Bug report"}`
}
