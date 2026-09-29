"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  UploadCloudIcon,
  FileSpreadsheetIcon,
  CheckCircle2Icon,
  XIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  Trash2Icon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmAction } from "@/components/confirm-action"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"
import {
  editRows,
  flagRow,
  rollNeedsDepartment,
  type PreviewRow,
  type RosterFields,
} from "@/lib/xlsx-import"

// Only the fields VERP does NOT compute. No marks, no CGPA, no attendance.
const COLUMNS: { key: keyof PreviewRow; label: string }[] = [
  { key: "rollNumber", label: "Roll number" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "department", label: "Dept" },
  { key: "division", label: "Div" },
  { key: "year", label: "Year" },
]

// The four years, named as the syllabus importer names them, for setting on
// many rows at once.
const YEARS = [
  { value: "FE", label: "FE — First Year" },
  { value: "SE", label: "SE — Second Year" },
  { value: "TE", label: "TE — Third Year" },
  { value: "BE", label: "BE — Final Year" },
]

// A preview row with an id, so a selection survives edits and removals. The
// sheet gives a row no id of its own, and its index shifts whenever a row above
// it is removed.
type Row = PreviewRow & { id: number }

type PreviewResponse = {
  sheetNames: string[]
  activeSheet: string
  headerFound: boolean
  headerRow?: number
  rows: PreviewRow[]
  totalRows: number
  flaggedRows: number
  truncated: boolean
}

