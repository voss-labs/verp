import { config } from "dotenv"
config({ path: ".env.local" })

import { execSync } from "child_process"
import * as path from "path"

async function run() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  console.log("Step 1: Pushing Drizzle schema to database...")
  try {
    execSync("npx drizzle-kit push", { stdio: "inherit" })
  } catch {
    console.error("Failed to push schema")
    process.exit(1)
  }

  console.log("\nStep 2: Running SQL migrations...")
  try {
    execSync(`npx tsx ${path.join(__dirname, "migrate.ts")}`, {
      stdio: "inherit",
      env: { ...process.env },
    })
  } catch {
    console.error("Failed to run migrations")
    process.exit(1)
  }

  console.log("\nDatabase setup complete.")
}

run()
