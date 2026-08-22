import { config } from "dotenv"
config({ path: ".env.local" })

import * as fs from "fs"
import * as path from "path"
import { isLocalPostgres } from "../src/db/driver"

const MIGRATIONS_DIR = path.join(__dirname, "..", "src", "db", "migrations")

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

async function run() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const files = fs.existsSync(MIGRATIONS_DIR)
    ? fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql") && !f.startsWith("0000"))
        .sort()
    : []

  const pool = makePool(url)
  const { rows } = await pool.query("SELECT filename FROM _migrations")
  await pool.end()

  const applied = new Set<string>(
    rows.map((r: { filename: string }) => r.filename)
  )
  const missing = files.filter((f) => !applied.has(f))
  const unknown = [...applied].filter((f) => !files.includes(f))

  for (const f of missing) console.error(`not applied: ${f}`)
  for (const f of unknown) console.error(`applied but not in the repo: ${f}`)

  if (missing.length > 0 || unknown.length > 0) process.exit(1)
  console.log(`${files.length} migration(s) applied, ledger matches the repo`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
