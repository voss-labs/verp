import { NextRequest } from "next/server"
import { z } from "zod"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { getSessionUser } from "@/lib/session"
import { createStudent, createAuditLog } from "@/db/queries"
import { db } from "@/db"
import { students } from "@/db/schema"
import { inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

// Mirrors the expected CSV columns from the issue spec
const importRowSchema = z.object({
  rollNumber: z.string().min(1, "Roll number is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  department: z.string().min(1, "Department is required"),
  division: z.enum(["A", "B"]).optional(),
  year: z.enum(["FE", "SE", "TE", "BE"]),
  semester: z.string().optional(),
})

const importBodySchema = z.object({
  rows: z.array(importRowSchema).min(1, "No rows provided"),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== "admin") {
      return apiError("Forbidden", 403)
    }

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
      .select({ rollNumber: students.rollNumber })
      .from(students)
      .where(inArray(students.rollNumber, allRollNumbers))

    const dbConflicts = new Set(existingInDb.map((s) => s.rollNumber))

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
          lastName: r.lastName,
          rollNumber: r.rollNumber,
          email: r.email,
          department: r.department,
          division: r.division ?? null,
          year: r.year,
          semester: r.semester ?? null,
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
