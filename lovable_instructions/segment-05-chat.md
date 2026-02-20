# Lovable Prompt: Segment 05 - Chat Interface

**Context:** This is the core interface where end-users interact with the Weblets (AI Agents). It needs to feel as smooth and responsive as ChatGPT or Claude.

**Design Guidance:** Clean, distraction-free messaging interface. Central chat area with a fixed input bar at the bottom and a sidebar on the left for past conversations.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Stick exactly to the UI elements requested.
2. **NO EXTRA ROUTES:** Only build the `/chat` and `/chat/[id]` routes.
3. **USE SHADCN:** Use Shadcn Textareas, Buttons, and ScrollAreas.

---

## 1. Route: `/chat/[id]` (The Main Chat Interface)

**Purpose:** Allows users to talk to the AI.

**Required UI Elements - Layout:**
*   **Left Sidebar (History):**
    *   "New Chat" Button (Primary action at the top).
    *   List of recent chat sessions. Each item should show a truncated title (e.g., "Help with Next.js code...").
    *   Hovering over a historical chat should reveal a small "Trash" icon to delete it.
*   **Main Chat Area (Center/Right Panel):**
    *   **Header:** Displays the Name and Icon of the Weblet currently being chatted with (e.g., "💻 Codebot 3000").
    *   **Message List (Scrollable Area):**
        *   User Messages: Aligned right, distinct background color (e.g., standard blue bubble or subtle gray).
        *   Assistant Messages: Aligned left, clean white/transparent background. Must support Markdown rendering (bold, lists, code blocks with syntax highlighting).
        *   **Tool Call Loader:** When the AI is using a tool (like Web Search or Code Interpreter), show a small inline loading state (e.g., "`Searching the web for 'latest Next.js features'...`" with a spinner).
        *   **Message Actions:** On hover of an Assistant message, show a "Copy" icon button and a "Thumbs Up / Thumbs Down" rating widget (crucial for RSIL).
    *   **Input Area (Fixed at bottom):**
        *   Textarea that auto-grows as the user types (up to a max-height).
        *   Submit Button (Paper airplane or upward arrow icon).
        *   *Optional:* A paperclip icon for "Attach File" (we will connect this to the vision/document capabilities later).
        *   Subtext below input: "AI can make mistakes. Verify important information."

**Logic / State (What Lovable needs to build):**
*   **Streaming State:** Show a pulsing cursor or a "typing..." indicator while the AI is responding.
*   **Disabled State:** Disable the input box and send button while the AI is currently generating a response.
*   **Empty State:** If it's a brand new chat with no messages, show a nice welcome screen in the center: "How can I help you today?" with 3 suggestion chips.

## 2. Global Feedback Modal (For RSIL)
**Purpose:** When a user clicks "Thumbs Down" on an AI message, we need to know why to feed the RSIL optimization engine.

**Required UI Elements:**
*   A Shadcn Dialog (Modal) triggered by a "Thumbs Down" click.
*   **Title:** "Provide Feedback"
*   **Description:** "Help us improve this Weblet by telling us what went wrong."
*   **Input:** A Textarea (Placeholder: "The AI gave me outdated information about React 18...").
*   **Buttons:** "Cancel" and "Submit Feedback".
