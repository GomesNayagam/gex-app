---
sketch: 001
name: uoa-tape
question: "Which row density and layout structure works best for the Flow Signals tape?"
winner: null
tags: [uoa, tape, density, layout, drawer]
---

# Sketch 001: UOA Tape

## Design Question
Which row density and layout pattern maximizes signal scanning speed while preserving the six-component score breakdown and detail drawer?

## How to View
```
open .planning/sketches/001-uoa-tape/index.html
```

## Variants
- **A: Tape (2-line density)** — Standard terminal-tape rows with tags row on line 3; matches Bloomberg TOMS style. Shows all metadata inline.
- **B: Compact (1-line density)** — One-line rows, tags inline with contract name, breakdown bar smaller. Higher density.
- **C: Card layout** — Each signal is a card with left-border intent stripe. More breathing room, less scannable.

## What to Look For
- Does the score chip (score + intent indicator) read at a glance?
- Is the breakdown bar useful at the row level, or just in the drawer?
- Do tags need their own row, or can they live inline?
- Does the card layout feel too "airy" for a live tape?
- Drawer: does the greeks + chain context section feel complete?

## Interactive Controls
- Click any row → opens detail drawer
- Drawer ✕ or overlay → closes
- Top bar controls are all interactive (pills, toggles, slider, 0DTE, ⟳)
- Sketch toolbar (bottom-right, hover to expand): cycle states (loading/empty/error/populated), viewport presets
