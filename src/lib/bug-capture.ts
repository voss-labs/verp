import { MAX_LOGS, clamp } from "@/lib/bug-report"
import type { BugDevice, BugLogEntry } from "@/lib/bug-report"

const UNKNOWN = "unknown"
const LOG_TEXT_MAX = 500
const SCREENSHOT_MAX_EDGE = 1600
const SCREENSHOT_QUALITY = 0.8

type UserAgentBrand = { brand: string; version: string }

type UserAgentData = {
  brands?: UserAgentBrand[]
  mobile?: boolean
  platform?: string
}

type ConnectionInfo = { effectiveType?: string }

type ExtendedNavigator = Navigator & {
  userAgentData?: UserAgentData
  deviceMemory?: number
  connection?: ConnectionInfo
}

function safe<T>(read: () => T | null | undefined, fallback: T): T {
  try {
    return read() ?? fallback
  } catch {
    return fallback
  }
}

const UA_BROWSERS: Array<[RegExp, string]> = [
  [/Edg(?:iOS|A)?\/([\d.]+)/, "Edge"],
  [/OPR\/([\d.]+)/, "Opera"],
  [/Firefox\/([\d.]+)/, "Firefox"],
  [/CriOS\/([\d.]+)/, "Chrome"],
  [/Chrome\/([\d.]+)/, "Chrome"],
  [/Version\/([\d.]+).*Safari/, "Safari"],
]

function brandFromHints(uaData: UserAgentData | undefined) {
  const brands = uaData?.brands
  if (!brands || brands.length === 0) return null
  const real = brands.filter(
    (entry) => entry?.brand && !/not[^a-z]*a[^a-z]*brand/i.test(entry.brand)
  )
  const picked = real.find((entry) => !/chromium/i.test(entry.brand)) ?? real[0]
  if (!picked) return null
  return { browser: picked.brand, browserVersion: picked.version ?? "" }
}

function browserFromUserAgent(ua: string) {
  for (const [pattern, name] of UA_BROWSERS) {
    const match = ua.match(pattern)
    if (match) return { browser: name, browserVersion: match[1] ?? "" }
  }
  return { browser: UNKNOWN, browserVersion: "" }
}

function osFromUserAgent(ua: string, touchPoints: number) {
  if (/iPhone|iPod/.test(ua)) {
    return { os: "iOS", osVersion: dotted(ua.match(/OS (\d+[_\d]*)/)?.[1]) }
  }
  if (/iPad/.test(ua)) {
    return { os: "iPadOS", osVersion: dotted(ua.match(/OS (\d+[_\d]*)/)?.[1]) }
  }
  if (/Android/.test(ua)) {
    return { os: "Android", osVersion: ua.match(/Android ([\d.]+)/)?.[1] ?? "" }
  }
  if (/CrOS/.test(ua)) {
    return {
      os: "ChromeOS",
      osVersion: ua.match(/CrOS \S+ ([\d.]+)/)?.[1] ?? "",
    }
  }
  if (/Mac OS X/.test(ua)) {
    if (touchPoints > 1) return { os: "iPadOS", osVersion: "" }
    return {
      os: "macOS",
      osVersion: dotted(ua.match(/Mac OS X (\d+[_.\d]*)/)?.[1]),
    }
  }
  if (/Windows NT/.test(ua)) {
    return {
      os: "Windows",
      osVersion: ua.match(/Windows NT ([\d.]+)/)?.[1] ?? "",
    }
  }
  if (/Linux/.test(ua)) return { os: "Linux", osVersion: "" }
  return { os: UNKNOWN, osVersion: "" }
}

function dotted(version: string | undefined): string {
  return version ? version.replace(/_/g, ".") : ""
}

