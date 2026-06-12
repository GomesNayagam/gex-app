import { cn } from "@/lib/utils";

const variants = {
  mint:    "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.28)]",
  rose:    "text-[var(--rose)] bg-[rgba(240,138,155,0.10)] shadow-[inset_0_0_0_1px_rgba(240,138,155,0.28)]",
  flip:    "text-[var(--flip)] bg-[rgba(157,184,255,0.10)] shadow-[inset_0_0_0_1px_rgba(157,184,255,0.28)]",
  gold:    "text-[#0a0e1c] bg-[var(--gold)] font-semibold shadow-[0_0_14px_rgba(232,197,116,0.35)]",
  neutral: "text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)]",
};

// Legacy aliases
variants.default = variants.flip;
variants.positive = variants.mint;
variants.negative = variants.rose;
variants.amber = variants.gold;
variants.muted = variants.neutral;

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono",
        variants[variant] ?? variants.default,
        className,
      )}
      {...props}
    />
  );
}
