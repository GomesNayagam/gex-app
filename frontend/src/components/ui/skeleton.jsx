import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-md bg-[var(--glass)] animate-shimmer",
        "bg-[linear-gradient(90deg,var(--glass)_25%,var(--glass-2)_50%,var(--glass)_75%)] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  )
}
