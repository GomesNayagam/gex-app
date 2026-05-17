import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary/20 text-blue border-blue/30",
  positive: "bg-green/10 text-green border-green/30",
  negative: "bg-red/10 text-red border-red/30",
  amber: "bg-amber/10 text-amber border-amber/30",
  muted: "bg-surface-2 text-text-2 border-border",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium font-mono",
        variants[variant] ?? variants.default,
        className,
      )}
      {...props}
    />
  );
}
