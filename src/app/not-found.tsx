"use client"

import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          We can&apos;t find that page!
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="bg-foreground text-background inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
