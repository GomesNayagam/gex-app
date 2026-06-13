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
