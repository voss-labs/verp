import { config } from "dotenv"
config({ path: ".env.local" })

import * as fs from "fs"
import * as path from "path"
import { isLocalPostgres } from "./driver"

// A local container speaks the Postgres wire protocol and the Neon driver does
// not, so the local case needs node-postgres. The hosted case is left on the
// exact client it has always used: this script migrates production, and a
// driver swap there would be a change nobody asked for riding along with a
// developer-experience one.
function makePool(url: string) {
  if (isLocalPostgres(url)) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Pool: PgPool } = require("pg")
    /* eslint-enable @typescript-eslint/no-require-imports */
    return new PgPool({ connectionString: url })
  }
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { Pool: NeonPool, neonConfig } = require("@neondatabase/serverless")
  const ws = require("ws")
  /* eslint-enable @typescript-eslint/no-require-imports */
  neonConfig.webSocketConstructor = ws
  return new NeonPool({ connectionString: url })
}

const MIGRATIONS_DIR = path.join(__dirname, "migrations")

async function run() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const pool = makePool(url)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const { rows: applied } = await pool.query(
    "SELECT filename FROM _migrations ORDER BY filename"
  )
  const appliedSet = new Set(
    applied.map((r: { filename: string }) => r.filename)
  )

  // A fresh checkout can have no migrations at all — that is a valid state, not
  // a crash. drizzle-kit push carries the schema; these files carry the rest.
  const files = fs.existsSync(MIGRATIONS_DIR)
    ? fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql") && !f.startsWith("0000"))
        .sort()
    : []

  const pending = files.filter((f) => !appliedSet.has(f))

  // `drizzle-kit push` builds the whole current schema in one step, so a
  // database created that way is already at head and these files would be
  // re-applying what is there. Baselining records them as done without running
  // them — which is what a fresh local database wants, and what lets a
  // migration written tomorrow still run normally.
  if (process.argv.includes("--baseline")) {
    // Same rule as the seeder: this rewrites the migration ledger, and doing
    // that to a hosted database would tell it changes had been applied that
    // never ran.
    if (!isLocalPostgres(url)) {
      console.error(
        `Refusing to baseline ${new URL(url).hostname} — --baseline is for a ` +
          "freshly pushed local database only."
      )
      await pool.end()
      process.exit(1)
    }
    for (const file of pending) {
      await pool.query("INSERT INTO _migrations (filename) VALUES ($1)", [file])
    }
    console.log(
      pending.length === 0
        ? "Already baselined."
        : `Baselined ${pending.length} migration(s) against the pushed schema.`
    )
    await pool.end()
    return
  }

  if (pending.length === 0) {
    console.log("No pending migrations.")
    await pool.end()
    return
  }

  console.log(`Found ${pending.length} pending migration(s):`)

  for (const file of pending) {
    console.log(`  Running: ${file}`)
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8")
    try {
      await pool.query(content)
      await pool.query("INSERT INTO _migrations (filename) VALUES ($1)", [file])
      console.log(`  [OK] ${file}`)
    } catch (err) {
      console.error(`  [FAIL] ${file}:`, err)
      await pool.end()
      process.exit(1)
    }
  }

  console.log("All migrations applied.")
  await pool.end()
}

run()
