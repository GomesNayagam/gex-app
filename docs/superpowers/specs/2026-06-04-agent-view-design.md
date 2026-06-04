# AgentView Design Spec

**Date:** 2026-06-04  
**Branch:** feature/aibot  
**Status:** Approved

## Overview

Replace the floating chat bubble (`ChatWidget`) with a full-page `AgentView` at `/agent`. The view follows the same pattern as `B3Mode`, `UOAMode`, etc. — a dedicated route inside `AppShell`. It provides a multi-session AI chat experience modeled on industry-standard agent UIs (Claude, ChatGPT): session sidebar on the left, chat pane on the right.

## Data Model

Each session stored in localStorage under key `ai-sessions` (JSON array). Active session id stored under `ai-active-session`.

```js
Session {
  id: string          // random id via genId()
  title: string       // first user message truncated to 60 chars
  createdAt: number   // Date.now()
  messages: Message[]
}

Message {
  id: string
  role: "user" | "assistant"
  content: string
  toolNames?: string[]
  error?: boolean
}
```

Sessions list is sorted descending by `createdAt` in the sidebar.

Each session also stores the selected model:

```js
Session {
  id: string
  title: string
  createdAt: number
  model: string       // e.g. "anthropic/claude-sonnet-4-5"; defaults to first in MODELS list
  messages: Message[]
}
```

**Predefined models** (`lib/chatSettings.js`):
```js
export const MODELS = [
  "anthropic/claude-sonnet-4-5",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "mistralai/mistral-large",
  "deepseek/deepseek-v4-flash",
]
```

Additional models can be added by the user via the Settings page (stored in localStorage under `ai-custom-models`, merged with `MODELS` at runtime).

## Hook: `useAISessions`

Replaces `useAIChat`. Single source of truth for all session state.

**Exposed API:**

| Name | Type | Description |
|---|---|---|
| `sessions` | `Session[]` | All sessions, sorted newest first |
| `activeId` | `string` | Currently selected session id |
| `setActiveId(id)` | fn | Switch active session |
| `activeSession` | `Session` | Derived: `sessions.find(s => s.id === activeId)` |
| `newSession()` | fn | Create blank session, set as active |
| `renameSession(id, title)` | fn | Update session title |
| `deleteSession(id)` | fn | Remove session; if active, switch to next or create blank |
| `sendMessage(text)` | fn | Stream into active session's messages |
| `loading` | `boolean` | Streaming in progress |
| `copyMessage(content)` | fn | `navigator.clipboard.writeText(content)` |
| `exportSession(id)` | fn | Download session as `.md` file |
| `setSessionModel(id, model)` | fn | Update the model for a session |
| `refinePersona()` | fn | Manually trigger system prompt refinement |

Auto-title: when the first user message is sent, session title is set to that message truncated to 60 chars.

## Components

### New Files

**`views/AgentView.jsx`**  
Route component at `/agent`. Renders a two-pane layout filling the AppShell content area: `AgentSidebar` (left, fixed ~240px) + `AgentChat` (right, flex-1). Instantiates `useAISessions` and passes props down.

**`components/ai/AgentSidebar.jsx`**  
Left panel. Contains:
- "New Chat" button at top
- Scrollable list of sessions; each row shows title (one line, truncated) + relative timestamp ("2h ago")
- Active session highlighted with `var(--blue)` left border
- Hover state reveals inline rename (pencil icon) and delete (trash icon) actions
- Rename triggers an inline text input on the session row

**`components/ai/AgentChat.jsx`**  
Right pane. Contains:
- Header bar: session title + model picker dropdown + export button (download icon)
- Model picker: dropdown showing all models (predefined + custom); selecting updates `session.model`
- Scrollable messages area using `ChatMessage`
- Empty state with suggested prompts when `messages.length === 0`
- `ChatInput` pinned to the bottom

### Modified Files

**`components/ai/ChatMessage.jsx`**  
Add a copy button (clipboard icon) that appears on hover for assistant messages only. Calls `copyMessage(content)` from hook.

