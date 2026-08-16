import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import { isLocalPostgres } from "./driver"
import * as schema from "./schema"

// Typed as the Neon database because that is what production is. The local
// driver is API-compatible for everything this codebase does — the one real
// difference is that node-postgres supports transactions and neon-http does
// not, so code written against local must still never assume them, or it will
// work for the contributor and fail in production.
type Db = NeonHttpDatabase<typeof schema>

let _db: Db | null = null

function getDb(): Db {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  if (isLocalPostgres(url)) {
    // Required lazily: production never evaluates this branch, and a top-level
    // import would pull the driver into every server bundle to be unused.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Pool } = require("pg")
    const { drizzle: pgDrizzle } = require("drizzle-orm/node-postgres")
    /* eslint-enable @typescript-eslint/no-require-imports */
    _db = pgDrizzle(new Pool({ connectionString: url }), { schema }) as Db
    return _db
  }

  _db = drizzle(neon(url), { schema })
  return _db
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type Database = typeof db
