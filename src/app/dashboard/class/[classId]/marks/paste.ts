export function parseMark(raw: string, max: number): number | null {
  const text = raw.trim()
  if (text === "") return null
  const value = Number(text)
  if (!Number.isInteger(value) || value < 0 || value > max) return null
  return value
}

export function parseClipboardMatrix(text: string): string[][] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "")
  return lines.map((line) =>
    line.includes("\t") ? line.split("\t") : line.split(",")
  )
}
