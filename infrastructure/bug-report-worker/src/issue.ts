import type {
  BugBundle,
  BugContext,
  BugDevice,
  BugLogEntry,
  BugReporter,
} from "./bundle";

const UNKNOWN = "unknown";
const DESCRIPTION_MAX = 4000;
const LOG_BLOCK_MAX = 40_000;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, "<ANTHROPIC_KEY>"],
  [/sk-or-[A-Za-z0-9_-]{20,}/g, "<OPENROUTER_KEY>"],
  [/sk-[A-Za-z0-9_-]{20,}/g, "<OPENAI_KEY>"],
  [/AIza[A-Za-z0-9_-]{30,}/g, "<GOOGLE_KEY>"],
  [/github_pat_[A-Za-z0-9_]{40,}/g, "<GITHUB_PAT>"],
  [/ghp_[A-Za-z0-9]{30,}/g, "<GITHUB_PAT>"],
  [/hf_[A-Za-z0-9]{30,}/g, "<HF_TOKEN>"],
  [/gsk_[A-Za-z0-9]{30,}/g, "<GROQ_KEY>"],
  [/BSA[A-Za-z0-9_-]{20,}/g, "<BRAVE_KEY>"],
  [/xox[aboprs]-[A-Za-z0-9-]{20,}/g, "<SLACK_TOKEN>"],
  [/[Bb]earer\s+[A-Za-z0-9._=-]{15,}/g, "Bearer <TOKEN>"],
  [/postgres(?:ql)?:\/\/[^\s:/@]+:[^\s/@]+@[^\s"']+/gi, "<POSTGRES_URL>"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "<JWT>"],
  [/[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, "<JWT>"],
  [
    /([A-Za-z0-9_.-]{0,40}(?:token|secret|key|password)[A-Za-z0-9_.-]{0,40}\s*[=:]\s*["']?)[A-Za-z0-9+/=_-]{32,}/gi,
    "$1<REDACTED>",
  ],
];

export function reScrub(value: string): string {
  let out = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function clampLen(value: string, max: number): string {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max)} <truncated ${value.length - max} chars>`;
}

function text(value: unknown, max = 200): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value !== "string") return "";
  return clampLen(reScrub(value).replace(/`/g, "'").trim(), max);
}

function field(value: unknown, max = 200): string {
  return text(value, max) || UNKNOWN;
}

function pair(name: unknown, detail: unknown): string {
  const left = text(name, 80);
  const right = text(detail, 40);
  if (!left) return UNKNOWN;
  return right ? `${left} ${right}` : left;
}

export function buildTitle(description: string): string {
  const firstLine = reScrub(description).split("\n")[0].trim();
  return `[bug] ${clampLen(firstLine, 80) || "Bug report"}`;
}

function reporterSection(reporter: BugReporter | undefined): string[] {
  const source = reporter ?? ({} as BugReporter);
  return [
    "## Reporter",
    `- Name: \`${field(source.name, 120)}\``,
    `- Role: \`${field(source.role ?? source.tier, 80)}\``,
    `- Scope: \`${field(source.scopeLabel, 160)}\``,
  ];
}

function environmentSection(device: BugDevice | undefined): string[] {
  const source = device ?? ({} as BugDevice);
  const languages = Array.isArray(source.languages)
    ? source.languages.map((entry) => text(entry, 20)).filter(Boolean)
    : [];
  const connection =
    source.online === false
      ? `${field(source.connection, 40)} (offline)`
      : field(source.connection, 40);
  const dpr = text(source.devicePixelRatio, 10);

  return [
    "## Environment",
    `- Browser: \`${pair(source.browser, source.browserVersion)}\``,
    `- Engine: \`${field(source.engine, 40)}\``,
    `- OS: \`${pair(source.os, source.osVersion)}\``,
    `- Device type: \`${field(source.deviceType, 20)}\``,
    `- Viewport: \`${field(source.viewport, 40)}\``,
    `- Screen: \`${field(source.screen, 40)}\` at \`${dpr ? `${dpr}x` : UNKNOWN}\``,
    `- Theme: \`${field(source.theme, 20)}\``,
    `- Timezone: \`${field(source.timezone, 60)}\``,
    `- Languages: \`${languages.join(", ") || UNKNOWN}\``,
    `- Connection: \`${connection}\``,
    `- CPU cores: \`${field(source.cores, 10)}\``,
    `- Device memory: \`${source.memoryGb ? `${source.memoryGb} GB` : UNKNOWN}\``,
    `- User agent: \`${field(source.userAgent, 400)}\``,
  ];
}

function pageSection(bundle: BugBundle): string[] {
  const context = bundle.context ?? ({} as BugContext);
  return [
    "## Page",
    `- Route: \`${field(context.route, 300)}\` on verp \`${field(context.appVersion, 40)}\``,
    `- Captured: \`${field(context.capturedAt, 40)}\` (received \`${field(bundle.receivedAt, 40)}\`, server \`${field(bundle.serverVersion, 40)}\`)`,
  ];
}

function logSection(logs: BugLogEntry[] | undefined): string[] {
  const entries = Array.isArray(logs) ? logs : [];
  if (entries.length === 0) {
    return ["## Recent errors", "_none captured before the report was filed_"];
  }

  const rendered = entries
    .map((entry) => {
      const at = text(entry?.at, 40) || "?";
      const level = text(entry?.level, 10) || "log";
      return `[${at}] ${level}: ${text(entry?.text, 1000)}`;
    })
    .join("\n");

  return [
    `## Recent errors (${entries.length}, scrubbed)`,
    "```",
    clampLen(rendered, LOG_BLOCK_MAX).replace(/`{3,}/g, "'''"),
    "```",
  ];
}

export function buildIssueBody(bundle: BugBundle, shotUrl: string | null): string {
  const description =
    clampLen(reScrub(bundle.description), DESCRIPTION_MAX) || "_no description given_";

  const lines = [
    "## What went wrong",
    description,
    "",
    ...reporterSection(bundle.reporter),
    "",
    ...environmentSection(bundle.device),
    "",
    ...pageSection(bundle),
    "",
    ...logSection(bundle.logs),
  ];

  if (shotUrl) {
    lines.push("", "## Screenshot", `![screenshot](${shotUrl})`);
  }

  lines.push(
    "",
    "---",
    "_Filed from the VERP dashboard bug reporter. Scrubbed client-side, then again here._",
  );

  return lines.join("\n");
}
