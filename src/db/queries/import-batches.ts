import { and, desc, eq, inArray, or, type SQL } from "drizzle-orm"
import { db } from "@/db"
import { importBatches, user } from "@/db/schema"
import type { ImportKind, ImportStatus } from "@/db/schema/import-batches"
import type { Tier } from "@/lib/rbac"

export type ImportBatchScope =
  | { all: true }
  | { actorUserId: string; scopeLabels?: string[] }

export type ImportViewer = {
  id: string
  tier: Tier | null
  deptCodes: string[]
}

/** Who may see which uploads: everything, the department's, or only your own. */
export function importScopeFor(viewer: ImportViewer): ImportBatchScope {
  if (viewer.tier === "super_admin") return { all: true }
  if (viewer.tier === "hod") {
    return { actorUserId: viewer.id, scopeLabels: viewer.deptCodes }
  }
  return { actorUserId: viewer.id }
}

const SELECTION = {
  id: importBatches.id,
  kind: importBatches.kind,
  fileName: importBatches.fileName,
  fileSize: importBatches.fileSize,
  rowCount: importBatches.rowCount,
  insertedCount: importBatches.insertedCount,
  updatedCount: importBatches.updatedCount,
  skippedCount: importBatches.skippedCount,
  status: importBatches.status,
  errorSummary: importBatches.errorSummary,
  scopeLabel: importBatches.scopeLabel,
  actorUserId: importBatches.actorUserId,
  actorName: user.name,
  createdAt: importBatches.createdAt,
}

function scopeCondition(scope: ImportBatchScope): SQL | undefined {
  if ("all" in scope) return undefined
  const own = eq(importBatches.actorUserId, scope.actorUserId)
  if (!scope.scopeLabels?.length) return own
  return or(own, inArray(importBatches.scopeLabel, scope.scopeLabels))
}

export async function createImportBatch(data: {
  kind: ImportKind
  fileName: string
  fileSize?: number | null
  rowCount: number
  insertedCount?: number
  updatedCount?: number
  skippedCount?: number
  status: ImportStatus
  errorSummary?: string | null
  scopeLabel: string
  actorUserId: string
}) {
  const [row] = await db
    .insert(importBatches)
    .values({
      kind: data.kind,
      fileName: data.fileName,
      fileSize: data.fileSize ?? null,
      rowCount: data.rowCount,
      insertedCount: data.insertedCount ?? 0,
      updatedCount: data.updatedCount ?? 0,
      skippedCount: data.skippedCount ?? 0,
      status: data.status,
      errorSummary: data.errorSummary ?? null,
      scopeLabel: data.scopeLabel,
      actorUserId: data.actorUserId,
    })
    .returning()
  return row
}

export async function listImportBatches(params: {
  scope: ImportBatchScope
  kinds?: ImportKind[]
  limit?: number
}) {
  if (params.kinds && params.kinds.length === 0) return []

  const conditions: SQL[] = []
  const scoped = scopeCondition(params.scope)
  if (scoped) conditions.push(scoped)
  if (params.kinds) conditions.push(inArray(importBatches.kind, params.kinds))

  return db
    .select(SELECTION)
    .from(importBatches)
    .leftJoin(user, eq(importBatches.actorUserId, user.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(importBatches.createdAt))
    .limit(params.limit ?? 100)
}

export async function latestImportByKind(
  kind: ImportKind,
  scope: ImportBatchScope
) {
  const conditions: SQL[] = [eq(importBatches.kind, kind)]
  const scoped = scopeCondition(scope)
  if (scoped) conditions.push(scoped)

  const [row] = await db
    .select(SELECTION)
    .from(importBatches)
    .leftJoin(user, eq(importBatches.actorUserId, user.id))
    .where(and(...conditions))
    .orderBy(desc(importBatches.createdAt))
    .limit(1)
  return row ?? null
}
