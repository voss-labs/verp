import type { BugBundle, BugScreenshot } from "./bundle";
import { buildIssueBody, buildTitle } from "./issue";

export { RateLimiter } from "./rate-limiter";

export interface Env {
  GITHUB_TOKEN: string;
  RATE_LIMITER: DurableObjectNamespace;
  SHOTS: R2Bucket;
  REPO_OWNER?: string;
  REPO_NAME?: string;
  DAILY_LIMIT?: string;
  MAX_BODY_BYTES?: string;
  MAX_SCREENSHOT_BYTES?: string;
}

const DEFAULT_OWNER = "voss-labs";
const DEFAULT_REPO = "verp";
const DEFAULT_DAILY_LIMIT = "500";
const DEFAULT_MAX_BODY_BYTES = "3000000";
const DEFAULT_MAX_SCREENSHOT_BYTES = "1500000";

const SHOT_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const SHOT_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/;

function json(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

function base64Bytes(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface RateLimitResp {
  ok: boolean;
  remaining: number;
  reset_in_seconds: number;
}

async function rateLimitCheck(env: Env, ip: string): Promise<RateLimitResp> {
  const limit = parseInt(env.DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT, 10);
  const id = env.RATE_LIMITER.idFromName(ip);
  const stub = env.RATE_LIMITER.get(id);
  const resp = await stub.fetch(`https://do/?limit=${limit}`);
  return (await resp.json()) as RateLimitResp;
}

async function storeScreenshot(
  env: Env,
  shot: BugScreenshot,
): Promise<{ key: string } | { error: string }> {
  const mime = typeof shot.mime === "string" ? shot.mime.toLowerCase().trim() : "";
  const extension = SHOT_EXTENSIONS[mime];
  if (!extension) {
    const allowed = Object.keys(SHOT_EXTENSIONS).join(", ");
    return { error: `unsupported screenshot type (allowed: ${allowed})` };
  }

  const data = shot.dataBase64;
  if (typeof data !== "string" || data.length === 0) {
    return { error: "screenshot data missing" };
  }

  const maxShotBytes = parseInt(env.MAX_SCREENSHOT_BYTES ?? DEFAULT_MAX_SCREENSHOT_BYTES, 10);
  if (base64Bytes(data) > maxShotBytes) {
    return { error: `screenshot too large (max ${maxShotBytes} bytes)` };
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(data);
  } catch {
    return { error: "screenshot is not valid base64" };
  }
  if (bytes.byteLength > maxShotBytes) {
    return { error: `screenshot too large (max ${maxShotBytes} bytes)` };
  }

  const key = `${crypto.randomUUID()}.${extension}`;
  await env.SHOTS.put(key, bytes, { httpMetadata: { contentType: mime } });
  return { key };
}

async function serveScreenshot(env: Env, key: string): Promise<Response> {
  if (!SHOT_KEY.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.SHOTS.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { status: 200, headers });
}

async function createIssue(env: Env, title: string, body: string): Promise<Response> {
  const owner = env.REPO_OWNER ?? DEFAULT_OWNER;
  const repo = env.REPO_NAME ?? DEFAULT_REPO;
  return fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "verp-bug-report-worker",
    },
    body: JSON.stringify({ title, body, labels: ["bug", "auto-filed"] }),
    signal: AbortSignal.timeout(10_000),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/shot/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("GET /shot/:id", { status: 405 });
      }
      return serveScreenshot(env, url.pathname.slice("/shot/".length));
    }

    if (request.method !== "POST") {
      return new Response("POST /report with a JSON body", { status: 405 });
    }

    if (url.pathname !== "/report") {
      return new Response("Not found", { status: 404 });
    }

    const maxBytes = parseInt(env.MAX_BODY_BYTES ?? DEFAULT_MAX_BODY_BYTES, 10);
    const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
    if (contentLength > maxBytes) {
      return json({ error: `payload too large (max ${maxBytes} bytes)` }, 413);
    }

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const rl = await rateLimitCheck(env, ip);
    if (!rl.ok) {
      return json(
        {
          error: "rate limit exceeded",
          limit_per_day: parseInt(env.DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT, 10),
          retry_after_seconds: rl.reset_in_seconds,
        },
        429,
        { "retry-after": String(rl.reset_in_seconds) },
      );
    }

    let bundle: BugBundle;
    try {
      bundle = (await request.json()) as BugBundle;
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }

    if (!bundle || typeof bundle !== "object") {
      return json({ error: "invalid bundle" }, 400);
    }

    const parsedLen = JSON.stringify(bundle).length;
    if (parsedLen > maxBytes) {
      return json({ error: `parsed payload too large (${parsedLen} bytes)` }, 413);
    }

    if (!bundle.description || typeof bundle.description !== "string") {
      return json({ error: "description required" }, 400);
    }

    let shotKey: string | null = null;
    if (bundle.screenshot) {
      const stored = await storeScreenshot(env, bundle.screenshot);
      if ("error" in stored) {
        return json({ error: stored.error }, 400);
      }
      shotKey = stored.key;
    }

    const title = buildTitle(bundle.description);
    const body = buildIssueBody(bundle, shotKey ? `${url.origin}/shot/${shotKey}` : null);

    const ghResp = await createIssue(env, title, body);
    if (!ghResp.ok) {
      const detail = await ghResp.text();
      if (shotKey) await env.SHOTS.delete(shotKey);
      return json(
        { error: `github api failed: ${ghResp.status}`, detail: detail.slice(0, 500) },
        502,
      );
    }

    const ghJson = (await ghResp.json()) as { html_url?: string; number?: number };
    return json(
      {
        ok: true,
        issue_url: ghJson.html_url ?? "",
        issue_number: ghJson.number ?? 0,
        rate_limit_remaining: rl.remaining,
      },
      200,
    );
  },
};
