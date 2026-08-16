"use client"

import { useTransition } from "react"
import { FlaskConicalIcon } from "lucide-react"
import type { DevPersona } from "@/lib/dev-personas"
import { setDevActor } from "@/lib/dev-auth-actions"

/**
 * The way in when there is no way in.
 *
 * A contributor cannot complete a VOSS sign-in, so without this the login page
 * is a wall. Rendered only when the server hands it personas, which it does
 * only on a development machine with the flag set.
 */
export function DevSignIn({ personas }: { personas: DevPersona[] }) {
  const [pending, start] = useTransition()
  return (
    <div className="border-attention/50 mx-auto mt-6 w-full max-w-sm rounded-lg border border-dashed p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <FlaskConicalIcon className="text-attention size-4" />
        Development sign-in
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        No VOSS credentials needed. Permissions still come from the database, so
        what each of these can do is the real answer.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        {personas.map((p) => (
          <button
            key={p.key}
            type="button"
            disabled={pending}
            onClick={() => start(() => void setDevActor(p.key))}
            className="hover:bg-muted focus-visible:ring-ring flex flex-col rounded px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="text-sm">
              {p.name}
              <span className="text-muted-foreground ml-1.5 text-xs">
                {p.role}
              </span>
            </span>
            <span className="text-muted-foreground text-xs">{p.scope}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
