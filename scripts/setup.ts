import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { color } from "@astrojs/cli-kit"
import open from "open"
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
  DEFAULT_APP_URL,
  ENV_PATH,
  VOSS_DISCOVERY_URL,
  callbackUrl,
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
  SEED_TIERS,
  SeedTier,
  quickSeedRoster,
  seedPerson,
  validateDomain,
  validateEmail,
  validateName,
  validateRoll,
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
    `  VOSS_CLIENT_ID     = ${
      existing.VOSS_CLIENT_ID
        ? color.dim("•••• (set)")
        : color.yellow("not set — sign-in will fail")
    }`,
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
  open(url).catch(() => {
    // ignore — not all environments allow this
  })
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

/**
 * VERP is the relying party, not the identity provider. It cannot mint its own
 * client credentials, so the most this step can do is collect them and say
 * exactly where they come from. Left blank, everything else still works — the
 * app boots and the schema is live; only the sign-in button fails, and it fails
 * with a specific error rather than a mystery.
 */
async function collectVossCredentials() {
  await maybeSay([
    "VERP has no passwords of its own — VOSS is the only way in.",
    "That means it needs a client id and secret registered in vauth.",
  ])

  note(
    [
      "Register VERP as a client in the vauth repo, using this redirect URI:",
      "",
      `  ${color.cyan(callbackUrl())}`,
      "",
      color.dim("The secret is hashed at rest there and shown exactly once."),
      color.dim("You can leave these blank now and fill them in later."),
    ].join("\n"),
    "VOSS client"
  )

  const clientId = ensure(
    await text({
      message: "VOSS_CLIENT_ID (Enter to skip):",
      placeholder: "leave blank to configure later",
      defaultValue: "",
    })
  ) as string

  const clientSecret = clientId
    ? ((await passwordPrompt({
        message: "VOSS_CLIENT_SECRET:",
      })) as string)
    : ""

  if (isCancel(clientSecret)) bail()

  await maybeSay([
    "One more: super admins.",
    "That allowlist is the only bootstrap into the admin console.",
  ])

  const superAdmins = ensure(
    await text({
      message: "SUPER_ADMIN_EMAILS (comma-separated, Enter to skip):",
      placeholder: "you@vit.edu.in",
      defaultValue: "",
    })
  ) as string

  return {
    VOSS_DISCOVERY_URL,
    VOSS_CLIENT_ID: clientId,
    VOSS_CLIENT_SECRET: clientSecret,
    SUPER_ADMIN_EMAILS: superAdmins,
  }
}

/**
 * Seeding is roster work, not account work. There is no password to set here:
 * a seeded row is claimed when its email signs in through VOSS and bindIdentity
 * links the two. Seed nothing and you still get in — you just land roleless on
 * the pending screen.
 */
async function runRosterSeedLoop(directUrl: string | undefined) {
  if (CI_MODE || DRY_RUN || !directUrl) return

  const choice = ensure(
    await select({
      message: "Seed the roster so a VOSS login lands with a role?",
      options: [
        {
          value: "self",
          label: "Just me",
          hint: "one row for your own address — pick its tier",
        },
        {
          value: "quick",
          label: "One of each tier",
          hint: "HOD, coordinator, TR, student on a domain you choose",
        },
        { value: "skip", label: "Skip", hint: "empty roster for now" },
      ],
      initialValue: "self",
    })
  ) as "self" | "quick" | "skip"

  if (choice === "skip") return
  if (choice === "quick") {
    await runQuickSeed(directUrl)
    return
  }

  await maybeSay([
    "Use the address you'll actually sign in with.",
    "Binding is by verified email — anything else will never match.",
  ])

  while (true) {
    const seeded = await seedOnePerson(directUrl)
    if (!seeded) break
    const more = ensure(
      await confirm({ message: "Seed another person?", initialValue: false })
    ) as boolean
    if (!more) break
  }
}

