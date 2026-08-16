import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { DEV_ACTOR_COOKIE, devAuthEnabled } from "@/lib/dev-auth-gate"

const publicRoutes = ["/login", "/api/auth"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route))

  if (isPublic) return NextResponse.next()

  // Locally, the dev switcher's cookie is what stands in for a session. Without
  // this the proxy turns every route into a redirect before any of it is
  // reached, and the switcher looks broken rather than blocked.
  //
  // This decides only whether to let the request THROUGH. Who the caller is,
  // and what they may do, is still resolved from the database further in — the
  // proxy has never been the thing that answers that.
  const devActor =
    devAuthEnabled() && request.cookies.get(DEV_ACTOR_COOKIE)?.value

  const session = getSessionCookie(request)

  if (!session && !devActor) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
