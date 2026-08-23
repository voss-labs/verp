"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, Loader2Icon, UserRoundCheckIcon, XIcon } from "lucide-react"

import { ConfirmAction } from "@/components/confirm-action"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  approveStaffRequestAction,
  rejectStaffRequestAction,
} from "../admin/actions"

export type StaffRequestRow = {
  id: string
  name: string
  employeeId: string
  email: string
  deptCode: string
  arrivedAt: string
}

export function StaffRequestsClient({
  requests,
}: {
  requests: StaffRequestRow[]
}) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const locked = busyId !== null || refreshing

  async function decide(
    id: string,
    run: () => Promise<{ error: string | null }>,
    ok: string
  ) {
    setBusyId(id)
    try {
      const res = await run()
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(ok)
      startRefresh(() => router.refresh())
    } finally {
      setBusyId(null)
    }
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={UserRoundCheckIcon}
        title="No staff waiting"
        description="New sign-ups appear here."
        variant="dashed"
      />
    )
  }

  return (
    <div className="grid gap-3">
      {requests.map((r) => (
        <div key={r.id} className="border-border bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                <Badge variant="outline" className="identifier">
                  {r.employeeId}
                </Badge>
                <Badge variant="secondary" className="identifier">
                  {r.deptCode}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {r.email}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Waiting since {r.arrivedAt}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={locked}
                onClick={() =>
                  decide(
                    r.id,
                    () => approveStaffRequestAction({ requestId: r.id }),
                    `${r.name} can now sign in as faculty in ${r.deptCode}`
                  )
                }
              >
                {busyId === r.id ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                Approve
              </Button>
              <ConfirmAction
                disabled={locked}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                  >
                    <XIcon data-icon="inline-start" />
                    Reject
                  </Button>
                }
                title={`Reject ${r.name}?`}
                description={
                  <>
                    <span className="block">
                      No faculty record is created and they stay unable to sign
                      in. Tell them why, so they know what to fix.
                    </span>
                    <Input
                      className="mt-3"
                      value={reasons[r.id] ?? ""}
                      onChange={(e) =>
                        setReasons((cur) => ({
                          ...cur,
                          [r.id]: e.target.value,
                        }))
                      }
                      placeholder="Reason (e.g. not a member of this department)"
                    />
                  </>
                }
                confirmLabel="Reject"
                onConfirm={() =>
                  decide(
                    r.id,
                    () =>
                      rejectStaffRequestAction({
                        requestId: r.id,
                        reason: reasons[r.id] ?? "",
                      }),
                    `${r.name} was not added to ${r.deptCode}`
                  )
                }
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
