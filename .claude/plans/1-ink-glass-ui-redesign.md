# Ink & Glass UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the entire GED frontend in the approved "Ink & Glass" design language (single palette, no theme switcher), per spec `docs/superpowers/specs/2026-06-11-ink-glass-ui-redesign-design.md`.

**Architecture:** Presentation-layer-only rewrite. A single `:root` token set (with legacy CSS-var aliases so unmigrated classes degrade gracefully) replaces the three `[data-theme]` blocks; `useTheme.js` and `useSidebar.js` are deleted; chart colors become a plain constant. Shell becomes a fixed 60px icon rail + per-route header. All six views are restyled onto glass-panel primitives.

**Tech Stack:** React 18, Vite, Tailwind CSS v3, Recharts, lucide-react. Fonts: Instrument Serif, Inter, JetBrains Mono (Google Fonts). No new dependencies.

**Reference:** Approved mockup at `.superpowers/brainstorm/26329-1781230023/content/full-mockup.html` — open it in a browser when in doubt about any visual call.

**Validation reality:** This repo has no JS test infrastructure (no test script in `frontend/package.json`). Every task verifies with `npm run build` + grep checks; final task does a full browser walkthrough. Do not add a test framework.

**Branch:** Work on `feature/ink-glass-ui` (already created, spec committed).

**Working directory note:** All `npm` commands run from `frontend/`. All `git` commands run from repo root.

---

## Color migration table (used throughout — refer back here)

| Old (hex or var) | New token | Notes |
|---|---|---|
| `#22c55e`, `#4ade80`, `green-400/500`, `var(--green)` | `var(--mint)` `#6ee7c7` | positive |
| `#34d399` (deep green) | `var(--mint-deep)` `#34d2a4` | gradient base |
| `#ef4444`, `#f43f5e`, `#f87171`, `red-400/500`, `var(--red)` | `var(--rose)` `#f08a9b` | negative |
| `#3b82f6`, `blue-400/500`, `var(--blue)` | `var(--flip)` `#9db8ff` | info/active accent |
| `#f59e0b`, `#d97706`, `#d4a017`, `amber-400`, `var(--amber)` | `var(--gold)` `#e8c574` | spot + warning states |
| `#a78bfa`, `#c084fc` (purple) | `#c9a7f0` | categorical only (score segments, 0DTE) |
| `#111118`, `#0a0a0f`, `#0f0f18`, `#16161f`, `#1a1a2a`, surfaces | `var(--glass)` / `var(--glass-2)` | translucent surfaces |
| `#1e1e2a`, `#333348`, borders | `var(--edge)` / `var(--edge-soft)` | hairlines |
| `#3d3d50`, `#6b6b80` (dim text) | `var(--slate-dim)` `#5a6b8c` | tertiary text |
| `#e2e2e8`, white text | `var(--ivory)` `#f0ede6` | primary text |

Legacy CSS vars (`--surface-*`, `--border*`, `--green/red/blue/amber`, `--text-*`) are **aliased to the new palette in Task 1**, so components that still reference them pick up the new look automatically. Per-component tasks then replace *hardcoded hexes* and apply *structural* restyling (pills, serif titles, glass panels).

**⚠ Two traps (from Task 1 code review — verified empirically):**
1. **Opacity modifiers on alias colors are silent no-ops.** `bg-blue/10`, `border-amber/50`, `hover:bg-amber/15` etc. compile to NOTHING because Tailwind cannot inject alpha into a bare `var()` color. Never write `/opacity` on `green|red|blue|amber|mint|rose2|gold|flip` classes. For tinted fills use arbitrary rgba values (`bg-[rgba(110,231,199,0.10)]`) or the `--*-dim` vars — exactly as the task snippets already do.
2. **Surface aliases are now translucent.** `--surface-*` resolve to faint white rgba over the gradient, not opaque fills. Anything that was an opaque *mask* (labels overlapping content) must be migrated to an explicit opaque or solid-token background, not left on `var(--surface*)`.

---

### Task 1: Foundation — tokens, fonts, Tailwind, index.html

**Files:**
- Modify: `frontend/src/index.css` (full rewrite)
- Modify: `frontend/tailwind.config.js` (full rewrite)
- Modify: `frontend/index.html`

- [ ] **Step 1: Rewrite `frontend/src/index.css`** with exactly this content:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --radius: 0.75rem;

    /* ── Ink & Glass core tokens ───────────────────────────── */
    --ink-0: #070a14;
    --ink-1: #0a0e1c;
    --ink-2: #15203a;
    --glass:      rgba(255,255,255,0.04);
    --glass-2:    rgba(255,255,255,0.07);
    --edge:       rgba(255,255,255,0.09);
    --edge-soft:  rgba(255,255,255,0.05);
    --ivory:      #f0ede6;
    --slate:      #8fa3c8;
    --slate-dim:  #5a6b8c;
    --gold:       #e8c574;
    --mint:       #6ee7c7;
    --mint-deep:  #34d2a4;
    --rose:       #f08a9b;
    --rose-deep:  #e0596e;
    --flip:       #9db8ff;

    /* ── Legacy aliases — keep unmigrated classes rendering ── */
    --bg:          var(--ink-1);
    --surface-1:   rgba(255,255,255,0.03);
    --surface:     rgba(255,255,255,0.03);
    --surface-2:   rgba(255,255,255,0.05);
    --surface-3:   rgba(255,255,255,0.08);
    --border:      var(--edge);
    --border-soft: var(--edge-soft);
    --border-color: var(--edge);
    --green:       var(--mint);
    --red:         var(--rose);
    --blue:        var(--flip);
    --amber:       var(--gold);
    --green-dim:   rgba(110,231,199,0.10);
    --red-dim:     rgba(240,138,155,0.10);
    --blue-dim:    rgba(157,184,255,0.10);
    --amber-dim:   rgba(232,197,116,0.10);
    --text-1:      var(--ivory);
    --text-2:      var(--slate);
    --text-3:      var(--slate-dim);

    /* Chart aliases (palette.js is the canonical source) */
    --chart-grid:  rgba(255,255,255,0.05);
    --chart-axis:  #5a6b8c;
    --chart-pos:   #6ee7c7;
    --chart-neg:   #f08a9b;
    --chart-flip:  #9db8ff;

    /* shadcn semantic tokens (single set) */
    --background: 225 42% 7%;
    --foreground: 40 25% 92%;
    --card: 225 41% 9%;
    --card-foreground: 40 25% 92%;
    --primary: 224 100% 81%;
    --primary-foreground: 225 42% 7%;
    --muted: 222 30% 12%;
    --muted-foreground: 219 27% 57%;
    --accent: 222 30% 15%;
    --accent-foreground: 40 25% 92%;
    --destructive: 350 77% 75%;
    --destructive-foreground: 225 42% 7%;
    --input: 222 30% 12%;
    --ring: 224 100% 81%;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { overflow-x: hidden; }

  html { scroll-behavior: smooth; }

  body {
    background: radial-gradient(120% 90% at 18% -10%, var(--ink-2) 0%, var(--ink-1) 48%, var(--ink-0) 100%) fixed;
    color: var(--ivory);
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--edge); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--slate-dim); }
}

@layer components {
  .glass-panel {
    background: var(--glass);
    border: 1px solid var(--edge);
    border-radius: 16px;
    backdrop-filter: blur(14px);
    box-shadow: 0 12px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .glass-strip {
    background: rgba(255,255,255,0.018);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--edge-soft);
  }
  .glass-input {
    background: var(--glass);
    border: 1px solid var(--edge);
    color: var(--ivory);
    outline: none;
  }
  .glass-input::placeholder { color: var(--slate-dim); }
  .glass-input:focus { border-color: rgba(232,197,116,0.55); }
}

