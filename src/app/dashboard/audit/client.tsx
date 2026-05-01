"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchIcon, DownloadIcon, Loader2Icon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"

type AuditLogEntry = {
  id: string
  action: string
  actorName: string
  targetType: string
  targetId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

const ACTION_STYLES: Record<string, string> = {
  "marks.save": "text-blue border-blue/20 bg-blue/8",
  "marks.lock":
    "text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10",
  "marks.unlock":
    "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  "enrollment.add":
    "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  "enrollment.remove":
    "text-destructive border-destructive/20 bg-destructive/10",
  "offering.assign_faculty":
    "text-violet-600 dark:text-violet-400 border-violet-500/20 bg-violet-500/10",
  "batch.create": "text-blue border-blue/20 bg-blue/8",
  "batch.assign_student": "text-blue border-blue/20 bg-blue/8",
  "students.promote":
    "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  "students.graduate":
    "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
}

export function AuditLogClient({
  logs,
  actionTypes,
}: {
  logs: AuditLogEntry[]
  actionTypes: string[]
}) {
  const [search, setSearch] = useState("")
  const [filterAction, setFilterAction] = useState("all")
  const [isExporting, setIsExporting] = useState(false)

  const filtered = logs.filter((log) => {
    if (filterAction !== "all" && log.action !== filterAction) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.targetType.toLowerCase().includes(q) ||
        (log.targetId?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  const handleExport = async (format: "csv" | "xlsx") => {
    setIsExporting(true)
    try {
      const headers = [
        "Time",
        "Action",
        "Actor",
        "Target Type",
        "Target ID",
        "Details",
      ]
      const rows = filtered.map((log) => [
        new Date(log.createdAt).toLocaleString(),
        log.action,
        log.actorName,
        log.targetType,
        log.targetId ?? "",
        log.details ? JSON.stringify(log.details) : "",
      ])

      const dateStr = new Date().toISOString().split("T")[0]
      const filename = `AuditLog_${dateStr}.${format}`

      let base64 = ""
      if (format === "xlsx") {
        base64 = await exportTableXlsx({ title: "Audit Log", headers, rows })
        downloadBase64File(
          base64,
          filename,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      } else {
        base64 = await exportTableCsv({ headers, rows })
        downloadBase64File(base64, filename, "text/csv")
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterAction("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterAction === "all"
                  ? "bg-blue text-blue-foreground shadow-sm"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              All
            </button>
            {actionTypes.map((action) => (
              <button
                key={action}
                onClick={() => setFilterAction(action)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterAction === action
                    ? "bg-blue text-blue-foreground shadow-sm"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: "outline" })}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DownloadIcon className="mr-2 h-4 w-4" />
            )}
            Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("csv")}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("xlsx")}>
              Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-muted-foreground text-xs font-medium tabular-nums">
        {filtered.length} entries
      </p>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Time</TableHead>
              <TableHead className="w-45">Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium ${ACTION_STYLES[log.action] ?? ""}`}
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {log.actorName}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="text-muted-foreground">
                      {log.targetType}
                    </span>
                    {log.targetId && (
                      <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 font-mono text-[10px]">
                        {log.targetId.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-50 truncate font-mono text-xs">
                    {log.details ? JSON.stringify(log.details) : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
