import { cn } from "@/lib/utils"

const variants = {
  default: "bg-[var(--glass)] text-[var(--slate)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
  ghost: "text-[var(--slate)] hover:text-[var(--ivory)] hover:bg-[var(--glass)]",
  destructive: "bg-[rgba(240,138,155,0.10)] text-[var(--rose)] shadow-[inset_0_0_0_1px_rgba(240,138,155,0.28)] hover:bg-[rgba(240,138,155,0.16)]",
}

const sizes = {
  default: "h-8 px-3 py-1.5 text-xs",
  sm: "h-7 px-2.5 py-1 text-xs",
  lg: "h-10 px-4 py-2 text-sm",
  icon: "h-8 w-8",
}

export function Button({ className, variant = "default", size = "default", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium font-mono transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}
