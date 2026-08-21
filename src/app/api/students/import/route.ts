import { NextRequest } from "next/server"
import { z } from "zod"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { rollsInScope } from "@/lib/scope"
import { tryClassKeyFromRoll } from "@/lib/class-key"
import { createStudent, createAuditLog } from "@/db/queries"
import { createImportBatch } from "@/db/queries/import-batches"
import { db } from "@/db"
import { students } from "@/db/schema"
import { inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

// Mirrors the expected CSV columns from the issue spec
const importRowSchema = z.object({
  rollNumber: z.string().min(1, "Roll number is required"),
  firstName: z.string().min(1, "First name is required"),
  // Single-word names are common; last name is optional and stored as "".
  lastName: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
  department: z.string().min(1, "Department is required"),
  division: z.enum(["A", "B", "C"]).optional(),
  year: z.enum(["FE", "SE", "TE", "BE"]),
})

const importBodySchema = z.object({
  rows: z.array(importRowSchema).min(1, "No rows provided"),
  file: z
    .object({
      name: z.string().min(1).max(255),
      size: z.number().int().nonnegative().optional(),
    })
    .optional(),
})

function rosterScopeLabel(rows: { department: string }[]): string {
  const depts = [...new Set(rows.map((r) => r.department.trim().toUpperCase()))]
  return depts.length === 1 ? depts[0] : "institution"
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    // Creating student records is a student write, and saying so is the point:
    // isStaff() let any staff account through regardless of what the permission
    // model said about them, so revoking student:update in the console changed
    // nothing here. Scope is still checked per row below.
    if (!user || !can(user, "student:update")) return apiError("Forbidden", 403)

    const body = await req.json()
    const parsed = importBodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid import data", 400)
    }

    const { rows } = parsed.data

    // ── 1. Detect intra-batch duplicate roll numbers ──────────────────────
    const rollNumberCounts = new Map<string, number[]>()
    rows.forEach((row, idx) => {
      const existing = rollNumberCounts.get(row.rollNumber) ?? []
      existing.push(idx)
      rollNumberCounts.set(row.rollNumber, existing)
    })

    // ── 2. Check DB for already-existing roll numbers ─────────────────────
    const allRollNumbers = rows.map((r) => r.rollNumber)
    const existingInDb = await db
      .select({
        rollNumber: students.rollNumber,
        classKey: students.classKey,
      })
      .from(students)
      .where(inArray(students.rollNumber, allRollNumbers))

    const dbConflicts = new Set(existingInDb.map((s) => s.rollNumber))

    // Being staff says nothing about WHICH roster you may write. Without this a
    // TR holding one class could post rows creating students for another
    // department entirely — and Import roster is shown to every faculty user,
    // so it was not an unreachable path.
    //
    // Scope is judged on the roll, never on the department and division sent
    // beside it: those are descriptive fields the payload controls, while the
    // roll encodes the cohort and cannot disagree with itself. Where a student
    // already exists their stored class key wins, because a repeater's roll
    // cannot express the cohort they actually sit in.
    const scope = rollsInScope(
      user!,
      allRollNumbers,
      new Map(existingInDb.map((s) => [s.rollNumber.toUpperCase(), s.classKey]))
    )
    if (!scope.ok) {
      // The batch fails whole rather than importing the in-scope part: a
      // half-applied roster is harder to reason about than a refused one, and a
      // forged batch should leave a refusal rather than a partial success.
      const message = `${scope.reason}${scope.offending.length ? " " + scope.offending.join(", ") : ""}`
      await createImportBatch({
        kind: "roster",
        fileName: parsed.data.file?.name ?? "(file name not sent)",
        fileSize: parsed.data.file?.size ?? null,
        rowCount: rows.length,
        skippedCount: rows.length,
        status: "failed",
        errorSummary: message,
        scopeLabel: rosterScopeLabel(rows),
        actorUserId: user.id,
      })
      return apiError(message, 403)
    }

    // ── 3. Classify rows into valid / errored ─────────────────────────────
    type RowError = { row: number; field: string; message: string }
    const errors: RowError[] = []
    const validRows: ((typeof parsed.data.rows)[number] & { _idx: number })[] =
      []

    rows.forEach((row, idx) => {
      const rowNum = idx + 1 // 1-based for display

      // Intra-batch duplicate
      const batchOccurrences = rollNumberCounts.get(row.rollNumber) ?? []
      if (batchOccurrences.length > 1 && batchOccurrences[0] !== idx) {
        errors.push({
          row: rowNum,
          field: "rollNumber",
          message: `Duplicate roll number "${row.rollNumber}" in this import (first seen at row ${batchOccurrences[0] + 1})`,
        })
        return
      }

      // DB conflict
      if (dbConflicts.has(row.rollNumber)) {
        errors.push({
          row: rowNum,
          field: "rollNumber",
          message: `Roll number "${row.rollNumber}" already exists in the database`,
        })
        return
      }

      validRows.push({ ...row, _idx: idx })
    })

    // ── 4. Batch-insert valid rows ────────────────────────────────────────
    let insertedCount = 0
    if (validRows.length > 0) {
      const inserts = validRows.map((r) =>
        createStudent({
          firstName: r.firstName,
          lastName: r.lastName ?? "",
          rollNumber: r.rollNumber,
          email: r.email,
          department: r.department,
          division: r.division ?? null,
          year: r.year,
          // Cohort membership is derived from the roll, so a bulk-imported
          // student lands in their class with no separate linking step.
          classKey: tryClassKeyFromRoll(r.rollNumber),
        })
      )

      const results = await Promise.allSettled(inserts)

      results.forEach((result, i) => {
        const row = validRows[i]
        if (result.status === "fulfilled") {
          insertedCount++
        } else {
          errors.push({
            row: row._idx + 1,
            field: "unknown",
            message:
              result.reason instanceof Error
                ? result.reason.message
                : "Failed to insert row",
          })
        }
      })
    }

    // ── 5. Audit log ──────────────────────────────────────────────────────
    if (insertedCount > 0) {
      await createAuditLog({
        action: "students.bulk_import",
        actorId: user.id,
        targetType: "students",
        details: {
          totalRows: rows.length,
          inserted: insertedCount,
          failed: errors.length,
        },
      })
    }

    await createImportBatch({
      kind: "roster",
      fileName: parsed.data.file?.name ?? "(file name not sent)",
      fileSize: parsed.data.file?.size ?? null,
      rowCount: rows.length,
      insertedCount,
      skippedCount: errors.length,
      status: "committed",
      errorSummary:
        errors.length > 0
          ? errors
              .slice(0, 5)
              .map((e) => `Row ${e.row}: ${e.message}`)
              .join("; ")
          : null,
      scopeLabel: rosterScopeLabel(rows),
      actorUserId: user.id,
    })

    return apiSuccess({
      inserted: insertedCount,
      failed: errors.length,
      errors,
    })
  } catch (err) {
    console.error("Failed to import students:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}
