import Link from "next/link"
import { CircleCheckIcon, CircleIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Year } from "@/lib/roll-number"
import { cn } from "@/lib/utils"

export type HodClassRow = {
  id: string
  classKey: string
  deptCode: string
  year: Year | null
  division: string
  coordinator: string | null
  roster: number
  marked: number
  subjects: number
  unallocated: number
  entered: number
  pendingRequests: number
}

function RegisterChip({ marked, roster }: { marked: number; roster: number }) {
  if (roster === 0) {
    return <span className="text-muted-foreground text-xs">No roster</span>
  }
  if (marked === 0) {
    return (
      <Badge variant="secondary" className="bg-attention/10 text-attention">
        <CircleIcon data-icon="inline-start" />
        Not taken
      </Badge>
    )
  }
  if (marked < roster) {
    return (
      <Badge variant="secondary" className="bg-attention/10 text-attention">
        <CircleIcon data-icon="inline-start" />
        Part done · {marked}/{roster}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-success/10 text-success">
      <CircleCheckIcon data-icon="inline-start" />
      Taken · {marked}
    </Badge>
  )
}

export function HodClassesTable({
  rows,
  showDept,
  canAssign,
}: {
  rows: HodClassRow[]
  showDept: boolean
  canAssign: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Class</TableHead>
          {showDept && <TableHead>Dept</TableHead>}
          <TableHead>Year</TableHead>
          <TableHead>Coordinator</TableHead>
          <TableHead className="text-right">Roster</TableHead>
          <TableHead>Register today</TableHead>
          <TableHead className="text-right">Marks</TableHead>
          <TableHead className="text-right">Requests</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const scale = row.roster * row.subjects
          const marks =
            scale > 0 ? Math.round((row.entered / scale) * 100) : null
          return (
            <TableRow
              key={row.id}
              className={cn(
                "relative",
                !row.coordinator && "border-l-destructive border-l-2"
              )}
            >
              <TableCell>
                <Link
                  href={`/dashboard/class/${row.id}`}
                  className="identifier focus-visible:after:ring-ring/50 font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2"
                >
                  {row.classKey}
                </Link>
              </TableCell>
              {showDept && (
                <TableCell>
                  <Badge variant="outline" className="identifier">
                    {row.deptCode}
                  </Badge>
                </TableCell>
              )}
              <TableCell className="text-muted-foreground">
                {row.year ?? "—"} · {row.division}
              </TableCell>
              <TableCell>
                {row.coordinator ? (
                  row.coordinator
                ) : canAssign ? (
                  <Link
                    href="/dashboard/dept"
                    className="text-destructive relative z-10 font-medium hover:underline"
                  >
                    Assign
                  </Link>
                ) : (
                  <span className="text-destructive font-medium">
                    Unassigned
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.roster}
              </TableCell>
              <TableCell>
                <RegisterChip marked={row.marked} roster={row.roster} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {marks === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  `${marks}%`
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  row.pendingRequests > 0 && "text-attention font-medium"
                )}
              >
                {row.pendingRequests}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
