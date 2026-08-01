"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type StudentRow = {
  id: string
  firstName: string
  lastName: string
  rollNumber: string
  email: string | null
  department: string
  division: string | null
  year: string
  authUserId: string | null
  isActive: boolean
}

export const studentsColumns: ColumnDef<StudentRow>[] = [
  {
    accessorKey: "rollNumber",
    header: "Roll No.",
  },
  {
    id: "name",
    header: "Name",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/students/${row.original.id}`}
        className="text-blue underline-offset-2 hover:underline"
      >
        {row.original.firstName} {row.original.lastName}
      </Link>
    ),
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
    accessorKey: "division",
    header: "Division",
    cell: ({ row }) => row.getValue("division") ?? "-",
  },
  {
    accessorKey: "year",
    header: "Year",
  },
  {
    accessorKey: "authUserId",
    header: "Claimed",
    cell: ({ row }) => (
      <Badge variant={row.getValue("authUserId") ? "default" : "secondary"}>
        {row.getValue("authUserId") ? "Claimed" : "Pending"}
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
