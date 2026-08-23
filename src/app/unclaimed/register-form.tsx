"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmAction } from "@/components/confirm-action"
import { parseRollNumber, expectedYear } from "@/lib/roll-number"
import {
  submitEnrollmentRequestAction,
  withdrawEnrollmentRequestAction,
} from "../onboarding/actions"

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

export function RegisterForm({
  email,
  name,
  rejection,
}: {
  email: string
  name: string
  rejection: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const initial = splitName(name)
  const [rollNumber, setRollNumber] = useState("")
  const [firstName, setFirstName] = useState(initial.first)
  const [lastName, setLastName] = useState(initial.last)

  // Live parse of the roll into a class, so the student sees we recognise it.
  const parsed = useMemo(() => {
    const roll = rollNumber.trim().toUpperCase()
    if (roll.length < 10) return null
    try {
      const p = parseRollNumber(roll)
      return {
        dept: p.department ?? p.branchCode,
        division: p.division,
        year: expectedYear(p.admissionYear, new Date()) ?? `${p.admissionYear}`,
        dsy: p.isDSY,
      }
    } catch {
      return null
    }
  }, [rollNumber])

  const rollTouched = rollNumber.trim().length >= 10
  const rollBad = rollTouched && !parsed

  function submit() {
    start(async () => {
      const res = await submitEnrollmentRequestAction({
        rollNumber,
        firstName,
        lastName,
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
        <span className="text-foreground font-mono">{email}</span>. Enter your
        roll number so your class coordinator can confirm you.
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
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Roll number</span>
          <Input
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
            placeholder="23108A0054"
            className="font-mono"
            autoFocus
          />
          {parsed && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{parsed.year}</Badge>
              <Badge variant="outline">{parsed.dept}</Badge>
              <Badge variant="outline">Div {parsed.division}</Badge>
              {parsed.dsy && <Badge variant="secondary">DSY</Badge>}
            </div>
          )}
          {rollBad && (
            <p role="alert" className="text-destructive text-xs">
              That doesn&rsquo;t look like a valid roll number.
            </p>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium">First name</span>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
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

        <Button
          disabled={pending || !parsed || !firstName.trim()}
          onClick={submit}
          className="mt-1"
        >
          {pending ? "Submitting…" : "Submit for approval"}
        </Button>
      </div>
    </div>
  )
}

export function WithdrawRequest({ rollNumber }: { rollNumber: string }) {
  const router = useRouter()

  async function withdraw() {
    const res = await withdrawEnrollmentRequestAction()
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
      description={`Your claim on ${rollNumber} is deleted and your coordinator stops seeing it. You can enter a roll number again straight after.`}
      confirmLabel="Withdraw"
      onConfirm={withdraw}
    />
  )
}
