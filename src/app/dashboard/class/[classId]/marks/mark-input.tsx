"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function cellKey(row: number, col: number) {
  return `${row}:${col}`
}

export function coordsOf(el: HTMLInputElement) {
  const [row, col] = (el.dataset.cell ?? "").split(":").map(Number)
  return { row, col }
}

export function atEdge(el: HTMLInputElement, dir: number) {
  const start = el.selectionStart
  const end = el.selectionEnd
  if (start == null || end == null) return true
  return dir < 0 ? start === 0 : end === el.value.length
}

export function MarkInput({
  cell,
  label,
  value,
  max,
  locked,
  invalid,
  register,
  onChange,
  onKeyDown,
  onPaste,
  onBlur,
}: {
  cell: string
  label: string
  value: number | null
  max: number
  locked?: boolean
  invalid?: string
  register: (el: HTMLInputElement | null) => void
  onChange: React.ChangeEventHandler<HTMLInputElement>
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>
  onPaste: React.ClipboardEventHandler<HTMLInputElement>
  onBlur: React.FocusEventHandler<HTMLInputElement>
}) {
  return (
    <Input
      ref={register}
      data-cell={cell}
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value ?? ""}
      readOnly={locked}
      disabled={locked}
      aria-label={
        locked ? `${label} — locked, submitted` : `${label} of ${max}`
      }
      aria-invalid={invalid ? true : undefined}
      title={invalid}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={onBlur}
      onWheel={(e) => e.currentTarget.blur()}
      className={cn(
        "h-9 w-16 tabular-nums sm:h-8",
        locked && "bg-muted text-muted-foreground cursor-not-allowed",
        invalid &&
          "border-destructive ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/40 ring-3"
      )}
    />
  )
}
