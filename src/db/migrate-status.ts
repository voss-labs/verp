import { config } from "dotenv"
config({ path: ".env.local" })

import { Pool, neonConfig } from "@neondatabase/serverless"
import ws from "ws"
import * as fs from "fs"
import * as path from "path"

neonConfig.webSocketConstructor = ws

const MIGRATIONS_DIR = path.join(__dirname, "migrations")

async function run() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })

  try {
    await pool.query("SELECT 1 FROM _migrations LIMIT 1")
  } catch {
    console.log("Migration table does not exist yet. Run db:migrate first.")
    await pool.end()
    return
  }

  const { rows: applied } = await pool.query(
    "SELECT filename FROM _migrations ORDER BY filename"
  )
  const appliedSet = new Set(applied.map((r) => r.filename))

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("0000"))
    .sort()

  console.log("\nMigration Status:")
  let pendingCount = 0

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  [applied]  ${file}`)
    } else {
      console.log(`  [pending]  ${file}`)
      pendingCount++
    }
  }

  console.log(
    `\n  Total: ${files.length} | Applied: ${files.length - pendingCount} | Pending: ${pendingCount}\n`
  )
  await pool.end()
}

run()
