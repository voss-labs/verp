import { CircleCheckIcon } from "lucide-react"

import { AttentionGroup } from "@/components/attention-card"
import { EmptyState } from "@/components/empty-state"
import { groupAttention, type AttentionItem } from "@/lib/attention"

/**
 * What needs doing, in the order it needs doing (spec 4.5).
 *
 * The cards below this answer "how are my classes doing". They cannot answer
 * "what should I do next", because the facts are spread one per class and the
 * thing blocking a hundred students carries the same visual weight as a
 * cosmetic gap. This is the one place that ranks them against each other.
 */

export function AttentionInbox({ items }: { items: AttentionItem[] }) {
  const groups = groupAttention(items)

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CircleCheckIcon}
        title="All clear"
        description="Nothing needs your attention."
        variant="dashed"
      />
    )
  }

  return (
    <AttentionGroup
      heading="Needs your attention"
      items={groups.map((group) => ({
        severity: group.urgency,
        title: group.title,
        description: group.detail,
        scopes: group.scopes,
        href: group.href,
      }))}
    />
  )
}
