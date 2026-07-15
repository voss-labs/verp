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
  const appliedSet = new Set(applied.map((r) => r.filename))

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("0000"))
    .sort()

  const pending = files.filter((f) => !appliedSet.has(f))

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
