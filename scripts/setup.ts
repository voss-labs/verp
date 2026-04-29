import { exec, spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { color } from "@astrojs/cli-kit"
import {
  cancel,
  confirm,
  intro,
  isCancel,
  note,
  outro,
  password as passwordPrompt,
  select,
  spinner,
  text,
} from "@clack/prompts"

import { inspectDatabase, runMigrations, pushSchema } from "./lib/db"
import {
  ENV_PATH,
  envExists,
  generateAuthSecret,
  maskUrl,
  readEnv,
  validateDirectUrl,
  validatePooledUrl,
  writeEnv,
} from "./lib/env"
import {
  NEON_REGIONS,
  consoleUrl,
  showConnectionStringGuide,
  showOverview,
  showRegionTip,
} from "./lib/neon-guide"
import {
  QuickSeedResult,
  RoleOption,
  createUser,
  fetchRoles,
  quickSeedDefaults,
  validateEmail,
  validateName,
  validatePassword,
} from "./lib/users"
import { banner, bannerAbort, voss } from "./lib/voss"

const DRY_RUN = process.argv.includes("--dry-run")
const CI_MODE =
  process.argv.includes("--ci") ||
  process.argv.includes("--non-interactive") ||
  process.env.CI === "true"
const SKIP_VOSS =
  process.argv.includes("--skip-voss") || CI_MODE || !process.stdout.isTTY

const REQUIRED_NODE_MAJOR = 20

function checkNodeVersion() {
  const major = parseInt(process.versions.node.split(".")[0], 10)
  if (major >= REQUIRED_NODE_MAJOR) return
  process.stderr.write(
    `\n${color.red("✗")} Node ${REQUIRED_NODE_MAJOR}+ required (you have ${process.versions.node}).\n` +
      `  Install via nvm: ${color.cyan("nvm install 20 && nvm use 20")}\n\n`
  )
  process.exit(1)
}

function bail(reason = "Setup cancelled."): never {
  cancel(reason)
  bannerAbort()
  process.exit(0)
}

function ensure<T>(value: T | symbol): T {
  if (isCancel(value)) bail()
  return value as T
}

async function maybeSay(messages: string | string[]) {
  if (SKIP_VOSS) return
  await voss(messages)
}

async function decideOnExistingEnv(): Promise<"keep" | "overwrite"> {
  if (!envExists()) return "overwrite"
  const existing = readEnv()
  const summary = [
    existing.DATABASE_URL &&
      `  DATABASE_URL = ${color.dim(maskUrl(existing.DATABASE_URL))}`,
    existing.DIRECT_URL &&
      `  DIRECT_URL   = ${color.dim(maskUrl(existing.DIRECT_URL))}`,
    existing.BETTER_AUTH_SECRET &&
      `  BETTER_AUTH_SECRET = ${color.dim("•••• (set)")}`,
  ]
    .filter(Boolean)
    .join("\n")

  await maybeSay([
    "I found an existing .env.local.",
    "I can keep it and just run migrations, or overwrite it from scratch.",
  ])

  if (summary) process.stdout.write("\n" + summary + "\n\n")

  const action = ensure(
    await select({
      message: "What should I do?",
      options: [
        {
          value: "keep",
          label: "Keep current .env.local",
          hint: "skip to migrations",
        },
        {
          value: "overwrite",
          label: "Overwrite it",
          hint: "re-run full setup",
        },
        { value: "cancel", label: "Cancel" },
      ],
    })
  ) as "keep" | "overwrite" | "cancel"

  if (action === "cancel") bail()
  return action
}

async function collectNeonCredentials() {
  showOverview()

  const region = ensure(
    await select({
      message: "Which region are you creating the Neon project in?",
      options: NEON_REGIONS.map((r) => ({
        value: r.value,
        label: r.label,
        hint: r.hint,
      })),
      initialValue: "aws-us-east-1",
    })
  ) as string

  showRegionTip(region)

  const open = ensure(
    await confirm({
      message: `Open ${consoleUrl()} in your browser now?`,
      initialValue: true,
    })
  ) as boolean

  if (open) openInBrowser(consoleUrl())
  else
    process.stdout.write(
      `\n  ${color.dim("→ visit:")} ${color.cyan(consoleUrl())}\n`
    )

  showConnectionStringGuide()

  const databaseUrl = ensure(
    await text({
      message: "Paste your POOLED connection string (DATABASE_URL):",
      placeholder:
        "postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require",
      validate: validatePooledUrl,
    })
  ) as string

  const directUrl = ensure(
    await text({
      message: "Paste your DIRECT (unpooled) connection string (DIRECT_URL):",
      placeholder:
        "postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require",
      validate: validateDirectUrl,
    })
  ) as string

  return { DATABASE_URL: databaseUrl, DIRECT_URL: directUrl }
}

function openInBrowser(url: string) {
  const platform = process.platform
  try {
    if (platform === "win32") {
      // 'start' is a cmd.exe built-in, not an executable — must use shell
      exec(`start "" "${url}"`);
    } else {
      const command = platform === "darwin" ? "open" : "xdg-open"
      spawn(command, [url], { stdio: "ignore", detached: true }).unref()
    }
  } catch {
    // ignore — not all environments allow this
  }
}

async function ensureDatabaseReady(directUrl: string | undefined) {
  if (DRY_RUN || !directUrl) return
  const s = spinner()
  s.start("Checking database state")
  const state = await inspectDatabase(directUrl)

  if (state.kind === "unreachable") {
    s.stop("Could not reach database")
    process.stderr.write(
      `\n  ${color.red("✗")} ${state.error}\n` +
        `  Check your DATABASE_URL / DIRECT_URL.\n\n`
    )
    process.exit(1)
  }

  if (state.kind === "empty") {
    s.stop("Database is empty — fresh setup")
    return
  }

  if (state.kind === "verp") {
    s.stop(
      `Database already has verp schema (${state.tableCount} tables) — will be idempotent`
    )
    return
  }

  // foreign
  s.stop("Database already has non-verp tables")
  const sample = state.tables
    .slice(0, 6)
    .map((t) => color.dim(t))
    .join(", ")
  const more =
    state.tables.length > 6
      ? color.dim(` +${state.tables.length - 6} more`)
      : ""
  process.stderr.write(
    `\n  ${color.yellow("⚠")} Found ${state.tables.length} tables that don't look like verp:\n` +
      `    ${sample}${more}\n` +
      `  Pushing the schema could conflict with existing tables.\n\n`
  )
  if (CI_MODE) {
    process.stderr.write(
      `  ${color.red("✗")} Refusing to continue in --ci mode. Use a fresh Neon project.\n\n`
    )
    process.exit(1)
  }
  const proceed = ensure(
    await confirm({
      message:
        "Continue anyway? (only safe if you know these tables won't clash)",
      initialValue: false,
    })
  ) as boolean
  if (!proceed) bail("Aborted to protect your existing database.")
}

async function applyDatabase() {
  await maybeSay(["Wiring up the database now. This takes a few seconds."])
  await pushSchema(DRY_RUN)
  await runMigrations(DRY_RUN)
}

async function runUserCreationLoop(directUrl: string | undefined) {
  if (CI_MODE || DRY_RUN || !directUrl) return

  const choice = ensure(
    await select({
      message: "How do you want to set up users?",
      options: [
        {
          value: "quick",
          label: "Quick seed",
          hint: "1 admin + 1 faculty + 1 student with random passwords",
        },
        {
          value: "custom",
          label: "Create custom users",
          hint: "pick role, name, email, and password yourself",
        },
        { value: "skip", label: "Skip", hint: "no users for now" },
      ],
      initialValue: "quick",
    })
  ) as "quick" | "custom" | "skip"

  if (choice === "skip") return

  let roles: RoleOption[]
  try {
    roles = await fetchRoles(directUrl)
  } catch (err) {
    process.stderr.write(
      `\n  ${color.red("✗")} Could not load roles: ${(err as Error).message}\n\n`
    )
    return
  }

  if (roles.length === 0) {
    process.stderr.write(
      `\n  ${color.yellow("⚠")} No roles found in role_definitions. Skipping user creation.\n\n`
    )
    return
  }

  if (choice === "quick") {
    await runQuickSeed(directUrl)
    return
  }

  await maybeSay([
    "Let's create your account.",
    "I'll ask for a role, name, email, and password.",
  ])

  while (true) {
    const created = await createOneUser(roles, directUrl)
    if (!created) break
    const more = ensure(
      await confirm({
        message: "Create another user?",
        initialValue: false,
      })
    ) as boolean
    if (!more) break
  }
}

async function runQuickSeed(directUrl: string) {
  const s = spinner()
  s.start("Seeding admin, faculty, student with random passwords")
  let result: QuickSeedResult
  try {
    result = await quickSeedDefaults(directUrl)
  } catch (err) {
    s.stop("Quick seed failed")
    process.stderr.write(`\n  ${color.red("✗")} ${(err as Error).message}\n\n`)
    return
  }
  s.stop(
    `Quick seed: ${color.green(`${result.created.length} created`)}` +
      (result.skipped.length
        ? `, ${color.yellow(`${result.skipped.length} skipped`)}`
        : "")
  )

  if (result.created.length > 0) {
    const lines = [
      color.bold("Save these now — they won't be shown again."),
      "",
      ...result.created.map(
        (a) =>
          `${color.bold(a.roleName.padEnd(8))} ${color.cyan(a.email.padEnd(24))} ${color.yellow(a.password)}`
      ),
      "",
      color.dim(
        "Passwords are random base64. Log in and change them via the app."
      ),
    ]
    note(lines.join("\n"), "Seeded credentials")
  }

  if (result.skipped.length > 0) {
    const lines = result.skipped.map(
      (s) =>
        `${color.dim(s.email.padEnd(24))} ${color.dim(truncate(s.reason, 50))}`
    )
    note(
      [
        color.dim("Likely cause: account already exists from a previous run."),
        "",
        ...lines,
      ].join("\n"),
      "Skipped"
    )
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

function roleHint(r: RoleOption): string | undefined {
  if (r.roleName === "faculty") return "Teaching role (TR)"
  if (r.description) return r.description
  return undefined
}

async function createOneUser(
  roles: RoleOption[],
  directUrl: string
): Promise<boolean> {
  const roleName = ensure(
    await select({
      message: "What kind of user?",
      options: roles.map((r) => ({
        value: r.roleName,
        label: r.displayName,
        hint: roleHint(r),
      })),
      initialValue:
        roles.find((r) => r.roleName === "admin")?.roleName ??
        roles[0].roleName,
    })
  ) as string

  const name = ensure(
    await text({
      message: "Full name:",
      placeholder: "Harshal More",
      validate: validateName,
    })
  ) as string

  const email = ensure(
    await text({
      message: "Email:",
      placeholder: "you@example.com",
      validate: validateEmail,
    })
  ) as string

  const pw = ensure(
    await passwordPrompt({
      message: "Password (min 8 chars):",
      validate: validatePassword,
    })
  ) as string

  const s = spinner()
  s.start(`Creating ${color.cyan(email)} as ${color.cyan(roleName)}`)
  try {
    await createUser({ name, email, password: pw, roleName }, directUrl)
    s.stop(`${color.green("✓")} Created ${color.cyan(email)} (${roleName})`)
    return true
  } catch (err) {
    s.stop(`${color.red("✗")} Failed to create user`)
    process.stderr.write(`  ${(err as Error).message}\n\n`)
    const retry = ensure(
      await confirm({
        message: "Try again with different details?",
        initialValue: true,
      })
    ) as boolean
    return retry ? createOneUser(roles, directUrl) : false
  }
}

async function offerDevServer() {
  const start = ensure(
    await confirm({
      message: "Start the dev server now (npm run dev)?",
      initialValue: true,
    })
  ) as boolean
  if (!start) return
  process.stdout.write("\n")
  spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true })
}

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8")
    )
    return pkg.version ?? "0.0.0"
  } catch {
    return "0.0.0"
  }
}

