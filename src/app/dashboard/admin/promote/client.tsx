"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2Icon } from "lucide-react"

const YEAR_OPTIONS = ["FE", "SE", "TE", "BE"]
const YEAR_SEMESTERS: Record<string, string[]> = {
  FE: ["1", "2"],
  SE: ["3", "4"],
  TE: ["5", "6"],
  BE: ["7", "8"],
}

function getTargetFor(sourceYear: string, sourceSemester: string) {
  const sem = Number.parseInt(sourceSemester, 10)
  if (Number.isNaN(sem)) return null

  const nextSem = sem + 1
  if (nextSem % 2 === 0) {
    return { year: sourceYear, semester: String(nextSem) }
  }

  const yearOrder = ["FE", "SE", "TE", "BE"]
  const idx = yearOrder.indexOf(sourceYear)
  if (idx === -1 || idx === yearOrder.length - 1) return null

  return { year: yearOrder[idx + 1], semester: String(nextSem) }
}

type PreviewRow = {
  id: string
  rollNumber: string
  name: string
  year: string
  semester: string | null
  sgpi: number | null
  status: "pass" | "fail" | "incomplete"
  eligible: boolean
  reason: string
}

type PreviewResponse = {
  preview: boolean
  counts: {
    total: number
    eligible: number
    failed: number
    incomplete: number
    alreadyTarget: number
    promoted?: number
  }
  students?: PreviewRow[]
}

