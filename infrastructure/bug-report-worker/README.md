# VERP bug-report worker

Cloudflare Worker behind the dashboard's "Report a bug" button. It takes a scrubbed report from the VERP server action, stores any attached screenshot in R2, and opens a GitHub issue on `voss-labs/verp` using a fine-grained PAT held server-side. Nobody filing a bug needs a GitHub account or a token.

The browser never talks to this Worker. There is no CORS handling here on purpose: the only caller is VERP's own server action, which posts from the server and attaches the reporter's identity from the trusted session. A direct browser call would be a cross-origin request and would fail.

## One-time deploy

```bash
cd infrastructure/bug-report-worker
npm install

# 1. Log in to Cloudflare (opens a browser)
npx wrangler login

# 2. Create the screenshot bucket named in wrangler.toml
npx wrangler r2 bucket create verp-bug-report-shots

# 3. Put the GitHub PAT (scopes below)
npx wrangler secret put GITHUB_TOKEN

# 4. Ship it
npx wrangler deploy
```

Rate limiting is served by a Durable Object declared in `wrangler.toml`; the first `wrangler deploy` runs the `v1` migration that creates the `RateLimiter` class, so there is no separate KV or D1 setup step.

`wrangler deploy` prints the deployed URL at the end. That origin is what VERP needs.

### Optionally attach a custom domain

- Cloudflare dashboard: Workers & Pages -> `verp-bug-report` -> Settings -> Triggers -> Custom Domains -> Add Custom Domain.
- Enter the hostname (Cloudflare must manage the DNS zone). The TLS cert is auto-provisioned.
- Point `VERP_BUG_REPORT_URL` at the new origin and redeploy VERP.

Changing the origin does not break issues that are already filed only if the old origin keeps serving `/shot/:id` — screenshots are embedded as absolute URLs built from the origin the report arrived on. Keep the old hostname routed, or accept that older issues lose their image.

## PAT scopes

Use a **fine-grained** personal access token scoped to the `voss-labs/verp` repository only:

- **Issues**: Read and write
- **Metadata**: Read (GitHub requires it alongside any other scope)
- **Contents**: No access

No `admin:org`, no `workflow`, no `contents`. If the token leaks, the damage is limited to issue spam in one repository — the token cannot read code, push commits, or touch any other repo in the org.

## Wire it into VERP

Set one server-side env var in the VERP app:

```bash
VERP_BUG_REPORT_URL="https://verp-bug-report.<your-subdomain>.workers.dev"
```

The origin only. VERP appends `/report` itself.

It is deliberately **not** `NEXT_PUBLIC_` — the URL stays on the server, and the browser only ever talks to the VERP server action. When the var is unset the feature degrades gracefully: the floating button does not render at all.

## Test without a real deploy

```bash
# 1. Local dev server on http://localhost:8787, with local R2 and DO state
cd infrastructure/bug-report-worker
npx wrangler dev

# 2. In another terminal, run VERP pointed at it
VERP_BUG_REPORT_URL=http://localhost:8787 npm run dev
```

`wrangler dev` runs entirely locally, including R2 and the Durable Object, so screenshots land in `.wrangler/state` rather than a real bucket. The GitHub call is the one thing that still goes out for real, so put a token in `.dev.vars` (gitignored) if you want issues to actually open:

```
GITHUB_TOKEN=github_pat_...
```

Without it the Worker returns `502 github api failed: 401` and VERP surfaces "could not reach GitHub, so nothing was filed" — which is itself a useful path to exercise.

`npx wrangler tail` streams live logs from the deployed Worker in a third terminal.

## How it works

`POST /report` takes VERP's `BugBundle` as JSON and, in order:

