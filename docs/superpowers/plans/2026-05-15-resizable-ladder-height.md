# Resizable Ladder Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to drag-resize the scrollable strike list height in `InstrumentColumn`, with per-symbol height persisted to localStorage.

**Architecture:** Add a `resizable` prop to `InstrumentColumn`; when true, replace the fixed `max-h-[420px]` Tailwind class with a dynamic inline style driven by React state. A custom drag handle strip below the scrollable list listens to `mousedown` → `document mousemove/mouseup` to compute height delta. Height is clamped between 120px and 700px, read from localStorage on mount keyed as `gex:ladder-height:{symbol}`, and written on drag end. B3Mode and WatchlistMode pass `resizable` to their `InstrumentColumn` usages.

**Tech Stack:** React 18, Tailwind CSS v3, localStorage

---

## File Map

| File | Change |
|---|---|
| `frontend/src/components/InstrumentColumn.jsx` | Add `resizable` prop, dynamic height state, drag handle, localStorage read/write |
| `frontend/src/views/B3Mode.jsx` | Pass `resizable` prop to each `InstrumentColumn` |
| `frontend/src/views/WatchlistMode.jsx` | Pass `resizable` prop to `InstrumentColumn` |

---

### Task 1: Add resizable height state and localStorage persistence to InstrumentColumn

**Files:**
- Modify: `frontend/src/components/InstrumentColumn.jsx`

- [ ] **Step 1: Add `useCallback` to imports and add height state with localStorage init**

  Replace the import line at the top of `InstrumentColumn.jsx`:

  ```jsx
  import { Fragment, useState, useEffect, useRef, useCallback } from "react";
  ```

  Then, inside the component function, after the existing `const [netGexSort, setNetGexSort] = useState(null);` line, add:

  ```jsx
  const DEFAULT_HEIGHT = 420;
  const MIN_HEIGHT = 120;
  const MAX_HEIGHT = 700;
  const storageKey = `gex:ladder-height:${symbol}`;

  const [ladderHeight, setLadderHeight] = useState(() => {
    if (!resizable) return DEFAULT_HEIGHT;
    const saved = localStorage.getItem(storageKey);
    const parsed = parseInt(saved, 10);
    return !isNaN(parsed) && parsed >= MIN_HEIGHT && parsed <= MAX_HEIGHT
      ? parsed
      : DEFAULT_HEIGHT;
  });
  ```

- [ ] **Step 2: Add `resizable` to the component's prop signature**

  Change the component signature from:

  ```jsx
  export default function InstrumentColumn({ inst, compact = false }) {
  ```

  to:

  ```jsx
  export default function InstrumentColumn({ inst, compact = false, resizable = false }) {
  ```

- [ ] **Step 3: Replace fixed `max-h-[420px]` class with dynamic inline style**

  Find the scrollable strike rows container (currently line ~116):

  ```jsx
  <div className={cn("overflow-y-auto", compact ? "max-h-[240px]" : "max-h-[420px]")}>
  ```

  Replace it with:

  ```jsx
  <div
    className="overflow-y-auto"
    style={{ height: compact ? 240 : ladderHeight, minHeight: compact ? 240 : MIN_HEIGHT }}
  >
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/components/InstrumentColumn.jsx
  git commit -m "feat(ladder): add resizable height state with localStorage init"
  ```

---

### Task 2: Add drag handle to InstrumentColumn

**Files:**
- Modify: `frontend/src/components/InstrumentColumn.jsx`

- [ ] **Step 1: Add drag handler logic using useCallback**

  Inside the component function, after the `ladderHeight` state block, add:

  ```jsx
  const dragState = useRef(null);

  const handleDragMouseDown = useCallback(
    (e) => {
      if (!resizable || compact) return;
      e.preventDefault();
      dragState.current = { startY: e.clientY, startHeight: ladderHeight };

      function onMouseMove(ev) {
        const dy = ev.clientY - dragState.current.startY;
        const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragState.current.startHeight + dy));
        setLadderHeight(next);
      }

      function onMouseUp(ev) {
        const dy = ev.clientY - dragState.current.startY;
        const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragState.current.startHeight + dy));
        setLadderHeight(next);
        localStorage.setItem(storageKey, String(next));
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        dragState.current = null;
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [resizable, compact, ladderHeight, storageKey],
  );
  ```

