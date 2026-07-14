"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import {
  GraduationCapIcon,
  ShieldCheckIcon,
  BarChart3Icon,
  UsersIcon,
} from "lucide-react"

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
      <div className="bg-blue relative hidden w-[52%] overflow-hidden lg:block">
        {/* Geometric pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        {/* Gradient overlay for depth */}
        <div className="from-blue/20 absolute inset-0 bg-gradient-to-br via-transparent to-black/20" />

        <div className="relative flex h-full flex-col justify-between p-12">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <GraduationCapIcon className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                VERP
              </h1>
              <p className="text-xs font-medium text-white/60">College ERP</p>
            </div>
          </div>

          {/* Center content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl leading-tight font-bold tracking-tight text-white">
                College Management
                <br />
                <span className="text-white/70">Made Simple.</span>
              </h2>
              <p className="max-w-sm text-base leading-relaxed text-white/50">
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
          <p className="text-xs text-white/30">
            Electronics & Computer Science Department
          </p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="bg-card flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="bg-blue flex size-10 items-center justify-center rounded-xl">
              <GraduationCapIcon className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">VERP</h1>
              <p className="text-muted-foreground text-xs">College ERP</p>
            </div>
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
    <div className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur-sm">
      {icon}
      {text}
    </div>
  )
}