1. **Size cap first.** `Content-Length` is checked against `MAX_BODY_BYTES` (3 MB default) *before* anything else, so a body bomb burns bandwidth rather than Worker CPU. Content-Length can lie, so the parsed body is measured again after `JSON.parse`.
2. **Rate limit.** A coarse abuse backstop, not the per-person cap: `DAILY_LIMIT` (500 default) reports per IP per day, counted in a `RateLimiter` Durable Object keyed on `cf-connecting-ip`. The only legitimate caller is the VERP server, so that IP is VERP's egress address and the bucket is effectively institution-wide — set it well above real traffic, and treat a `429` as "the URL leaked and someone is flooding it". The per-person cap (5 a day) lives in VERP's server action, where the session says who the reporter actually is. DO storage is strictly serialised per id, so the read-increment-write is atomic; KV would be eventually consistent and a burst could slip past the limit. The daily bucket is keyed on the UTC day index and resets lazily on the first request after rollover, so no alarm scheduler is needed and IPs that never come back never cost anything. Over the limit returns `429` with a `retry-after` header.
3. **Screenshot.** Optional, and only ever present because the reporter explicitly attached one — VERP never captures the screen on its own. The mime must be `image/png`, `image/jpeg` or `image/webp`, and the decoded size must stay under `MAX_SCREENSHOT_BYTES` (1.5 MB). The size is computed from the base64 length *before* decoding, so an oversized attachment never gets allocated. The bytes go to R2 under a random `crypto.randomUUID()` key with the correct content type, and the issue body embeds `![screenshot](<origin>/shot/<id>)`.
4. **Second scrub.** Every field is masked again with the same secret patterns VERP already applied client-side. Defense in depth: the Worker is a public endpoint and cannot assume its caller scrubbed anything. Values interpolated into markdown code spans also get backticks and fence runs neutralised so a crafted payload cannot inject markdown into the issue.
5. **File the issue.** `POST` to the GitHub REST API with labels `bug` and `auto-filed`, under a 10s `AbortSignal.timeout` so a hung upstream cannot hold the request open for the full CPU budget. If GitHub rejects the call, an already-stored screenshot is deleted rather than left orphaned in the bucket.

Success returns `{ ok, issue_url, issue_number, rate_limit_remaining }`. Failures return a distinct status — `400` bad bundle, `413` too large, `429` rate limited, `502` GitHub refused — with an `error` string VERP turns into a human message.

`GET /shot/:id` streams a stored screenshot back from R2 with its stored content type and a one-year immutable `Cache-Control`, and `404`s on anything that is not a well-formed key it holds. The Worker is the only reader of the bucket, so **the bucket stays private** — there is no public R2 access to configure, and nothing is reachable except through an id that only appears in the issue it belongs to.

### Configuration

| Binding / var | Where | Default |
| --- | --- | --- |
| `GITHUB_TOKEN` | secret, `wrangler secret put` | none, required |
| `RATE_LIMITER` | Durable Object | `RateLimiter` class |
| `SHOTS` | R2 bucket | `verp-bug-report-shots` |
| `REPO_OWNER` | var | `voss-labs` |
| `REPO_NAME` | var | `verp` |
| `DAILY_LIMIT` | var | `500` (per-IP backstop, not the per-person cap) |
| `MAX_BODY_BYTES` | var | `3000000` |
| `MAX_SCREENSHOT_BYTES` | var | `1500000` |

## Layout

| File | Holds |
| --- | --- |
| `src/index.ts` | routing, size caps, rate-limit call, R2 read/write, the GitHub call |
| `src/issue.ts` | the second scrub pass and the markdown issue body |
| `src/bundle.ts` | the `BugBundle` types, mirrored from VERP |
| `src/rate-limiter.ts` | the `RateLimiter` Durable Object |

This Worker is not part of the Next.js build. The repo's root `tsconfig.json` excludes `infrastructure`, and the root `eslint.config.mjs` ignores `infrastructure/**`, so `npm run typecheck` and `npm run lint` at the repo root never sweep it up. It has its own `tsconfig.json` and its own `npm run typecheck`.

## Keeping the duplicated pieces in sync

`SECRET_PATTERNS` in `src/issue.ts` is a **deliberate duplicate** of the list in VERP's `src/lib/bug-report.ts`. The two must stay identical, and there is no import to enforce it: this Worker is a standalone deployment with its own build, and reaching across into the Next.js app would couple two things that ship separately.

The same goes for `src/bundle.ts`, which mirrors the types in `src/lib/bug-report.ts` by hand, and for `MAX_SCREENSHOT_BYTES`, which mirrors the constant of the same name in that file. When the bundle shape, the pattern list, or the screenshot cap changes on the VERP side, change it here too and redeploy.
