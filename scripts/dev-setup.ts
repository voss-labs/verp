// One command from a fresh clone to a running college.
//
// Ordered the way it is because each step needs the one before it to have
// actually finished: the container reports "started" a moment before Postgres
// will accept a connection, and migrating a database that is not listening
// yet fails in a way that reads like a broken migration.

import { execSync, spawnSync } from "node:child_process"
import { existsSync, copyFileSync } from "node:fs"

const step = (n: number, msg: string) => console.log(`\n[${n}/4] ${msg}`)

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

  step(2, "database container")
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

  step(3, "schema")
  // push builds the whole current schema; --baseline then records the
  // migration files as applied rather than replaying changes the push already
  // contains. Any migration written after this point runs normally.
  run("npx", ["drizzle-kit", "push", "--force"])
  run("npx", ["tsx", "src/db/migrate.ts", "--baseline"])

  step(4, "mock data")
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
