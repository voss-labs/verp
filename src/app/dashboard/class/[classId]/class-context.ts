import "server-only"
import { notFound, redirect } from "next/navigation"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { getSessionUser, type SessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import type { TrailSegment } from "@/components/page-header"
import type { ClassTab } from "./class-tabs"

/**
 * One resolution of "which class, and what may this person do in it".
 *
 * Every page under /dashboard/class/[classId] repeated the same four steps:
 * resolve the session, load the class, recompute the same scope expression, and
 * rebuild the same label. The expression drifted — the marks page and the
 * subjects page spelled the coordinator check differently — so it lives here
 * once and every surface reads the same answer.
 */
export async function requireClassContext(classId: string) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const cls = await getClassById(classId)
  if (!cls) notFound()

  const canAllocate =
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode)) ||
    user.coordinatorClassIds.includes(classId)
  const inScope = canAllocate || user.classIds.includes(classId)
  if (!inScope) redirect("/dashboard/class")

  const year = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  const label = `${year} · ${cls.departmentCode} · ${cls.division}`

  return { user, cls, canAllocate, year, label }
}

/** VIT / EXCS / BE A — the scope this page operates in, spelled out. */
export function classTrail(
  cls: {
    departmentCode: string
  },
  label: string
): TrailSegment[] {
  return [
    { label: "VIT" },
    {
      label: cls.departmentCode,
      href: `/dashboard/dept/${cls.departmentCode}`,
    },
    { label },
  ]
}

export function classTabs(
  classId: string,
  user: SessionUser,
  opts: { canAllocate: boolean; pendingRequests?: number }
): ClassTab[] {
  const tabs: ClassTab[] = [
    {
      label: "Overview",
      href: `/dashboard/class/${classId}`,
      badge: opts.pendingRequests,
    },
  ]
  if (can(user, "offering:read")) {
    tabs.push({
      label: "Subjects",
      href: `/dashboard/class/${classId}/subjects`,
    })
  }
  // Write, not read. The destination is the register itself — an entry
  // surface — and it redirects anyone without attendance:write, so offering it
  // on read alone produced a tab that bounced you to the Overview.
  if (can(user, "attendance:write")) {
    tabs.push({
      label: "Attendance",
      href: `/dashboard/class/${classId}/attendance`,
    })
  }
  if (can(user, "marks:write")) {
    tabs.push({ label: "Marks", href: `/dashboard/class/${classId}/marks` })
    tabs.push({ label: "Batches", href: `/dashboard/class/${classId}/batches` })
  }
  if (can(user, "marks:read")) {
    tabs.push({ label: "Results", href: `/dashboard/class/${classId}/results` })
  }
  return tabs
}
