import Link from "next/link"
import { redirect } from "next/navigation"
import { DeniedToast } from "@/components/denied-toast"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { getSessionUser } from "@/lib/session"
import { expectedYear } from "@/lib/roll-number"
import { cn } from "@/lib/utils"
import { getClassesByIds } from "@/db/queries/onboarding"
import { listClassesForDepts } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { listDepartments } from "@/db/queries/departments"
import { getClassWork } from "@/db/queries/overview"

export const dynamic = "force-dynamic"

const YEAR_ORDER = ["FE", "SE", "TE", "BE"]

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
  const deptScope =
    user.tier === "super_admin"
      ? (await listDepartments()).filter((d) => d.isActive).map((d) => d.code)
      : user.deptCodes
  const classes =
    user.tier === "hod" || user.tier === "super_admin"
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

  const cards = classes.map((c) => {
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
      label: `${c.departmentCode} · ${c.division}`,
      coordinator: coord ? `${coord.firstName} ${coord.lastName}`.trim() : null,
      students: w?.students ?? 0,
      attention,
      isActive: c.isActive,
    }
  })

  const groups = new Map<string, typeof cards>()
  for (const card of cards) {
    const list = groups.get(card.group) ?? []
    list.push(card)
    groups.set(card.group, list)
  }
  const ordered = [...groups.keys()].sort((a, b) => {
    const ai = YEAR_ORDER.indexOf(a)
    const bi = YEAR_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return b.localeCompare(a)
  })

  return (
    <>
      <PageHeader title="My classes" />
      {denied && <DeniedToast scope={denied} />}
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {classes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            You are not assigned to any class yet. Your HOD assigns
            coordinators.
          </p>
        ) : (
          ordered.map((group) => (
            <section key={group} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2 border-b pb-2">
                <h2 className="text-sm font-semibold">
                  {YEAR_ORDER.includes(group) ? group : `${group} intake`}
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {plural(groups.get(group)!.length, "class", "classes")}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groups.get(group)!.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/class/${c.id}`}
                    className="border-border bg-card hover:border-blue/50 flex flex-col gap-2 rounded-xl border p-5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{c.label}</p>
                      <Badge variant="outline" className="identifier shrink-0">
                        {c.classKey}
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        "text-sm",
                        c.coordinator
                          ? "text-muted-foreground"
                          : "text-attention"
                      )}
                    >
                      {c.coordinator ?? "No coordinator"}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {plural(c.students, "student", "students")}
                    </p>
                    {c.attention.length > 0 && (
                      <p className="text-attention flex items-center gap-1.5 text-xs">
                        <span
                          aria-hidden
                          className="bg-attention size-1.5 shrink-0 rounded-full"
                        />
                        {c.attention.join(" · ")}
                      </p>
                    )}
                    {!c.isActive && (
                      <Badge variant="secondary" className="w-fit">
                        inactive
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}
