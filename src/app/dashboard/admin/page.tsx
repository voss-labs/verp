import Link from "next/link"
import {
  BuildingIcon,
  UsersIcon,
  GraduationCapIcon,
  ShieldIcon,
  ScrollTextIcon,
} from "lucide-react"
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
    href: "/dashboard/students",
    icon: GraduationCapIcon,
    title: "Students",
    desc: "Every student across all departments — search, filter, export, and open any record.",
  },
  {
    href: "/dashboard/admin/roles",
    icon: ShieldIcon,
    title: "Roles & permissions",
    desc: "Toggle capabilities per tier over the fixed defaults.",
  },
  {
    href: "/dashboard/audit",
    icon: ScrollTextIcon,
    title: "Activity log",
    desc: "Every administrative action, with who did it and when.",
  },
]

export default function AdminConsole() {
  return (
    <>
      <PageHeader title="Administration" />
      <div className="@container/main flex flex-1 flex-col p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            The super-admin console — the door to every CRUD in VERP.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="border-border bg-card hover:border-blue/50 hover:bg-muted/40 focus-visible:ring-ring/50 rounded-xl border p-5 transition-colors outline-none focus-visible:ring-2"
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
      </div>
    </>
  )
}
