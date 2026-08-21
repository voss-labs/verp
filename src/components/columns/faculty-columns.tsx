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
  role: "super_admin" | "hod" | "faculty"
  isActive: boolean
}

// Exported so the table, the drawer and the filter all name a role the same
// way. A raw "super_admin" reaching a dropdown is the same class of leak as
// the "__all" sentinel that used to show in the filter triggers.
export const ROLE_LABEL: Record<FacultyRow["role"], string> = {
  super_admin: "Super-admin",
  hod: "HOD",
  faculty: "Faculty",
}

const QUIET_SUCCESS = "bg-success/10 text-success"
const QUIET_ATTENTION = "bg-attention/10 text-attention"

export const facultyColumns: ColumnDef<FacultyRow>[] = [
  {
    accessorKey: "employeeId",
    header: "Employee ID",
    cell: ({ row }) => (
      <span className="identifier">{row.getValue("employeeId")}</span>
    ),
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
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as FacultyRow["role"]
      return (
        <Badge variant={role === "faculty" ? "outline" : "secondary"}>
          {ROLE_LABEL[role]}
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
