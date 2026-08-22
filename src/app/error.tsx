"use client"

import { useState } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)

  console.error(error)

  async function copyDigest() {
    if (!error.digest) return
    try {
      await navigator.clipboard.writeText(error.digest)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-muted-foreground text-sm font-medium">Error</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          Something went wrong!
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
          An unexpected error occurred. Try again, and if the problem persists,
          contact support.
        </p>
        {error.digest && (
          <p className="text-muted-foreground mt-4 font-mono text-xs">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="bg-foreground text-background inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium"
            onClick={reset}
          >
            Try again
          </button>
          {error.digest && (
            <button
              type="button"
              aria-live="polite"
              className="text-foreground inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium"
              onClick={() => {
                void copyDigest()
              }}
            >
              {copied ? "Copied" : "Copy error reference"}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
