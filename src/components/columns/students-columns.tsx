"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type StudentRow = {
  id: string
  firstName: string
  lastName: string
  rollNumber: string
  email: string
  department: string
  division: string | null
  year: string
  semester: string | null
  phoneNo: string | null
  gender: string | null
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
    accessorKey: "year",
    header: "Year",
  },
  {
    accessorKey: "semester",
    header: "Semester",
    cell: ({ row }) => row.getValue("semester") ?? "-",
  },
  {
    accessorKey: "phoneNo",
    header: "Phone",
    cell: ({ row }) => row.getValue("phoneNo") ?? "-",
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => row.getValue("gender") ?? "-",
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
