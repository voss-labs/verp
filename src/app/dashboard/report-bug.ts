"use server"

import pkg from "../../../package.json"
import { getSessionUser, type SessionUser } from "@/lib/session"
import { bugReportUrl } from "@/lib/bug-report-config"
import {
  MAX_DESCRIPTION,
  MAX_LOGS,
  MAX_SCREENSHOT_BYTES,
  clamp,
  scrubReport,
  scrubText,
  summarizeTitle,
} from "@/lib/bug-report"
import type {
  BugBundle,
  BugContext,
  BugLogEntry,
  BugReport,
  BugScreenshot,
} from "@/lib/bug-report"
import { countActorActionsSince, createAuditLog } from "@/db/queries/audit"

const SERVER_VERSION = pkg.version
const DAILY_LIMIT = 5
const LOG_TEXT_MAX = 500
const WORKER_TIMEOUT_MS = 15000
const WORKER_MESSAGE_MAX = 160
const SCREENSHOT_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/
const LOG_LEVELS = new Set(["error", "warn", "info"])

type Result = { error: string | null; issueUrl?: string; issueNumber?: number }

function istDayStart(now: Date): Date {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(now)
  return new Date(`${day}T00:00:00+05:30`)
}

function istStamp(now: Date): string {
  const text = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now)
  return `${text} IST`
}

function roleLabel(user: SessionUser): string | null {
  if (user.tier === "super_admin") return "Super admin"
  if (user.tier === "hod") return "HOD"
  if (user.tier === "faculty") {
    return user.coordinatorClassIds.length > 0
      ? "Academic coordinator"
      : user.classIds.length > 0
        ? "Teacher representative"
        : "Faculty"
  }
  if (user.tier === "student") return "Student"
  return null
}

function scopeLabel(user: SessionUser): string {
  if (!user.tier) return "Unplaced"
  if (user.tier === "super_admin") return "Institution"
  const parts = user.tier === "hod" ? user.deptCodes : user.classKeys
  return clamp(parts.join(", "), 120) || "No scope"
}

function readContext(context: BugContext | undefined): BugContext {
  return {
    route: clamp(
      scrubText(typeof context?.route === "string" ? context.route : ""),
      300
    ),
    appVersion: clamp(
      typeof context?.appVersion === "string" ? context.appVersion : "",
      40
    ),
    capturedAt: clamp(
      typeof context?.capturedAt === "string" ? context.capturedAt : "",
      40
    ),
  }
}

function readLogs(logs: BugLogEntry[]): BugLogEntry[] {
  return logs.map((entry) => ({
    at: typeof entry?.at === "string" ? entry.at : new Date().toISOString(),
    level: LOG_LEVELS.has(entry?.level) ? entry.level : "info",
    text: clamp(
      typeof entry?.text === "string" ? entry.text : "",
      LOG_TEXT_MAX
    ),
  }))
}

type ScreenshotResult =
  | { ok: true; screenshot: BugScreenshot | null }
  | { ok: false; error: string }

function readScreenshot(value: string | null): ScreenshotResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, screenshot: null }
  }
  if (typeof value !== "string") {
    return { ok: false, error: "That screenshot could not be read." }
  }
  const match = SCREENSHOT_PATTERN.exec(value)
  if (!match) {
    return {
      ok: false,
      error: "A screenshot has to be a PNG, JPEG or WebP image.",
    }
  }
  const [, mime, body] = match
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0
  const bytes = Math.max(0, Math.floor((body.length * 3) / 4) - padding)
  if (bytes === 0) {
    return { ok: false, error: "That screenshot came through empty." }
  }
  if (bytes > MAX_SCREENSHOT_BYTES) {
    const limit = (MAX_SCREENSHOT_BYTES / 1_000_000).toFixed(1)
    return {
      ok: false,
      error: `That screenshot is too large. It has to stay under ${limit} MB.`,
    }
  }
  return { ok: true, screenshot: { mime, dataBase64: body } }
}

function isTimeout(error: unknown): boolean {
  const name = error instanceof Error ? error.name : ""
  return name === "TimeoutError" || name === "AbortError"
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await response.json()
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function retryWindow(
  response: Response,
  body: Record<string, unknown>
): string | null {
  const header = Number(response.headers.get("retry-after"))
  const fromBody = Number(
    body.retry_after_seconds ??
      body.retryAfter ??
      body.retry_after ??
      body.retryAfterSeconds
  )
  const seconds =
    Number.isFinite(header) && header > 0
      ? header
      : Number.isFinite(fromBody) && fromBody > 0
        ? fromBody
        : 0
  if (!seconds) return null
  if (seconds < 90) return `${Math.ceil(seconds)} seconds`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 90) return `${minutes} minutes`
  return `${Math.ceil(minutes / 60)} hours`
}

