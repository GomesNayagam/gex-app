/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        "2xs": "8px",
        "3xs": "9px",
        "4xs": "10px",
        "5xs": "11px",
        xs:    "13px",
        sm:    "15px",
      },
      colors: {
        // Ink & Glass tokens
        ink:    { 0: "var(--ink-0)", 1: "var(--ink-1)", 2: "var(--ink-2)" },
        ivory:  "var(--ivory)",
        slate2: "var(--slate)",
        "slate-dim": "var(--slate-dim)",
        gold:   "var(--gold)",
        mint:   { DEFAULT: "var(--mint)", deep: "var(--mint-deep)" },
        rose2:  { DEFAULT: "var(--rose)", deep: "var(--rose-deep)" },
        flip:   "var(--flip)",
        glass:  { DEFAULT: "var(--glass)", 2: "var(--glass-2)" },
        edge:   { DEFAULT: "var(--edge)", soft: "var(--edge-soft)" },
        // Legacy names (resolve to new palette via CSS vars)
        bg:          "var(--bg)",
        surface:     "var(--surface-1)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        green:       "var(--green)",
        red:         "var(--red)",
        blue:        "var(--blue)",
        amber:       "var(--amber)",
        "text-1":    "var(--text-1)",
        "text-2":    "var(--text-2)",
        "text-3":    "var(--text-3)",
        // shadcn semantic tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border2: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        breathe: {
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        pulse2: "pulse2 2s ease-in-out infinite",
        breathe: "breathe 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
