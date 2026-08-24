"use client"

import { useState } from "react"
import {
  BriefcaseBusinessIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GraduationCapIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { RegisterForm } from "./register-form"
import {
  StaffRequestForm,
  type StaffDefaults,
  type StaffDepartment,
} from "./staff-form"

type Role = "student" | "staff"

export function ClaimFlow({
  email,
  name,
  departments,
  initialRole,
  studentRejection,
  staffRejection,
  staffDefaults,
}: {
  email: string
  name: string
  departments: StaffDepartment[]
  initialRole: Role | null
  studentRejection: string | null
  staffRejection: string | null
  staffDefaults: StaffDefaults | null
}) {
  const [role, setRole] = useState<Role | null>(initialRole)

  if (!role) return <RoleChoice email={email} onChoose={setRole} />

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2.5"
        onClick={() => setRole(null)}
      >
        <ChevronLeftIcon data-icon="inline-start" />
        Back
      </Button>
      {role === "student" ? (
        <RegisterForm email={email} name={name} rejection={studentRejection} />
      ) : (
        <StaffRequestForm
          email={email}
          name={name}
          departments={departments}
          defaults={staffDefaults}
          rejection={staffRejection}
        />
      )}
    </div>
  )
}

function RoleChoice({
  email,
  onChoose,
}: {
  email: string
  onChoose: (role: Role) => void
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Claim your account</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        You&rsquo;re verified as{" "}
        <span className="text-foreground font-mono">{email}</span>. VERP just
        needs to know who you are here before it can place you.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Choice
          icon={<GraduationCapIcon className="size-5" />}
          title="I am a student"
          detail="Your class coordinator confirms you."
          onClick={() => onChoose("student")}
        />
        <Choice
          icon={<BriefcaseBusinessIcon className="size-5" />}
          title="I am a member of staff"
          detail="Your head of department or an administrator confirms you."
          onClick={() => onChoose("staff")}
        />
      </div>
    </div>
  )
}

function Choice({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-input hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none"
    >
      <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          {detail}
        </span>
      </span>
      <ChevronRightIcon className="text-muted-foreground ml-auto size-4 shrink-0" />
    </button>
  )
}
