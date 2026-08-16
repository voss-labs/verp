import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { DevSignIn } from "./dev-sign-in"
import { devAuthProps } from "@/lib/dev-auth"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const devAuth = await devAuthProps()

  // Choosing a persona sets a cookie and revalidates; without this the login
  // page would keep rendering underneath an identity that already resolves.
  if (devAuth?.current && (await getSessionUser())) redirect("/dashboard")

  return (
    <>
      <LoginForm />
      {devAuth && <DevSignIn personas={devAuth.personas} />}
    </>
  )
}
