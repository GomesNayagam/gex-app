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
- Header bar: session title + export button (download icon)
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

### Deleted Files

- `hooks/useAIChat.js`
- `components/ai/ChatWidget.jsx`

### Unchanged

- `components/ai/ChatInput.jsx`
- `lib/chatSettings.js`
- `api.js` / `streamChat`

## Layout

```
AppShell
└── AgentView
    ├── AgentSidebar (w-60, shrink-0, border-right)
    │   ├── [+ New Chat] button
    │   └── session rows (scrollable)
    └── AgentChat (flex-1)
        ├── Header (title + export)
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

## What Is Not In Scope (v1)

- Server-side session persistence (localStorage only)
- Session search or filter
- Multi-model selector UI (model override stays in Settings)
- Message editing or regeneration
