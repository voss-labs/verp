import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Which SQL migrations have run. Written by src/db/migrate.ts.
 *
 * Declared here even though no query in the app reads it, because
 * `drizzle-kit push` drops any table it does not find in the schema — and it
 * was dropping this one. The ledger would vanish on every push, the next
 * `db:migrate` would replay every file from the beginning against a database
 * that already had the changes, and whether that failed or silently
 * double-applied depended on the file.
 */
export const migrationsLedger = pgTable("_migrations", {
  id: serial("id").primaryKey(),
  // Named to match what `filename TEXT NOT NULL UNIQUE` in migrate.ts made
  // Postgres call it. Left unnamed, Drizzle looks for its own convention,
  // decides the constraint is missing, and asks whether to TRUNCATE the table
  // to add it — a question `--force` does not answer, so a push simply hangs.
  filename: text("filename").notNull().unique("_migrations_filename_key"),
  appliedAt: timestamp("applied_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
