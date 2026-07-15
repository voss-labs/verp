"use client"

import { DataTableView } from "@/components/data-table-view"
import {
  departmentsColumns,
  type DepartmentRow,
} from "@/components/columns/departments-columns"

export function DepartmentsClient({ data }: { data: DepartmentRow[] }) {
  return (
    <DataTableView
      columns={departmentsColumns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search departments..."
    />
  )
}
