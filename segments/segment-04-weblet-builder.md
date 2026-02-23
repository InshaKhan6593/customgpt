# Segment 04: Weblet Builder

**Estimated effort:** 2.5 weeks
**Depends on:** Segment 03 (Database & API Layer)
**Produces:** Visual no-code builder for creating and configuring weblets, including category selection and knowledge file processing pipeline
**References:** segment-14-categories-discovery.md

---

## What This Segment Is

The Weblet Builder is the primary tool for developers. It is a visual no-code interface where developers create AI agents by configuring instructions, selecting a model, choosing a category, toggling tool capabilities, uploading knowledge files, and defining custom API actions. The builder uses a split-screen layout — configuration on the left, live chat preview on the right.

This segment also includes the **knowledge file processing pipeline** (RAG): when a developer uploads a PDF, DOCX, or TXT file, it is extracted, chunked, embedded, and stored in pgvector for semantic search during chat.

> **Example:** Developer Priya wants to create a weblet that helps users write blog posts. She opens the builder, names it "Blog Writer", selects the WRITING category, writes system instructions ("You are an expert blog writer who helps users create engaging posts..."), toggles on Web Search so the AI can research topics, uploads her style guide PDF as knowledge, adds conversation starters like "Help me write a blog post about..." and clicks Publish. The weblet appears in the marketplace within seconds.

---

## How It Will Be Done

### Step 1 — Build the Split-Screen Layout

The builder uses a two-panel design:
- **Left panel (50%):** Tabbed configuration form with 5 tabs
- **Right panel (50%):** Preview chat (shows a placeholder until Segment 05 makes it functional)

The layout is responsive — on mobile, it switches to a single-column view with a tab to toggle between config and preview.

### Step 2 — Build the Configure Tab

The first tab contains all core settings. Fields appear in this order:

1. **Icon / Profile Picture** — Circular avatar preview with URL input. Shows the uploaded icon or the first letter of the name. Used on marketplace cards. Stored as `iconUrl` on the Weblet model.
2. **Name** — Text input. Required. Auto-generates a URL slug (e.g., "Blog Writer" → "blog-writer")
3. **Category** — Searchable dropdown showing all 13 categories with icons and descriptions. Required before publishing, optional for drafts. See segment-14-categories-discovery.md for the full taxonomy.
4. **Description** — Textarea. A short description shown on the marketplace card (max 300 characters)
5. **Instructions** — Large textarea for the system prompt. This is what defines the weblet's personality and behavior. Shows character count with color-coded indicator (green < 6,000, yellow 6,000–7,500, red > 7,500). **Max 8,000 characters** (aligned with OpenAI GPT Builder).
6. **Model Selector** — Dropdown with curated LLM models from OpenRouter. Each option shows the provider name, model name, cost indicator ($, $$, $$$), and a one-line description.
7. **Conversation Starters** — Editable list. Developer adds suggested opening messages. Users see these as clickable chips in the chat interface. Can add, remove, and reorder. **Max 4 starters** (aligned with OpenAI GPT Builder). "Add" button disables at limit.
7. **Privacy Policy** — Optional. URL or text field for the weblet's privacy policy.

> **Example of the model selector:**
> The dropdown shows: "Claude 3.5 Sonnet (Anthropic) — $$ — Best for complex reasoning", "GPT-4o (OpenAI) — $$ — Fast multimodal", "Gemini 2.0 Flash (Google) — $ — Fast and cheap", "Llama 3.3 70B (Meta) — $ — Open source, strong", etc.

### Step 3 — Build the Capabilities Tab

Toggle switches for each tool the weblet can use during chat:

| Capability | Description | What Happens When Enabled |
|-----------|------------|--------------------------|
| **Web Search** | Search the internet for current information | The AI can call Tavily to fetch search results |
| **Code Interpreter** | Execute Python code in a secure sandbox | The AI can write and run Python code via E2B |
| **Image Generation** | Generate images from text descriptions | The AI can call DALL-E 3 to create images |
| **Knowledge Search** | Search uploaded knowledge files using AI | The AI can query the developer's uploaded documents via pgvector |

