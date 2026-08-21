import "server-only"

export function bugReportUrl(): string | null {
  const raw = process.env.VERP_BUG_REPORT_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, "")
}

export function isBugReportConfigured(): boolean {
  return bugReportUrl() !== null
}
