"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DownloadIcon, HistoryIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { DataTableView } from "@/components/data-table-view"
import { EmptyState } from "@/components/empty-state"

export type ImportKind = "roster" | "faculty" | "courses" | "marks"
export type ImportStatus = "committed" | "failed"

export type ImportCard = {
  kind: ImportKind
  title: string
  description: string
  href: string
  template: { fileName: string; headers: string[] } | null
  last: { when: string; by: string; rows: number } | null
}

export type BatchRow = {
  id: string
  when: string
  kind: ImportKind
  fileName: string
  rowCount: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  scopeLabel: string
  actorName: string
  status: ImportStatus
  errorSummary: string | null
}

const KIND_LABEL: Record<ImportKind, string> = {
  roster: "Roster",
  faculty: "Faculty",
  courses: "Syllabus",
  marks: "Marks",
}

const QUIET_SUCCESS = "bg-success/10 text-success"
const QUIET_DESTRUCTIVE = "bg-destructive/10 text-destructive"

function csvField(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function downloadTemplate(fileName: string, headers: string[]) {
  const csv = `${headers.map(csvField).join(",")}\n`
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const columns: ColumnDef<BatchRow>[] = [
  {
    accessorKey: "when",
    header: "When",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
        {row.original.when}
      </span>
    ),
  },
  {
    accessorKey: "kind",
    header: "Kind",
    cell: ({ row }) => (
      <Badge variant="outline">{KIND_LABEL[row.original.kind]}</Badge>
    ),
  },
  {
    accessorKey: "fileName",
    header: "File",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.original.fileName}</p>
        {row.original.errorSummary && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {row.original.errorSummary}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "rowCount",
    header: "Rows",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.rowCount}</span>
    ),
  },
  {
    accessorKey: "insertedCount",
    header: "Inserted",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.insertedCount}</span>
    ),
  },
  {
    accessorKey: "updatedCount",
    header: "Updated",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.updatedCount}</span>
    ),
  },
  {
    accessorKey: "skippedCount",
    header: "Skipped",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.skippedCount}</span>
    ),
  },
  {
    accessorKey: "scopeLabel",
    header: "Scope",
    cell: ({ row }) => (
      <span className="identifier">{row.original.scopeLabel}</span>
    ),
  },
  {
    accessorKey: "actorName",
    header: "By",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const committed = row.original.status === "committed"
      return (
        <Badge
          variant="secondary"
          className={committed ? QUIET_SUCCESS : QUIET_DESTRUCTIVE}
        >
          {committed ? "Committed" : "Failed"}
        </Badge>
      )
    },
  },
]

function ImportSummary({ card }: { card: ImportCard }) {
  const template = card.template
  return (
    <div className="bg-card text-card-foreground ring-foreground/10 flex flex-col rounded-lg p-4 ring-1">
      <h2 className="text-sm font-semibold tracking-tight">{card.title}</h2>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {card.description}
      </p>
      <p className="text-muted-foreground mt-3 text-xs">
        {card.last ? (
          <>
            Last import {card.last.when} by {card.last.by} ·{" "}
            <span className="tabular-nums">{card.last.rows}</span> rows
          </>
        ) : (
          "No imports yet."
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={card.href}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open
        </Link>
        {template ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadTemplate(template.fileName, template.headers)
            }
          >
            <DownloadIcon className="mr-1.5 size-3.5" />
            Template
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">
            No template — the source is a published PDF.
          </span>
        )}
      </div>
    </div>
  )
}

export function ImportsClient({
  cards,
  batches,
}: {
  cards: ImportCard[]
  batches: BatchRow[]
}) {
  const kinds = [...new Set(cards.map((c) => c.kind))]

  return (
    <>
      <div className="grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {cards.map((card) => (
          <ImportSummary key={card.kind} card={card} />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">History</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Every commit VERP recorded. The uploaded files themselves are never
            stored.
          </p>
        </div>
        <DataTableView
          columns={columns}
          data={batches}
          globalSearch
          searchPlaceholder="Search imports..."
          facets={
            kinds.length > 1
              ? [
                  {
                    columnId: "kind",
                    label: "Kind",
                    format: (v) => KIND_LABEL[v as ImportKind] ?? v,
                  },
                ]
              : undefined
          }
          emptyContent={
            <EmptyState
              icon={HistoryIcon}
              title="No imports yet"
              description="Commits land here with who, when, and what changed."
            />
          }
          mobileRow={(b) => ({
            title: b.fileName,
            subtitle: `${KIND_LABEL[b.kind]} · ${b.when}`,
            meta: [
              { label: "Rows", value: b.rowCount },
              { label: "Inserted", value: b.insertedCount },
              { label: "Updated", value: b.updatedCount },
              { label: "Skipped", value: b.skippedCount },
              { label: "Scope", value: b.scopeLabel },
              { label: "By", value: b.actorName },
              {
                label: "Status",
                value: b.status === "committed" ? "Committed" : "Failed",
              },
            ],
          })}
        />
      </section>
    </>
  )
}