Each toggle shows the capability name, an icon, and a description. When "Knowledge Search" is toggled on, the Knowledge tab gets a highlight indicator showing it needs attention (files should be uploaded).

### Step 4 — Build the Knowledge Tab

This tab handles the RAG (Retrieval Augmented Generation) pipeline:

1. **File Upload Area** — A drag-and-drop zone that accepts PDF, DOCX, TXT, CSV, and MD files (max 20MB each)
2. **Processing Pipeline** — When a file is uploaded:
   - The file is stored in Vercel Blob (cloud storage)
   - A KnowledgeFile record is created in the database
   - Text is extracted from the file using the LlamaParse API (preventing Vercel serverless OOM crashes on large complex files)
   - The extracted text is split into chunks of 500 tokens each, with 50-token overlap between chunks
   - Each chunk is sent to OpenAI's text-embedding-3-small model to generate a 1536-dimension vector embedding
   - Chunks and embeddings are stored in the KnowledgeChunk table using prisma-extension-pgvector
   - The file card updates to show the chunk count
3. **File List** — Shows all uploaded files with filename, file size, chunk count, and a delete button
4. **Progress Indicator** — During processing, show: "Uploading... → Extracting text... → Chunking... → Generating embeddings... → Done (42 chunks created)"

> **Example:** Developer uploads "company-handbook.pdf" (2MB, 50 pages). The system extracts text, creates 120 chunks of ~500 tokens each, generates embeddings, and stores them. When a user later asks the weblet "What is the PTO policy?", the chat engine searches these embeddings to find the most relevant chunks and includes them in the AI's context.

### Step 5 — Build the Actions Tab

A code editor for defining custom API integrations using OpenAPI schemas:

1. **Editor** — Syntax-highlighted JSON/YAML editor (using Monaco Editor or a lightweight alternative)
2. **Validation** — On save, validate the schema against OpenAPI 3.0 specification. Show inline errors if invalid.
3. **Endpoint Preview** — After validation succeeds, display a list of discovered endpoints: method (GET/POST/etc.), path, and description. This gives the developer visual confirmation of what actions the weblet will have.
4. **Import** — Support pasting a URL to fetch an existing OpenAPI schema

> **Example:** A developer pastes a weather API OpenAPI schema. The editor validates it and shows: "GET /weather — Get current weather for a location", "GET /forecast — Get 7-day forecast". Now during chat, the AI can call these endpoints to answer weather questions.

### Step 6 — Build the Publish Bar

A sticky bottom bar with three states:

- **Draft** — Shows "Save Draft" (auto-saves on every change with 300ms debounce) and "Publish" button
- **Published** — Shows "Saved" indicator and "Unpublish" button
- **Saving** — Shows "Saving..." with a spinner

**Publish requirements:**
- Name is required
- Category is required (the developer must pick one)
- Instructions are required (system prompt cannot be empty)
- If the validation fails, highlight the missing fields and show a toast: "Please fill in all required fields"

### Step 7 — Implement Auto-Save

Every field change triggers an auto-save with debounce:
1. User types or changes a field
2. After 300ms of no changes, a PATCH request fires to `/api/weblets/[id]`
3. A "Saving..." indicator appears in the publish bar
4. On success, it changes to "Saved" with a checkmark
5. On failure, it shows "Error saving" with a retry button

---

## Files to Create

