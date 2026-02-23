# Lovable Prompt: Segment 04 - Weblet Builder

**Context:** The Weblet Builder is the most complex UI in the app. It is a no-code split-screen interface where developers configure their AI agent on the left, and immediately test it in a live chat preview on the right.

**Design Guidance:** Split-pane layout (Resizable if possible, otherwise fixed 50/50 or 40/60). On mobile, it switches to a single-column view with a tab to toggle between config and preview. Use Shadcn Tabs for the left-side configuration panel. Provide a polished, IDE-like experience.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Our database schema is strict. Stick EXACTLY to the fields outlined below. The only image field is `iconUrl` for the weblet's profile picture.
2. **NO EXTRA ROUTES:** Only build the `/builder/[id]` route.

---

## 1. Route: `/builder/[id]` (The Weblet Studio)

**Purpose:** Where developers create, configure, and test their AI agents.

**Required UI Elements - Global Layout:**
*   **Split Screen Container:**
    *   **Left Pane:** Configuration Panel (using Shadcn Tabs).
    *   **Right Pane:** Live Preview Chat Interface.
*   **Sticky Bottom Publish Bar:**
    *   Left: Status indicator ("Draft", "Saving..." with spinner, or "Saved" with checkmark).
    *   Right: "Save Draft" button (secondary), "Publish" button (primary, or "Unpublish" if already active).

**Required UI Elements - Left Pane (Configuration Panel):**

*   **Tab 1: Configure (Default active)**
    *   **Icon / Profile Picture:** Circular avatar preview (64×64). Shows uploaded image or first letter of name as fallback. URL text input below it. Helper text: "Enter a URL for your weblet's icon (PNG, JPG, or WebP). Shown on marketplace cards." Uses Lucide `ImageIcon` for empty state.
    *   **Name:** Text input. Required.
    *   **Category Dropdown:** Searchable Shadcn Select component. Options MUST BE EXACTLY: `WRITING`, `CODE`, `DATA_ANALYSIS`, `MARKETING`, `EDUCATION`, `CUSTOMER_SUPPORT`, `RESEARCH`, `CREATIVE`, `PRODUCTIVITY`, `FINANCE`, `HEALTH`, `LEGAL`, `OTHER`. (Show icons and descriptions for each if possible).
    *   **Description:** Textarea. (Max 300 characters).
    *   **Agent Instructions / System Prompt:** Large Textarea (monospaced font if possible). **Max 8,000 characters.** Shows color-coded character counter: green (< 6,000), yellow (6,000–7,500), red (> 7,500). Input blocked at limit.
    *   **Model Selector:** Dropdown showing LLM models from OpenRouter (Provider Name, Model Name, Cost Indicator ($, $$, $$$), and one-line description).
    *   **Conversation Starters:** Editable list of chips. User can add, remove, and reorder. **Max 4 starters.** Shows counter (e.g. "2/4"). "Add" button and input disable when limit is reached. Shows amber warning text: "Maximum 4 conversation starters reached".
    *   **Privacy Policy:** Text input for a URL.
    *   **Access Toggle:** Shadcn Switch. Label: "Subscribers Only". (Default: false / Free).

*   **Tab 2: Capabilities**
    *   **Web Search:** Shadcn Switch with description ("Search the internet for current information").
    *   **Code Interpreter:** Shadcn Switch with description ("Allow this agent to write and execute Python code in a secure sandbox").
    *   **Image Generation:** Shadcn Switch with description ("Generate images from text descriptions").
    *   **Knowledge Search:** Shadcn Switch with description ("Search uploaded knowledge files using AI").

*   **Tab 3: Knowledge (RAG)**
    *   **Upload Area:** Drag-and-drop zone. Accepts `.pdf`, `.docx`, `.txt`, `.csv`, and `.md` (Max 20MB each).
    *   **Uploaded Files List:** A list displaying filename, file size, chunk count, and a "Delete" button.
    *   **Progress Indicator:** Show status during upload: "Uploading... -> Extracting text... -> Chunking... -> Generating embeddings... -> Done".

*   **Tab 4: Actions**
    *   **Editor:** Syntax-highlighted JSON/YAML code editor for defining OpenAPI schemas.
    *   **Input/Import:** Support pasting a URL to fetch an existing OpenAPI schema.
    *   **Endpoint Preview:** After successful validation, display a clean list of discovered endpoints below the editor (method, path, and description).

**Required UI Elements - Right Pane (Live Preview):**
*   **Header:** "Live Preview Mode".
*   **Chat Window:** Standard chat interface. Shows a placeholder until Segment 05 makes it functional.
*   **Input Area:** Text input and a "Send" button icon. Must have a clear/reset chat button to start the test over.

**Logic / State:**
*   **Auto-Save:** Every field change triggers an auto-save (visual "Saving..." / "Saved" indicator in the bottom bar).
*   **Validation:** Publish validates that Name, Category, and Instructions are filled out. Displays toasts clearly identifying any missing required fields.
