import { cn } from "@/lib/utils"

export function Card({ className, ...props }) {
  return <div className={cn("glass-panel text-[var(--ivory)]", className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1 p-4", className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("font-display text-lg leading-none", className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-4 pt-0", className)} {...props} />
}