@layer utilities {
  .gex-positive { color: var(--mint); }
  .gex-negative { color: var(--rose); }
  .font-display { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes breathe {
  50% { opacity: 0.45; }
}
```

- [ ] **Step 2: Rewrite `frontend/tailwind.config.js`** with exactly this content (drops `darkMode`, swaps fonts, adds new tokens, keeps legacy names):

```js
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
```

- [ ] **Step 3: Update `frontend/index.html`** — replace the entire `<head>` contents so the file reads exactly:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0e1c" />
    <title>GED — Gamma Exposure Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

(The `data-theme` bootstrap `<script>` block is deleted; IBM Plex font link is replaced.)

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: `✓ built in …` with no errors. (The app still references `useTheme` from Settings/charts — that's fine, the hook file still exists until Task 2.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/tailwind.config.js frontend/index.html
git commit -m "feat(ui): Ink & Glass design tokens, fonts, single-palette CSS"
```

---

### Task 2: Remove theme machinery (`useTheme`, Settings theme section, chart color hook)

**Files:**
- Create: `frontend/src/lib/palette.js`
- Modify: `frontend/src/components/IntradayChart.jsx`
- Modify: `frontend/src/components/GEXProfileChart.jsx`
- Modify: `frontend/src/views/Settings.jsx`
- Delete: `frontend/src/hooks/useTheme.js`

- [ ] **Step 1: Create `frontend/src/lib/palette.js`**:

```js
// Canonical Ink & Glass data colors. Charts and JS-side styling import from
// here; CSS reads the same values from :root tokens in index.css.
export const CHART = {
  grid: "rgba(255,255,255,0.05)",
  axis: "#5a6b8c",
  pos:  "#6ee7c7",
  neg:  "#f08a9b",
  flip: "#9db8ff",
  gold: "#e8c574",
}

// Signal score tiers (UOA views)
export const SCORE_TIERS = [
  { min: 90, color: "#6ee7c7" }, // elite — mint
  { min: 80, color: "#9db8ff" }, // high  — flip
  { min: 60, color: "#e8c574" }, // mid   — gold
  { min: 0,  color: "#5a6b8c" }, // low   — slate-dim
]

export function scoreColor(score) {
  return SCORE_TIERS.find((t) => score >= t.min)?.color ?? "#5a6b8c"
}

// Score-breakdown categorical segments (UOA)
export const SEGMENT_COLORS = {
  premium:      "#9db8ff",
  size_vs_oi:   "#6ee7c7",
  aggressor:    "#e8c574",
  sweep:        "#c9a7f0",
  opening_bias: "#34d2a4",
  tenor:        "#8fa3c8",
}
```

- [ ] **Step 2: Swap the color source in `frontend/src/components/IntradayChart.jsx`**

Replace:
```js
import { useThemeColors } from "@/hooks/useTheme";
```
with:
```js
import { CHART } from "@/lib/palette";
```
and replace:
```js
  const c = useThemeColors();
```
with:
```js
  const c = CHART;
```

- [ ] **Step 3: Same swap in `frontend/src/components/GEXProfileChart.jsx`**

Replace:
```js
import { useThemeColors } from "@/hooks/useTheme"
```
with:
```js
import { CHART } from "@/lib/palette"
```
and replace:
```js
  const c = useThemeColors()
```
with:
```js
  const c = CHART
```

- [ ] **Step 4: Remove the theme section from `frontend/src/views/Settings.jsx`**

1. Delete the import line: `import { useTheme } from "@/hooks/useTheme"`
2. Delete the entire `DisplayPanel()` function (the `function DisplayPanel() { … }` block that renders the Theme `<select>`).
3. In the `NAV` array, delete the line `{ id: "display", label: "Display", icon: "◈" },`
4. Change `const [active, setActive] = useState("display")` to `const [active, setActive] = useState("data")`
5. Delete the render line `{active === "display" && <DisplayPanel />}`

- [ ] **Step 5: Delete the hook**

Run: `rm frontend/src/hooks/useTheme.js`

- [ ] **Step 6: Grep-verify zero references remain**

Run: `grep -rn "useTheme\|useThemeColors\|data-theme\|gex.theme\|bloomberg\|THEMES" frontend/src frontend/index.html`
Expected: no output.

- [ ] **Step 7: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A frontend/src
git commit -m "feat(ui): remove theme switcher — single Ink & Glass palette"
```

---

### Task 3: UI primitives — Card, Badge, Button, Skeleton, Tabs

Export names stay identical so existing imports keep working. New variant names are added; legacy variant names are kept as aliases.

**Files:**
- Modify: `frontend/src/components/ui/card.jsx`
- Modify: `frontend/src/components/ui/badge.jsx`
- Modify: `frontend/src/components/ui/button.jsx`
- Modify: `frontend/src/components/ui/skeleton.jsx`
- Modify: `frontend/src/components/ui/tabs.jsx`

- [ ] **Step 1: Rewrite `card.jsx`** (glass panel):

```jsx
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
```

- [ ] **Step 2: Rewrite `badge.jsx`** (soft pills; tinted fill + inset ring; legacy variant names alias to new ones):

```jsx
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
```

- [ ] **Step 3: Rewrite `button.jsx`** (glass pills, no solid primaries):

```jsx
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
```

- [ ] **Step 4: Rewrite `skeleton.jsx`** (shimmer over glass):

```jsx
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
```

- [ ] **Step 5: Rewrite `tabs.jsx`** (pill tabs, mint active — context API unchanged):

```jsx
import { createContext, useContext, useState } from "react"
import { cn } from "@/lib/utils"

const TabsCtx = createContext(null)

export function Tabs({ defaultValue, value, onValueChange, className, children }) {
  const [internal, setInternal] = useState(defaultValue)
  const active = value ?? internal
  const setActive = onValueChange ?? setInternal
  return (
    <TabsCtx.Provider value={{ active, setActive }}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </TabsCtx.Provider>
  )
}

export function TabsList({ className, ...props }) {
  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

export function TabsTrigger({ value, className, ...props }) {
  const { active, setActive } = useContext(TabsCtx)
  const isActive = active === value
  return (
    <button
      onClick={() => setActive(value)}
      className={cn(
        "rounded-full px-3 py-1 text-[10px] font-mono transition-colors duration-150",
        isActive
          ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.25)]"
          : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
        className
      )}
      {...props}
    />
  )
}

export function TabsContent({ value, className, children }) {
  const { active } = useContext(TabsCtx)
  if (active !== value) return null
  return <div className={cn("mt-3", className)}>{children}</div>
}
```

- [ ] **Step 6: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/components/ui
git commit -m "feat(ui): glass-pill primitives — Card, Badge, Button, Skeleton, Tabs"
```

---

### Task 4: Shell — icon rail, header, market clock, header-actions portal

**Files:**
- Create: `frontend/src/components/shell/HeaderActions.jsx`
- Modify: `frontend/src/components/shell/Sidebar.jsx` (full rewrite → fixed icon rail)
- Modify: `frontend/src/components/shell/TopBar.jsx` (full rewrite)
- Modify: `frontend/src/components/shell/MarketClock.jsx` (full rewrite)
- Modify: `frontend/src/components/shell/AppShell.jsx`
- Delete: `frontend/src/hooks/useSidebar.js`

- [ ] **Step 1: Create `frontend/src/components/shell/HeaderActions.jsx`** (lets views portal controls — e.g. the pause button — into the header without lifting state):

```jsx
import { createContext, useContext, useState } from "react"
import { createPortal } from "react-dom"

const Ctx = createContext({ node: null, setNode: () => {} })

export function HeaderActionsProvider({ children }) {
  const [node, setNode] = useState(null)
  return <Ctx.Provider value={{ node, setNode }}>{children}</Ctx.Provider>
}

// Rendered once inside TopBar — the mount point.
export function HeaderActionsSlot() {
  const { setNode } = useContext(Ctx)
  return <div ref={setNode} className="flex items-center gap-2" />
}

// Used by views: <HeaderActions><button …/></HeaderActions>
export function HeaderActions({ children }) {
  const { node } = useContext(Ctx)
  if (!node) return null
  return createPortal(children, node)
}
```

- [ ] **Step 2: Rewrite `frontend/src/components/shell/Sidebar.jsx`** as the fixed 60px rail:

```jsx
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Star,
  CalendarRange,
  Settings2,
  Flame,
  BotMessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/b3", icon: LayoutGrid, label: "Gamma Ladders" },
  { to: "/watch", icon: Star, label: "Flow List" },
  { to: "/expiry", icon: CalendarRange, label: "Gamma Horizon" },
  { to: "/uoa", icon: Flame, label: "Flow Signals" },
  { to: "/agent", icon: BotMessageSquare, label: "Agent" },
];

function RailLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cn(
          "flex items-center justify-center w-[38px] h-[38px] rounded-[11px] transition-all duration-150",
          isActive
            ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.22),0_0_18px_rgba(110,231,199,0.07)]"
            : "text-[var(--slate-dim)] hover:text-[var(--slate)] hover:bg-[var(--glass)]",
        )
      }
    >
      <Icon size={17} strokeWidth={1.6} />
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <div className="flex flex-col items-center shrink-0 w-[60px] py-3.5 gap-1.5 bg-[rgba(255,255,255,0.025)] border-r border-[var(--edge-soft)] backdrop-blur-xl">
      <span
        className="font-display text-[15px] leading-none text-[var(--ivory)] mb-4 select-none"
        title="Gamma Exposure Dashboard"
      >
        GED<span className="text-[var(--gold)]">.</span>
      </span>

      <nav className="flex flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}
      </nav>

      <div className="flex-1" />

      <RailLink to="/settings" icon={Settings2} label="Settings" />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `frontend/src/components/shell/TopBar.jsx`** (per-route serif titles + clock + actions slot):

```jsx
import { useLocation } from "react-router-dom"
import MarketClock from "./MarketClock"
import { HeaderActionsSlot } from "./HeaderActions"

const PAGES = {
  "/b3":       { title: "Gamma Ladders", sub: "SPX · SPY · QQQ — live dealer positioning" },
  "/watch":    { title: "Flow List", sub: "custom tickers — pinned ladders" },
  "/expiry":   { title: "Gamma Horizon", sub: "single-expiry deep dive" },
  "/uoa":      { title: "Flow Signals", sub: "unusual options activity — scored tape" },
  "/agent":    { title: "Agent", sub: "market structure copilot" },
  "/settings": { title: "Settings", sub: "configuration" },
}

export default function TopBar() {
  const { pathname } = useLocation()
  const page = PAGES[pathname] ?? PAGES["/b3"]

  return (
    <div className="glass-strip relative h-[58px] px-6 flex items-center gap-3.5 shrink-0">
      <span className="font-display text-[23px] leading-none tracking-[0.01em] text-[var(--ivory)]">
        {page.title}
      </span>
      <span className="hidden md:block font-mono text-[10px] tracking-[0.08em] text-[var(--slate-dim)]">
        {page.sub}
      </span>

      <div className="flex-1" />

      <HeaderActionsSlot />

      <MarketClock />
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `frontend/src/components/shell/MarketClock.jsx`** (glass pill, breathing mint dot — session logic preserved):

```jsx
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

function getSession(nyHour, nyMinute) {
  const mins = nyHour * 60 + nyMinute
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return { label: "PRE-MARKET", live: false }
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return { label: "MARKET OPEN", live: true }
  if (mins >= 16 * 60 && mins < 20 * 60) return { label: "AFTER HOURS", live: false }
  return { label: "MARKET CLOSED", live: false }
}

export default function MarketClock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const nyTime = time.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const nyDate = new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const session = getSession(nyDate.getHours(), nyDate.getMinutes())

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--slate)] bg-[var(--glass)] rounded-full px-3.5 py-[5px] shadow-[inset_0_0_0_1px_var(--edge)]">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          session.live
            ? "bg-[var(--mint)] shadow-[0_0_8px_var(--mint)] animate-breathe"
            : "bg-[var(--slate-dim)]",
        )}
      />
      <span className="whitespace-nowrap">
        {session.label} · {nyTime} ET
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Update `frontend/src/components/shell/AppShell.jsx`** (transparent over body gradient, provider wired):

```jsx
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import { HeaderActionsProvider } from "./HeaderActions"

export default function AppShell({ children }) {
  return (
    <HeaderActionsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </HeaderActionsProvider>
  )
}
```

- [ ] **Step 6: Delete the sidebar hook**

Run: `rm frontend/src/hooks/useSidebar.js`
Then: `grep -rn "useSidebar" frontend/src` — expected: no output.

- [ ] **Step 7: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add -A frontend/src
git commit -m "feat(ui): icon-rail shell with serif header and glass market clock"
```

---

### Task 5: Strike ladder — StrikeRow + InstrumentColumn

**Files:**
- Modify: `frontend/src/components/StrikeRow.jsx` (full rewrite)
- Modify: `frontend/src/components/InstrumentColumn.jsx` (targeted edits)

- [ ] **Step 1: Rewrite `frontend/src/components/StrikeRow.jsx`**:

```jsx
import { fmtGex, fmtStrike } from "@/lib/format"
import { cn } from "@/lib/utils"

const MAX_W = 44

const TAG_CLASS = {
  "Call Wall": "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.28)]",
  "γ Flip":    "text-[var(--flip)] bg-[rgba(157,184,255,0.10)] shadow-[inset_0_0_0_1px_rgba(157,184,255,0.28)]",
  "Put Wall":  "text-[var(--rose)] bg-[rgba(240,138,155,0.10)] shadow-[inset_0_0_0_1px_rgba(240,138,155,0.28)]",
}

export default function StrikeRow({ d, symbol, maxNet, maxCall, maxPut, compact = false, tags = [] }) {
  const isPos = d.net_gex >= 0
  const netW  = (Math.abs(d.net_gex) / maxNet) * MAX_W
  const callW = (d.call_gex / maxCall) * MAX_W
  const putW  = (Math.abs(d.put_gex) / maxPut) * MAX_W

  return (
    <div className={cn(
      "group grid items-center min-h-[30px] px-4 border-b border-[rgba(255,255,255,0.025)] overflow-x-hidden",
      compact && "min-h-[20px] py-0.5",
      "grid-cols-[minmax(80px,auto)_1fr_56px] gap-x-0 transition-colors duration-100",
      d.is_flip ? "bg-[rgba(157,184,255,0.04)] hover:bg-[rgba(157,184,255,0.07)]" : "hover:bg-[rgba(255,255,255,0.03)]",
    )}>
      {/* Strike + tags */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn(
          "font-mono tabular-nums text-[10.5px] tracking-wide flex-none text-[var(--slate)]",
          d.is_spot && "text-[var(--ivory)] font-semibold",
        )}>
          {fmtStrike(symbol, d.strike)}
        </span>
        {tags.map((t) => (
          <span
            key={t.label}
            className={cn(
              "font-sans text-[8px] font-semibold tracking-[0.04em] px-[7px] py-px rounded-full whitespace-nowrap",
              TAG_CLASS[t.label] ?? "text-[var(--slate)] shadow-[inset_0_0_0_1px_var(--edge)]",
            )}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Bar area */}
      <div className="relative h-[18px]">
        {/* Center axis */}
        <div className="absolute left-1/2 top-[4px] bottom-[4px] w-px bg-[var(--edge)]" />

        {/* Ghost call bar */}
        <div
          className="absolute top-[4px] left-1/2 h-[2px] rounded-full bg-[var(--mint-deep)] opacity-[0.28]"
          style={{ width: `${callW}%` }}
        />

        {/* Ghost put bar */}
        <div
          className="absolute bottom-[4px] right-1/2 h-[2px] rounded-full bg-[var(--rose-deep)] opacity-[0.28]"
          style={{ width: `${putW}%` }}
        />

        {/* Net bar */}
        {isPos ? (
          <div
            className="absolute top-1/2 left-1/2 h-[6px] -translate-y-1/2 rounded-[4px] bg-gradient-to-r from-[var(--mint-deep)] to-[var(--mint)] shadow-[0_0_10px_rgba(52,210,164,0.35)]"
            style={{ width: `${netW}%` }}
          />
        ) : (
          <div
            className="absolute top-1/2 right-1/2 h-[6px] -translate-y-1/2 rounded-[4px] bg-gradient-to-l from-[var(--rose-deep)] to-[var(--rose)] shadow-[0_0_10px_rgba(224,89,110,0.32)]"
            style={{ width: `${netW}%` }}
          />
        )}
      </div>

      {/* Net GEX value */}
      <span className={cn(
        "font-mono tabular-nums text-[10.5px] text-right tracking-wide",
        isPos ? "text-[var(--mint)]" : "text-[var(--rose)]",
      )}>
        {fmtGex(d.net_gex)}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Edit `frontend/src/components/InstrumentColumn.jsx`** — apply each of these exact replacements (behavior — sort, resize, scroll-to-spot — is untouched):

1. Replace the `TAG_COLOR` constant:
```js
const TAG_COLOR = {
  call: "#6ee7c7",
  flip: "#9db8ff",
  put: "#f08a9b",
};
```

2. Ladder card wrapper — replace
```jsx
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
```
with
```jsx
      <div className="glass-panel overflow-hidden flex flex-col">
```

3. Header block — replace the header `<div>` (the one containing the symbol span and both Badges) with:
```jsx
          <div
            className={cn(
              "flex items-baseline gap-2.5",
              compact ? "px-3 pt-2 pb-1" : "px-4 pt-3.5 pb-2",
            )}
          >
            <span
              className={cn(
                "font-display leading-none text-[var(--ivory)]",
                compact ? "text-base" : "text-[22px]",
              )}
            >
              {symbol}
            </span>
            <Badge variant={isPos == "positive" ? "mint" : "rose"}>
              {isPos == "positive" ? "+GEX · LONG γ" : "−GEX · SHORT γ"}
            </Badge>
            <span className="ml-auto font-mono text-[12px] font-bold tracking-[0.02em] text-[var(--gold)]">
              {fmtSpot(symbol, spot)}
            </span>
          </div>
```

4. Sub-header stats row — replace its wrapper className
`"flex items-center justify-between px-4 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]"`
with
`"flex items-center gap-3.5 px-4 pb-3"`
and inside it: change every label span from `text-text-2` to `text-[var(--slate-dim)]`, every positive value class from `text-green` to `text-[var(--mint-deep)]`, every negative from `text-red` to `text-[var(--rose-deep)]`, and the `flow_direction` span from `text-pink-600` to `text-[var(--slate)]` (pink is off-palette). Keep the "N strikes" span but move it after the Chex span with class `font-mono text-[8px] uppercase tracking-widest text-[var(--slate-dim)] ml-auto`.

5. Column headers row — replace its wrapper className with
`"grid grid-cols-[minmax(80px,auto)_1fr_56px] px-4 py-1.5 bg-[rgba(255,255,255,0.015)] border-y border-[var(--edge-soft)]"`
and change each `text-text-2` inside it to `text-[var(--slate-dim)]`, adding `tracking-[0.18em]` in place of `tracking-widest`. In the sort button's inline style, replace `color: netGexSort ? "var(--amber)" : "var(--text-2)"` with `color: netGexSort ? "var(--mint)" : "var(--slate-dim)"`.

6. Spot divider — replace the spot-line block (`{d.is_spot && (…)}`) inner content with:
```jsx
                <div
                  ref={spotRef}
                  className="relative h-px z-10 overflow-visible"
                >
                  <div
                    className="absolute inset-0 opacity-75"
                    style={{ background: "linear-gradient(90deg, transparent, var(--gold) 18%, var(--gold) 82%, transparent)" }}
                  />
                  <div className="absolute right-3 -top-[9px] font-mono text-[8.5px] font-bold text-[#0a0e1c] bg-[var(--gold)] rounded-full px-2 py-[2px] whitespace-nowrap tracking-[0.04em] shadow-[0_0_14px_rgba(232,197,116,0.35)]">
                    SPOT {fmtSpot(symbol, spot)}
                  </div>
                </div>
```

7. Drag handle — replace its wrapper `style={{ background: "var(--surface-2)" }}` with `style={{ background: "rgba(255,255,255,0.015)" }}`, replace `border-t border-[var(--border)]` with `border-t border-[var(--edge-soft)]`, and the inner span classes `text-[var(--border)] group-hover:text-[var(--text-3)]` with `text-[var(--slate-dim)] opacity-40 group-hover:opacity-100`.

- [ ] **Step 3: Verify build, then visual smoke-check**

Run: `cd frontend && npm run build` — expected: success.
Optionally run `./start.sh` from repo root and eyeball `/b3` against the mockup.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StrikeRow.jsx frontend/src/components/InstrumentColumn.jsx
git commit -m "feat(ui): glass ladder — glowing net bars, gold spot line, level pills"
```

---### Task 6: B3 Mode + LoadingSkeleton

**Files:**
- Modify: `frontend/src/views/B3Mode.jsx`
- Modify: `frontend/src/components/LoadingSkeleton.jsx`

- [ ] **Step 1: Edit `frontend/src/views/B3Mode.jsx`**:

1. Add import: `import { HeaderActions } from "@/components/shell/HeaderActions";`
2. Replace the "View toolbar" block (the `<div className="flex items-center justify-end mb-3">…</div>` containing the pause button) with a header portal — the pause pill moves into the TopBar:
```jsx
      <HeaderActions>
        <button
          onClick={togglePause}
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] px-3.5 py-[5px] rounded-full transition-colors duration-150",
            paused
              ? "text-[var(--gold)] bg-[rgba(232,197,116,0.10)] shadow-[inset_0_0_0_1px_rgba(232,197,116,0.35)]"
              : "text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)]",
          )}
          title={paused ? "Resume auto-refresh" : "Pause auto-refresh"}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "resume" : "pause"}
        </button>
      </HeaderActions>
```
3. Content padding: change the root `<div className="p-4 overflow-y-auto h-full">` to `<div className="p-6 overflow-y-auto h-full">` and the grid `gap-4` to `gap-[18px]`.
4. Error state — replace the error block with:
```jsx
      <div className="flex items-center justify-center p-8 h-full">
        <div className="glass-panel max-w-md p-5 shadow-[inset_0_0_0_1px_rgba(240,138,155,0.25)]">
          <p className="font-mono text-xs font-semibold text-[var(--rose)] mb-1">
            API Error
          </p>
          <p className="font-mono text-[10px] text-[var(--slate)]">{error}</p>
        </div>
      </div>
```
5. Intraday section — replace the section header block (the `flex items-center gap-2 mb-3` div with the "Intraday GEX Evolution" span, Badge, and symbol buttons) with:
```jsx
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <span className="font-display text-[17px] text-[var(--ivory)]">
              Intraday Evolution
            </span>
            <span className="font-mono text-[9px] tracking-[0.1em] text-[var(--slate-dim)]">
              NET GEX · SESSION
            </span>
            <div className="flex gap-1.5 ml-auto">
              {instruments.map((i) => (
                <button
                  key={i.symbol}
                  onClick={() => setActiveSymbol(i.symbol)}
                  className={cn(
                    "font-mono text-[9px] px-2.5 py-[3px] rounded-full transition-colors duration-150",
                    effectiveSymbol === i.symbol
                      ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.25)]"
                      : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
                  )}
                >
                  {i.symbol}
                </button>
              ))}
            </div>
          </div>
```
6. Remove the now-unused `Badge` import if nothing else in the file uses it. Keep `Pause, Play` imports (still used in the portal button).

- [ ] **Step 2: Rewrite `frontend/src/components/LoadingSkeleton.jsx`** to mirror the new ladder panel shape:

```jsx
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
```

- [ ] **Step 3: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/views/B3Mode.jsx frontend/src/components/LoadingSkeleton.jsx
git commit -m "feat(ui): B3 view — header pause portal, serif intraday section, glass skeletons"
```

---

### Task 7: Charts — IntradayChart + GEXProfileChart

**Files:**
- Modify: `frontend/src/components/IntradayChart.jsx`
- Modify: `frontend/src/components/GEXProfileChart.jsx`

- [ ] **Step 1: Edit `IntradayChart.jsx`** (palette import done in Task 2; now the visuals):

1. Replace the `CustomTooltip` wrapper className with:
`"glass-panel px-3 py-2 font-mono text-[10px]"` and inside it change `text-text-2` to `text-[var(--slate-dim)]`.
2. Replace the outer container `className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"` with `className="glass-panel p-4"`.
3. In the header strip, change both `text-text-3` to `text-[var(--slate-dim)]`, and the live indicator `text-green-400` to `text-[var(--mint)]`.
4. In the empty-state `<p>`, change `text-text-3` to `text-[var(--slate-dim)]` and wrap the message in the serif empty-state treatment:
```jsx
        <div className="py-8 text-center">
          <p className="font-display text-[15px] text-[var(--slate)]">
            {inSession ? "Waiting for snapshots" : "Market is closed"}
          </p>
          <p className="font-mono text-[9px] text-[var(--slate-dim)] mt-1">
            {inSession
              ? "Snapshots accumulate during the session (60s interval)"
              : "No session data"}
          </p>
        </div>
```
5. Both `XAxis`/`YAxis` `tick` props: change `fontFamily: "IBM Plex Mono"` to `fontFamily: "JetBrains Mono"`.
6. Spot `<Line>`: change `stroke="#d89a48"` to `stroke={c.gold}` and `strokeDasharray={2,3}` (a bug — evaluates to `3`) to `strokeDasharray="3 5"`.
7. Net GEX `<Line>`: keep `stroke={isPos ? c.pos : c.neg}`; add prop `style={{ filter: isPos ? "drop-shadow(0 0 6px rgba(110,231,199,0.45))" : "drop-shadow(0 0 6px rgba(240,138,155,0.4))" }}`.

- [ ] **Step 2: Edit `GEXProfileChart.jsx`**:

1. Tooltip wrapper className → `"glass-panel px-3 py-2 font-mono text-[10px] space-y-0.5"`; inside, `text-text-2` → `text-[var(--slate-dim)]`.
2. Container className → `"glass-panel p-4"`.
3. Title `<p>` — replace with:
```jsx
      <p className="font-display text-[15px] text-[var(--ivory)] mb-3">
        GEX Profile <span className="font-mono not-italic text-[9px] tracking-[0.1em] text-[var(--slate-dim)] ml-2">CALL VS PUT BY STRIKE</span>
      </p>
```
4. Both tick `fontFamily` values → `"JetBrains Mono"`.
5. Bars: `radius={[2,2,0,0]}` → `radius={[3,3,0,0]}` on calls, `radius={[0,0,2,2]}` → `radius={[0,0,3,3]}` on puts.

- [ ] **Step 3: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/components/IntradayChart.jsx frontend/src/components/GEXProfileChart.jsx
git commit -m "feat(ui): charts on Ink & Glass palette — glow lines, gold spot, glass tooltips"
```

---

### Task 8: Flow List (WatchlistMode) + Gamma Horizon (ExpiryMode)

These two views share the same panel/toolbar patterns. Behavior (pause loops, pinning, localStorage) is untouched.

**Files:**
- Modify: `frontend/src/views/WatchlistMode.jsx`
- Modify: `frontend/src/views/ExpiryMode.jsx`

- [ ] **Step 1: Edit `WatchlistMode.jsx`** toolbar + panels:

1. `WatchPanel` wrapper — replace
```jsx
      className={cn(
        "flex flex-col border rounded-sm bg-[var(--surface-1)] min-w-[320px] flex-shrink-0",
        pinned ? "border-blue/40" : "border-[var(--border)]"
      )}
```
with
```jsx
      className={cn(
        "glass-panel flex flex-col min-w-[320px] flex-shrink-0",
        pinned && "shadow-[inset_0_0_0_1px_rgba(110,231,199,0.3),0_12px_36px_rgba(0,0,0,0.35)]"
      )}
```
2. `WatchPanel` header — replace its wrapper className with `"flex items-center gap-2 px-3.5 py-2 border-b border-[var(--edge-soft)] flex-none"`; change the symbol span to `className="font-display text-[15px] leading-none text-[var(--ivory)]"`; the 0DTE span `text-amber` → pill `className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-px rounded-full text-[var(--gold)] shadow-[inset_0_0_0_1px_rgba(232,197,116,0.35)]"`; the pinned span `text-blue` → `text-[var(--mint)]`; the pin button active color `text-blue` → `text-[var(--mint)]`; close button hover `hover:text-[var(--red)]` → `hover:text-[var(--rose)]`.
3. Toolbar — replace the top-bar wrapper `className="flex-none flex flex-wrap items-center gap-2 px-4 py-2 border-b"` + `style={{ borderColor: "var(--border)" }}` with `className="glass-strip flex-none flex flex-wrap items-center gap-2 px-6 py-2.5"` (delete the style prop).
4. Ticker input — replace its className/style with:
```jsx
            className="glass-input font-mono text-[11px] px-3 py-1 rounded-full w-28"
```
(delete the `style={{…}}` prop).
5. Add button (`<Plus>`) — className → `"p-1.5 rounded-full text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)] transition-colors"` (delete style prop).
6. Watchlist chips — replace the chip button classes with:
```jsx
                className={cn(
                  "font-mono text-[10px] px-2.5 py-[3px] rounded-full flex items-center gap-1 transition-colors duration-150",
                  isOpen
                    ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.25)]"
                    : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
                )}
```
(delete the conditional `style` prop).
7. 0DTE toggle — same pattern, gold when active:
```jsx
          className={cn(
            "flex items-center gap-1 font-mono text-[10px] px-2.5 py-[3px] rounded-full transition-colors duration-150",
            zeroDTE
              ? "text-[var(--gold)] bg-[rgba(232,197,116,0.10)] shadow-[inset_0_0_0_1px_rgba(232,197,116,0.35)]"
              : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
          )}
```
(delete the conditional `style` prop).
8. "Close unpinned" button — className → `"font-mono text-[10px] px-2.5 py-1 rounded-full text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--rose)] transition-colors"`.
9. Pause button — replace with the same gold/glass pause pill used in B3Mode (Task 6 Step 1.2 — copy that exact button JSX, it uses this view's local `paused`/`togglePause`).
10. Empty state — replace the centered span with:
```jsx
            <div className="text-center">
              <p className="font-display text-[17px] text-[var(--slate)]">
                {watchlist.length === 0 ? "Add a ticker to get started" : "Click a ticker chip to open a panel"}
              </p>
              <p className="font-mono text-[9px] tracking-[0.08em] text-[var(--slate-dim)] mt-1.5">
                LADDERS OPEN AS PINNED PANELS
              </p>
            </div>
```
11. Error text inside panels: `text-[var(--red)]` → `text-[var(--rose)]`. Loading text `text-[var(--text-3)]` stays (alias).

- [ ] **Step 2: Edit `ExpiryMode.jsx`** with the same treatment:

1. `ExpiryPanel` wrapper, header, pin/close buttons, pinned indicator: identical replacements as WatchlistMode steps 1–2 (mint pin accent, glass panel, serif symbol, rose hover on close). The date span beside the symbol becomes `className="font-mono text-[9px] text-[var(--slate-dim)]"`.
2. Toolbar wrapper — `className="flex-none border-b border-[var(--border)] px-4 py-2"` → `className="glass-strip flex-none px-6 py-2.5"`.
3. Symbol input — `className="glass-input font-mono text-[11px] px-3 py-1 rounded-full w-24 uppercase"` (delete old border classes).
4. Watchlist quick-pick buttons — same mint pill pattern as WatchlistMode step 6 (active when `symbol === sym`).
5. Date input — keep `colorScheme: "dark"` in style but replace the rest:
```jsx
            className="glass-input font-mono text-[10px] px-3 py-1 rounded-full"
            style={{ colorScheme: "dark" }}
```
6. "+ Add Panel" button — className → `"font-mono text-[10px] px-3 py-1 rounded-full text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"`.
7. "Close unpinned" + pause buttons — same as WatchlistMode steps 8–9.
8. Empty state — serif treatment:
```jsx
            <div className="text-center">
              <p className="font-display text-[17px] text-[var(--slate)]">
                Pick a symbol and expiration date
              </p>
              <p className="font-mono text-[9px] tracking-[0.08em] text-[var(--slate-dim)] mt-1.5">
                PANELS PIN TO THIS VIEW
              </p>
            </div>
```

- [ ] **Step 3: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/views/WatchlistMode.jsx frontend/src/views/ExpiryMode.jsx
git commit -m "feat(ui): Flow List and Gamma Horizon on glass panels and pill controls"
```

---

### Task 9: Flow Signals (UOA) — strips, tape, rows

**Files:**
- Modify: `frontend/src/components/uoa/UOATopBar.jsx`
- Modify: `frontend/src/components/uoa/UOAWatchlistRow.jsx`
- Modify: `frontend/src/components/uoa/UOATabsRow.jsx`
- Modify: `frontend/src/components/uoa/UOASummaryStrip.jsx`
- Modify: `frontend/src/components/uoa/SignalTape.jsx`
- Modify: `frontend/src/views/UOAMode.jsx`

General rule for this task: every hardcoded hex goes through the **color migration table** at the top of this plan; every square `rounded-sm` filter/chip becomes a `rounded-full` pill; solid-fill active states become tinted-fill + inset-ring.

- [ ] **Step 1: `UOATopBar.jsx`**

1. Wrapper — `"shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 py-2 …"` → `"glass-strip shrink-0 px-6 py-2.5 flex flex-wrap items-center gap-3 font-mono text-[11px]"`.
2. Window buttons — replace className + style logic with:
```jsx
            className={cn(
              "px-2.5 py-[3px] rounded-full transition-colors duration-150",
              filters.windowMinutes === value
                ? "text-[var(--flip)] bg-[rgba(157,184,255,0.10)] shadow-[inset_0_0_0_1px_rgba(157,184,255,0.28)]"
                : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
            )}
```
(add `import { cn } from "@/lib/utils"`; delete the inline `style` props).
3. Intent buttons — replace the `activeStyle` object values: bullish → `{ background: "rgba(110,231,199,0.12)", color: "#6ee7c7", boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)" }`; bearish → `{ background: "rgba(240,138,155,0.12)", color: "#f08a9b", boxShadow: "inset 0 0 0 1px rgba(240,138,155,0.3)" }`; all → `{ background: "var(--glass-2)", color: "var(--ivory)", boxShadow: "inset 0 0 0 1px var(--edge)" }`. Remove the `borderColor` keys; change button className `rounded-sm border` → `rounded-full`; inactive style → `{ color: "var(--slate-dim)", boxShadow: "inset 0 0 0 1px var(--edge-soft)" }`.
4. Structure buttons — sweep active → `{ background: "rgba(157,184,255,0.12)", color: "#9db8ff", boxShadow: "inset 0 0 0 1px rgba(157,184,255,0.3)" }`; all-active and inactive same as step 3. Same `rounded-full` change.
5. 0DTE button — active style → `{ background: "rgba(201,167,240,0.12)", color: "#c9a7f0", boxShadow: "inset 0 0 0 1px rgba(201,167,240,0.35)" }`; `rounded-sm border` → `rounded-full`.
6. Range slider — `accent-blue-500` → `accent-[#9db8ff]`; value span `text-[var(--text-1)]` stays (alias).
7. Progress arc — `stroke="var(--border)"` → `stroke="var(--edge)"`; `stroke="var(--text-3)"` → `stroke="var(--mint)"`.
8. Pause button — replace with the standard gold/glass pause pill (B3Mode pattern, Task 6 Step 1.2, using this component's `paused`/`togglePause` props).

- [ ] **Step 2: `UOAWatchlistRow.jsx`**

1. Wrapper — delete the `style` prop; className → `"glass-strip shrink-0 font-mono text-[11px] flex flex-wrap items-center gap-1.5 px-6 py-2"`.
2. "Watch" label — delete style prop; className → `"text-[10px] uppercase tracking-widest mr-1 text-[var(--slate-dim)]"`.
3. Symbol chips — replace style logic: active → `{ background: "rgba(110,231,199,0.10)", color: "#6ee7c7", boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)" }`; inactive → `{ background: "var(--glass)", color: "var(--slate)", boxShadow: "inset 0 0 0 1px var(--edge-soft)" }`; className `rounded-sm border` → `rounded-full`; the ✕ span color → `sym === activeSymbol ? "rgba(110,231,199,0.6)" : "var(--slate-dim)"`.
4. Add-ticker input — delete style prop; className → `"glass-input font-mono text-[11px] uppercase px-2.5 py-[3px] rounded-full w-[80px]"` and add `style={{ borderStyle: "dashed" }}`.

- [ ] **Step 3: `UOATabsRow.jsx`**

1. Wrapper — style → `{ background: "rgba(255,255,255,0.015)", borderBottom: "1px solid var(--edge-soft)" }`.
2. Tab buttons — style →
```js
            style={{
              paddingTop: "6px",
              paddingBottom: "6px",
              borderRight: "1px solid var(--edge-soft)",
              borderBottom: isActive ? "2px solid var(--mint)" : "2px solid transparent",
              background: isActive ? "var(--glass-2)" : "transparent",
              color: isActive ? "var(--ivory)" : "var(--slate-dim)",
            }}
```
3. Dot span background → `isActive ? "var(--mint)" : "var(--slate-dim)"`.
4. Count chip style → `{ background: isActive ? "rgba(110,231,199,0.15)" : "var(--glass)", color: isActive ? "var(--mint)" : "var(--slate-dim)" }`.

- [ ] **Step 4: `UOASummaryStrip.jsx`**

1. Wrapper — `"shrink-0 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 …"` → `"shrink-0 border-b border-[var(--edge-soft)] bg-[var(--glass)] px-6 py-2 font-mono text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1"`.
2. `text-green-400` → `text-[var(--mint)]` (both occurrences), `text-red-400` → `text-[var(--rose)]` (both).
3. Bull/bear bar — track `bg-[var(--surface-3)]` → `bg-[var(--glass-2)]`; fill `bg-green-500` → `bg-gradient-to-r from-[var(--mint-deep)] to-[var(--mint)]`.

- [ ] **Step 5: `SignalTape.jsx`**

1. Column-header style block → `{ gridTemplateColumns: "52px 64px 1fr 150px 110px", padding: "4px 24px", background: "rgba(255,255,255,0.015)", borderBottom: "1px solid var(--edge-soft)", fontSize: "9px", color: "var(--slate-dim)", letterSpacing: "0.18em" }` (keep the className).
2. Empty state — replace the centered div content with:
```jsx
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
        <p className="font-display text-[17px] text-[var(--slate)]">No signals match</p>
        <p className="font-mono text-[9px] tracking-[0.08em] text-[var(--slate-dim)]">LOWER MIN SCORE OR WIDEN THE WINDOW</p>
      </div>
```

- [ ] **Step 6: `UOAMode.jsx`** — loading/error states:

1. Loading div: `text-[var(--text-3)]` stays; change `font-mono text-[12px]` content to a serif treatment:
```jsx
          <div className="flex-1 flex items-center justify-center">
            <p className="font-display text-[17px] text-[var(--slate)]">Loading flow signals…</p>
          </div>
```
2. Error div: `text-red-400` → `text-[var(--rose)]`.

- [ ] **Step 7: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/components/uoa frontend/src/views/UOAMode.jsx
git commit -m "feat(ui): Flow Signals strips and tape on Ink & Glass"
```

---

### Task 10: Flow Signals (UOA) — rows, leaderboard, drawer

**Files:**
- Modify: `frontend/src/components/uoa/SignalRow.jsx`
- Modify: `frontend/src/components/uoa/ScoreBreakdownBar.jsx`
- Modify: `frontend/src/components/uoa/UOALeaderboardRow.jsx`
- Modify: `frontend/src/components/uoa/UOALeaderboard.jsx`
- Modify: `frontend/src/components/uoa/SignalDetailDrawer.jsx`

- [ ] **Step 1: `SignalRow.jsx`**

1. Delete the local `SCORE_TIERS` + `scoreColor`; import instead: `import { scoreColor } from "@/lib/palette";`
2. `intentGlyph` — bullish `text-[#22c55e]` → `text-[var(--mint)]`; bearish `text-[#f43f5e]` → `text-[var(--rose)]`.
3. `TAG_STYLE` — replace whole constant:
```js
const TAG_STYLE = {
  whale:   { boxShadow: "inset 0 0 0 1px rgba(232,197,116,0.45)", color: "#e8c574" },
  golden:  { background: "#e8c574", color: "#0a0e1c", fontWeight: 600 },
  sweep:   { boxShadow: "inset 0 0 0 1px rgba(157,184,255,0.35)", color: "#9db8ff" },
  block:   { boxShadow: "inset 0 0 0 1px var(--edge)", color: "var(--slate-dim)" },
  opening: { boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)", color: "#6ee7c7" },
  closing: { boxShadow: "inset 0 0 0 1px rgba(240,138,155,0.3)", color: "#f08a9b" },
};
```
and the tag span className `rounded-sm` → `rounded-full px-2`, with the style fallback `{ boxShadow: "inset 0 0 0 1px var(--edge)", color: "var(--slate-dim)" }`.
4. Row wrapper — `border-b border-[var(--border)] … hover:bg-[var(--surface-3)]` → `border-b border-[var(--edge-soft)] px-6 py-2 cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.03)]`; active state `"bg-[var(--surface-3)] border-l-2 border-l-blue-500"` → `"bg-[var(--glass-2)] border-l-2 border-l-[var(--mint)]"`.
5. Structure span — `text-blue-400` → `text-[var(--flip)]`.

- [ ] **Step 2: `ScoreBreakdownBar.jsx`**

Replace the `SEGMENTS` color values using `SEGMENT_COLORS` from palette:
```js
import { SEGMENT_COLORS } from "@/lib/palette"

const SEGMENTS = [
  { key: "premium",      label: "P", color: SEGMENT_COLORS.premium },
  { key: "size_vs_oi",   label: "S", color: SEGMENT_COLORS.size_vs_oi },
  { key: "aggressor",    label: "A", color: SEGMENT_COLORS.aggressor },
  { key: "sweep",        label: "W", color: SEGMENT_COLORS.sweep },
  { key: "opening_bias", label: "O", color: SEGMENT_COLORS.opening_bias },
  { key: "tenor",        label: "T", color: SEGMENT_COLORS.tenor },
]
```
Also change the bar container `rounded-sm` → `rounded-full`.

- [ ] **Step 3: `UOALeaderboardRow.jsx`** (inline styles — swap var names):

1. `borderBottom: "1px solid var(--border-soft)"` → `"1px solid var(--edge-soft)"`; hover background `"var(--surface-2)"` → `"var(--glass-2)"`.
2. Rank/ago color `"var(--text-3)"` → `"var(--slate-dim)"` (2 places); symbol color `"var(--text-1)"` → `"var(--ivory)"`.
3. Watchlist dot `background: "var(--blue)"` → `"var(--mint)"`.
4. Net premium color `isBull ? "var(--green)" : "var(--red)"` → `isBull ? "var(--mint)" : "var(--rose)"`.
5. Volume bar — track `background: "var(--surface-3)"` → `"var(--glass-2)"`, `borderRadius: 3` → `7`; buy segment `background: "var(--blue-dim)"` → `"rgba(110,231,199,0.12)"`, `borderRight: "1px solid var(--border)"` → `"1px solid var(--edge)"`, label color `"var(--blue)"` → `"var(--mint)"`; sell segment `background: "var(--red-dim)"` stays (alias → rose-dim), label color `"var(--red)"` → `"var(--rose)"`.

- [ ] **Step 4: `UOALeaderboard.jsx`** (inline styles):

1. `baseStyle` — replace with:
```js
  const baseStyle = {
    flexShrink: 0,
    borderBottom: "1px solid var(--edge-soft)",
    background: "var(--glass)",
    backdropFilter: "blur(14px)",
    fontFamily: "'JetBrains Mono', monospace",
  };
```
2. Title bar style — `background: "var(--bg)"` → `"rgba(255,255,255,0.015)"`; `borderBottom: "1px solid var(--border)"` → `"1px solid var(--edge-soft)"`; "Top Movers" span: add `fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 13, textTransform: "none", letterSpacing: "0.01em"` (replacing `fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase"`), color → `"var(--ivory)"`.
3. Window chip — `border: "1px solid var(--border)", borderRadius: 2` → `boxShadow: "inset 0 0 0 1px var(--edge)", borderRadius: 99, padding: "1px 7px"` (remove `border`), color → `"var(--slate-dim)"`.
4. `ExcludeChip` — `background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 2` → `background: "var(--glass)", boxShadow: "inset 0 0 0 1px var(--edge-soft)", borderRadius: 99, padding: "1px 7px"`; ✕ hover color `"var(--red)"` → `"var(--rose)"`.
5. `ExcludeInput` — `border: "1px solid var(--border)", borderRadius: 2` → `border: "1px solid var(--edge)", borderRadius: 99, padding: "1px 7px"`; focus border `"var(--blue)"` → `"rgba(232,197,116,0.55)"`; the `+` button color `"var(--blue)"` → `"var(--mint)"`.
6. PAUSED chip — `background: "var(--amber, #b45309)", color: "#fff"` → `background: "rgba(232,197,116,0.15)", color: "var(--gold)", boxShadow: "inset 0 0 0 1px rgba(232,197,116,0.4)"`, `borderRadius: 99`.
7. Pause/resume button — `border: "1px solid var(--border)", borderRadius: 2` → `border: "1px solid var(--edge)", borderRadius: 99, padding: "1px 8px"`; resume color `"var(--green, #16a34a)"` → `"var(--mint)"`; hover border colors → `paused ? "var(--mint)" : "var(--gold)"`.
8. Column headers (`LeaderboardColumn`) — `background: "var(--surface-2)"` → `"rgba(255,255,255,0.015)"`, `borderBottom: "1px solid var(--border)"` → `"1px solid var(--edge-soft)"`; BUYERS/SELLERS colors `var(--green)`/`var(--red)` → `var(--mint)`/`var(--rose)`; right label + "No data" `var(--text-3)` → `var(--slate-dim)`; column divider `borderLeft: "1px solid var(--border)"` → `"1px solid var(--edge-soft)"`.
9. Resize handle — `background: "var(--surface-2)"` → `"rgba(255,255,255,0.015)"` (both in style and in `onMouseLeave`), `borderTop: "1px solid var(--border)"` → `"1px solid var(--edge-soft)"`, hover background `"var(--blue)"` → `"var(--mint)"`, grip `background: "var(--text-3)"` → `"var(--slate-dim)"`.

- [ ] **Step 5: `SignalDetailDrawer.jsx`** (heavier glass per spec):

1. Replace local `BREAKDOWN_SEGMENTS` colors with palette imports — add `import { scoreColor, SEGMENT_COLORS } from "@/lib/palette";`, delete local `SCORE_COLORS` + `scoreColor`, and set:
```js
const BREAKDOWN_SEGMENTS = [
  { key: "premium", label: "premium", color: SEGMENT_COLORS.premium },
  { key: "size_vs_oi", label: "size/OI", color: SEGMENT_COLORS.size_vs_oi },
  { key: "aggressor", label: "aggressor", color: SEGMENT_COLORS.aggressor },
  { key: "sweep", label: "sweep", color: SEGMENT_COLORS.sweep },
  { key: "opening_bias", label: "open bias", color: SEGMENT_COLORS.opening_bias },
  { key: "tenor", label: "tenor", color: SEGMENT_COLORS.tenor },
];
```
2. `TAG_STYLE` — same replacement as SignalRow (Task 10 Step 1.3).
3. `CONVICTION_STYLE` — replace:
```js
const CONVICTION_STYLE = {
  high:   { background: "rgba(110,231,199,0.12)", color: "#6ee7c7", boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)" },
  medium: { background: "rgba(157,184,255,0.12)", color: "#9db8ff", boxShadow: "inset 0 0 0 1px rgba(157,184,255,0.3)" },
  low:    { background: "rgba(232,197,116,0.12)", color: "#e8c574", boxShadow: "inset 0 0 0 1px rgba(232,197,116,0.35)" },
};
```
(and the conviction span className `rounded-sm` → `rounded-full`).
4. `drawerCls` — replace:
```js
  const drawerCls = cn(
    "relative flex flex-col overflow-y-auto font-mono text-[11px] border-l border-[var(--edge)]",
    "bg-[rgba(21,32,58,0.55)] backdrop-blur-[20px] shadow-[-16px_0_48px_rgba(0,0,0,0.5)]",
    pinned ? "shrink-0" : "fixed right-0 top-0 bottom-0 z-50",
  );
```
5. Overlay — `bg-black/30` → `bg-[rgba(7,10,20,0.5)] backdrop-blur-[2px]`.
6. Resize handle hover — `hover:bg-[var(--blue)]` → `hover:bg-[var(--mint)]`; grip `bg-[var(--text-3)]` stays (alias).
7. Header — title span: add `font-display text-[15px] not-italic` is wrong (display is italic by design) — replace `"text-[var(--text-1)] font-semibold font-mono"` with `"font-display text-[16px] text-[var(--ivory)]"`. "View in GEX ladder" link `text-blue-400 hover:text-blue-300` → `text-[var(--flip)] hover:text-[var(--ivory)]`. Pin active `text-blue-400` → `text-[var(--mint)]`.
8. Premium rows — `text-green-400` → `text-[var(--mint)]`, `text-red-400` → `text-[var(--rose)]` (all occurrences in the summary section and net premium conditional).
9. Chain context highlight — `text-amber-400` → `text-[var(--gold)]` (2 occurrences — call/put wall match is a marked price level, gold is correct here per spec §1).
10. Section labels: leave `text-[var(--text-3)]` (alias). Skeleton bars `bg-[var(--surface-2)]` → `bg-[var(--glass-2)]`. Raw JSON `bg-[var(--surface-2)]` → `bg-[var(--glass)]`. `<hr className="border-[var(--border)]">` → `border-[var(--edge-soft)]` (3 occurrences).

- [ ] **Step 6: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/components/uoa
git commit -m "feat(ui): Flow Signals rows, leaderboard, and glass detail drawer"
```

---

### Task 11: Agent view — sidebar, chat, input, messages

**Files:**
- Modify: `frontend/src/components/ai/AgentSidebar.jsx`
- Modify: `frontend/src/components/ai/AgentChat.jsx`
- Modify: `frontend/src/components/ai/ChatInput.jsx`
- Modify: `frontend/src/components/ai/ChatMessage.jsx`

- [ ] **Step 1: `AgentSidebar.jsx`**

1. Both wrapper divs (collapsed + expanded): `border-r border-[var(--border)] bg-[var(--surface-1)]` → `border-r border-[var(--edge-soft)] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl`.
2. `SessionRow` active state — `"border-l-2 border-[var(--blue)] bg-[var(--blue-dim)] text-[var(--text-1)]"` → `"border-l-2 border-[var(--mint)] bg-[rgba(110,231,199,0.07)] text-[var(--ivory)]"`; hover `hover:bg-[var(--surface-3)]` → `hover:bg-[var(--glass)]` (both row and icon-mode button); icon-mode active same mint treatment.
3. Rename input — `border border-[var(--blue)]` → `border border-[rgba(110,231,199,0.4)]`, `bg-[var(--surface-2)]` → `bg-[var(--glass-2)]`; confirm check button `text-[var(--blue)]` → `text-[var(--mint)]`.
4. "New Chat" buttons (both modes) — `border border-[var(--border)] … hover:border-[var(--blue)]` → `shadow-[inset_0_0_0_1px_var(--edge)] rounded-full … hover:shadow-[inset_0_0_0_1px_rgba(110,231,199,0.35)] hover:text-[var(--mint)]` (drop the `border` classes, keep sizing; change `rounded-sm` → `rounded-full`).
5. Delete hover `hover:text-red-400` → `hover:text-[var(--rose)]`.
6. Header `border-b border-[var(--border)]` → `border-b border-[var(--edge-soft)]`.

- [ ] **Step 2: `AgentChat.jsx`**

1. Header — `border-b border-[var(--border)]` → `border-b border-[var(--edge-soft)]`; title span → `className="font-display text-[15px] text-[var(--ivory)] truncate"`.
2. Model select — `bg-[var(--surface-2)] border border-[var(--border)] rounded-sm … focus:border-[var(--blue)]` → `bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] rounded-full border-0 … focus:shadow-[inset_0_0_0_1px_rgba(232,197,116,0.55)]` (keep `appearance-none`, padding, font classes).
3. Empty state — replace the inner block:
```jsx
            <div className="w-full max-w-3xl mx-auto px-6 flex flex-col items-center gap-3">
              <p className="font-display text-[19px] text-[var(--slate)] text-center">
                Ask about gamma, key levels, and volatility
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSend(s)}
                    className={cn(
                      "font-mono text-[10px] px-3 py-1.5 rounded-full",
                      "bg-[var(--glass)] text-[var(--slate)] shadow-[inset_0_0_0_1px_var(--edge)]",
                      "hover:text-[var(--ivory)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] transition-colors",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
```
4. "No session selected" div — `text-[var(--text-3)] font-mono text-[11px]` → `font-display text-[17px] text-[var(--slate)]`.

- [ ] **Step 3: `ChatInput.jsx`**

1. Textarea — replace the border/bg classes: `"flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"` → `"flex-1 resize-none rounded-2xl glass-input"` and `focus:border-[var(--blue)]` is handled by `.glass-input:focus` (delete that class). Keep font/size/max-height classes.
2. Send button — replace the solid blue fill with a mint glass pill (gold is reserved for spot/brand, so mint is the action accent). Final classes:
```jsx
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-full shrink-0",
          "bg-[rgba(110,231,199,0.14)] text-[var(--mint)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.35)] font-mono text-[13px]",
          "disabled:opacity-40 hover:bg-[rgba(110,231,199,0.22)] transition-colors"
        )}
```

- [ ] **Step 4: `ChatMessage.jsx`**

1. User bubble — `"bg-[var(--blue-dim)] text-[var(--text-1)] text-[13px] ml-8"` → `"bg-[var(--glass-2)] shadow-[inset_0_0_0_1px_var(--edge-soft)] rounded-2xl text-[var(--ivory)] text-[13px] ml-8"`; assistant bubble gets a hairline left rule: change the assistant branch `"text-[var(--text-1)] text-[13px]"` → `"text-[var(--ivory)] text-[13px] border-l border-[var(--edge)] pl-3"`. Change the shared bubble class `rounded-sm` → `rounded-none` (the user branch's `rounded-2xl` overrides for user).
2. Error state `border-red-500/50 text-red-400` → `text-[var(--rose)]`.
3. Streaming caret `bg-[var(--blue)]` → `bg-[var(--mint)]`.
4. `mdComponents` — inline code `text-[var(--blue)] bg-[var(--surface-3)]` → `text-[var(--flip)] bg-[var(--glass-2)]`; pre block `bg-[var(--surface-3)] border border-[var(--border)]` → `bg-[var(--glass)] border border-[var(--edge-soft)] rounded-lg`; table th `bg-[var(--surface-2)]` → `bg-[var(--glass)]`; all `border-[var(--border)]` in table/hr → `border-[var(--edge-soft)]`.
5. `AgentTrace` — wrapper/divider `border-[var(--border)]` → `border-[var(--edge-soft)]` (3 places); running spinner `text-[var(--blue)]` → `text-[var(--mint)]`; done dot `bg-green-500/60` → `bg-[rgba(110,231,199,0.6)]`; tool chips `bg-[var(--surface-3)]` → `bg-[var(--glass-2)] rounded-full`.
6. Feedback buttons — replace green/red/blue hardcoded classes: positive active `"border-green-500/50 text-green-400 bg-green-500/10"` → `"border-[rgba(110,231,199,0.4)] text-[var(--mint)] bg-[rgba(110,231,199,0.1)]"`, hover variants likewise (`hover:border-green-500/50 hover:text-green-400` → `hover:border-[rgba(110,231,199,0.4)] hover:text-[var(--mint)]`); negative active/hover same pattern with `rgba(240,138,155,…)` and `text-[var(--rose)]`; copy active `"border-[var(--blue)]/50 text-[var(--blue)] bg-[var(--blue-dim)]"` → `"border-[rgba(157,184,255,0.4)] text-[var(--flip)] bg-[rgba(157,184,255,0.1)]"`, copy/regenerate hovers `hover:border-[var(--blue)]/50` → `hover:border-[rgba(157,184,255,0.4)]`; all four action buttons `rounded-sm` → `rounded-full`.

- [ ] **Step 5: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/components/ai
git commit -m "feat(ui): Agent chat — glass bubbles, mint accents, serif identity"
```

---

### Task 12: Settings restyle

Theme section was already removed in Task 2. This task restyles what remains.

**Files:**
- Modify: `frontend/src/views/Settings.jsx`

- [ ] **Step 1: Restyle the primitives at the top of the file**

1. `SettingLabel` — className → `"font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--slate-dim)] mb-1.5"`.
2. `InfoCard` — replace:
```jsx
function InfoCard({ label, value }) {
  return (
    <div className="glass-panel relative p-3.5 overflow-hidden">
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--mint)]" />
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--slate-dim)] mb-1 pl-2">{label}</div>
      <div className="font-mono tabular-nums text-[13px] font-semibold text-[var(--ivory)] pl-2">{value}</div>
    </div>
  )
}
```
3. `Hint` — className → `"font-mono text-[9px] leading-relaxed text-[var(--slate-dim)] mt-2"`.

- [ ] **Step 2: Restyle nav + selects + buttons**

1. Sidebar nav wrapper — `"w-36 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] …"` → `"w-40 shrink-0 border-r border-[var(--edge-soft)] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl flex flex-col py-4 gap-1 px-2.5"`.
2. Nav buttons — active `"bg-[var(--surface-3)] text-[var(--text-1)]"` → `"text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.22)]"`; inactive hover `hover:bg-[var(--surface-2)]` → `hover:bg-[var(--glass)]`; `rounded-sm` → `rounded-full`; icon span `text-[var(--blue)]` → `text-[var(--slate-dim)]`.
3. Content `<h1>` — `"font-mono text-[11px] uppercase tracking-widest text-[var(--text-3)] mb-6"` → `"font-display text-[19px] text-[var(--ivory)] mb-6"` (and it already renders the section label text).
4. All `<select>` elements (DataPanel intervals) — replace `bg-[var(--surface-2)] … border border-[var(--border)] rounded-sm … focus:border-[var(--blue)]` with `bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] rounded-full border-0 px-3 …` (keep font classes; focus → `focus:shadow-[inset_0_0_0_1px_rgba(232,197,116,0.55)]`).
5. GEX endpoint toggle buttons — active `"border-[var(--blue)] text-[var(--blue)] bg-[var(--blue)]/10"` → `"text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.3)]"`; inactive `"border-[var(--border)] … hover:border-[var(--blue)] …"` → `"text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]"`; both drop `border` and use `rounded-full`.
6. AgentPanel model chips/inputs/buttons — model list rows `bg-[var(--surface-2)] border border-[var(--border)] rounded-sm` → `bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge-soft)] rounded-full px-3` (3 occurrences: built-in rows, custom rows, and keep truncation classes); remove-✕ hover `hover:text-red-400` → `hover:text-[var(--rose)]`; the add-model input → `className="glass-input flex-1 font-mono text-[10px] px-3 py-1.5 rounded-full"`; Add button → `"font-mono text-[9px] uppercase tracking-wider px-3.5 py-1.5 rounded-full text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)] transition-colors"`; Refine button — refined state `"border-green-500/50 text-green-400"` → `"text-[var(--mint)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.4)]"`, default `"border-[var(--border)] … hover:border-[var(--blue)] …"` → `"text-[var(--slate)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)]"`, drop `border`, `rounded-sm` → `rounded-full`.
7. Content area wrapper — `"flex-1 overflow-y-auto p-8"` stays.

- [ ] **Step 3: Verify build, then commit**

Run: `cd frontend && npm run build` — expected: success.

```bash
git add frontend/src/views/Settings.jsx
git commit -m "feat(ui): Settings on glass — pill nav, glass selects, serif section titles"
```

---

### Task 13: Cleanup + full validation

**Files:**
- Delete: `frontend/src/components/StatCard.jsx` (imported nowhere — verified dead code)

- [ ] **Step 1: Delete dead component**

Run: `grep -rn "StatCard" frontend/src --include="*.jsx" -l`
Expected: only `frontend/src/components/StatCard.jsx` itself.
Then: `rm frontend/src/components/StatCard.jsx`

- [ ] **Step 2: Final grep gate (spec §4.7)**

Run:
```bash
grep -rn "useTheme\|useThemeColors\|data-theme\|gex.theme\|bloomberg\|useSidebar\|IBM Plex" frontend/src frontend/index.html
```
Expected: no output.

Run:
```bash
grep -rn "text-pink-600\|#d89a48\|#22c55e\|#3b82f6\|#ef4444\|#f43f5e\|#f59e0b\|#d97706\|amber-400\|green-400\|red-400\|blue-400\|green-500\|red-500\|blue-500" frontend/src --include="*.jsx"
```
Expected: no output (every hardcoded legacy color migrated).

Run:
```bash
grep -rnE "(green|red|blue|amber|mint|rose2|gold|flip)/[0-9]" frontend/src --include="*.jsx"
```
Expected: no output (opacity modifiers on CSS-var colors silently compile to nothing — any hit is a dead class that must become an explicit rgba arbitrary value).

- [ ] **Step 3: Production build**

Run: `cd frontend && npm run build`
Expected: success, no warnings about missing modules or unused imports breaking the build.

- [ ] **Step 4: Full browser walkthrough (browser MCP per CLAUDE.md, or manual)**

Start the app from repo root: `./start.sh`. Then verify each route against the approved mockup (`.superpowers/brainstorm/26329-1781230023/content/full-mockup.html`):

1. `/b3` — rail with GED. brand + mint active icon; serif "Gamma Ladders" header; pause pill in header (toggles gold when paused); three glass ladders with serif symbols, regime pills, gold spot values; gold spot hairline + pill in each ladder; glowing mint/rose net bars; key-level pills; serif "Intraday Evolution" panel with mint symbol tabs and glow chart line.
2. `/watch` — glass toolbar, pill ticker chips (mint when open), gold 0DTE toggle, glass panels, serif empty state.
3. `/expiry` — glass toolbar with pill quick-picks, glass date input, serif empty state.
4. `/uoa` — leaderboard with serif "Top Movers", mint/rose columns; pill filters in top bar; tape rows with palette score colors; click a signal → heavy-glass drawer slides over with backdrop blur.
5. `/agent` — glass session sidebar with mint active row; serif chat title; glass user bubbles, hairline-ruled agent replies; mint send button.
6. `/settings` — pill nav (no Display/theme section anywhere), glass selects, serif section titles.
7. Kill the backend (`Ctrl+C` the uvicorn process) and reload `/b3` — error panel renders as glass with rose ring.
8. Restart backend; confirm 30s auto-refresh still works and the market clock ticks.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore(ui): remove dead StatCard, final Ink & Glass cleanup"
```

---

## Spec coverage checklist (self-review against spec)

- §1 Design language → Task 1 (tokens/fonts/canvas), Task 3 (primitives)
- §2 Shell (rail, header, clock, useSidebar deletion, GED. brand) → Task 4
- §3 B3/ladders → Tasks 5–6; charts → Task 7; Flow List/Gamma Horizon → Task 8; Flow Signals → Tasks 9–10; Agent → Task 11; Settings → Task 12; loading/empty/error states → Tasks 6–9, 13.7
- §4 Theme removal (useTheme, palette.js, single :root, tailwind, Settings section, index.html, grep gate) → Tasks 1–2, 13
- §5 Unchanged surface (hooks, routing, api, behaviors) → no task touches them; Task 13 walkthrough verifies behaviors
- §6 Validation → every task's build step + Task 13
