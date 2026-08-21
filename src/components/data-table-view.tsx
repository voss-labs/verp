"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SearchIcon,
  SearchXIcon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"

// Radix Select cannot hold an empty string as a value, so "no filter" needs a
// sentinel rather than "".
const ALL = "__all"

const PAGE_SIZES = [25, 50, 100]

const INTERACTIVE_SELECTOR =
  "a,button,input,select,textarea,label,[role=checkbox],[role=button]"

function hitsInteractiveChild(
  event: React.MouseEvent | React.KeyboardEvent
): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  const interactive = target.closest(INTERACTIVE_SELECTOR)
  return interactive !== null && interactive !== event.currentTarget
}

interface DataTableViewProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  globalSearch?: boolean
  // Dropdown filters built from the values actually present in the data.
  // Counts come from TanStack's faceted row model, so no extra queries are
  // needed and the numbers always match what the table is showing.
  // format turns a stored value into what a person calls it: the column holds
  // "super_admin", the filter has to offer "Super-admin".
  facets?: {
    columnId: string
    label: string
    format?: (value: string) => string
  }[]
  exportConfig?: {
    filename: string
    onExport: (data: TData[], format: "csv" | "xlsx") => Promise<void>
  }
  // Opt-in row selection: rowId maps a row to a stable id, bulkBar renders the
  // action toolbar for the current selection.
  rowId?: (row: TData) => string
  bulkBar?: (ids: string[], clear: () => void) => React.ReactNode
  // Filters the table opens with, so a link from elsewhere can land on the
  // exact list it was talking about rather than the whole roster. Seeded once:
  // clearing a filter must stay cleared, not snap back on the next render.
  initialFilters?: ColumnFiltersState
  // Opening a record. A drawer keeps the list, its filters and its scroll
  // position behind it, so comparing two records is two clicks rather than
  // four page loads.
  onRowClick?: (row: TData) => void
  emptyContent?: React.ReactNode
  // How one record reads when there is no room for a table. A phone cannot
  // show eight columns, and a horizontally scrolling table hides the columns
  // that matter behind the ones that do not.
  mobileRow?: (row: TData) => {
    title: React.ReactNode
    subtitle?: React.ReactNode
    meta?: { label: string; value: React.ReactNode }[]
  }
}