function workerMessage(body: Record<string, unknown>): string | null {
  const raw = body.error ?? body.message
  if (typeof raw !== "string") return null
  return clamp(raw.trim(), WORKER_MESSAGE_MAX) || null
}

function failureMessage(
  response: Response,
  body: Record<string, unknown>
): string {
  if (response.status === 413) {
    return "That report is too large to send. Drop the screenshot and try again."
  }
  if (response.status === 429) {
    const wait = retryWindow(response, body)
    return wait
      ? `The bug reporter is rate limited right now. Try again in ${wait}.`
      : "The bug reporter is rate limited right now. Try again a little later."
  }
  if (response.status === 502 || response.status === 504) {
    return "The bug reporter could not reach GitHub, so nothing was filed. Try again in a few minutes."
  }
  if (response.status >= 500) {
    return "The bug reporter is having trouble, so nothing was filed. Try again later."
  }
  const detail = workerMessage(body)
  return detail
    ? `The bug reporter rejected the report: ${detail}`
    : "The bug reporter rejected the report."
}

function readIssue(body: Record<string, unknown>): {
  url?: string
  number?: number
} {
  const nested =
    body.issue && typeof body.issue === "object"
      ? (body.issue as Record<string, unknown>)
      : {}
  const url = [
    body.issue_url,
    body.issueUrl,
    body.url,
    nested.html_url,
    nested.url,
  ].find((value) => typeof value === "string" && value.startsWith("https://"))
  const rawNumber = body.issue_number ?? body.issueNumber ?? nested.number
  return {
    url: typeof url === "string" ? url : undefined,
    number: typeof rawNumber === "number" ? rawNumber : undefined,
  }
}

export async function reportBugAction(report: BugReport): Promise<Result> {
  try {
    const user = await getSessionUser()
    if (!user) return { error: "Sign in to report a bug." }

    const endpoint = bugReportUrl()
    if (!endpoint) {
      return { error: "Bug reporting is not set up on this server." }
    }

    const description =
      typeof report?.description === "string" ? report.description.trim() : ""
    if (!description) return { error: "Describe what went wrong first." }
    if (description.length > MAX_DESCRIPTION) {
      return {
        error: `That description is too long. Keep it under ${MAX_DESCRIPTION} characters.`,
      }
    }

    const rawLogs = Array.isArray(report.logs) ? report.logs : []
    if (rawLogs.length > MAX_LOGS) {
      return { error: `A report carries at most ${MAX_LOGS} log lines.` }
    }

    const shot = readScreenshot(report.screenshot)
    if (!shot.ok) return { error: shot.error }

    const now = new Date()
    const sentToday = await countActorActionsSince(
      user.id,
      "bug.reported",
      istDayStart(now)
    )
    if (sentToday >= DAILY_LIMIT) {
      return {
        error: `You have already sent ${DAILY_LIMIT} bug reports today. You can send another after midnight IST.`,
      }
    }

    const scrubbed = scrubReport({
      description,
      device: report.device,
      context: readContext(report.context),
      logs: readLogs(rawLogs),
      screenshot: null,
    })

    const bundle: BugBundle = {
      description: scrubbed.description,
      device: scrubbed.device,
      context: scrubbed.context,
      logs: scrubbed.logs,
      screenshot: shot.screenshot,
      reporter: {
        name: user.name,
        email: user.email,
        tier: user.tier,
        role: roleLabel(user),
        scopeLabel: scopeLabel(user),
      },
      serverVersion: SERVER_VERSION,
      receivedAt: istStamp(now),
    }

    let response: Response
    try {
      response = await fetch(`${endpoint}/report`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": `verp/${SERVER_VERSION} (bug-report; voss-labs/verp)`,
        },
        body: JSON.stringify(bundle),
        cache: "no-store",
        signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
      })
    } catch (error) {
      return {
        error: isTimeout(error)
          ? "The bug reporter took too long to answer. Try again in a moment."
          : "Could not reach the bug reporter. Check your connection and try again.",
      }
    }

    const body = await readBody(response)
    if (!response.ok) return { error: failureMessage(response, body) }

    const issue = readIssue(body)
    await createAuditLog({
      action: "bug.reported",
      actorId: user.id,
      targetType: "bug_report",
      targetId: issue.number ? String(issue.number) : undefined,
      details: {
        title: summarizeTitle(scrubbed.description),
        route: scrubbed.context.route || "unknown",
        issueNumber: issue.number,
        issueUrl: issue.url,
        hasScreenshot: shot.screenshot !== null,
        logCount: scrubbed.logs.length,
      },
    })

    return { error: null, issueUrl: issue.url, issueNumber: issue.number }
  } catch {
    return { error: "Could not send the report. Try again in a moment." }
  }
}
