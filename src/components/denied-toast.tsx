"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

const MESSAGES: Record<string, string> = {
  class: "You do not have access to that class — here is your own list",
  dept: "You do not have access to that department — here is your own list",
}

export function DeniedToast({ scope }: { scope: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    const message = MESSAGES[scope]
    if (!message) return
    toast.error(message)
    const next = new URLSearchParams(params.toString())
    next.delete("denied")
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [scope, pathname, params, router])

  return null
}
