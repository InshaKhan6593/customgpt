# Lovable Prompt: Segment 05 - Chat Interface

**Context:** This is the core interface where end-users interact with the Weblets (AI Agents). It needs to feel as smooth and responsive as ChatGPT or Claude.

**Design Guidance:** Clean, distraction-free messaging interface. Central chat area with a fixed input bar at the bottom and a sidebar on the left for past conversations.

**Status:** ✅ IMPLEMENTED — All UI components built and working.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Stick exactly to the UI elements requested.
2. **NO EXTRA ROUTES:** Only build the `/chat/[webletId]` and `/chat/[webletId]/[sessionId]` routes. Do not build a generic `/chat` route.
3. **USE SHADCN:** Use Shadcn Textareas, Buttons, Avatars, and Dialogs.

---

## 1. Route: `/chat/[webletId]` (The Main Chat Interface)

**Purpose:** Allows users to talk to the AI.

**Files Created:**
- `app/(user)/chat/[webletId]/layout.tsx` — Split-screen layout (sidebar + main)
- `app/(user)/chat/[webletId]/page.tsx` — New chat page
- `app/(user)/chat/[webletId]/[sessionId]/page.tsx` — Resume existing session

### Required UI Elements - Layout:

*   **Left Sidebar (History) — `components/chat/chat-sidebar.tsx`:**
    *   "New Chat" Button (Primary action at the top). ✅
    *   List of recent chat sessions **for this specific Weblet only**. Each item shows a truncated title. ✅
    *   Hovering over a historical chat reveals a small "Trash" icon to delete it. ✅

*   **Main Chat Area (Center/Right Panel):**
    *   **Header — `components/chat/chat-header.tsx`:** Displays the Name and Icon of the Weblet. ✅
    *   **Message List — `components/chat/message-list.tsx`:** Scrollable area with auto-scroll to latest message. Uses `overflow-x-hidden` to prevent code blocks from breaking layout. ✅
    *   **Message Bubble — `components/chat/message-bubble.tsx`:**
        *   User Messages: Aligned right, primary color background, `break-words` to prevent overflow. ✅
        *   Assistant Messages: Aligned left, rendered via `ChatMarkdown` component. ✅
        *   **Message Actions:** On hover of an Assistant message, shows "Copy", "Thumbs Up", "Thumbs Down" icon buttons. ✅
    *   **Input Area — `components/chat/input-bar.tsx`:**
        *   Textarea with Submit button. ✅
        *   Disabled while AI is streaming. ✅
    *   **Empty State — `components/chat/starter-chips.tsx`:**
        *   Shows clickable conversation starter chips when chat is empty. ✅
    *   **Typing Indicator — `components/chat/typing-indicator.tsx`:**
        *   Animated bouncing dots while AI is generating. ✅

### Logic / State:
*   **Streaming State:** Typing indicator shown while AI is responding. ✅
*   **Disabled State:** Input box and send button disabled during generation. ✅
*   **Empty State:** Welcome screen with Weblet's conversation starters. ✅
*   **Chat Container — `components/chat/chat-container.tsx`:** Uses `useChat` with `DefaultChatTransport` from AI SDK v6. Has `overflow-hidden` on root to prevent layout escape. ✅

---

## 2. Markdown Rendering (Premium Code Blocks)

**Files Created:**
- `components/ui/chat-markdown.tsx` — Centralized markdown renderer (shared by chat + builder preview)
- `components/ui/premium-code-block.tsx` — ChatGPT-style code block component

### ChatMarkdown Component
- Uses `react-markdown` v10.1.0 with plugins: `remark-gfm`, `remark-math`, `rehype-highlight`, `rehype-katex`
- Custom `<pre>` renderer routes code blocks to `PremiumCodeBlock`
- Custom `<code>` renderer styles inline code with `bg-muted` background
- Prose heading sizes scaled down: h1=xl, h2=lg, h3=base, h4-h6=sm
- Has `overflow-hidden`, `min-w-0`, `break-words` to prevent layout blowout

### PremiumCodeBlock Component
- Dark background: `#0d0d0d` body, `#2f2f2f` header
- Header shows language name (lowercase) + "Copy code" / "Copied!" button
- Uses plain CSS `overflow-x-auto` for horizontal scrolling (NOT Radix ScrollArea — it causes flex container blowout)
- Root has `max-w-full overflow-hidden`
- Child `<code>` tags forced to `bg-transparent` to prevent style collision

### Builder Preview Updated
- `components/builder/preview-chat.tsx` updated to use `ChatMarkdown` so code blocks in the builder preview also get premium styling.

---

## 3. Global Feedback Modal (For RSIL) — `components/chat/rating-dialog.tsx`

**Purpose:** When a user clicks "Thumbs Down" on an AI message, collects feedback for RSIL.

**Implemented UI Elements:**
*   A Shadcn Dialog (Modal) triggered by "Thumbs Down" click. ✅
*   **Title:** "Provide Feedback" ✅
*   **Description:** "Help us improve this Weblet by telling us what went wrong." ✅
*   **Input:** A Textarea for written feedback. ✅
*   **Buttons:** "Cancel" and "Submit Feedback". ✅
*   Feedback saved to `AnalyticsEvent` via `POST /api/chat/feedback`. ✅

---

## 4. Overflow Prevention (Critical Implementation Detail)

The split-screen chat layout had a critical CSS issue where long code blocks or unbroken text would expand the chat panel beyond its boundaries. This was fixed at 5 levels:

| Level | File | Fix Applied |
|-------|------|-------------|
| 1 | `layout.tsx` | `overflow-hidden` on root, `min-w-0` on `<main>` |
| 2 | `chat-container.tsx` | `overflow-hidden` on root div |
| 3 | `message-list.tsx` | `overflow-x-hidden` on scroll container |
| 4 | `chat-markdown.tsx` | `overflow-hidden`, `min-w-0`, `break-words` |
| 5 | `premium-code-block.tsx` | `max-w-full overflow-hidden`, plain `overflow-x-auto` |

> **⚠️ WARNING for future agents:** Do NOT use Radix `ScrollArea` inside flex containers for code blocks. It does not constrain width and causes the entire panel to expand. Use plain CSS `overflow-x-auto` instead.

---

## 5. Dependencies Installed (For This Segment Only)

```bash
npm install react-markdown remark-gfm remark-math rehype-highlight rehype-katex katex
```

> Other dependencies (`ai`, `@ai-sdk/react`, `@openrouter/ai-sdk-provider`, `zod`, `@e2b/code-interpreter`, `@langfuse/*`, `@opentelemetry/*`) were installed as part of this segment's backend work. See `segments/segment-05-chat-engine-tools.md` for the full list.
