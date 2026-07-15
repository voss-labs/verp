"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type DepartmentRow = {
  id: number
  name: string
  code: string
  description: string | null
  headOfDepartment: string | null
  isActive: boolean
}

export const departmentsColumns: ColumnDef<DepartmentRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("code")}</Badge>,
  },
  {
    accessorKey: "name",
    header: "Department Name",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[300px]">
        {row.getValue("description") ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "headOfDepartment",
    header: "HOD",
    cell: ({ row }) => row.getValue("headOfDepartment") ?? "-",
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
        {row.getValue("isActive") ? "Active" : "Inactive"}
      </Badge>
    ),
  },
]