export function DataTableView<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  globalSearch,
  facets,
  exportConfig,
  rowId,
  bulkBar,
  onRowClick,
  mobileRow,
  emptyContent,
  initialFilters,
}: DataTableViewProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    initialFilters ?? []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [isExporting, setIsExporting] = React.useState(false)

  const selectable = Boolean(bulkBar || exportConfig)
  const allColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!selectable) return columns
    const selectCol: ColumnDef<TData, TValue> = {
      id: "__select",
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        // The checkbox lives inside a row that may itself be clickable, so it
        // has to keep its own click and key: selecting a record must not also
        // open it. Held on the control rather than a wrapper, which would be a
        // span nothing can reach carrying handlers it does not own.
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
    }
    return [selectCol, ...columns]
  }, [columns, selectable])

  const runExport = async (rows: TData[], format: "csv" | "xlsx") => {
    if (!exportConfig) return
    setIsExporting(true)
    try {
      await exportConfig.onExport(rows, format)
    } finally {
      setIsExporting(false)
    }
  }

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableRowSelection: selectable,
    getRowId: rowId,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize: 50 } },
    state: { sorting, columnFilters, globalFilter, rowSelection },
  })

  // A row that opens a record has to be operable without a pointer. Giving it
  // the button role and Enter/Space rather than a nested <button> keeps the
  // cells' own links and checkboxes working, which a wrapping button would
  // swallow.
  const rowHandlers = (row: TData) =>
    onRowClick
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: (e: React.MouseEvent) => {
            if (hitsInteractiveChild(e)) return
            onRowClick(row)
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return
            if (hitsInteractiveChild(e)) return
            e.preventDefault()
            onRowClick(row)
          },
        }
      : {}

  const scopeFixed = (columnId: string) => {
    const seen = new Set<string>()
    for (const row of table.getPreFilteredRowModel().rows) {
      const value: unknown = row.getValue(columnId)
      if (value === null || value === undefined || value === "") continue
      seen.add(String(value))
      if (seen.size > 1) return false
    }
    return true
  }

  const showSearch = Boolean(globalSearch || searchKey)
  const selectedRows = table.getSelectedRowModel().rows
  const selectedIds = selectedRows.map((r) => r.id)
  const clearSelection = () => setRowSelection({})
  const activeFacets = (facets ?? []).filter((f) =>
    Boolean(table.getColumn(f.columnId)?.getFilterValue())
  )

  const { pageIndex, pageSize } = table.getState().pagination
  const total = table.getFilteredRowModel().rows.length
  const rangeStart = pageIndex * pageSize + 1
  const rangeEnd = Math.min(rangeStart + pageSize - 1, total)
  const narrowed = globalFilter !== "" || columnFilters.length > 0

  const emptyState =
    !narrowed && emptyContent ? (
      emptyContent
    ) : (
      <EmptyState
        icon={SearchXIcon}
        title="No results"
        description={
          narrowed ? "Try a different search, or clear the filters." : undefined
        }
      />
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {showSearch ? (
          <div className="relative w-full max-w-sm">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder={searchPlaceholder}
              value={
                globalSearch
                  ? globalFilter
                  : ((table
                      .getColumn(searchKey!)
                      ?.getFilterValue() as string) ?? "")
              }
              onChange={(e) => {
                if (globalSearch) {
                  setGlobalFilter(e.target.value)
                } else {
                  table.getColumn(searchKey!)?.setFilterValue(e.target.value)
                }
              }}
              className="pl-9"
            />
          </div>
        ) : (
          <div />
        )}
        {facets && facets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {facets.map((facet) => {
              const column = table.getColumn(facet.columnId)
              if (!column) return null
              const value = (column.getFilterValue() as string) ?? ALL
              if (value === ALL && scopeFixed(facet.columnId)) return null
              const counts = column.getFacetedUniqueValues()
              const options = Array.from(counts.keys())
                .filter(
                  (v): v is string => v !== null && v !== undefined && v !== ""
                )
                .sort((a, b) => String(a).localeCompare(String(b)))
              const label = facet.format ?? ((v: string) => v)

              return (
                <Select
                  key={facet.columnId}
                  value={value}
                  onValueChange={(next) =>
                    column.setFilterValue(next === ALL ? undefined : next)
                  }
                >
                  <SelectTrigger
                    className="w-auto min-w-[9rem]"
                    aria-label={facet.label}
                  >
                    {/* Render the label rather than letting the primitive echo
                        the raw value: the "no filter" case is a sentinel, and
                        the trigger was showing "__all" to users. */}
                    <span className="truncate">
                      {value === ALL
                        ? `All ${facet.label.toLowerCase()}`
                        : `${label(value)} (${counts.get(value) ?? 0})`}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      All {facet.label.toLowerCase()}
                    </SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {label(option)} ({counts.get(option)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            })}
            {activeFacets.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  activeFacets.forEach((f) =>
                    table.getColumn(f.columnId)?.setFilterValue(undefined)
                  )
                }
              >
                Clear
              </Button>
            )}
          </div>
        )}
        {exportConfig && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={`ml-auto ${buttonVariants({ variant: "outline" })}`}
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
              <DropdownMenuItem
                onClick={() =>
                  runExport(
                    table.getSortedRowModel().rows.map((r) => r.original),
                    "csv"
                  )
                }
              >
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  runExport(
                    table.getSortedRowModel().rows.map((r) => r.original),
                    "xlsx"
                  )
                }
              >
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {selectable && selectedRows.length > 0 && (
        <div className="border-blue/30 bg-blue/5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm font-medium tabular-nums">
            {selectedRows.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {exportConfig && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <DownloadIcon className="mr-1.5 size-3.5" />
                  )}
                  Export {selectedRows.length} selected
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      runExport(
                        selectedRows.map((r) => r.original),
                        "csv"
                      )
                    }
                  >
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      runExport(
                        selectedRows.map((r) => r.original),
                        "xlsx"
                      )
                    }
                  >
                    Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {bulkBar?.(selectedIds, clearSelection)}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}
      <div
        className={cn(
          "bg-card overflow-hidden rounded-lg border",
          "[&>[data-slot=table-container]]:max-h-[65svh]",
          mobileRow && "hidden sm:block"
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="bg-surface sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--border)]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  {...rowHandlers(row.original)}
                  className={
                    onRowClick
                      ? "focus-visible:outline-ring cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2"
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {mobileRow && (
        <div className="flex flex-col gap-2 sm:hidden">
          {table.getRowModel().rows.length === 0
            ? emptyState
            : table.getRowModel().rows.map((row) => {
                const r = mobileRow(row.original)
                return (
                  <div
                    key={row.id}
                    {...rowHandlers(row.original)}
                    className={
                      onRowClick
                        ? "bg-card focus-visible:ring-ring flex items-start gap-3 rounded-lg border p-3 focus-visible:ring-2 focus-visible:outline-none"
                        : "bg-card flex items-start gap-3 rounded-lg border p-3"
                    }
                  >
                    {selectable && (
                      <Checkbox
                        className="mt-0.5"
                        checked={row.getIsSelected()}
                        onCheckedChange={(v) => row.toggleSelected(!!v)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-label="Select record"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      {r.subtitle && (
                        <p className="text-muted-foreground truncate text-xs">
                          {r.subtitle}
                        </p>
                      )}
                      {r.meta && r.meta.length > 0 && (
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {r.meta.map((m) => (
                            <div key={m.label} className="flex gap-1.5 text-xs">
                              <dt className="text-muted-foreground">
                                {m.label}
                              </dt>
                              <dd>{m.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  </div>
                )
              })}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tabular-nums">
          {total === 0
            ? "No records"
            : `${rangeStart}-${rangeEnd} of ${total.toLocaleString("en-US")}`}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(next) => table.setPageSize(Number(next))}
          >
            <SelectTrigger size="sm" aria-label="Rows per page">
              <span className="tabular-nums">{pageSize} per page</span>
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
