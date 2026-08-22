"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  BugIcon,
  ChevronRightIcon,
  Loader2Icon,
  ShieldAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { reportBugAction } from "@/app/dashboard/report-bug"
import { useSessionUser } from "@/components/session-provider"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  captureDevice,
  captureScreenshot,
  getBugLogs,
  startBugLogCapture,
} from "@/lib/bug-capture"
import {
  MAX_DESCRIPTION,
  MAX_SCREENSHOT_BYTES,
  type BugDevice,
  type BugLogEntry,
} from "@/lib/bug-report"

const COUNTER_FROM = Math.floor(MAX_DESCRIPTION * 0.8)

const ROLE_LABEL: Record<
  "super_admin" | "hod" | "faculty" | "student",
  string
> = {
  super_admin: "Super-admin",
  hod: "HOD",
  faculty: "Faculty",
  student: "Student",
}

type Shot = { dataUrl: string; bytes: number }
type Snapshot = { device: BugDevice; logs: BugLogEntry[]; capturedAt: string }

export const OPEN_BUG_REPORT = "verp:open-bug-report"

export type BugReportPrefill = { description?: string; digest?: string }

export function openBugReport(prefill?: BugReportPrefill) {
  document.dispatchEvent(
    new CustomEvent(OPEN_BUG_REPORT, { detail: prefill ?? {} })
  )
}

function seedDescription(prefill: BugReportPrefill): string {
  const lines: string[] = []
  const typed = prefill.description?.trim()
  if (typed) lines.push(typed, "")
  if (prefill.digest) lines.push(`Error reference: ${prefill.digest}`)
  return lines.join("\n")
}

function takeSnapshot(): Snapshot {
  return {
    device: captureDevice(),
    logs: getBugLogs(),
    capturedAt: new Date().toISOString(),
  }
}

