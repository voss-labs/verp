"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type AttendanceRow = {
  id: string
  date: string
  status: string
  remarks: string | null
  student: { firstName: string; lastName: string; rollNumber: string } | null
  course: { courseName: string; courseCode: string } | null
}

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  present: "default",
  absent: "destructive",
  late: "outline",
  excused: "secondary",
}

export const attendanceColumns: ColumnDef<AttendanceRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.getValue("date")).toLocaleDateString(),
  },
  {
    id: "student",
    header: "Student",
    accessorFn: (row) =>
      row.student ? `${row.student.firstName} ${row.student.lastName}` : "-",
  },
  {
    id: "rollNumber",
    header: "Roll No.",
    accessorFn: (row) => row.student?.rollNumber ?? "-",
  },
  {
    id: "course",
    header: "Course",
    accessorFn: (row) =>
      row.course ? `${row.course.courseCode} - ${row.course.courseName}` : "-",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={statusVariant[status] ?? "outline"}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      )
    },
  },
  {
    accessorKey: "remarks",
    header: "Remarks",
    cell: ({ row }) => row.getValue("remarks") ?? "-",
  },
]
