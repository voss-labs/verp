import { redirect } from "next/navigation"
import { ClockIcon } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionUser, isUnbound } from "@/lib/session"

export const dynamic = "force-dynamic"

/**
 * The pending state for a real VIT student VOSS authenticated but not yet in the
 * roster. It renders inside the app shell — the account IS in, it just has no
 * record to act on yet — rather than bouncing them to a bare dead-end page. The
 * dashboard layout still redirects unbound users here, so no data route is ever
 * reachable without a role; this is the one screen they can see.
 */
export default async function UnclaimedPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!isUnbound(user)) redirect("/dashboard")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
              <ClockIcon className="size-5" />
            </div>

            <h1 className="mt-5 text-2xl font-bold tracking-tight">
              Access pending
            </h1>

            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              You&rsquo;re signed in and verified as{" "}
              <span className="text-foreground font-mono">{user.email}</span> —
              we&rsquo;re just waiting for your record to be added to VERP.
            </p>

            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Ask your TR to add you to the roster. The moment they do, your
              next sign-in links you automatically — there is nothing else for
              you to do.
            </p>

            <p className="text-muted-foreground/70 mt-8 text-xs leading-relaxed">
              Already listed? The email on your record may differ from the one
              you signed in with. Your TR can correct it.
            </p>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
