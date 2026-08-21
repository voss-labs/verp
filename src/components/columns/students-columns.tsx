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

const QUIET_SUCCESS = "bg-success/10 text-success"
const QUIET_MUTED = "bg-muted text-muted-foreground"
const QUIET_ATTENTION = "bg-attention/10 text-attention"

export const studentsColumns: ColumnDef<StudentRow>[] = [
  {
    accessorKey: "rollNumber",
    header: "Roll No.",
    cell: ({ row }) => (
      <span className="identifier">{row.getValue("rollNumber")}</span>
    ),
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
    cell: ({ row }) => {
      const claimed = Boolean(row.getValue("authUserId"))
      return (
        <Badge
          variant="secondary"
          className={claimed ? QUIET_SUCCESS : QUIET_MUTED}
        >
          {claimed ? "Claimed" : "Pending"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => {
      const active = Boolean(row.getValue("isActive"))
      return (
        <Badge
          variant="secondary"
          className={active ? QUIET_SUCCESS : QUIET_ATTENTION}
        >
          {active ? "Active" : "Inactive"}
        </Badge>
      )
    },
  },
]