**`App.jsx`**  
Add `<Route path="/agent" element={<AgentView />} />`.

**`components/shell/Sidebar.jsx`**  
Add Agent nav link pointing to `/agent` with a suitable icon.

**`components/shell/AppShell.jsx`**  
Remove `<ChatWidget />` render.

**`views/Settings.jsx`**  
Add "Agent Models" section: shows predefined models (read-only list) + text input to add custom model strings (stored in `ai-custom-models` localStorage key). Also shows "Refine Agent Now" button that calls `refinePersona()`.

### Deleted Files

- `hooks/useAIChat.js`
- `components/ai/ChatWidget.jsx`

### Unchanged

- `components/ai/ChatInput.jsx`
- `api.js` / `streamChat`

**`lib/chatSettings.js`** — extended with `MODELS` array and `getCustomModels()` / `saveCustomModels()` helpers.

## Layout

```
AppShell
└── AgentView
    ├── AgentSidebar (w-60, shrink-0, border-right)
    │   ├── [+ New Chat] button
    │   └── session rows (scrollable)
    └── AgentChat (flex-1)
        ├── Header (title + [model dropdown] + export)
        ├── Messages (flex-1, overflow-y-auto)
        └── ChatInput (pinned bottom)
```

## Session Actions

| Action | Trigger | Behaviour |
|---|---|---|
| New session | "New Chat" button | Creates blank session, switches active |
| Rename | Pencil icon on hover | Inline input on session row, save on Enter/blur |
| Delete | Trash icon on hover | Removes session; switches to next or creates blank if last |
| Copy message | Clipboard icon on hover (assistant only) | `navigator.clipboard.writeText` |
| Export | Download icon in chat header | Downloads `.md` file of full session |

## Model Selection

**Per-session model picker** in the `AgentChat` header. Dropdown lists all available models — predefined + any custom models added by the user in Settings.

The selected model is passed to `streamChat` as the `model` field. Changing the model mid-session takes effect from the next message onward.

**Settings page — "Agent Models" section:**
- Read-only list of predefined models
- Text input to add a custom model string (e.g. `mistralai/mistral-small`)
- Custom models stored in localStorage under `ai-custom-models` (string array)
- Delete button per custom model entry

## Self-Improvement Loop

The agent maintains a **persona prompt** in localStorage (`ai-agent-persona`). This is a concise system prompt paragraph describing the user's observed trading focus, question patterns, and preferred response style.

**Automatic refinement (after each session ends):**
When the user starts a new session (or closes AgentView), the just-completed session's messages are analyzed by sending a summarization request to the AI. The AI is instructed to update the existing persona prompt based on what topics were discussed (e.g. "user frequently asks about SPX gamma flip and 0DTE pin risk"). The refined persona is silently written back to `ai-agent-persona` in localStorage.

**Manual refinement:**
A "Refine Agent Now" button in the Settings page triggers the same summarization pass across the last N sessions (up to 5).

**Usage:**
The persona prompt is prepended to the system prompt on every `streamChat` call. It is never shown to the user in the UI — it operates silently in the background.

**Reset:**
Clearing all sessions also resets the persona to the default empty state.

## Session Actions

| Action | Trigger | Behaviour |
|---|---|---|
| New session | "New Chat" button | Creates blank session, switches active |
| Rename | Pencil icon on hover | Inline input on session row, save on Enter/blur |
| Delete | Trash icon on hover | Removes session; switches to next or creates blank if last |
| Copy message | Clipboard icon on hover (assistant only) | `navigator.clipboard.writeText` |
| Export | Download icon in chat header | Downloads `.md` file of full session |
| Switch model | Model dropdown in chat header | Updates `session.model`; applies from next message |
| Refine agent | Button in Settings | Triggers persona summarization across last 5 sessions |

## What Is Not In Scope (v1)

- Server-side session persistence (localStorage only)
- Session search or filter
- Message editing or regeneration
- Persona prompt visible or editable in UI
