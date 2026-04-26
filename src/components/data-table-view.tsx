"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

interface DataTableViewProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  exportConfig?: {
    filename: string
    onExport: (data: TData[], format: "csv" | "xlsx") => Promise<void>
  }
}

export function DataTableView<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  exportConfig,
}: DataTableViewProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [isExporting, setIsExporting] = React.useState(false)

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!exportConfig) return
    setIsExporting(true)
    try {
      const filteredData = table.getFilteredRowModel().rows.map(r => r.original)
      await exportConfig.onExport(filteredData, format)
    } finally {
      setIsExporting(false)
    }
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: { sorting, columnFilters, globalFilter },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {searchKey || searchPlaceholder !== "Search..." ? (
          <div className="relative max-w-sm w-full">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder={searchPlaceholder}
              value={
                searchKey && searchKey !== "global"
                  ? ((table.getColumn(searchKey)?.getFilterValue() as string) ?? "")
                  : globalFilter
              }
              onChange={(e) => {
                if (searchKey && searchKey !== "global") {
                  table.getColumn(searchKey)?.setFilterValue(e.target.value)
                } else {
                  setGlobalFilter(e.target.value)
                }
              }}
              className="pl-9"
            />
          </div>
        ) : (
          <div /> // Placeholder for spacing if no search key
        )}
        {exportConfig && (
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "outline" })} disabled={isExporting}>
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
