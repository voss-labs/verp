import { redirect } from "next/navigation"
import { getSessionUser, isUnbound } from "@/lib/session"

export const dynamic = "force-dynamic"

/**
 * The dead end for a real VIT student VOSS authenticated but VERP cannot place.
 *
 * This page exists because the alternative is worse: before, an account with no
 * roster match silently defaulted to the student role and saw a dashboard built
 * out of nothing. Being told plainly that you are not in the roster is better
 * than being shown an empty one.
 */
export default async function UnclaimedPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!isUnbound(user)) redirect("/dashboard")

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">
          You are not in the roster yet
        </h1>

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Your VOSS account is verified, but no student or faculty record in
          VERP matches{" "}
          <span className="text-foreground font-mono">{user.email}</span>.
        </p>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Ask your TR to add you. Once your record is uploaded, sign in again
          and you will be linked automatically — there is nothing else for you
          to do.
        </p>

        <p className="text-muted-foreground/70 mt-8 text-xs leading-relaxed">
          If you believe the roster already lists you, the email on your record
          may differ from the one you signed in with. Your TR can correct it.
        </p>
      </div>
    </main>
  )
}
