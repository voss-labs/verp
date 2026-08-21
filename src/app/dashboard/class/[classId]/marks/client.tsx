"use client"

import Link from "next/link"

import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { MarksGrid } from "./marks-grid"
import type { Grid, Offering } from "./types"

function gridIdentity(grid: Grid) {
  const rows = grid.rows
    .map((r) => `${r.studentId}:${r.isa}:${r.mse1}:${r.mse2}:${r.ese}`)
    .join("|")
  return `${grid.offeringId}|${rows}`
}

export function MarksClient({
  classId,
  offerings,
  selectedId,
  grid,
  canAllocate,
}: {
  classId: string
  offerings: Offering[]
  selectedId: string | null
  grid: Grid | null
  canAllocate: boolean
}) {
  if (grid && selectedId) {
    const offering = offerings.find((o) => o.id === selectedId)!
    return (
      <MarksGrid
        key={gridIdentity(grid)}
        classId={classId}
        offering={offering}
        grid={grid}
      />
    )
  }
  return (
    <SubjectSetup
      classId={classId}
      offerings={offerings}
      canAllocate={canAllocate}
    />
  )
}

function SubjectSetup({
  classId,
  offerings,
  canAllocate,
}: {
  classId: string
  offerings: Offering[]
  canAllocate: boolean
}) {
  const router = useRouter()

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Subjects</h2>
          <button
            type="button"
            onClick={() =>
              router.push(`/dashboard/class/${classId}/marks/import`)
            }
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Import from file
          </button>
        </div>
        {offerings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No subjects yet. Add one to start entering marks.
          </p>
        ) : (
          <div className="border-border overflow-hidden rounded border">
            <ul className="divide-border divide-y">
              {offerings.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/dashboard/class/${classId}/marks?offering=${o.id}`
                      )
                    }
                    className="hover:bg-muted flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        {o.code}
                      </Badge>
                      <span className="text-sm">{o.name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Sem {o.semester} ·{" "}
                      {o.facultyName ?? (
                        <span className="text-destructive">Unallocated</span>
                      )}{" "}
                      · Enter marks →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-border flex flex-col gap-3 rounded border p-4">
        <h2 className="text-sm font-semibold">Adding subjects</h2>
        <p className="text-muted-foreground text-sm">
          Subjects are chosen from the department catalogue and allocated to a
          teacher on the{" "}
          <Link
            href={`/dashboard/class/${classId}/subjects`}
            className="underline"
          >
            Subjects
          </Link>{" "}
          page. Defining them there once — rather than typing a code into every
          class — is what keeps credits and the marks split consistent.
        </p>
        {!canAllocate && (
          <p className="text-muted-foreground text-xs">
            Your subjects appear on the left once the coordinator or HOD
            allocates them to you.
          </p>
        )}
      </div>
    </div>
  )
}
