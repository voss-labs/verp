import { Skeleton } from "@/components/ui/skeleton"

export default function AuditLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-5 lg:px-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Skeleton className="h-4 w-24" />
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-12 rounded-none" />
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="mx-4 my-3 h-10 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
