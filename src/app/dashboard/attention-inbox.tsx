import Link from "next/link"
import type { AttentionItem, Urgency } from "@/lib/attention"

/**
 * What needs doing, in the order it needs doing (spec 4.5).
 *
 * The cards below this answer "how are my classes doing". They cannot answer
 * "what should I do next", because the facts are spread one per class and the
 * thing blocking a hundred students carries the same visual weight as a
 * cosmetic gap. This is the one place that ranks them against each other.
 */

const TONE: Record<Urgency, string> = {
  blocking: "border-l-destructive",
  overdue: "border-l-attention",
  open: "border-l-border",
}

// The stripe is a repetition of the word, never the only carrier of it.
const WORD: Record<Urgency, string> = {
  blocking: "Blocking",
  overdue: "Overdue",
  open: "Open",
}

export function AttentionInbox({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">Needs your attention</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {items.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`bg-card hover:bg-muted/40 focus-visible:ring-ring flex items-start gap-3 rounded-lg border border-l-4 p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none ${TONE[item.urgency]}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {item.detail}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                {WORD[item.urgency]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
