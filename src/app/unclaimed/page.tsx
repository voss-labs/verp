import { redirect } from "next/navigation"
import { ClockIcon, AlertTriangleIcon } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SessionProvider } from "@/components/session-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionUser, isUnbound } from "@/lib/session"
import { devAuthProps } from "@/lib/dev-auth"
import { getLatestRequestForUser } from "@/db/queries/onboarding"
import { getLatestStaffRequestForUser } from "@/db/queries/staff-requests"
import { getClassById } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { getDepartment, listDepartments } from "@/db/queries/departments"
import { getActiveHod } from "@/db/queries/appointments"
import { expectedYear } from "@/lib/roll-number"
import { ClaimFlow } from "./claim-flow"
import { WithdrawRequest } from "./register-form"
import { WithdrawStaffRequest } from "./staff-form"

export const dynamic = "force-dynamic"

/**
 * The unbound account's entry point. VOSS verified them, VERP cannot place them:
 * they say whether they are a student or staff, that request goes to whoever can
 * confirm it (class coordinator / HOD or an administrator), and until then this
 * page is the status of it. Rendered inside the app shell — they ARE in, just not
 * yet placed. The dashboard layout redirects unbound users here, so no data route
 * is reachable without a role.
 */
export default async function UnclaimedPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!isUnbound(user)) redirect("/dashboard")

  // Without this the "unplaced" persona is a trap: you land here, the shell has
  // no switcher, and the only way back is deleting a cookie by hand.
  const devAuth = await devAuthProps()
  const [req, staffReq] = await Promise.all([
    getLatestRequestForUser(user.id),
    getLatestStaffRequestForUser(user.id),
  ])

  const enrolment = req && req.status !== "rejected" ? req : null
  const staffPending =
    !enrolment && staffReq?.status === "pending" ? staffReq : null
  const staffDeptCode = staffPending?.deptCode ?? null

  const queued = enrolment?.status === "pending" ? enrolment.classId : null
  const [cls, staff, staffDept, hod, depts] = await Promise.all([
    queued ? getClassById(queued) : null,
    queued ? listClassStaff([queued]) : [],
    staffDeptCode ? getDepartment(staffDeptCode) : null,
    staffDeptCode ? getActiveHod(staffDeptCode) : null,
    enrolment || staffPending ? [] : listDepartments(),
  ])

  const coordinator = staff.find((s) => s.role === "academic_coordinator")
  const classLabel = cls
    ? `${expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear} · ${cls.departmentCode} · ${cls.division}`
    : null
  const coordinatorPhrase =
    coordinator && classLabel
      ? `${`${coordinator.firstName} ${coordinator.lastName}`.trim()}, the ${classLabel} coordinator`
      : null

  const deptName = staffDept?.name ?? staffDeptCode ?? ""
  const hodName = hod ? `${hod.firstName} ${hod.lastName}`.trim() : null
  const deciderPhrase = hodName
    ? `${hodName}, the head of ${deptName}, or an administrator`
    : `the head of ${deptName}, or an administrator`

  const studentRejection = req?.status === "rejected" ? req : null
  const staffRejection = staffReq?.status === "rejected" ? staffReq : null
  const initialRole =
    studentRejection && staffRejection
      ? staffRejection.updatedAt > studentRejection.updatedAt
        ? "staff"
        : "student"
      : studentRejection
        ? "student"
        : staffRejection
          ? "staff"
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
              {enrolment ? (
                enrolment.status === "pending" ? (
                  <Status
                    icon={<ClockIcon className="size-5" />}
                    title="Waiting for approval"
                    body={
                      coordinatorPhrase
                        ? `Waiting for ${coordinatorPhrase}, to approve your claim on ${enrolment.rollNumber}. You'll be linked automatically the moment they do.`
                        : `Your claim on ${enrolment.rollNumber} is with your class coordinator. You'll be linked automatically the moment they approve it.`
                    }
                    action={
                      <WithdrawRequest rollNumber={enrolment.rollNumber} />
                    }
                  />
                ) : (
                  <Status
                    icon={<AlertTriangleIcon className="size-5" />}
                    title="Your class isn't set up yet"
                    body={`We have your details for ${enrolment.rollNumber}, but your class has not been created in VERP yet. You'll be routed to your coordinator's queue automatically once it is — nothing more to do.`}
                    action={
                      <WithdrawRequest rollNumber={enrolment.rollNumber} />
                    }
                  />
                )
              ) : staffPending ? (
                <Status
                  icon={<ClockIcon className="size-5" />}
                  title="Waiting for approval"
                  body={`Waiting for ${deciderPhrase}, to confirm you as staff. You'll be placed automatically the moment they do.`}
                  action={
                    <WithdrawStaffRequest
                      deptName={deptName}
                      employeeId={staffPending.employeeId}
                    />
                  }
                />
              ) : (
                <ClaimFlow
                  email={user.email}
                  name={user.name}
                  departments={depts
                    .filter((d) => d.isActive)
                    .map((d) => ({ code: d.code, name: d.name }))}
                  initialRole={initialRole}
                  studentRejection={studentRejection?.rejectionReason ?? null}
                  staffRejection={staffRejection?.rejectionReason ?? null}
                  staffDefaults={
                    staffRejection
                      ? {
                          firstName: staffRejection.firstName,
                          lastName: staffRejection.lastName,
                          employeeId: staffRejection.employeeId,
                          deptCode: staffRejection.deptCode,
                        }
                      : null
                  }
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
