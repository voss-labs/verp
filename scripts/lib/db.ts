import { spawn } from "node:child_process"
import { neon } from "@neondatabase/serverless"
import { spinner } from "@clack/prompts"

interface RunOptions {
  label: string
  command: string
  args: string[]
  dryRun?: boolean
}

function runWithSpinner({
  label,
  command,
  args,
  dryRun,
}: RunOptions): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const s = spinner()
    s.start(label)
    if (dryRun) {
      setTimeout(() => {
        s.stop(`${label} (skipped — dry run)`)
        resolveRun()
      }, 350)
      return
    }
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: true,
    })
    let stderr = ""
    child.stdout?.on("data", () => {})
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", (err) => {
      s.stop(`${label} — failed`)
      rejectRun(err)
    })
    child.on("close", (code) => {
      if (code === 0) {
        s.stop(`${label} — done`)
        resolveRun()
      } else {
        s.stop(`${label} — failed (exit ${code})`)
        if (stderr.trim()) process.stderr.write(stderr)
        rejectRun(new Error(`${command} ${args.join(" ")} exited ${code}`))
      }
    })
  })
}

export async function pushSchema(dryRun = false) {
  await runWithSpinner({
    label: "Pushing schema (drizzle-kit push)",
    command: "npx",
    args: ["drizzle-kit", "push"],
    dryRun,
  })
}

export async function runMigrations(dryRun = false) {
  await runWithSpinner({
    label: "Running SQL migrations",
    command: "npx",
    args: ["tsx", "src/db/migrate.ts"],
    dryRun,
  })
}

export type DbState =
  | { kind: "empty" }
  | { kind: "verp"; tableCount: number }
  | { kind: "foreign"; tables: string[] }
  | { kind: "unreachable"; error: string }

export async function inspectDatabase(url: string): Promise<DbState> {
  try {
    const sql = neon(url)
    const rows = (await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `) as { table_name: string }[]
    const names = rows.map((r) => r.table_name)
    if (names.length === 0) return { kind: "empty" }
    if (names.includes("_migrations")) {
      return { kind: "verp", tableCount: names.length }
    }
    return { kind: "foreign", tables: names }
  } catch (err) {
    return {
      kind: "unreachable",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
