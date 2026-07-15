"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"

type OfferingItem = {
  id: string
  division: string | null
  course: {
    courseCode: string
    courseName: string
    courseType: string
    credits: number
    maxIsa: number
    maxMse: number
    maxEse: number
    maxTotal: number
  }
  faculty: { id: string; firstName: string; lastName: string } | null
}
type FacultyOption = { id: string; name: string }

export function OfferingsClient({
  data,
  faculty,
  semesterLabel,
}: {
  data: OfferingItem[]
  faculty: FacultyOption[]
  semesterLabel: string
}) {
  const [search, setSearch] = useState("")
  const router = useRouter()

  const filtered = data.filter(
    (o) =>
      o.course.courseName.toLowerCase().includes(search.toLowerCase()) ||
      o.course.courseCode.toLowerCase().includes(search.toLowerCase())
  )

  async function assignFaculty(offeringId: string, facultyId: string | null) {
    await fetch(`/api/offerings/${offeringId}/assign-faculty`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facultyId }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{semesterLabel}</p>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {filtered.length} offerings
        </Badge>
      </div>
      <div className="relative max-w-sm">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search by course name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Course</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead className="text-center">Cr</TableHead>
              <TableHead className="text-center">Div</TableHead>
              <TableHead>Faculty</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="w-[100px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">
                    {o.course.courseCode}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {o.course.courseName}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="capitalize">
                      {o.course.courseType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {o.course.credits}
                  </TableCell>
                  <TableCell className="text-center">
                    {o.division ? (
                      <Badge variant="outline">{o.division}</Badge>
                    ) : (
                      <span className="text-muted-foreground">All</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.faculty ? (
                      `${o.faculty.firstName} ${o.faculty.lastName}`
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {o.course.maxTotal}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/dashboard/offerings/${o.id}`}
                        className="text-blue text-sm underline-offset-2 hover:underline"
                      >
                        Manage
                      </Link>
                      <AssignFacultyDialog
                        offeringId={o.id}
                        currentFacultyId={o.faculty?.id ?? null}
                        facultyOptions={faculty}
                        onAssign={assignFaculty}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AssignFacultyDialog({
  offeringId,
  currentFacultyId,
  facultyOptions,
  onAssign,
}: {
  offeringId: string
  currentFacultyId: string | null
  facultyOptions: FacultyOption[]
  onAssign: (offeringId: string, facultyId: string | null) => Promise<void>
}) {
  const [selected, setSelected] = useState(currentFacultyId ?? "none")
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onAssign(offeringId, selected === "none" ? null : selected)
    setSaving(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="text-blue text-sm underline-offset-2 hover:underline" />
        }
      >
        Assign
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign Faculty</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Select
            value={selected}
            onValueChange={(v) => setSelected(v ?? "none")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select faculty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {facultyOptions.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
