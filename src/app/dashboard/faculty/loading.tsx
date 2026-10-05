import { Skeleton } from "@/components/ui/skeleton"

export default function FacultyLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-5 lg:px-6">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-12 rounded-none" />
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="mx-4 my-3 h-10 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
