"use client"

import { useTransition } from "react"
import { FlaskConicalIcon } from "lucide-react"
import type { DevPersona } from "@/lib/dev-personas"
import { setDevActor } from "@/lib/dev-auth-actions"

/**
 * The way in when there is no way in.
 *
 * A contributor cannot complete a VOSS sign-in, so without this the login page
 * is a wall — it renders "Invalid OAuth configuration" and there is nothing
 * else to click.
 *
 * Fixed rather than in the document flow. The login form is `min-h-svh`, so
 * anything placed after it starts one full viewport down: the first version of
 * this sat there, correct in the markup and invisible on the screen, which for
 * the one control that lets you in is the same as not existing.
 */
export function DevSignIn({ personas }: { personas: DevPersona[] }) {
  const [pending, start] = useTransition()
  return (
    <div className="bg-background border-attention/60 fixed right-4 bottom-4 z-50 flex max-h-[80vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-lg border border-dashed p-4 shadow-lg">
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
