import { note } from "@clack/prompts"
import { color } from "@astrojs/cli-kit"

const NEON_CONSOLE = "https://console.neon.tech"

export const NEON_REGIONS = [
  {
    value: "aws-us-east-1",
    label: "AWS US East (N. Virginia)",
    hint: "lowest latency for North America",
  },
  {
    value: "aws-us-east-2",
    label: "AWS US East (Ohio)",
    hint: "alternate US East",
  },
  {
    value: "aws-us-west-2",
    label: "AWS US West (Oregon)",
    hint: "US West Coast",
  },
  {
    value: "aws-eu-central-1",
    label: "AWS Europe (Frankfurt)",
    hint: "Europe",
  },
  {
    value: "aws-eu-west-2",
    label: "AWS Europe (London)",
    hint: "UK / Western Europe",
  },
  {
    value: "aws-ap-southeast-1",
    label: "AWS Asia Pacific (Singapore)",
    hint: "Southeast Asia",
  },
  {
    value: "aws-ap-southeast-2",
    label: "AWS Asia Pacific (Sydney)",
    hint: "Australia",
  },
  {
    value: "azure-eastus2",
    label: "Azure East US 2 (Virginia)",
    hint: "Azure US",
  },
] as const

export function showOverview() {
  const dim = color.dim
  const b = color.bold
  const lines = [
    `${b("1.")} Open ${color.cyan(NEON_CONSOLE)}`,
    `   ${dim("Sign in with Google, GitHub, or email — free tier is fine.")}`,
    "",
    `${b("2.")} Click ${b("New Project")} (or pick an existing one).`,
    `   ${dim('Project name: anything (e.g. "verp"). Database name: leave as "neondb".')}`,
    "",
    `${b("3.")} Pick a ${b("region")} closest to you.`,
    `   ${dim("I'll ask which one in a moment so I can recommend the right value.")}`,
    "",
    `${b("4.")} Postgres version: ${b("17")} ${dim("(default — leave it).")}`,
    "",
    `${b("5.")} After the project is created, you'll land on the dashboard.`,
    `   ${dim('Look for the "Connection Details" widget on the right.')}`,
  ]
  note(lines.join("\n"), "Neon — create a project")
}

export function showRegionTip(region: string) {
  const match = NEON_REGIONS.find((r) => r.value === region)
  if (!match) return
  note(
    `${color.dim("Selected region:")} ${color.bold(match.label)}\n${color.dim("When creating the Neon project, pick this same region from the dropdown.")}`,
    "Region"
  )
}

export function showConnectionStringGuide() {
  const b = color.bold
  const dim = color.dim
  const ok = color.green
  const warn = color.yellow

  const lines = [
    `In the ${b("Connection Details")} widget you'll see a connection string.`,
    `Use the ${b("dropdown")} above the string to switch between two modes:`,
    "",
    `${ok("●")} ${b("Pooled connection")}  ${dim("→ goes in DATABASE_URL")}`,
    `   ${dim("Looks like:")} ${color.cyan("postgresql://user:****@ep-xxx-")}${warn("pooler")}${color.cyan(".region.aws.neon.tech/neondb?sslmode=require")}`,
    `   ${dim("Notice the")} ${warn("-pooler")} ${dim("in the host. Used by the app at runtime (handles many concurrent connections).")}`,
    "",
    `${ok("●")} ${b("Direct connection")}   ${dim("→ goes in DIRECT_URL")}`,
    `   ${dim("Looks like:")} ${color.cyan("postgresql://user:****@ep-xxx.region.aws.neon.tech/neondb?sslmode=require")}`,
    `   ${dim("No")} ${warn("-pooler")}${dim(". Used by Drizzle Studio and migrations (needs a stable single connection).")}`,
    "",
    `${b("Both")} URLs must end with ${color.cyan("?sslmode=require")} ${dim("(Neon adds this by default).")}`,
    "",
    `${dim("Tip: copy each one with the clipboard icon next to the field.")}`,
  ]
  note(lines.join("\n"), "Neon — copy your two connection strings")
}

export function consoleUrl(): string {
  return NEON_CONSOLE
}
