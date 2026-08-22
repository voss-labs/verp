"use client"

import { useEffect } from "react"
import { TriangleAlertIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { openBugReport } from "@/components/report-bug"
import { useSessionUser } from "@/components/session-provider"
import { Button } from "@/components/ui/button"
import { startBugLogCapture } from "@/lib/bug-capture"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { bugReportConfigured } = useSessionUser()

  useEffect(() => {
    startBugLogCapture()
    console.error(error)
  }, [error])

  return (
    <>
      <PageHeader
        title="Something went wrong"
        parent="Overview"
        parentHref="/dashboard"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <EmptyState
          icon={TriangleAlertIcon}
          variant="dashed"
          className="[&>svg]:text-destructive my-auto"
          title="This page could not be loaded"
          description="The page failed while it was being built, so none of it is showing. Everything else still works — try again, and report it if it keeps happening."
          action={
            <div className="flex flex-col items-center gap-3">
              {error.digest && (
                <p className="text-muted-foreground text-xs">
                  Reference <span className="identifier">{error.digest}</span>
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={reset}>Try again</Button>
                {bugReportConfigured && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      openBugReport({
                        description: "This page failed to load.",
                        digest: error.digest,
                      })
                    }
                  >
                    Report this bug
                  </Button>
                )}
              </div>
            </div>
          }
        />
      </div>
    </>
  )
}