function deviceLine(device: BugDevice): string {
  const browser =
    [device.browser, device.browserVersion].filter(Boolean).join(" ") ||
    "unknown browser"
  const os =
    [device.os, device.osVersion].filter(Boolean).join(" ") || "unknown system"
  return `${browser} on ${os}, ${device.deviceType}, window ${device.viewport}, ${device.timezone}`
}

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function ReportBugButton({ appVersion }: { appVersion: string }) {
  const pathname = usePathname()
  const { tier } = useSessionUser()
  const [open, setOpen] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
  const [shot, setShot] = React.useState<Shot | null>(null)
  const [shotBusy, setShotBusy] = React.useState(false)
  const [shotError, setShotError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    startBugLogCapture()
  }, [])

  React.useEffect(() => {
    const onOpen = (event: Event) => {
      const prefill = (event as CustomEvent<BugReportPrefill>).detail ?? {}
      const seed = seedDescription(prefill)
      setSnapshot(takeSnapshot())
      setShotError(null)
      setDescription((current) => (current.trim() ? current : seed))
      setOpen(true)
    }
    document.addEventListener(OPEN_BUG_REPORT, onOpen)
    return () => document.removeEventListener(OPEN_BUG_REPORT, onOpen)
  }, [])

  function changeOpen(next: boolean) {
    if (busy) return
    if (next) {
      setSnapshot(takeSnapshot())
      setShotError(null)
    }
    setOpen(next)
  }

  async function toggleShot(next: boolean) {
    if (!next) {
      setShot(null)
      setShotError(null)
      return
    }
    setShotError(null)
    setShotBusy(true)
    try {
      const captured = await captureScreenshot()
      if (!captured) return
      if (captured.bytes > MAX_SCREENSHOT_BYTES) {
        setShotError(
          `That capture is ${kb(captured.bytes)}, over the ${kb(MAX_SCREENSHOT_BYTES)} limit. Capture a smaller area — one window rather than the whole screen.`
        )
        return
      }
      setShot(captured)
    } catch (error) {
      setShotError(
        error instanceof Error
          ? error.message
          : "The screenshot could not be captured"
      )
    } finally {
      setShotBusy(false)
    }
  }

  async function submit() {
    const text = description.trim()
    if (busy || !text) return
    const taken = snapshot ?? takeSnapshot()
    setBusy(true)
    try {
      const result = await reportBugAction({
        description: text,
        device: taken.device,
        context: {
          route: pathname,
          appVersion,
          capturedAt: taken.capturedAt,
        },
        logs: taken.logs,
        screenshot: shot?.dataUrl ?? null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      setDescription("")
      setSnapshot(null)
      setShot(null)
      setShotError(null)
      toast.success(
        result.issueNumber
          ? `Reported as issue #${result.issueNumber}`
          : "Bug report sent",
        {
          action: result.issueUrl ? (
            <a
              href={result.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Open issue
            </a>
          ) : undefined,
        }
      )
    } catch {
      toast.error("The report could not be sent. Check your connection.")
    } finally {
      setBusy(false)
    }
  }

  const overCounter = description.length >= COUNTER_FROM
  const role = tier ? ROLE_LABEL[tier] : "No role yet"

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              aria-label="Report a bug"
              render={
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="text-muted-foreground hover:text-foreground fixed right-6 bottom-6 z-40 size-11 rounded-full shadow-sm hover:shadow-md motion-safe:transition-all motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none print:hidden"
                />
              }
            />
          }
        >
          <BugIcon />
        </TooltipTrigger>
        <TooltipContent side="left">Report a bug</TooltipContent>
      </Tooltip>

      <DialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-1 px-4 pt-4 pr-12">
          <DialogTitle>Report a bug</DialogTitle>
          <DialogDescription className="text-xs">
            This opens an issue on the VERP repository. Nothing from the page
            itself is collected — only what is listed below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bug-description">What went wrong?</Label>
            <Textarea
              id="bug-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={MAX_DESCRIPTION}
              disabled={busy}
              placeholder="What were you doing, what did you expect to happen, and what happened instead?"
              className="min-h-28"
            />
            {overCounter && (
              <p
                aria-live="polite"
                className="text-muted-foreground self-end text-xs tabular-nums"
              >
                {description.length} / {MAX_DESCRIPTION}
              </p>
            )}
          </div>

          {snapshot && (
            <Collapsible className="group/disclosure border-border rounded-lg border">
              <CollapsibleTrigger
                render={
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium transition-colors"
                  >
                    <ChevronRightIcon className="size-3.5 transition-transform duration-200 group-data-open/disclosure:rotate-90 motion-reduce:transition-none" />
                    What gets sent
                  </button>
                }
              />
              <CollapsibleContent className="border-border flex flex-col gap-2 border-t px-3 py-2.5 text-xs">
                <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5">
                  <dt className="text-muted-foreground">The page you are on</dt>
                  <dd className="identifier">{pathname}</dd>
                  <dt className="text-muted-foreground">Who you are</dt>
                  <dd>
                    Your name, email and role ({role}), taken from your session
                  </dd>
                  <dt className="text-muted-foreground">Browser and device</dt>
                  <dd>{deviceLine(snapshot.device)}</dd>
                  <dt className="text-muted-foreground">
                    Recent errors from this tab
                  </dt>
                  <dd>
                    {snapshot.logs.length === 0
                      ? "None so far"
                      : `${snapshot.logs.length} lines`}
                  </dd>
                </dl>
                {snapshot.logs.length > 0 && (
                  <div className="bg-muted/60 max-h-32 overflow-y-auto rounded-md p-2 font-mono text-[11px] leading-relaxed">
                    {snapshot.logs.map((entry, index) => (
                      <p
                        key={`${entry.at}-${index}`}
                        className="wrap-anywhere whitespace-pre-wrap"
                      >
                        <span className="text-muted-foreground">
                          {entry.level}
                        </span>{" "}
                        {entry.text}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground">
                  No form values, table rows or student records are read from
                  the page.
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="border-border flex flex-col gap-2.5 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="bug-screenshot" className="text-sm">
                <Switch
                  id="bug-screenshot"
                  aria-label="Attach a screenshot"
                  checked={shot !== null}
                  disabled={busy || shotBusy}
                  onCheckedChange={(next) => {
                    void toggleShot(next)
                  }}
                />
                <span>Attach a screenshot</span>
              </Label>
              {shotBusy && (
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Waiting for you to pick
                </span>
              )}
            </div>

            <p className="bg-attention/10 text-attention flex items-start gap-2 rounded-md p-2 text-xs">
              <ShieldAlertIcon className="mt-px size-3.5 shrink-0" />
              <span>
                A screenshot of this page can contain real student names, roll
                numbers and marks, and everyone who can see the issue can see
                them. Attach one only if the bug cannot be understood without
                it.
              </span>
            </p>

            {shotError && (
              <p role="alert" className="text-destructive text-xs">
                {shotError}
              </p>
            )}

            {shot && (
              <div className="flex flex-col gap-2">
                <div
                  role="img"
                  aria-label="Preview of the screenshot you attached"
                  className="border-border bg-muted h-28 w-full rounded-md border bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${shot.dataUrl})` }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {kb(shot.bytes)}, sent with this report
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={busy}
                    onClick={() => {
                      setShot(null)
                      setShotError(null)
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0">
          <DialogClose disabled={busy} render={<Button variant="ghost" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={busy || description.trim().length === 0}
            onClick={() => {
              void submit()
            }}
          >
            {busy && (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            )}
            {busy ? "Sending" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
