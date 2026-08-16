import type { NextConfig } from "next"

// The third lock on dev impersonation (lib/dev-auth.ts explains the other two).
// The runtime gate already refuses when NODE_ENV is "production", but a refusal
// at runtime is a bug report from a user; this is a build that never ships.
if (process.env.NODE_ENV === "production" && process.env.VERP_DEV_AUTH) {
  throw new Error(
    "VERP_DEV_AUTH is set for a production build. It bypasses sign-in and must " +
      "never be present in a deployed environment — unset it and rebuild."
  )
}

const nextConfig: NextConfig = {
  // Required at runtime by the local-Postgres branch in src/db/index.ts and
  // never by the hosted one. Listing it here keeps it out of the compiled
  // server bundle, so a production deploy carries no trace of the local path.
  serverExternalPackages: ["pg"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ]
  },
}

export default nextConfig
