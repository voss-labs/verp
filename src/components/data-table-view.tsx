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
  SelectValue,
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
  facets?: { columnId: string; label: string }[]
  exportConfig?: {
    filename: string
    onExport: (data: TData[], format: "csv" | "xlsx") => Promise<void>
  }
  // Opt-in row selection: rowId maps a row to a stable id, bulkBar renders the
  // action toolbar for the current selection. Passing bulkBar turns on the
  // checkbox column.
  rowId?: (row: TData) => string
  bulkBar?: (ids: string[], clear: () => void) => React.ReactNode
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
}: DataTableViewProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
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
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
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
                    <SelectValue placeholder={facet.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      All {facet.label.toLowerCase()}
                    </SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option} ({counts.get(option)})
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
      <div className="bg-card rounded-lg border">
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
                <TableRow key={row.id}>
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
