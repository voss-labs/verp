import Link from "next/link"
import { BuildingIcon, UsersIcon, ShieldIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"

export const dynamic = "force-dynamic"

const SECTIONS = [
  {
    href: "/dashboard/admin/departments",
    icon: BuildingIcon,
    title: "Departments",
    desc: "The 5 branches. Create them, then appoint an HOD for each.",
  },
  {
    href: "/dashboard/admin/faculty",
    icon: UsersIcon,
    title: "Faculty",
    desc: "Add staff, set their tier, and appoint HODs and coordinators.",
  },
  {
    href: "/dashboard/admin/roles",
    icon: ShieldIcon,
    title: "Roles & permissions",
    desc: "Toggle capabilities per tier over the fixed defaults.",
  },
]

export default function AdminConsole() {
  return (
    <>
      <PageHeader title="Administration" />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <p className="text-muted-foreground text-sm">
          The super-admin console — the door to every CRUD in VERP.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="border-border bg-card hover:border-blue/50 rounded-xl border p-5 transition-colors"
            >
              <s.icon className="text-blue size-5" />
              <p className="mt-3 font-medium">{s.title}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {s.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
