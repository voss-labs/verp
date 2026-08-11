import { NextRequest } from "next/server"
import { extractText, getDocumentProxy } from "unpdf"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { pdfToLines, pdfToGlyphs } from "@/lib/pdf-extract"
import { parseSyllabus } from "@/lib/syllabus-import"
import { listCoursesForDepts } from "@/db/queries/courses"

export const dynamic = "force-dynamic"

// Syllabi run to a few hundred pages; the largest of the four sample
// regulations is 2.2 MB.
const MAX_BYTES = 15 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return apiError("Unauthorized", 401)
    if (!can(user, "course:create")) return apiError("Forbidden", 403)

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return apiError("No file uploaded", 400)
    if (file.size > MAX_BYTES) return apiError("File is larger than 15 MB", 400)
    if (!/\.pdf$/i.test(file.name)) return apiError("Expected a PDF", 400)

    const buffer = Buffer.from(await file.arrayBuffer())

    // Two readings of the same document: positional lines recover the scheme
    // table's columns, flowed page text carries the "Course Name / Course Code"
    // pairs on each detail page. See lib/syllabus-import for why both are needed.
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: false })
    const [lines, glyphs] = await Promise.all([
      pdfToLines(buffer),
      pdfToGlyphs(buffer),
    ])
    const parsed = parseSyllabus(lines, text as string[], glyphs)

    if (parsed.length === 0) {
      return apiError(
        "No course rows found. This should be a Scheme & Syllabus PDF containing a 'Course Structure and Assessment Guidelines' table.",
        422
      )
    }

    // Flag codes the catalogue already holds so a re-import does not look like
    // it is about to create duplicates the unique constraint would reject.
    const scope = user.tier === "super_admin" ? [] : user.deptCodes
    const existing = scope.length > 0 ? await listCoursesForDepts(scope) : []
    const known = new Set(existing.map((c) => c.courseCode.toUpperCase()))

    return apiSuccess({
      fileName: file.name,
      pages: pdf.numPages,
      courses: parsed.map((c) => ({
        ...c,
        warnings: known.has(c.courseCode)
          ? [
              ...c.warnings,
              "Already in the catalogue — importing will be skipped",
            ]
          : c.warnings,
      })),
    })
  } catch (err) {
    return apiError(getErrorMessage(err, "Could not read that PDF"), 500)
  }
}