export function ImportClient({
  departments,
}: {
  /** Departments this person may set on rows whose roll number names none. */
  departments: { code: string; name: string }[]
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const file = useRef<File | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)

  const flaggedCount = useMemo(
    () => rows?.filter((r) => r.flags.length > 0).length ?? 0,
    [rows]
  )

  // Ask the server to parse a file, optionally targeting a specific sheet. The
  // raw file stays in the browser (file ref) so switching sheets just re-POSTs.
  async function runPreview(f: File, sheet?: string) {
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", f)
      if (sheet) form.append("sheet", sheet)
      const res = await fetch("/api/students/import/preview", {
        method: "POST",
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not read that file")
        return
      }
      const data = json.data as PreviewResponse
      setPreview(data)
      setRows(
        data.headerFound ? data.rows.map((r, id) => ({ ...r, id })) : null
      )
      setSelected(new Set())
      if (data.truncated) {
        toast.warning(`Only the first ${data.rows.length} rows were read.`)
      }
    } catch {
      toast.error("Upload failed. Try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleFile(f: File) {
    file.current = f
    setFileName(f.name)
    setPreview(null)
    setRows(null)
    void runPreview(f)
  }

  function switchSheet(sheet: string | null) {
    if (sheet && file.current) void runPreview(file.current, sheet)
  }

  function reset() {
    file.current = null
    setFileName(null)
    setPreview(null)
    setRows(null)
    setSelected(new Set())
  }

  // Live re-validation: as the TR fixes a cell, re-run the same flagRow the
  // server used, so red flags clear the instant they're resolved.
  function editCell(index: number, key: keyof PreviewRow, value: string) {
    setRows((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const { flags: _drop, ...fields } = next[index]
      next[index] = {
        ...flagRow({ ...fields, [key]: value }),
        id: next[index].id,
      }
      return next
    })
  }

  // Real sheets carry section labels the auto-classifier can't confidently drop
  // ("CLASS", "DSY"). The TR removes those rows here rather than being blocked.
  function removeRow(id: number) {
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev)
    select(id, false)
  }

  function select(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // The HOD's case: a sheet of sixty students all missing a year used to be
  // sixty cells typed one by one. A value set on a selection goes through
  // editRows, which re-validates each row exactly as typing into its cell would.
  function setOnSelected(
    patch: Partial<RosterFields>,
    applies: (row: Row) => boolean = () => true
  ) {
    setRows(
      (prev) =>
        prev && editRows(prev, (r) => selected.has(r.id) && applies(r), patch)
    )
  }

  // A roll that names its department keeps it: any other value would only be
  // flagged against the roll. So a department set on a selection lands on the
  // rows whose roll parses but cannot place them, and says so when it skips
  // any rather than looking as if it did nothing.
  function setDepartmentOnSelected(code: string) {
    const picked = rows?.filter((r) => selected.has(r.id)) ?? []
    const placeless = picked.filter((r) => rollNeedsDepartment(r.rollNumber))
    setOnSelected({ department: code }, (r) =>
      rollNeedsDepartment(r.rollNumber)
    )
    if (placeless.length < picked.length) {
      toast.info(
        placeless.length === 0
          ? "Nothing changed: every selected row gets its department from its roll number, or needs its roll number fixed first."
          : `Set on ${placeless.length} of ${picked.length}. The rest get their department from their roll number, or need it fixed first.`
      )
    }
  }

  function removeSelected() {
    setRows((prev) => prev?.filter((r) => !selected.has(r.id)) ?? prev)
    setSelected(new Set())
  }

  async function commit() {
    if (!rows || rows.length === 0) return
    if (flaggedCount > 0) {
      toast.error(`Resolve ${flaggedCount} flagged row(s) before importing.`)
      return
    }
    setCommitting(true)
    // Kept so the server's row numbers can be traced back by id: they count
    // places in what was sent, and the preview can change while it is in flight.
    const sent = rows
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: file.current
            ? { name: file.current.name, size: file.current.size }
            : undefined,
          rows: sent.map((r) => ({
            rollNumber: r.rollNumber,
            firstName: r.firstName,
            lastName: r.lastName || undefined,
            email: r.email || undefined,
            department: r.department,
            division: r.division || undefined,
            year: r.year,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Import failed")
        return
      }
      const { inserted, failed, errors } = json.data as {
        inserted: number
        failed: number
        errors: { row: number; message: string }[]
      }
      if (failed > 0) {
        toast.warning(`Imported ${inserted}, ${failed} failed.`)
        // Surface DB-level failures (e.g. an already-existing roll number) back
        // onto the rows so the TR can see which.
        const failures = new Map(
          errors.map((e) => [sent[e.row - 1]?.id, e.message])
        )
        setRows(
          (prev) =>
            prev?.map((r) => {
              const message = failures.get(r.id)
              return message === undefined
                ? r
                : { ...r, flags: [{ field: "rollNumber", message }] }
            }) ?? prev
        )
      } else {
        toast.success(`Imported ${inserted} students.`)
        router.push("/dashboard/students")
        router.refresh()
      }
    } catch {
      toast.error("Import failed. Try again.")
    } finally {
      setCommitting(false)
    }
  }

  // ── Upload state ──────────────────────────────────────────────────────
  if (!preview) {
    return (
      <div
        // A drop target, named as a region rather than left as a bare div with
        // handlers. Dropping is a pointer gesture with no keyboard equivalent
        // to add; the keyboard path is the button inside, which opens the same
        // picker the drop would feed.
        role="region"
        aria-label="Upload a roster"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        className="border-border hover:border-blue/50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 text-center transition-colors"
      >
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <UploadCloudIcon className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          Upload a roster
        </h2>
        <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
          An Excel sheet of students — roll number, name, and whatever columns
          you have. We find the header row, map the columns and check every roll
          number before anything is saved. Marks, SGPI and attendance are never
          imported; VERP owns those.
        </p>
        <input
          ref={fileInput}
          type="file"
          aria-label="Roster spreadsheet"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <Button
          className="mt-6"
          disabled={loading}
          onClick={() => fileInput.current?.click()}
        >
          {loading ? "Reading…" : "Choose file"}
        </Button>
      </div>
    )
  }

  // ── Sheet picker (shared by the preview and the no-header states) ──────
  const sheetPicker = preview.sheetNames.length > 1 && (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sheet</span>
      <Select
        value={preview.activeSheet}
        onValueChange={switchSheet}
        disabled={loading}
      >
        <SelectTrigger size="sm" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {preview.sheetNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  // ── No roster header on this sheet ─────────────────────────────────────
  if (!preview.headerFound || !rows) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheetIcon className="text-muted-foreground size-4" />
            <span className="font-medium">{fileName}</span>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            Choose another file
          </Button>
        </div>
        <div className="border-border flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
            <AlertTriangleIcon className="size-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold tracking-tight">
            No roster found on &ldquo;{preview.activeSheet}&rdquo;
          </h2>
          <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
            This sheet has no recognizable Roll number / Name header — it is
            probably a summary or instructions tab. Pick the sheet with the
            student list.
          </p>
          {sheetPicker && <div className="mt-5">{sheetPicker}</div>}
        </div>
      </div>
    )
  }

  const allSelected = rows.length > 0 && selected.size === rows.length
  const selectFlagged = () =>
    setSelected(
      new Set(rows.filter((r) => r.flags.length > 0).map((r) => r.id))
    )

  // ── Preview + edit state ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <FileSpreadsheetIcon className="text-muted-foreground size-4" />
            {fileName}
          </span>
          {sheetPicker}
          <span className="text-muted-foreground">
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </span>
          {flaggedCount > 0 ? (
            <>
              <span className="text-destructive">· {flaggedCount} to fix</span>
              <Button
                variant="link"
                size="xs"
                className="h-auto px-0"
                onClick={selectFlagged}
              >
                Select them
              </Button>
            </>
          ) : rows.length > 0 ? (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2Icon className="size-3.5" /> all clear
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={committing || flaggedCount > 0 || rows.length === 0}
            onClick={commit}
          >
            {committing ? "Importing…" : `Import ${rows.length} students`}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Red cells disagree with the roll number (which encodes branch and
        division) or are missing. Edit any cell to fix it — the flag clears when
        it is resolved. Tick rows to set their year
        {departments.length > 0 && " or department"} in one go, or to remove
        them together; the ✕ on a row removes just that one, such as a section
        label left in the sheet.
      </p>

      {selected.size > 0 && (
        <div className="border-blue/30 bg-blue/5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm font-medium tabular-nums">
            {selected.size} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Set year
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                {YEARS.map((y) => (
                  <DropdownMenuItem
                    key={y.value}
                    onClick={() => setOnSelected({ year: y.value })}
                  >
                    {y.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {departments.length > 0 && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Set department
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto">
                  {departments.map((d) => (
                    <DropdownMenuItem
                      key={d.code}
                      onClick={() => setDepartmentOnSelected(d.code)}
                    >
                      {d.code} — {d.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ConfirmAction
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                >
                  <Trash2Icon className="mr-1.5 size-3.5" />
                  Remove {selected.size}
                </Button>
              }
              title={`Remove ${selected.size} ${selected.size === 1 ? "row" : "rows"} from this import?`}
              description="They are left out when you import. To get them back, choose the file again."
              confirmLabel="Remove"
              onConfirm={removeSelected}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="border-border max-h-[65vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/60 sticky top-0">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">
                <Checkbox
                  checked={allSelected}
                  indeterminate={selected.size > 0 && !allSelected}
                  onCheckedChange={(v) =>
                    setSelected(
                      v ? new Set(rows.map((r) => r.id)) : new Set<number>()
                    )
                  }
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-10 text-xs">#</TableHead>
              {COLUMNS.map((c) => (
                <TableHead key={c.key} className="text-xs">
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMNS.length + 3}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  Every row has been removed. Cancel, then choose the file again
                  to start over.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row, i) => {
              const flagFor = (key: string) =>
                row.flags.find((f) => f.field === key)
              return (
                <TableRow
                  key={row.id}
                  data-state={selected.has(row.id) ? "selected" : undefined}
                  className="hover:bg-muted/30"
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={(v) => select(row.id, !!v)}
                      aria-label={`Select row ${i + 1}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {i + 1}
                  </TableCell>
                  {COLUMNS.map((c) => {
                    const flag = flagFor(c.key)
                    return (
                      <TableCell key={c.key} className="p-1">
                        <Input
                          value={String(row[c.key] ?? "")}
                          onChange={(e) => editCell(i, c.key, e.target.value)}
                          title={flag?.message}
                          className={cn(
                            "focus-visible:border-input h-8 border-transparent bg-transparent px-2 text-xs shadow-none",
                            flag &&
                              "border-destructive/40 bg-destructive/5 text-destructive"
                          )}
                        />
                        {flag && (
                          <p className="text-destructive px-2 pt-0.5 text-[10px] leading-tight">
                            {flag.message}
                          </p>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      title="Remove this row"
                      aria-label={`Remove row ${i + 1}`}
                      onClick={() => removeRow(row.id)}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
