import { redirect } from "next/navigation"
import { ClockIcon, AlertTriangleIcon } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SessionProvider } from "@/components/session-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionUser, isUnbound } from "@/lib/session"
import { devAuthProps } from "@/lib/dev-auth"
import { getLatestRequestForUser } from "@/db/queries/onboarding"
import { getClassById } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { expectedYear } from "@/lib/roll-number"
import { RegisterForm, WithdrawRequest } from "./register-form"

export const dynamic = "force-dynamic"

/**
 * The student's entry point. An unbound account either self-registers here (roll
 * + name; the email is the verified session, not typed) or, once submitted, sees
 * the status of that request. Rendered inside the app shell — they ARE in, just
 * not yet placed. The dashboard layout redirects unbound users here, so no data
 * route is reachable without a role.
 */
export default async function UnclaimedPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!isUnbound(user)) redirect("/dashboard")

  // Without this the "unplaced" persona is a trap: you land here, the shell has
  // no switcher, and the only way back is deleting a cookie by hand.
  const devAuth = await devAuthProps()
  const req = await getLatestRequestForUser(user.id)
  const showForm = !req || req.status === "rejected"

  const queued = req?.status === "pending" ? req.classId : null
  const [cls, staff] = await Promise.all([
    queued ? getClassById(queued) : null,
    queued ? listClassStaff([queued]) : [],
  ])
  const coordinator = staff.find((s) => s.role === "academic_coordinator")
  const classLabel = cls
    ? `${expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear} · ${cls.departmentCode} · ${cls.division}`
    : null
  const coordinatorPhrase =
    coordinator && classLabel
      ? `${`${coordinator.firstName} ${coordinator.lastName}`.trim()}, the ${classLabel} coordinator`
      : null

  // AppSidebar reads the signed-in identity from context, so the shell has to
  // provide it. This page rendered the sidebar without a provider from #82
  // onward and threw on every visit — invisible because reaching it needs an
  // account VOSS authenticated that VERP cannot place, which the dev switcher
  // now makes reachable in one click.
  return (
    <SessionProvider
      session={{
        name: user.name,
        email: user.email,
        image: user.image,
        tier: user.tier,
        facultyId: user.facultyId,
        studentId: user.studentId,
        deptCodes: user.deptCodes,
        classIds: user.classIds,
        coordinatorClassIds: user.coordinatorClassIds,
        capabilities: [...user.capabilities],
        scopeDepts: [],
        scopeClasses: [],
        rollNumber: null,
        bugReportConfigured: false,
      }}
    >
      <SidebarProvider>
        <AppSidebar devAuth={devAuth} />
        <SidebarInset>
          <div className="flex min-h-svh items-center justify-center p-6">
            <div className="w-full max-w-md">
              {showForm ? (
                <RegisterForm
                  email={user.email}
                  name={user.name}
                  rejection={
                    req?.status === "rejected" ? req.rejectionReason : null
                  }
                />
              ) : req.status === "pending" ? (
                <Status
                  icon={<ClockIcon className="size-5" />}
                  title="Waiting for approval"
                  body={
                    coordinatorPhrase
                      ? `Waiting for ${coordinatorPhrase}, to approve your claim on ${req.rollNumber}. You'll be linked automatically the moment they do.`
                      : `Your claim on ${req.rollNumber} is with your class coordinator. You'll be linked automatically the moment they approve it.`
                  }
                  action={<WithdrawRequest rollNumber={req.rollNumber} />}
                />
              ) : (
                <Status
                  icon={<AlertTriangleIcon className="size-5" />}
                  title="Your class isn't set up yet"
                  body={`We have your details for ${req.rollNumber}, but your class has not been created in VERP yet. You'll be routed to your coordinator's queue automatically once it is — nothing more to do.`}
                  action={<WithdrawRequest rollNumber={req.rollNumber} />}
                />
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  )
}

function Status({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <>
      <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
        {icon}
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {body}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </>
  )
}
