"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type CourseRow = {
  id: string
  courseName: string
  courseCode: string
  courseType: string
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  isActive: boolean
  department: { name: string; code: string } | null
}

export const coursesColumns: ColumnDef<CourseRow>[] = [
  {
    accessorKey: "courseCode",
    header: "Code",
  },
  {
    accessorKey: "courseName",
    header: "Course Name",
  },
  {
    accessorKey: "courseType",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("courseType") as string
      return (
        <Badge variant="outline" className="capitalize">
          {type}
        </Badge>
      )
    },
  },
  {
    id: "department",
    header: "Department",
    accessorFn: (row) => row.department?.code ?? "-",
    cell: ({ row }) => {
      const dept = row.original.department
      return dept ? <Badge variant="outline">{dept.code}</Badge> : "-"
    },
  },
  {
    accessorKey: "credits",
    header: "Credits",
  },
  {
    id: "marks",
    header: "Marks (ISA/MSE/ESE)",
    cell: ({ row }) => {
      const { maxIsa, maxMse, maxEse } = row.original
      return `${maxIsa}/${maxMse}/${maxEse}`
    },
  },
  {
    accessorKey: "maxTotal",
    header: "Total",
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
