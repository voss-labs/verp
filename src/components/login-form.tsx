"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { VossWordmark } from "@/components/voss-logo"
import { ShieldCheckIcon, BarChart3Icon, UsersIcon } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // No email field, no password field, no sign-up toggle. VERP holds no
  // credentials any more: VOSS is the only door, and it is what verifies the
  // address really is @vit.edu.in. Open self-registration used to live here —
  // anyone on the internet could create an account and land with a role.
  async function signInWithVoss() {
    setError("")
    setLoading(true)
    const { error } = await authClient.signIn.oauth2({
      providerId: "voss",
      callbackURL: "/dashboard",
    })
    if (error) {
      setLoading(false)
      setError(error.message ?? "Could not reach VOSS. Try again in a moment.")
    }
  }

  return (
    <div className={cn("flex min-h-svh", className)} {...props}>
      {/* Left: Branding Panel */}
      <div className="bg-primary text-primary-foreground relative hidden w-[52%] overflow-hidden lg:block">
        {/* Thin blue accent along the leading edge */}
        <div className="bg-blue absolute inset-y-0 left-0 w-1" />
        {/* Subtle depth gradient — flat ink, no loud multi-color wash */}
        <div className="from-primary absolute inset-0 bg-gradient-to-t via-transparent to-black/20" />

        <div className="relative flex h-full flex-col justify-between p-12">
          {/* Logo & Branding */}
          <VossWordmark product="VERP" className="text-primary-foreground" />

          {/* Center content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl leading-tight font-bold tracking-tight">
                College Management
                <br />
                <span className="text-primary-foreground/60">Made Simple.</span>
              </h2>
              <p className="text-primary-foreground/50 max-w-sm text-base leading-relaxed">
                A unified platform for managing students, faculty, marks,
                attendance, and academic operations.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3">
              <FeaturePill
                icon={<UsersIcon className="size-3.5" />}
                text="Student Management"
              />
              <FeaturePill
                icon={<BarChart3Icon className="size-3.5" />}
                text="SGPI Analytics"
              />
              <FeaturePill
                icon={<ShieldCheckIcon className="size-3.5" />}
                text="Role-Based Access"
              />
            </div>
          </div>

          {/* Bottom */}
          <p className="text-primary-foreground/40 text-xs">
            Electronics & Computer Science Department
          </p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="bg-card flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <VossWordmark product="VERP" />
          </div>

          <div>
            <div className="mb-6 space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight">
                Welcome back
              </h2>
              <p className="text-muted-foreground text-sm">
                Sign in with your VOSS account to access the dashboard
              </p>
            </div>

            {error && (
              <div className="bg-destructive/8 text-destructive mb-4 rounded-lg px-3.5 py-2.5 text-sm font-medium">
                {error}
              </div>
            )}

            <Button
              onClick={signInWithVoss}
              disabled={loading}
              size="lg"
              className="h-11 w-full"
            >
              {loading ? "Redirecting to VOSS…" : "Continue with VOSS"}
            </Button>

            <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
              One VOSS account works across VERP and vboard. Your college email
              is verified once, at accounts.vosslabs.org.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-primary-foreground/80 border-primary-foreground/10 bg-primary-foreground/5 flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium backdrop-blur-sm">
      {icon}
      {text}
    </div>
  )
}
