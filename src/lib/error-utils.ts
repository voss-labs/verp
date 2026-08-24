/**
 * Error Sanitization Utility
 *
 * Prevents leaking internal DB/SQL details to the user.
 * Detects Postgres/Drizzle/connection errors and replaces them with safe messages.
 */

const INTERNAL_ERROR_PATTERNS = [
  // Postgres / SQL errors
  /relation ".*" does not exist/i,
  /column ".*" (does not exist|of relation)/i,
  /duplicate key value violates unique constraint/i,
  /violates foreign key constraint/i,
  /violates not-null constraint/i,
  /violates check constraint/i,
  /syntax error at or near/i,
  /invalid input syntax/i,
  /deadlock detected/i,
  /current transaction is aborted/i,

  // Connection / network errors
  /connection refused/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /timeout exceeded/i,
  /too many connections/i,
  /connection terminated/i,

  // Drizzle / ORM internals
  /DrizzleError/i,
  /NeonDbError/i,
  /PostgresError/i,

  // Raw SQL fragments
  /\bSELECT\b.*\bFROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b.*\bSET\b/i,
  /\bDELETE\s+FROM\b/i,

  // Stack trace fragments
  /at\s+\w+\s+\(.*:\d+:\d+\)/,
  /node_modules\//,
]

const SAFE_PREFIXES = [
  "Unauthorized",
  "Forbidden",
  "Not found",
  "Already",
  "Cannot",
  "Invalid",
  "Marks are locked",
  "Batch name already exists",
  "Enrollment not found",
  "Offering not found",
  "Failed to",
]

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (!(error instanceof Error)) return fallback

  const msg = error.message
  if (!msg || msg.trim().length === 0) return fallback

  if (SAFE_PREFIXES.some((prefix) => msg.startsWith(prefix))) {
    return msg
  }

  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(msg))) {
    console.error("[sanitized error]", msg)
    return "A server error occurred. Please try again later."
  }

  if (msg.length > 300) {
    console.error("[sanitized error - long message]", msg)
    return "A server error occurred. Please try again later."
  }

  return msg
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  if ((error as { code?: unknown }).code === "23505") return true
  return (
    error instanceof Error &&
    /duplicate key value violates unique constraint/i.test(error.message)
  )
}
