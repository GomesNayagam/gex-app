import { Skeleton } from "@/components/ui/skeleton"

function ColumnSkeleton() {
  return (
    <div className="glass-panel flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-[26px] rounded" />
        ))}
      </div>
    </div>
  )
}

export default function LoadingSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
      {Array.from({ length: count }).map((_, i) => (
        <ColumnSkeleton key={i} />
      ))}
    </div>
  )
}