- [ ] **Step 2: Render the drag handle strip after the scrollable div**

  The ladder card's JSX currently ends with the scrollable div then closes the outer `div.rounded-xl`. Find:

  ```jsx
        </div>
      </div>
    </div>
  );
  ```

  The innermost closing `</div>` closes the scrollable list, the next closes the `rounded-xl` card, and the last closes the outer `flex flex-col`. Insert the drag handle between the scrollable div's closing tag and the card's closing tag:

  ```jsx
        </div>

        {/* Drag handle — only shown when resizable and not compact */}
        {resizable && !compact && (
          <div
            onMouseDown={handleDragMouseDown}
            className="flex-none flex items-center justify-center h-3 border-t border-[var(--border)] cursor-ns-resize select-none group"
            style={{ background: "var(--surface-2)" }}
            title="Drag to resize"
          >
            <span
              className="font-mono text-[10px] tracking-widest text-[var(--border)] group-hover:text-[var(--text-3)] transition-colors leading-none"
              style={{ letterSpacing: "0.25em" }}
            >
              ⋯
            </span>
          </div>
        )}
      </div>
    </div>
  );
  ```

- [ ] **Step 3: Verify the full closing structure is correct**

  The ladder card `div.rounded-xl` should now contain, in order:
  1. `div.flex-none` (frozen headers)
  2. `div.overflow-y-auto` (strike rows)
  3. Drag handle `div` (conditional)

  Confirm no extra or missing closing tags by reading the file.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/components/InstrumentColumn.jsx
  git commit -m "feat(ladder): add custom drag handle for height resize"
  ```

---

### Task 3: Wire resizable prop in B3Mode and WatchlistMode

**Files:**
- Modify: `frontend/src/views/B3Mode.jsx`
- Modify: `frontend/src/views/WatchlistMode.jsx`

- [ ] **Step 1: Pass `resizable` in B3Mode**

  In `B3Mode.jsx`, find:

  ```jsx
  <InstrumentColumn inst={inst} />
  ```

  Replace with:

  ```jsx
  <InstrumentColumn inst={inst} resizable />
  ```

- [ ] **Step 2: Pass `resizable` in WatchlistMode**

  In `WatchlistMode.jsx`, find:

  ```jsx
  <InstrumentColumn inst={instData} />
  ```

  Replace with:

  ```jsx
  <InstrumentColumn inst={instData} resizable />
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/views/B3Mode.jsx frontend/src/views/WatchlistMode.jsx
  git commit -m "feat(ladder): enable resizable ladder in B3Mode and WatchlistMode"
  ```

---

### Task 4: Manual validation

- [ ] **Step 1: Start the frontend**

  ```bash
  cd frontend && npm run dev
  ```

  Open `http://localhost:5173` in browser.

- [ ] **Step 2: Test B3Mode resize**

  - Navigate to `/` (B3Mode).
  - Hover over the bottom of an instrument column's ladder card — a subtle `⋯` strip should appear with `cursor: ns-resize`.
  - Drag it down — the strike list should grow.
  - Drag it up — it should shrink but stop at 120px.
  - Drag beyond 700px — it should stop at 700px.
  - Refresh the page — the height should be restored from localStorage.

- [ ] **Step 3: Test WatchlistMode resize**

  - Navigate to `/watch` (WatchlistMode).
  - Add a ticker if not already present, select it.
  - Drag the handle on the instrument column — same behavior as B3Mode.
  - Refresh — height restored.

- [ ] **Step 4: Verify compact mode is unaffected**

  - If `ExpiryMode` uses `compact` prop, confirm no drag handle appears there and the height is fixed at 240px.

- [ ] **Step 5: Commit if any fixups made**

  ```bash
  git add -p
  git commit -m "fix(ladder): address resize edge cases found in validation"
  ```
