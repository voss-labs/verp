"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser } from "@/lib/session"
import { authorize } from "@/lib/rbac"
import { getErrorMessage } from "@/lib/error-utils"
import { createAuditLog } from "@/db/queries"
import {
  createDepartment,
  setDepartmentActive,
  getDepartment,
} from "@/db/queries/departments"

type Result = { error: string | null }

const CODE_RE = /^[A-Z]{2,10}$/

export async function createDepartmentAction(input: {
  code: string
  name: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "dept:create")

    const code = input.code.toUpperCase().trim()
    const name = input.name.trim()
    if (!CODE_RE.test(code)) return { error: "Code must be 2–10 letters." }
    if (!name) return { error: "Name is required." }
    if (await getDepartment(code))
      return { error: `Department ${code} already exists.` }

    await createDepartment({ code, name })
    await createAuditLog({
      action: "department.created",
      actorId: user!.id,
      targetType: "department",
      targetId: code,
      details: { name },
    })
    revalidatePath("/dashboard/admin/departments")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not create department") }
  }
}

export async function setDepartmentActiveAction(input: {
  code: string
  isActive: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, input.isActive ? "dept:update" : "dept:deactivate")
    const row = await setDepartmentActive(input.code, input.isActive)
    if (!row) return { error: "No such department." }
    await createAuditLog({
      action: input.isActive ? "department.enabled" : "department.disabled",
      actorId: user!.id,
      targetType: "department",
      targetId: input.code,
    })
    revalidatePath("/dashboard/admin/departments")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not update department") }
  }
}