```
app/(dashboard)/builder/
├── page.tsx                       ← "Create New Weblet" — POST then redirect to /builder/[id]
└── [id]/
    └── page.tsx                   ← Edit weblet (full builder interface)

components/builder/
├── builder-layout.tsx             ← Split view: config panel (left), preview chat (right)
├── builder-tabs.tsx               ← Tab navigation: Configure | Capabilities | Knowledge | Actions
├── configure-tab/
│   ├── name-description.tsx       ← Name + slug + description fields
│   ├── category-selector.tsx      ← Searchable dropdown for WebletCategory enum with icons
│   ├── instructions-editor.tsx    ← Textarea for system prompt (with character count)
│   ├── model-selector.tsx         ← Dropdown with OpenRouter models + cost indicator
│   ├── conversation-starters.tsx  ← Editable list (add/remove/reorder)
│   └── privacy-policy.tsx         ← Privacy policy URL or text input
├── capabilities-tab/
│   └── capability-toggles.tsx     ← Toggle switches for each tool
├── knowledge-tab/
│   ├── knowledge-uploader.tsx     ← Drag-and-drop file upload area with progress
│   └── knowledge-file-list.tsx    ← List of uploaded files with delete button
├── actions-tab/
│   └── action-schema-editor.tsx   ← JSON/YAML editor for OpenAPI schemas + validation
├── publish-bar.tsx                ← Bottom bar: Save Draft | Publish | Unpublish
└── preview-chat.tsx               ← Live preview chat panel (placeholder until Segment 05)

lib/knowledge/
├── process.ts                     ← Main pipeline: upload → extract → chunk → embed → store
├── extract.ts                     ← Text extraction from PDF, DOCX, TXT, CSV, MD
├── chunk.ts                       ← Text chunking (500 tokens, 50 token overlap)
└── embed.ts                       ← OpenAI text-embedding-3-small API call
```

---

## Acceptance Criteria

- [ ] Developer can create a new weblet from `/(dashboard)/builder`
- [ ] Builder shows split-screen layout (config left, preview right)
- [ ] All 4 tabs work: Configure, Capabilities, Knowledge, Actions
- [ ] **Category selector** shows all 13 categories with icons and descriptions
- [ ] **Category is required** before publishing (validation error if missing)
- [ ] Category can be changed after publishing
- [ ] Name, description, icon URL, instructions, model, starters, privacy policy fields save correctly
- [ ] Icon preview shows uploaded image or first-letter fallback
- [ ] Instructions textarea enforces 8,000-character limit with color-coded counter
- [ ] Conversation starters capped at 4 — "Add" button disables at limit
- [ ] Capability toggles update the weblet's capabilities JSON
- [ ] Knowledge files upload via drag-and-drop (PDF, DOCX, TXT, CSV, MD — max 20MB)
- [ ] Upload shows progress: Uploading → Extracting → Chunking → Embedding → Done
- [ ] Uploaded files are chunked and embedded in pgvector
- [ ] Knowledge file list shows filename, size, chunk count, delete button
- [ ] OpenAPI action schemas are validated against OpenAPI 3.0 before save
- [ ] Action schema editor shows parsed endpoints after validation
- [ ] Conversation starters can be added, removed, and reordered
- [ ] Auto-save works with 300ms debounce (visual "Saving..." / "Saved" indicator)
- [ ] Publish validates: name, category, and instructions are required
- [ ] Published weblets appear in the marketplace (via isActive flag)
- [ ] Developer can edit and unpublish existing weblets
- [ ] Model selector shows provider, cost indicator, and description
- [ ] File upload validates size (max 20MB) and file type

---

## After Completion, the Developer Will Be Able To

1. **Create a new weblet** from the dashboard with a single click
2. **Configure every aspect** of their AI agent: name, category, instructions, model, tools, knowledge, and custom actions
3. **Upload knowledge files** and see them processed into searchable embeddings
4. **See a live preview** of how the chat interface will look (placeholder until Segment 05)
5. **Publish to the marketplace** — the weblet becomes discoverable by users
6. **Edit and unpublish** at any time
7. **Choose a category** that determines where the weblet appears in the marketplace

---

## Dependencies to Install

```bash
npm install @monaco-editor/react     # Or react-simple-code-editor for lighter alternative
npm install llamaparse               # LlamaParse API for document extraction
npm install papaparse                # CSV parsing
npm install openai                   # For embedding API
npm install @vercel/blob             # File storage
npm install prisma-extension-pgvector # Native Prisma pgvector support
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large PDF processing takes too long | Process asynchronously — show upload progress, chunk/embed in background |
| OpenAI embedding costs | text-embedding-3-small is very cheap ($0.02/1M tokens). A 100-page PDF costs ~$0.01 |
| Monaco editor bundle size | Lazy-load the editor component. Or use lighter alternative (react-simple-code-editor) |
| Vercel Blob size limits | Max 500MB per file on Pro plan. Our 20MB limit is well within this. |
