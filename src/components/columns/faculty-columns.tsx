"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type FacultyRow = {
  id: string
  firstName: string
  lastName: string
  employeeId: string
  email: string
  department: string
  isAdmin: boolean
  isActive: boolean
}

export const facultyColumns: ColumnDef<FacultyRow>[] = [
  {
    accessorKey: "employeeId",
    header: "Employee ID",
  },
  {
    id: "name",
    header: "Name",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("department")}</Badge>
    ),
  },
  {
    accessorKey: "isAdmin",
    header: "Role",
    cell: ({ row }) => (
      <Badge variant={row.getValue("isAdmin") ? "default" : "outline"}>
        {row.getValue("isAdmin") ? "Admin" : "Faculty"}
      </Badge>
    ),
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
