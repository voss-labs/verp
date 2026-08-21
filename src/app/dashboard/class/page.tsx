import Link from "next/link"
import { redirect } from "next/navigation"
import { LayersIcon } from "lucide-react"
import { DeniedToast } from "@/components/denied-toast"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button-variants"
import { getSessionUser } from "@/lib/session"
import { buildNavigation } from "@/lib/navigation"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { getClassesByIds } from "@/db/queries/onboarding"
import { listClassesForDepts } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { listDepartments } from "@/db/queries/departments"
import { getClassWork } from "@/db/queries/overview"
import { ClassIndexClient, type ClassCard } from "./client"

export const dynamic = "force-dynamic"

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

export default async function ClassIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const { denied } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect("/login")

  // An HOD holds no class assignments — their scope is the department — so this
  // listed nothing and told them to ask their HOD, which is themselves. A
  // super-admin holds neither, and saw the same empty page.
  const scoped = user.tier === "hod" || user.tier === "super_admin"
  const deptScope =
    user.tier === "super_admin"
      ? (await listDepartments()).filter((d) => d.isActive).map((d) => d.code)
      : user.deptCodes
  const classes = scoped
    ? await listClassesForDepts(deptScope)
    : await getClassesByIds(user.classIds)
  const now = new Date()
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(now)

  const classIds = classes.map((c) => c.id)
  const [staff, work] = await Promise.all([
    listClassStaff(classIds),
    getClassWork(classIds, user.facultyId, today),
  ])
  const workById = new Map(work.map((w) => [w.classId, w]))

  const cards: ClassCard[] = classes.map((c) => {
    const coord = staff.find(
      (s) => s.classId === c.id && s.role === "academic_coordinator"
    )
    const w = workById.get(c.id)
    const pendingRequests = w?.pendingRequests ?? 0
    const unallocatedSubjects = w?.unallocatedSubjects ?? 0
    const attention = [
      pendingRequests > 0 &&
        plural(pendingRequests, "enrolment request", "enrolment requests"),
      unallocatedSubjects > 0 &&
        `${plural(unallocatedSubjects, "subject", "subjects")} with no teacher`,
    ].filter((x): x is string => Boolean(x))
    return {
      id: c.id,
      classKey: c.classKey,
      group: String(expectedYear(c.admissionYear, now) ?? c.admissionYear),
      deptCode: c.departmentCode,
      division: c.division,
      coordinator: coord ? `${coord.firstName} ${coord.lastName}`.trim() : null,
      students: w?.students ?? 0,
      attention,
      isActive: c.isActive,
    }
  })

  const navUrls = buildNavigation({
    tier: user.tier,
    can: (c) => can(user, c),
    isCoordinator: user.coordinatorClassIds.length > 0,
    hasClasses: user.classIds.length > 0,
    classIds: user.classIds,
  }).flatMap((s) => s.items.map((i) => i.url))
  const assignHref = navUrls.includes("/dashboard/dept")
    ? "/dashboard/dept"
    : null

  const title = scoped ? "All classes" : "My classes"
  const description =
    user.tier === "super_admin"
      ? `Every class across ${plural(deptScope.length, "active department", "active departments")}.`
      : user.tier === "hod"
        ? deptScope.length > 0
          ? `Every class in ${deptScope.join(", ")}, not only the ones you teach.`
          : "You are not appointed to a department yet."
        : "The classes you coordinate or teach."

  const empty = !scoped
    ? {
        title: "No classes assigned",
        description:
          "You are not assigned to any class yet. Your HOD assigns coordinators.",
      }
    : deptScope.length === 0
      ? {
          title: "No department scope",
          description:
            user.tier === "hod"
              ? "Ask a super-admin to appoint you to a department."
              : "No active department exists yet.",
        }
      : {
          title: "No classes yet",
          description:
            "A cohort has to be created on the department console before it shows up here.",
        }

  return (
    <>
      <PageHeader title={title} description={description} />
      {denied && <DeniedToast scope={denied} />}
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {cards.length === 0 ? (
          <EmptyState
            icon={LayersIcon}
            variant="dashed"
            title={empty.title}
            description={empty.description}
            action={
              scoped && deptScope.length > 0 && assignHref ? (
                <Link
                  href={assignHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Department console
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ClassIndexClient cards={cards} assignHref={assignHref} />
        )}
      </div>
    </>
  )
}
