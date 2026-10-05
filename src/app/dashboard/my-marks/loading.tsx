import { Skeleton } from "@/components/ui/skeleton"

export default function SgpiLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-5 lg:px-6">
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
