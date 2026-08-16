// Which Postgres driver this connection string needs.
//
// Production runs on Neon over HTTP: stateless, no connection to hold open, and
// the right shape for a serverless deploy. That driver speaks Neon's HTTP
// endpoint, not the Postgres wire protocol, so it cannot talk to a Postgres in
// a container — which is what a contributor has, and why local development
// previously needed a Neon account for a database nobody else would ever read.
//
// The rule is deliberately conservative: Neon unless the host is unmistakably a
// local one. Sniffing for ".neon.tech" instead would silently change the driver
// under anyone self-hosting, and a production deploy is not the place to
// discover a driver swap.

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
  // The service name inside docker-compose, for running the app in a container.
  "postgres",
  "db",
])

export function isLocalPostgres(url: string): boolean {
  if (process.env.DATABASE_DRIVER === "pg") return true
  if (process.env.DATABASE_DRIVER === "neon") return false
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}
