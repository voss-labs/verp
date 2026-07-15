"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusIcon, TrashIcon, SearchIcon } from "lucide-react"

type StudentItem = {
  id: string
  rollNumber: string
  firstName: string
  lastName: string
  division: string | null
}

type BatchItem = {
  id: string
  name: string
  students: Omit<StudentItem, "division">[]
}

type Props = {
  offeringId: string
  courseType: string
  division: string | null
  enrolledStudents: StudentItem[]
  availableStudents: StudentItem[]
  batches: BatchItem[]
}

export function OfferingDetailClient({
  offeringId,
  courseType,
  division,
  enrolledStudents,
  availableStudents,
  batches,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <Badge variant="outline" className="capitalize">
          {courseType}
        </Badge>
        {division && <Badge variant="outline">Div {division}</Badge>}
        <span>{enrolledStudents.length} enrolled</span>
      </div>

      <EnrollmentSection
        offeringId={offeringId}
        enrolled={enrolledStudents}
        available={availableStudents}
      />

      {courseType === "practical" && (
        <BatchSection
          offeringId={offeringId}
          batches={batches}
          enrolledStudents={enrolledStudents}
        />
      )}
    </div>
  )
}

function EnrollmentSection({
  offeringId,
  enrolled,
  available,
}: {
  offeringId: string
  enrolled: StudentItem[]
  available: StudentItem[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [enrolling, setEnrolling] = useState(false)

  const filteredAvailable = available.filter(
    (s) =>
      s.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
      `${s.firstName} ${s.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )

  async function handleEnroll(studentId: string) {
    setEnrolling(true)
    await fetch(`/api/offerings/${offeringId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    })
    router.refresh()
    setEnrolling(false)
  }

  async function handleUnenroll(studentId: string) {
    await fetch(`/api/offerings/${offeringId}/enroll`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    })
    router.refresh()
  }

  return (
    <div className="grid gap-6 @xl/main:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Enrolled Students ({enrolled.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {enrolled.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No students enrolled.
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolled.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">
                        {s.rollNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.firstName} {s.lastName}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleUnenroll(s.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Add Students</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="relative">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search by roll number or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search.length > 0 && (
            <div className="max-h-[340px] overflow-y-auto rounded-lg border">
              <Table>
                <TableBody>
                  {filteredAvailable.slice(0, 20).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">
                        {s.rollNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.firstName} {s.lastName}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.division && (
                          <Badge variant="outline" className="text-xs">
                            {s.division}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="w-[50px]">
                        <button
                          onClick={() => handleEnroll(s.id)}
                          disabled={enrolling}
                          className="text-muted-foreground hover:text-blue transition-colors disabled:opacity-50"
                        >
                          <PlusIcon className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAvailable.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-4 text-center text-sm"
                      >
                        No matching students.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredAvailable.length > 20 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground text-center text-xs"
                      >
                        Showing first 20 of {filteredAvailable.length} results.
                        Refine your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BatchSection({
  offeringId,
  batches,
  enrolledStudents,
}: {
  offeringId: string
  batches: BatchItem[]
  enrolledStudents: StudentItem[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [newBatchName, setNewBatchName] = useState("")

  async function handleCreateBatch() {
    if (!newBatchName.trim()) return
    setCreating(true)
    await fetch(`/api/offerings/${offeringId}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBatchName.trim() }),
    })
    setNewBatchName("")
    router.refresh()
    setCreating(false)
  }

  async function handleAssignToBatch(batchId: string, studentId: string) {
    await fetch(`/api/offerings/${offeringId}/batches`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, studentId }),
    })
    router.refresh()
  }

  const assignedStudentIds = new Set(
    batches.flatMap((b) => b.students.map((s) => s.id))
  )
  const unassigned = enrolledStudents.filter(
    (s) => !assignedStudentIds.has(s.id)
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Batches</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Batch name (e.g. B1)"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              className="h-8 w-32"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateBatch}
              disabled={creating || !newBatchName.trim()}
            >
              <PlusIcon className="mr-1 size-3.5" /> Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {batches.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No batches created yet.
          </p>
        ) : (
          <div className="grid gap-4 @xl/main:grid-cols-2">
            {batches.map((batch) => (
              <div key={batch.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{batch.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {batch.students.length} student(s)
                  </span>
                </div>
                <div className="space-y-1">
                  {batch.students.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-0.5 text-xs"
                    >
                      <span className="font-mono">{s.rollNumber}</span>
                      <span className="text-muted-foreground">
                        {s.firstName} {s.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {unassigned.length > 0 && batches.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-muted-foreground text-xs font-medium">
              Unassigned ({unassigned.length}) - click a batch to assign:
            </p>
            <div className="max-h-[200px] overflow-y-auto rounded-lg border">
              <Table>
                <TableBody>
                  {unassigned.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">
                        {s.rollNumber}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.firstName} {s.lastName}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {batches.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => handleAssignToBatch(b.id, s.id)}
                              className="border-border hover:border-blue hover:text-blue rounded border px-1.5 py-0.5 text-xs transition-colors"
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
