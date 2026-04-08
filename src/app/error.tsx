"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error(error)

  const handleTryAgain = () => {
    console.log("Resetting error boundary")
    reset()
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <h2>Something went wrong!</h2>
        <button
          type="button"
          className="bg-foreground text-background mt-4 inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium"
          onClick={handleTryAgain}
        >
          Try again
        </button>
      </div>
    </main>
  )
}
