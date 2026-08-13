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
import { SearchIcon, DownloadIcon, Loader2Icon } from "lucide-react"
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

// Radix Select cannot hold an empty string as a value, so "no filter" needs a
// sentinel rather than "".
const ALL = "__all"

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
  // action toolbar for the current selection. Passing bulkBar turns on the
  // checkbox column.
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
  initialFilters,
}: DataTableViewProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    initialFilters ?? []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [isExporting, setIsExporting] = React.useState(false)

  const selectable = Boolean(bulkBar)
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

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!exportConfig) return
    setIsExporting(true)
    try {
      const exportRows = table.getSortedRowModel().rows.map((r) => r.original)
      await exportConfig.onExport(exportRows, format)
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
          onClick: () => onRowClick(row),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onRowClick(row)
            }
          },
        }
      : {}

  const showSearch = Boolean(globalSearch || searchKey)
  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.id)
  const activeFacets = (facets ?? []).filter((f) =>
    Boolean(table.getColumn(f.columnId)?.getFilterValue())
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
              const counts = column.getFacetedUniqueValues()
              const options = Array.from(counts.keys())
                .filter(
                  (v): v is string => v !== null && v !== undefined && v !== ""
                )
                .sort((a, b) => String(a).localeCompare(String(b)))
              if (options.length === 0) return null
              const value = (column.getFilterValue() as string) ?? ALL
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
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {selectable && selectedIds.length > 0 && (
        <div className="border-blue/30 bg-blue/5 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkBar?.(selectedIds, () => setRowSelection({}))}
          </div>
        </div>
      )}
      <div
        className={
          mobileRow
            ? "bg-card hidden rounded-lg border sm:block"
            : "bg-card overflow-x-auto rounded-lg border"
        }
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                      ? "focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
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
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {mobileRow && (
        <div className="flex flex-col gap-2 sm:hidden">
          {table.getRowModel().rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No results.
            </p>
          ) : (
            table.getRowModel().rows.map((row) => {
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
                            <dt className="text-muted-foreground">{m.label}</dt>
                            <dd>{m.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium tabular-nums">
          {table.getFilteredRowModel().rows.length} record(s)
        </p>
        <div className="flex gap-2">
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