export function PromoteStudentsClient() {
  const [sourceYear, setSourceYear] = useState("TE")
  const [sourceSemester, setSourceSemester] = useState("6")
  const [targetYear, setTargetYear] = useState("BE")
  const [targetSemester, setTargetSemester] = useState("7")
  const [requirePass, setRequirePass] = useState(false)

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const sourceSemesterOptions = YEAR_SEMESTERS[sourceYear] ?? []
  const isGraduation = sourceYear === "BE" && sourceSemester === "8"
  const targetOption = useMemo(() => {
    if (isGraduation) {
      return { year: sourceYear, semester: sourceSemester }
    }
    return getTargetFor(sourceYear, sourceSemester)
  }, [isGraduation, sourceYear, sourceSemester])
  const targetYearOptions = targetOption ? [targetOption.year] : []
  const targetSemesterOptions = targetOption ? [targetOption.semester] : []

  const canSubmit = useMemo(() => {
    return (
      sourceYear &&
      sourceSemester &&
      targetYear &&
      targetSemester &&
      (isGraduation ||
        !(sourceYear === targetYear && sourceSemester === targetSemester))
    )
  }, [isGraduation, sourceYear, sourceSemester, targetYear, targetSemester])

  useEffect(() => {
    if (
      sourceSemesterOptions.length > 0 &&
      !sourceSemesterOptions.includes(sourceSemester)
    ) {
      setSourceSemester(sourceSemesterOptions[0])
    }
  }, [sourceSemester, sourceSemesterOptions])

  useEffect(() => {
    if (
      targetOption &&
      (targetYear !== targetOption.year ||
        targetSemester !== targetOption.semester)
    ) {
      setTargetYear(targetOption.year)
      setTargetSemester(targetOption.semester)
    }
  }, [targetOption, targetYear, targetSemester])

  async function runPreview() {
    setLoading(true)
    setError(null)
    setLastMessage(null)
    try {
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceYear,
          sourceSemester,
          targetYear,
          targetSemester,
          requirePass,
          action: "preview",
        }),
      })

      const raw = (await res.json()) as
        | { data: PreviewResponse; error?: string }
        | (PreviewResponse & { error?: string })
      const data = "data" in raw ? raw.data : raw
      if (!res.ok) {
        throw new Error("error" in raw && raw.error ? raw.error : "Failed")
      }
      setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview")
    } finally {
      setLoading(false)
    }
  }

  async function runPromote() {
    setPromoting(true)
    setError(null)
    setLastMessage(null)
    try {
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceYear,
          sourceSemester,
          targetYear,
          targetSemester,
          requirePass,
          action: isGraduation ? "graduate" : "promote",
        }),
      })

      const raw = (await res.json()) as
        | { data: PreviewResponse; error?: string }
        | (PreviewResponse & { error?: string })
      const data = "data" in raw ? raw.data : raw
      if (!res.ok) {
        throw new Error("error" in raw && raw.error ? raw.error : "Failed")
      }

      const promoted = data.counts.promoted ?? 0
      await runPreview()
      setLastMessage(
        isGraduation
          ? `Graduated ${promoted} student(s).`
          : `Promoted ${promoted} student(s).`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote")
    } finally {
      setPromoting(false)
    }
  }

  const rows = preview?.students ?? []
  const counts = preview?.counts ?? {
    total: 0,
    eligible: 0,
    failed: 0,
    incomplete: 0,
    alreadyTarget: 0,
  }
  const eligibleCount = counts.eligible

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {isGraduation ? "Graduation" : "Bulk Promotion"}
          </CardTitle>
          <CardDescription>
            {isGraduation
              ? "Mark final-semester students as graduated and inactive. Preview before confirming."
              : "Promote students from one year/semester to the next in a single batch. Preview before confirming."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Current Year</Label>
              <Select
                value={sourceYear}
                onValueChange={(value) => setSourceYear(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Current Semester</Label>
              <Select
                value={sourceSemester}
                onValueChange={(value) => setSourceSemester(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {sourceSemesterOptions.map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      Sem {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Year</Label>
              <Select
                value={targetYear}
                onValueChange={(value) => setTargetYear(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {targetYearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Semester</Label>
              <Select
                value={targetSemester}
                onValueChange={(value) => setTargetSemester(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {targetSemesterOptions.map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      Sem {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={requirePass}
              onCheckedChange={(value) => setRequirePass(!!value)}
              id="require-pass"
            />
            <Label htmlFor="require-pass" className="text-sm">
              Exclude failed or incomplete students (based on SGPI)
            </Label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Promotion failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {lastMessage && (
            <Alert>
              <AlertTitle>Promotion complete</AlertTitle>
              <AlertDescription>{lastMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={runPreview}
              disabled={!canSubmit || loading}
              className="bg-blue text-blue-foreground hover:bg-blue/90"
            >
              {loading ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Previewing...
                </>
              ) : isGraduation ? (
                "Preview Graduation"
              ) : (
                "Preview Promotion"
              )}
            </Button>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    disabled={!preview || eligibleCount === 0 || promoting}
                  />
                }
              >
                {promoting ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    {isGraduation ? "Graduating..." : "Promoting..."}
                  </>
                ) : isGraduation ? (
                  "Graduate Eligible Students"
                ) : (
                  "Promote Eligible Students"
                )}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isGraduation ? "Confirm graduation" : "Confirm promotion"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isGraduation
                      ? `This will mark ${eligibleCount} student record(s) as graduated and inactive.`
                      : `This will update ${eligibleCount} student record(s) to ${targetYear} Sem ${targetSemester}. You can preview again after the operation.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await runPromote()
                      setConfirmOpen(false)
                    }}
                    disabled={promoting}
                    className="bg-blue text-blue-foreground hover:bg-blue/90"
                  >
                    {isGraduation ? "Confirm graduation" : "Confirm promotion"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {counts.total} student(s) found. {counts.eligible} eligible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs tabular-nums">
                Total: {counts.total}
              </Badge>
              <Badge variant="outline" className="text-xs tabular-nums">
                Eligible: {counts.eligible}
              </Badge>
              <Badge variant="outline" className="text-xs tabular-nums">
                Failed: {counts.failed}
              </Badge>
              <Badge variant="outline" className="text-xs tabular-nums">
                Incomplete: {counts.incomplete}
              </Badge>
            </div>

            <div className="bg-card rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>SGPI</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Eligible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground h-24 text-center"
                      >
                        No students found for this selection.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">
                          {row.rollNumber}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell>{row.year}</TableCell>
                        <TableCell>{row.semester ?? "-"}</TableCell>
                        <TableCell className="tabular-nums">
                          {row.sgpi ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "pass"
                                ? "default"
                                : row.status === "fail"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.eligible ? (
                            <Badge variant="default">Yes</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