async function main() {
  checkNodeVersion()
  banner()
  await maybeSay([
    `Welcome to verp v${getVersion()}.`,
    "I'll wire up your Neon database, generate auth secrets, and run migrations.",
    "Should take about two minutes.",
  ])

  intro(color.bold("verp setup"))

  const action = await decideOnExistingEnv()

  if (action === "overwrite") {
    const { DATABASE_URL, DIRECT_URL } = await collectNeonCredentials()
    const BETTER_AUTH_SECRET = generateAuthSecret()
    const BETTER_AUTH_URL = "http://localhost:3000"
    writeEnv({ DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL })
    process.stdout.write(
      `\n  ${color.green("✓")} ${color.dim("wrote")} ${ENV_PATH}\n\n`
    )
  } else {
    process.stdout.write(
      `\n  ${color.green("✓")} ${color.dim("keeping existing")} ${ENV_PATH}\n\n`
    )
  }

  await loadEnvForChildProcesses()

  await ensureDatabaseReady(process.env.DIRECT_URL)
  await applyDatabase()
  await runUserCreationLoop(process.env.DIRECT_URL)

  outro(color.green("Setup complete."))

  await maybeSay([
    "All wired up.",
    "You can run npm run dev whenever you're ready.",
  ])

  if (!DRY_RUN && !SKIP_VOSS && !CI_MODE) await offerDevServer()
}

async function loadEnvForChildProcesses() {
  // db:push and db:migrate read from process.env, so load .env.local into it
  const env = readEnv()
  for (const [k, v] of Object.entries(env)) {
    if (v && !process.env[k]) process.env[k] = v
  }
}

main().catch((err) => {
  process.stderr.write(`\n${color.red("✗")} ${err.message ?? err}\n`)
  bannerAbort()
  process.exit(1)
})
