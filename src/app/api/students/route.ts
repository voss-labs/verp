import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage, isUniqueViolation } from "@/lib/error-utils"
import { getSessionUser } from "@/lib/session"
import { createAuditLog, createStudent } from "@/db/queries"
import { insertStudentSchema } from "@/db/validations"
import { tryClassKeyFromRoll } from "@/lib/class-key"
import { parseRollNumber } from "@/lib/roll-number"

export const dynamic = "force-dynamic"

const studentInputSchema = insertStudentSchema.pick({
  firstName: true,
  lastName: true,
  rollNumber: true,
  email: true,
  department: true,
  division: true,
  year: true,
})

function validationMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid student data"
}

function normalizeStudent(input: typeof studentInputSchema._output) {
  return {
    firstName: input.firstName.trim(),
    lastName: (input.lastName ?? "").trim(),
    rollNumber: input.rollNumber.trim().toUpperCase(),
    email: input.email?.trim().toLowerCase() || null,
    department: input.department.trim().toUpperCase(),
    division: input.division?.toUpperCase() ?? null,
    year: input.year,
    classKey: tryClassKeyFromRoll(input.rollNumber),
  }
}

function checkRollFields(student: ReturnType<typeof normalizeStudent>) {
  try {
    const parsed = parseRollNumber(student.rollNumber)
    if (parsed.department && parsed.department !== student.department) {
      return `Department does not match roll number (roll says ${parsed.department})`
    }
    if (student.division && parsed.division !== student.division) {
      return `Division does not match roll number (roll says ${parsed.division})`
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid roll number"
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return apiError("Unauthorized", 401)
    if (user.tier !== "super_admin") return apiError("Forbidden", 403)

    const parsed = studentInputSchema.safeParse(await request.json())
    if (!parsed.success) return apiError(validationMessage(parsed.error), 400)

    const student = normalizeStudent(parsed.data)
    const rollError = checkRollFields(student)
    if (rollError) return apiError(rollError, 400)

    const created = await createStudent(student)
    await createAuditLog({
      action: "student.created",
      actorId: user.id,
      targetType: "student",
      targetId: created.id,
      details: {
        rollNumber: created.rollNumber,
        email: created.email,
        department: created.department,
      },
    })
    return apiSuccess(created, 201)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(
        "A student with that roll number or email already exists",
        409
      )
    }
    return apiError(getErrorMessage(error, "Could not create student"), 500)
  }
}
