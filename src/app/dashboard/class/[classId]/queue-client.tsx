"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { approveEnrollmentAction, rejectEnrollmentAction } from "../actions"

type Req = { id: string; rollNumber: string; name: string; email: string }

export function QueueClient({ requests }: { requests: Req[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn()
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(ok)
      setRejecting(null)
      setReason("")
      router.refresh()
    })

  if (requests.length === 0) {
    return (
      <div className="border-border rounded-xl border border-dashed p-10 text-center">
        <p className="text-muted-foreground text-sm">
          No pending requests. New self-registrations for this class land here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {requests.map((r) => (
        <div key={r.id} className="border-border bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                <Badge variant="outline" className="font-mono">
                  {r.rollNumber}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {r.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => approveEnrollmentAction({ requestId: r.id }),
                    `${r.name} approved`
                  )
                }
              >
                <CheckIcon className="mr-1 size-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                className="text-destructive"
                onClick={() =>
                  setRejecting((cur) => (cur === r.id ? null : r.id))
                }
              >
                <XIcon className="mr-1 size-3.5" /> Reject
              </Button>
            </div>
          </div>

          {rejecting === r.id && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (e.g. not in this division)"
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                className="text-destructive"
                onClick={() =>
                  run(
                    () => rejectEnrollmentAction({ requestId: r.id, reason }),
                    "Request rejected"
                  )
                }
              >
                Confirm reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
