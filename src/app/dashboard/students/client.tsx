"use client"

import { useMemo, useState } from "react"

import { DataTableView } from "@/components/data-table-view"
import {
  studentsColumns,
  type StudentRow,
} from "@/components/columns/students-columns"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type CountItem = {
  label: string | null
  count: number
}

type CountSectionProps = {
  title: string
  items: CountItem[]
  bordered?: boolean
}

type FilterSelectProps = {
  label: string
  value: string
  placeholder: string
  allLabel: string
  options: string[]
  onChange: (value: string) => void
}

function FilterSelect({
  label,
  value,
  placeholder,
  allLabel,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <div className="min-w-[200px] space-y-2">
      <Label>{label}</Label>

      <Select
        value={value}
        onValueChange={(value) => {
          onChange(value === "ALL" ? "" : value!)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="ALL">{allLabel}</SelectItem>

          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function CountSection({ title, items, bordered = false }: CountSectionProps) {
  return (
    <div
      className={`flex items-center gap-3 ${
        bordered ? "border-muted border-r-2 pr-4" : ""
      }`}
    >
      <Label>{title}</Label>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.label!}
            className="bg-background flex items-center gap-3 rounded-md border px-3 py-1.5"
          >
            <span className="font-medium">{item.label}</span>

            <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-semibold">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StudentsClient({
  data,
  departmentCounts,
  yearCounts,
  divisionCounts,
}: {
  data: StudentRow[]
  departmentCounts: { department: string; count: number }[]
  yearCounts: { year: string; count: number }[]
  divisionCounts: { division: string; count: number }[]
}) {
  const [department, setDepartment] = useState<string>("")
  const [year, setYear] = useState<string>("")
  const [division, setDivision] = useState<string>("")

  const departments = useMemo<string[]>(() => {
    return [...new Set(data.map((s) => s.department))]
      .filter((v): v is string => !!v)
      .sort()
  }, [data])

  const years = useMemo<string[]>(() => {
    const filtered = department
      ? data.filter((s) => s.department === department)
      : data

    return [...new Set(filtered.map((s) => s.year))]
      .filter((v): v is string => !!v)
      .sort()
  }, [data, department])

  const divisions = useMemo<string[]>(() => {
    let filtered = data

    if (department) {
      filtered = filtered.filter((s) => s.department === department)
    }

    if (year) {
      filtered = filtered.filter((s) => s.year === year)
    }

    return [...new Set(filtered.map((s) => s.division))]
      .filter((v): v is string => !!v)
      .sort()
  }, [data, department, year])

  const filteredData = useMemo(() => {
    return data.filter((student) => {
      return (
        (!department || student.department === department) &&
        (!year || student.year === year) &&
        (!division || student.division === division)
      )
    })
  }, [data, department, year, division])

  const handleExport = async (
    filteredData: StudentRow[],
    format: "csv" | "xlsx"
  ) => {
    const headers = [
      "Roll No.",
      "Name",
      "Email",
      "Department",
      "Division",
      "Year",
      "Semester",
      "Phone",
      "Gender",
      "Status",
    ]
    const rows = filteredData.map((s) => [
      s.rollNumber,
      `${s.firstName} ${s.lastName}`,
      s.email,
      s.department,
      s.division ?? "-",
      s.year,
      s.semester ?? "-",
      s.phoneNo ?? "-",
      s.gender ?? "-",
      s.isActive ? "Active" : "Inactive",
    ])

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `Students_${dateStr}.${format}`

    let base64 = ""
    if (format === "xlsx") {
      base64 = await exportTableXlsx({
        title: "Students",
        headers,
        rows,
      })
      downloadBase64File(
        base64,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    } else {
      base64 = await exportTableCsv({ headers, rows })
      downloadBase64File(base64, filename, "text/csv")
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Filters</h3>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-4">
          <FilterSelect
            label="Department"
            value={department}
            placeholder="All departments"
            allLabel="All Departments"
            options={departments}
            onChange={setDepartment}
          />

          <FilterSelect
            label="Year"
            value={year}
            placeholder="All years"
            allLabel="All Years"
            options={years}
            onChange={setYear}
          />

          <FilterSelect
            label="Division"
            value={division}
            placeholder="All divisions"
            allLabel="All Divisions"
            options={divisions}
            onChange={setDivision}
          />

          <div className="mb-2 flex items-end">
            <Button
              variant="destructive"
              onClick={() => {
                setDepartment("")
                setYear("")
                setDivision("")
              }}
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
        <CardHeader className="border-t pt-4 rounded-t-none">
          <h3 className="text-lg font-semibold">Student Count</h3>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <CountSection
            title="Departments"
            bordered
            items={departmentCounts.map((item) => ({
              label: item.department,
              count: item.count,
            }))}
          />

          <CountSection
            title="Years"
            bordered
            items={yearCounts.map((item) => ({
              label: item.year,
              count: item.count,
            }))}
          />

          <CountSection
            title="Divisions"
            items={divisionCounts.map((item) => ({
              label: item.division,
              count: item.count,
            }))}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <DataTableView
        columns={studentsColumns}
        data={filteredData}
        globalSearch
        searchPlaceholder="Search students..."
        exportConfig={{
          filename: "Students",
          onExport: handleExport,
        }}
      />
    </div>
  )
}
