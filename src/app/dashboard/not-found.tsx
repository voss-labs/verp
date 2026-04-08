import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="mb-2 text-2xl font-bold">Dashboard resource not found</h2>
      <p className="text-muted-foreground mb-6">
        The dashboard page you requested does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="bg-foreground text-background inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
      >
        Back to dashboard
      </Link>
    </main>
  )
}
