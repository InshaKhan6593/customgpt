# Lovable Prompt: Segment 04 - Weblet Builder

**Context:** The Weblet Builder is the most complex UI in the app. It is a no-code split-screen interface where developers configure their AI agent on the left, and immediately test it in a live chat preview on the right.

**Design Guidance:** Split-pane layout (Resizable if possible, otherwise fixed 50/50 or 40/60). Use Shadcn Tabs for the left-side configuration panel. Provide a polished, IDE-like experience.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Our database schema is strict. Do not add generic "Agent Greeting" or "Agent Avatar" fields. Stick EXACTLY to the fields outlined below.
2. **NO EXTRA ROUTES:** Only build the `/builder/[id]` route.

---

## 1. Route: `/builder/[id]` (The Weblet Studio)

**Purpose:** Where developers create, configure, and test their AI agents.

**Required UI Elements - Global Layout:**
*   **Top Nav Bar:**
    *   Left: Back arrow, Editable Weblet Name (input field embedded in header, default: "Untitled Weblet").
    *   Right: Status badge ("Draft" or "Active"), "Save Draft" button (secondary), "Publish Weblet" button (primary).
*   **Split Screen Container:**
    *   **Left Pane:** Configuration Panel (using Shadcn Tabs).
    *   **Right Pane:** Live Preview Chat Interface.

**Required UI Elements - Left Pane (Configuration Panel):**

*   **Tab 1: Configuration (Default active)**
    *   **Category Dropdown:** Shadcn Select component. Options MUST BE EXACTLY: `WRITING`, `CODE`, `DATA_ANALYSIS`, `MARKETING`, `EDUCATION`, `CUSTOMER_SUPPORT`, `RESEARCH`, `CREATIVE`, `PRODUCTIVITY`, `FINANCE`, `HEALTH`, `LEGAL`, `OTHER`.
    *   **System Prompt (Instructions):** 
        *   Type: Large Textarea (monospaced font if possible).
        *   Label: "Agent Instructions / System Prompt".
        *   Placeholder: "You are a helpful assistant..."
    *   **Access Toggle:** Shadcn Switch. Label: "Subscribers Only". (Default: false / Free).

*   **Tab 2: Capabilities**
    *   **Web Search:** Shadcn Switch with description ("Allow this agent to search the live web for current information").
    *   **Code Interpreter:** Shadcn Switch with description ("Allow this agent to write and execute Python code in a secure sandbox").
    *   **Image Generation:** Shadcn Switch with description ("Allow this agent to generate images using DALL-E 3").

*   **Tab 3: Knowledge Base (RAG)**
    *   **Upload Area:** Drag-and-drop zone or file input button. Accepts `.pdf`, `.docx`, `.txt`, `.csv`.
    *   **Uploaded Files List:** A list displaying uploaded files displaying filename, size, and a "Delete" trash icon next to each.

*   **Tab 4: Optimization (RSIL)**
    *   **Enable RSIL:** Shadcn Switch. Label: "Enable Automatic Prompt Optimization (RSIL)".
    *   **Settings Form (Hidden if RSIL is off):**
        *   "Min Interactions Before Optimize" (Number input, default 100).
        *   "Optimization Frequency" (Select: Daily, Weekly, Manual).
        *   "Max Updates Per Day" (Number input, default 3).
        *   "Cooldown Hours" (Number input, default 6).
        *   "Require Developer Approval" (Switch, default false. Description: "If checked, all automated improvements will be sent to your inbox as Suggestions instead of auto-deploying.")

*   **Tab 5: Actions & Integrations (MCP)**
    *   **Description text:** "Connect external APIs or MCP (Model Context Protocol) servers to give your Weblet custom abilities."
    *   **Button:** "+ Add MCP Server" (Opens a modal with "Server Name" and "Server URL" inputs).
    *   **List Area:** Display connected MCP servers with a status dot (Green = Connected, Red = Offline) and a "Remove" button icon.
    *   **Button:** "+ Add Custom OpenAPI Action" (Opens a large textarea modal to paste an OpenAPI JSON/YAML schema).

**Required UI Elements - Right Pane (Live Preview):**
*   **Header:** "Live Preview Mode".
*   **Chat Window:** Standard chat interface (message history area that scrolls, input field at the bottom).
*   **Input Area:** Text input and a "Send" button icon. Must have a clear/reset chat button to start the test over.

**Logic / State:**
*   When editing the System Prompt or toggling Capabilities, it should feel like the Right Pane (Preview) is instantly aware of the new rules (even if we just handle this via a placeholder "Changes pending... click refresh" state for now).
*   File Upload should show a loading progress bar for realism.
