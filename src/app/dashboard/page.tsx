import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { AdminDashboard } from "./admin-dashboard"
import { HodDashboard } from "./hod-dashboard"
import { StudentDashboard } from "./student-dashboard"
import { TeacherDashboard } from "./teacher-dashboard"

export const dynamic = "force-dynamic"

/**
 * One overview per role. The session is resolved once here and the role decides
 * which dashboard renders: what an HOD needs to see and what a TR needs to do
 * are different questions, and one page branching on tier answered neither well.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const { denied } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect("/login")

  // The college's date, not UTC: toISOString() rolls over at 05:30 IST and would
  // open tomorrow's register during an early-morning lecture.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date())

  if (user.tier === "student") return <StudentDashboard user={user} />
  if (user.tier === "super_admin") {
    return <AdminDashboard user={user} today={today} denied={denied} />
  }
  if (user.tier === "hod") {
    return <HodDashboard user={user} today={today} denied={denied} />
  }
  return <TeacherDashboard user={user} today={today} denied={denied} />
}
