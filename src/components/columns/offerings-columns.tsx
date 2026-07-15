"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type OfferingRow = {
  id: string
  division: string | null
  isActive: boolean
  course: {
    courseCode: string
    courseName: string
    courseType: string
    credits: number
    maxTotal: number
  }
  faculty: {
    firstName: string
    lastName: string
  } | null
  semester: {
    number: number
    academicYear: { name: string }
  }
}

export const offeringsColumns: ColumnDef<OfferingRow>[] = [
  {
    id: "courseCode",
    header: "Code",
    accessorFn: (row) => row.course.courseCode,
  },
  {
    id: "courseName",
    header: "Course",
    accessorFn: (row) => row.course.courseName,
  },
  {
    id: "type",
    header: "Type",
    accessorFn: (row) => row.course.courseType,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.course.courseType}
      </Badge>
    ),
  },
  {
    id: "credits",
    header: "Credits",
    accessorFn: (row) => row.course.credits,
  },
  {
    id: "faculty",
    header: "Faculty",
    accessorFn: (row) =>
      row.faculty
        ? `${row.faculty.firstName} ${row.faculty.lastName}`
        : "Unassigned",
    cell: ({ row }) => {
      const f = row.original.faculty
      return f ? (
        `${f.firstName} ${f.lastName}`
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      )
    },
  },
  {
    accessorKey: "division",
    header: "Division",
    cell: ({ row }) => {
      const div = row.getValue("division") as string | null
      return div ? (
        <Badge variant="outline">{div}</Badge>
      ) : (
        <span className="text-muted-foreground">All</span>
      )
    },
  },
  {
    id: "semester",
    header: "Semester",
    accessorFn: (row) =>
      `Sem ${row.semester.number} (${row.semester.academicYear.name})`,
  },
  {
    id: "maxTotal",
    header: "Total Marks",
    accessorFn: (row) => row.course.maxTotal,
  },
]
