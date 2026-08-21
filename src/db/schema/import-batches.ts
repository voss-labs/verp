import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { user } from "./auth"

export const IMPORT_KINDS = ["roster", "faculty", "courses", "marks"] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]

export const IMPORT_STATUSES = ["committed", "failed"] as const
export type ImportStatus = (typeof IMPORT_STATUSES)[number]

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<ImportKind>().notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size"),
    rowCount: integer("row_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    status: text("status").$type<ImportStatus>().notNull(),
    errorSummary: text("error_summary"),
    scopeLabel: text("scope_label").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "import_batches_kind_check",
      sql`${t.kind} IN ('roster', 'faculty', 'courses', 'marks')`
    ),
    check(
      "import_batches_status_check",
      sql`${t.status} IN ('committed', 'failed')`
    ),
    index("import_batches_created_idx").on(t.createdAt),
    index("import_batches_kind_created_idx").on(t.kind, t.createdAt),
    index("import_batches_actor_idx").on(t.actorUserId),
    index("import_batches_scope_idx").on(t.scopeLabel),
  ]
)
