"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser } from "@/lib/session"
import { authorize } from "@/lib/rbac"
import { getErrorMessage } from "@/lib/error-utils"
import { createAuditLog } from "@/db/queries"
import {
  getAllStudents,
  getStudentsByClassIds,
  getStudentsByDepartments,
  deactivateStudentsByIds,
} from "@/db/queries/students"

type Result = { error: string | null; count?: number }

export async function bulkDeactivateStudentsAction(input: {
  ids: string[]
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "student:deactivate")

    // Only ever act on students within the caller's scope — a forged id from
    // outside their reach is silently dropped, not deactivated.
    const scoped =
      user!.tier === "super_admin"
        ? await getAllStudents()
        : user!.tier === "hod"
          ? await getStudentsByDepartments(user!.deptCodes)
          : await getStudentsByClassIds(user!.classIds)
    const allowed = new Set(scoped.map((s) => s.id))
    const targets = input.ids.filter((id) => allowed.has(id))
    if (targets.length === 0)
      return { error: "None of the selected students are in your scope." }

    const count = await deactivateStudentsByIds(targets)
    await createAuditLog({
      action: "students.bulk_deactivated",
      actorId: user!.id,
      targetType: "students",
      details: { count },
    })
    revalidatePath("/dashboard/students")
    return { error: null, count }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not deactivate students") }
  }
}
