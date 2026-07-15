import "server-only"
import { getDocumentProxy } from "unpdf"

// Cells within this many PDF units of vertical distance belong to the same row.
// Rows sit ~18 units apart; a single row's glyphs jitter by 1-2 units, so a small
// tolerance keeps a row together without merging neighbours.
const ROW_TOLERANCE = 5

// Reconstruct visual lines from a PDF's text items. PDF text has no notion of
// rows — only glyphs at (x, y). We cluster items whose y is within ROW_TOLERANCE
// into one line and sort each line left-to-right, which recovers the table rows
// the roll-anchored extractor then reads. Robust to the jumbled reading order and
// sub-pixel y-jitter that plain text extraction produces on these marksheets.
export async function pdfToLines(buffer: Buffer): Promise<string[][]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const lines: string[][] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()

    const items = content.items
      .map((item) => {
        const it = item as { str?: string; transform?: number[] }
        return {
          str: (it.str ?? "").trim(),
          x: it.transform?.[4],
          y: it.transform?.[5],
        }
      })
      .filter((it): it is { str: string; x: number; y: number } => {
        return Boolean(it.str) && it.x != null && it.y != null
      })
      .sort((a, b) => b.y - a.y) // top of page first

    let cur: { x: number; str: string }[] = []
    let refY: number | null = null
    const flush = () => {
      if (cur.length)
        lines.push(cur.sort((a, b) => a.x - b.x).map((c) => c.str))
      cur = []
    }
    for (const it of items) {
      if (refY === null || refY - it.y <= ROW_TOLERANCE) {
        cur.push({ x: it.x, str: it.str })
        refY = refY === null ? it.y : Math.min(refY, it.y)
      } else {
        flush()
        cur.push({ x: it.x, str: it.str })
        refY = it.y
      }
    }
    flush()
  }

  return lines
}
