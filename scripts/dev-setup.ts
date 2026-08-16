// One command from a fresh clone to a running college.
//
// Ordered the way it is because each step needs the one before it to have
// actually finished: the container reports "started" a moment before Postgres
// will accept a connection, and migrating a database that is not listening
// yet fails in a way that reads like a broken migration.

import { execSync, spawnSync } from "node:child_process"
import { existsSync, copyFileSync, readFileSync } from "node:fs"
import { isLocalPostgres } from "../src/db/driver"

const step = (n: number, msg: string) => console.log(`\n[${n}/5] ${msg}`)

/**
 * Refuse to touch anything that is not the local container.
 *
 * This runs before the schema push, and that ordering is the whole point. The
 * seeder had this check and the push did not, so a run against a leftover
 * production .env.local sailed through `drizzle-kit push --force` -- which
 * TRUNCATES a table to add a unique constraint -- and only stopped at the last
 * step, after the damage. A guard that fires after the destructive step is not
 * a guard.
 */
function assertLocal(env: Record<string, string>) {
  const targets: [string, string][] = [
    ["DATABASE_URL", env.DATABASE_URL ?? ""],
    ["DIRECT_URL", env.DIRECT_URL ?? env.DATABASE_URL ?? ""],
  ]
  const remote = targets.filter(([, url]) => url && !isLocalPostgres(url))
  if (remote.length === 0) return

  console.error("\n  Refusing to continue.\n")
  for (const [name, url] of remote) {
    let host = url
    try {
      host = new URL(url).hostname
    } catch {}
    console.error(`    ${name} points at ${host}`)
  }
  console.error(`
  This command pushes a schema and rewrites data, and only ever runs against
  the local container. Your .env.local is pointed somewhere else -- most
  likely it is a real environment you were using earlier.

  To set up the local database, move that file aside first:

    mv .env.local .env.local.remote
    npm run dev:setup

  and put it back when you need the hosted one again.
`)
  process.exit(1)
}

/** The env this run will actually use, read the way dotenv would. */
function readEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  if (!existsSync(".env.local")) return out
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  return out
}

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function compose(): string[] {
  // `docker compose` on anything current, `docker-compose` on older installs.
  try {
    execSync("docker compose version", { stdio: "ignore" })
    return ["docker", "compose"]
  } catch {
    try {
      execSync("docker-compose version", { stdio: "ignore" })
      return ["docker-compose"]
    } catch {
      console.error(
        "\nDocker is not available.\n" +
          "Install Docker Desktop (or any Docker engine) and start it, then re-run.\n"
      )
      process.exit(1)
    }
  }
}

async function main() {
  step(1, "environment")
  if (!existsSync(".env.local")) {
    copyFileSync(".env.development.example", ".env.local")
    console.log("  created .env.local from .env.development.example")
  } else {
    console.log("  .env.local already exists, leaving it alone")
  }

  step(2, "checking the target is local")
  assertLocal(readEnvLocal())
  console.log("  local container, safe to proceed")

  step(3, "database container")
  const [bin, ...sub] = compose()
  run(bin, [...sub, "up", "-d"])

  process.stdout.write("  waiting for postgres")
  const deadline = Date.now() + 60_000
  for (;;) {
    const r = spawnSync(
      bin,
      [
        ...sub,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "verp",
        "-d",
        "verp",
      ],
      { stdio: "ignore" }
    )
    if (r.status === 0) break
    if (Date.now() > deadline) {
      console.error("\n  postgres did not become ready within 60s.")
      console.error(`  check: ${bin} ${sub.join(" ")} logs postgres`)
      process.exit(1)
    }
    process.stdout.write(".")
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.log(" ready")

  step(4, "schema")
  // push builds the whole current schema; --baseline then records the
  // migration files as applied rather than replaying changes the push already
  // contains. Any migration written after this point runs normally.
  run("npx", ["drizzle-kit", "push", "--force"])
  run("npx", ["tsx", "src/db/migrate.ts", "--baseline"])

  step(5, "mock data")
  run("npx", ["tsx", "scripts/seed-dev.ts"])

  console.log(`
Ready. Start the app:

  npm run dev

Then open http://localhost:3000 and choose who you are from the switcher
beside the VOSS mark in the sidebar. No sign-in, no VOSS credentials.

  npm run dev:seed    rewrite the mock data
  npm run dev:down    stop the container (data is kept)
  npm run dev:reset   destroy the container and its data, then start over
`)
}

main()
