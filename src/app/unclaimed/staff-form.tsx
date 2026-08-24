"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmAction } from "@/components/confirm-action"
import {
  submitStaffRequestAction,
  withdrawStaffRequestAction,
} from "../onboarding/actions"
import { splitName } from "./register-form"

export type StaffDepartment = { code: string; name: string }

export type StaffDefaults = {
  firstName: string
  lastName: string
  employeeId: string
  deptCode: string
}

export function StaffRequestForm({
  email,
  name,
  departments,
  defaults,
  rejection,
}: {
  email: string
  name: string
  departments: StaffDepartment[]
  defaults: StaffDefaults | null
  rejection: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const fallback = splitName(name)
  const [firstName, setFirstName] = useState(
    defaults?.firstName || fallback.first
  )
  const [lastName, setLastName] = useState(defaults?.lastName || fallback.last)
  const [employeeId, setEmployeeId] = useState(defaults?.employeeId ?? "")
  const [deptCode, setDeptCode] = useState(
    departments.some((d) => d.code === defaults?.deptCode)
      ? (defaults?.deptCode ?? "")
      : ""
  )

  const items = departments.map((d) => ({
    value: d.code,
    label: `${d.code} — ${d.name}`,
  }))
  const ready =
    !!firstName.trim() && !!employeeId.trim() && !!deptCode && !pending

  function submit() {
    start(async () => {
      const res = await submitStaffRequestAction({
        firstName,
        lastName,
        employeeId,
        deptCode,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Request submitted")
      router.refresh()
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Claim your account</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        You&rsquo;re verified as{" "}
        <span className="text-foreground font-mono">{email}</span>. Tell us who
        you are so your head of department or an administrator can confirm you.
      </p>

      {rejection && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive mt-4 rounded-lg border px-3 py-2 text-sm"
        >
          Your previous request was declined: {rejection}. You can correct it
          and submit again.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium">First name</span>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium">Last name</span>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Employee ID</span>
          <Input
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="font-mono"
          />
        </label>

        <div className="grid gap-1.5">
          <label htmlFor="staff-department" className="text-xs font-medium">
            Department
          </label>
          <Select
            value={deptCode}
            items={items}
            disabled={departments.length === 0}
            onValueChange={(v) => v && setDeptCode(v)}
          >
            <SelectTrigger id="staff-department" className="w-full">
              <SelectValue placeholder="Choose your department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.code} — {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departments.length === 0 && (
            <p role="alert" className="text-destructive text-xs">
              No departments are set up yet. An administrator has to add yours
              before you can be confirmed.
            </p>
          )}
        </div>

        <Button disabled={!ready} onClick={submit} className="mt-1">
          {pending ? "Submitting…" : "Submit for approval"}
        </Button>
      </div>
    </div>
  )
}

export function WithdrawStaffRequest({
  deptName,
  employeeId,
}: {
  deptName: string
  employeeId: string
}) {
  const router = useRouter()

  async function withdraw() {
    const res = await withdrawStaffRequestAction()
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Request withdrawn")
    router.refresh()
  }

  return (
    <ConfirmAction
      label="Withdraw request and start over"
      variant="outline"
      size="sm"
      title="Withdraw this request?"
      description={`Your request to join ${deptName} as ${employeeId} is deleted and its approvers stop seeing it. You can submit again straight after.`}
      confirmLabel="Withdraw"
      onConfirm={withdraw}
    />
  )
}