async function runQuickSeed(directUrl: string) {
  const domain = ensure(
    await text({
      message: "Email domain for the demo rows:",
      placeholder: "vit.edu.in",
      initialValue: "vit.edu.in",
      validate: validateDomain,
    })
  ) as string

  const s = spinner()
  s.start("Seeding HOD, coordinator, TR and student rows")
  let result: QuickSeedResult
  try {
    result = await quickSeedRoster(directUrl, domain)
  } catch (err) {
    s.stop("Roster seed failed")
    process.stderr.write(`\n  ${color.red("✗")} ${(err as Error).message}\n\n`)
    return
  }
  s.stop(
    `Roster: ${color.green(`${result.created.length} seeded`)}` +
      (result.skipped.length
        ? `, ${color.yellow(`${result.skipped.length} skipped`)}`
        : "")
  )

  if (result.created.length > 0) {
    note(
      [
        color.bold("Sign in through VOSS with any of these to claim the row."),
        "",
        ...result.created.map(
          (a) => `${color.cyan(a.email.padEnd(26))} ${color.dim(a.detail)}`
        ),
        "",
        color.dim("No passwords exist — VOSS must be able to verify each one."),
      ].join("\n"),
      "Seeded roster"
    )
  }

  if (result.skipped.length > 0) {
    note(
      [
        color.dim("Usually means the row already exists from an earlier run."),
        "",
        ...result.skipped.map(
          (s) =>
            `${color.dim(s.email.padEnd(26))} ${color.dim(truncate(s.reason, 46))}`
        ),
      ].join("\n"),
      "Skipped"
    )
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

async function seedOnePerson(directUrl: string): Promise<boolean> {
  const tier = ensure(
    await select({
      message: "Which tier?",
      options: SEED_TIERS.map((t) => ({
        value: t.value,
        label: t.label,
        hint: t.hint,
      })),
      initialValue: "hod",
    })
  ) as SeedTier

  const name = ensure(
    await text({
      message: "Full name:",
      placeholder: "Harshal More",
      validate: validateName,
    })
  ) as string

  const email = ensure(
    await text({
      message: "Email (the one VOSS will verify):",
      placeholder: "you@vit.edu.in",
      validate: validateEmail,
    })
  ) as string

  // The roll number is the student's whole identity: it encodes cohort, branch
  // and division, and class membership is derived from it rather than typed.
  const rollNumber =
    tier === "student"
      ? (ensure(
          await text({
            message: "Roll number:",
            placeholder: "23108A0054",
            validate: validateRoll,
          })
        ) as string)
      : undefined

  const s = spinner()
  s.start(`Seeding ${color.cyan(email)} as ${color.cyan(tier)}`)
  try {
    const result = await seedPerson(
      { tier, name, email, rollNumber },
      directUrl
    )
    s.stop(
      `${color.green("✓")} ${color.cyan(result.email)} ${color.dim(`(${result.detail})`)}`
    )
    return true
  } catch (err) {
    s.stop(`${color.red("✗")} Could not seed that person`)
    process.stderr.write(`  ${(err as Error).message}\n\n`)
    const retry = ensure(
      await confirm({ message: "Try again?", initialValue: true })
    ) as boolean
    return retry ? seedOnePerson(directUrl) : false
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
    const BETTER_AUTH_URL = DEFAULT_APP_URL
    // Not `voss` — that name is the imported narrator, and shadowing it here
    // would put every later reference in this scope's temporal dead zone.
    const vossEnv = SKIP_VOSS
      ? {
          VOSS_DISCOVERY_URL,
          VOSS_CLIENT_ID: "",
          VOSS_CLIENT_SECRET: "",
          SUPER_ADMIN_EMAILS: "",
        }
      : await collectVossCredentials()
    writeEnv({
      DATABASE_URL,
      DIRECT_URL,
      BETTER_AUTH_SECRET,
      BETTER_AUTH_URL,
      ...vossEnv,
    })
    process.stdout.write(
      `\n  ${color.green("✓")} ${color.dim("wrote")} ${ENV_PATH}\n\n`
    )
    if (!vossEnv.VOSS_CLIENT_ID) {
      process.stdout.write(
        `  ${color.yellow("⚠")} No VOSS client configured — sign-in will fail with\n` +
          `    ${color.dim("INVALID_OAUTH_CONFIGURATION")} until you fill in VOSS_CLIENT_ID\n` +
          `    and VOSS_CLIENT_SECRET in ${color.dim(".env.local")}.\n\n`
      )
    }
  } else {
    process.stdout.write(
      `\n  ${color.green("✓")} ${color.dim("keeping existing")} ${ENV_PATH}\n\n`
    )
  }

  await loadEnvForChildProcesses()

  await ensureDatabaseReady(process.env.DIRECT_URL)
  await applyDatabase()
  await runRosterSeedLoop(process.env.DIRECT_URL)

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