function engineFor(browser: string, os: string, ua: string): string {
  if (os === "iOS" || os === "iPadOS") return "WebKit"
  if (/firefox/i.test(browser)) return "Gecko"
  if (/safari/i.test(browser)) return "WebKit"
  if (/chrome|chromium|edge|opera|brave|arc|vivaldi/i.test(browser))
    return "Blink"
  if (/AppleWebKit/.test(ua)) return "WebKit"
  if (/Gecko\//.test(ua)) return "Gecko"
  return UNKNOWN
}

function deviceTypeFor(
  ua: string,
  mobileHint: boolean | undefined,
  touchPoints: number
): BugDevice["deviceType"] {
  if (/iPad|Tablet|PlayBook|Silk/.test(ua)) return "tablet"
  if (/Android/.test(ua) && !/Mobi/.test(ua)) return "tablet"
  if (mobileHint === true) return "mobile"
  if (/Mobi|iPhone|iPod/.test(ua)) return "mobile"
  if (/Macintosh/.test(ua) && touchPoints > 1) return "tablet"
  return "desktop"
}

function readTheme(): string {
  const root = document.documentElement
  if (root.classList.contains("dark")) return "dark"
  if (root.classList.contains("light")) return "light"
  const attribute = root.getAttribute("data-theme")
  if (attribute) return attribute
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function emptyDevice(): BugDevice {
  return {
    browser: UNKNOWN,
    browserVersion: "",
    engine: UNKNOWN,
    os: UNKNOWN,
    osVersion: "",
    deviceType: "desktop",
    userAgent: "",
    viewport: UNKNOWN,
    screen: UNKNOWN,
    devicePixelRatio: 1,
    touchPoints: 0,
    cores: null,
    memoryGb: null,
    connection: UNKNOWN,
    languages: [],
    timezone: UNKNOWN,
    theme: UNKNOWN,
    online: true,
  }
}

export function captureDevice(): BugDevice {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return emptyDevice()
  }

  const nav = navigator as ExtendedNavigator
  const ua = safe(() => nav.userAgent, "")
  const hints = safe<UserAgentData | undefined>(
    () => nav.userAgentData,
    undefined
  )
  const touchPoints = safe(() => nav.maxTouchPoints, 0)

  const fromUa = browserFromUserAgent(ua)
  const brand = brandFromHints(hints) ?? fromUa
  const parsedOs = osFromUserAgent(ua, touchPoints)
  const os = safe(() => hints?.platform, "") || parsedOs.os

  return {
    browser: brand.browser || UNKNOWN,
    browserVersion: brand.browserVersion,
    engine: engineFor(brand.browser, parsedOs.os, ua),
    os: os || UNKNOWN,
    osVersion: parsedOs.osVersion,
    deviceType: deviceTypeFor(
      ua,
      safe(() => hints?.mobile, undefined),
      touchPoints
    ),
    userAgent: clamp(ua, LOG_TEXT_MAX),
    viewport: safe(() => `${window.innerWidth}x${window.innerHeight}`, UNKNOWN),
    screen: safe(
      () => `${window.screen.width}x${window.screen.height}`,
      UNKNOWN
    ),
    devicePixelRatio: safe(() => window.devicePixelRatio, 1),
    touchPoints,
    cores: safe<number | null>(() => nav.hardwareConcurrency, null),
    memoryGb: safe<number | null>(() => nav.deviceMemory, null),
    connection: safe(() => nav.connection?.effectiveType, UNKNOWN) || UNKNOWN,
    languages: safe<string[]>(
      () => [...nav.languages],
      safe(() => [nav.language], [])
    ),
    timezone: safe(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      UNKNOWN
    ),
    theme: safe(readTheme, UNKNOWN),
    online: safe(() => nav.onLine, true),
  }
}

const logs: BugLogEntry[] = []
let capturing = false

function textOf(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`
  }
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function record(level: BugLogEntry["level"], parts: unknown[]): void {
  try {
    const text = clamp(parts.map(textOf).join(" ").trim(), LOG_TEXT_MAX)
    if (!text) return
    logs.push({ at: new Date().toISOString(), level, text })
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
  } catch {
    return
  }
}

export function startBugLogCapture(): void {
  if (capturing || typeof window === "undefined") return
  capturing = true

  const originalError = console.error
  const originalWarn = console.warn

  console.error = (...args: unknown[]) => {
    record("error", args)
    originalError.apply(console, args)
  }

  console.warn = (...args: unknown[]) => {
    record("warn", args)
    originalWarn.apply(console, args)
  }

  window.addEventListener("error", (event) => {
    const where = event.filename
      ? ` (${event.filename}:${event.lineno}:${event.colno})`
      : ""
    record("error", [`${event.message}${where}`])
  })

  window.addEventListener("unhandledrejection", (event) => {
    record("error", ["unhandled rejection:", event.reason])
  })
}

export function getBugLogs(): BugLogEntry[] {
  return logs.map((entry) => ({ ...entry }))
}

function isCancel(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false
  }
  const name = String((error as { name: unknown }).name)
  return name === "AbortError" || name === "NotAllowedError"
}

function stopEveryTrack(stream: MediaStream): void {
  try {
    for (const track of stream.getTracks()) track.stop()
  } catch {
    return
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve())
      return
    }
    window.setTimeout(resolve, 50)
  })
}

function metadataReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    video.addEventListener("loadedmetadata", done, { once: true })
    window.setTimeout(done, 2000)
  })
}

function base64Bytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  const body = comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding)
}

async function frameFrom(
  stream: MediaStream
): Promise<{ dataUrl: string; bytes: number }> {
  const video = document.createElement("video")
  video.srcObject = stream
  video.muted = true
  video.playsInline = true

  try {
    await metadataReady(video)
    await video.play()
    await nextFrame()

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      throw new Error("The screen capture came back empty")
    }

    const scale = Math.min(1, SCREENSHOT_MAX_EDGE / Math.max(width, height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("This browser could not draw the screenshot")
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL("image/jpeg", SCREENSHOT_QUALITY)
    return { dataUrl, bytes: base64Bytes(dataUrl) }
  } finally {
    video.pause()
    video.srcObject = null
  }
}

export async function captureScreenshot(): Promise<{
  dataUrl: string
  bytes: number
} | null> {
  if (
    typeof navigator === "undefined" ||
    typeof document === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    throw new Error("This browser cannot capture the screen")
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
      preferCurrentTab: true,
    } as DisplayMediaStreamOptions)
  } catch (error) {
    if (isCancel(error)) return null
    throw error
  }

  try {
    return await frameFrom(stream)
  } finally {
    stopEveryTrack(stream)
  }
}
