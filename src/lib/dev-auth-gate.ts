// The gate on its own, importing nothing.
//
// Split out because the proxy (Next's middleware) has to ask the same question
// as the server does, and it cannot import the module that answers it: that one
// reaches for the database and for next/headers, neither of which exists in the
// proxy runtime. Two copies of a condition that decides whether authentication
// can be bypassed is exactly the drift worth preventing, so the condition lives
// here alone and both sides import it.

export const DEV_ACTOR_COOKIE = "verp_dev_actor"

/**
 * Whether impersonation is available at all.
 *
 * Three independent locks guard this feature; two of them are here. NODE_ENV
 * must not be "production" — `next build` and `next start` both set it, so a
 * deployed bundle fails regardless of configuration — and VERP_DEV_AUTH must be
 * exactly "1", which nothing sets by accident. The third lock is in
 * next.config.ts, which refuses to build at all when both are present.
 *
 * A function rather than a module constant: a constant is captured once at
 * import, which makes it easy to test something that is not what the running
 * process would actually do.
 */
export function devAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.VERP_DEV_AUTH === "1"
  )
}
