# Segment 05: Chat Engine & Tool Execution

**Estimated effort:** 3 weeks
**Depends on:** Segment 04 (Weblet Builder — knowledge files must be embeddable)
**Produces:** Working chat interface where users talk to weblets, with streaming responses, 5 tool types, and the payment feature flag
**Status:** ✅ IMPLEMENTED

---

## What This Segment Is

This is the most important segment — it is what users directly interact with. A user opens a weblet, sends a message, and receives an AI-powered streaming response. The AI can call tools (web search, code interpreter, image generation, knowledge search, custom API actions) based on what the developer enabled in the builder.

This segment also introduces the **payment feature flag** (`ENABLE_PAYMENT_ENFORCEMENT`). The entire payment infrastructure is designed to work, but the flag is set to `false` at launch — meaning all weblets are free to use. When the platform is ready for monetization, flipping this flag to `true` activates all payment checks without any code changes.

> **Example:** User Jordan opens the "Blog Writer" weblet from the marketplace. He types "Write a blog post about remote work trends in 2025." The AI streams a response in real-time. Midway, it calls the Web Search tool to find current statistics, which appear as a collapsible section in the chat. The final response includes the blog post with real data citations. Jordan rates it 4 stars. Because `ENABLE_PAYMENT_ENFORCEMENT` is false, Jordan didn't need to pay even though the developer set a $5/month price — that will be enforced later.

---

## Implementation Status

### What Was Built

#### Backend (Chat API & Tool System)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Chat API Route | `app/api/chat/route.ts` | ✅ Done | Streaming endpoint using `streamText` with `toUIMessageStreamResponse()`. Uses AI SDK v6 with `DefaultChatTransport`. Includes `experimental_telemetry` and `after()` for trace flushing. Multi-step tool execution enabled via `maxSteps: 5`. |
| Chat Feedback API | `app/api/chat/feedback/route.ts` | ✅ Done | POST endpoint for thumbs up/down ratings with optional text feedback. Saves to `AnalyticsEvent`. |
| Chat Sessions List API | `app/api/chat/sessions/route.ts` | ✅ Done | GET endpoint to list sessions for a weblet. |
| Chat Session Detail API | `app/api/chat/sessions/[id]/route.ts` | ✅ Done | GET endpoint to retrieve a specific session with messages. |
| Tool Registry | `lib/tools/registry.ts` | ✅ Done | Maps capability toggles to tool definitions. |
| Web Search | `lib/tools/web-search.ts` | ✅ Done | Tavily API integration. Returns up to 5 results with titles, URLs, content. |
| Code Interpreter | `lib/tools/code-interpreter.ts` | ✅ Done | E2B Sandbox integration. Executes Python in secure cloud sandbox. 30s timeout. |
| Image Generation | `lib/tools/image-generation.ts` | ✅ Done | DALL-E 3 API integration via OpenAI. |
| File Search (RAG) | `lib/tools/file-search.ts` | ✅ Done | **Hybrid Search**: pgvector cosine similarity search + PostgreSQL full-text search (`tsvector`), merged using Reciprocal Rank Fusion (RRF). Requires `webletId` for dataset scoping. |
| Custom Actions | `lib/tools/action-executor.ts` | ✅ Done | Dynamic tool creation from OpenAPI schemas. |
| Chat Engine | `lib/chat/engine.ts` | ✅ Done | Core orchestration — system prompt building, `getActiveVersion()` stub. |
| Chat History | `lib/chat/history.ts` | ✅ Done | Load/save conversation history from `ChatSession`/`ChatMessage` tables. |
| Access Control | `lib/chat/access.ts` | ✅ Done | `checkAccess()` with `ENABLE_PAYMENT_ENFORCEMENT` flag (set to `false`). |
| Analytics | `lib/chat/analytics.ts` | ✅ Done | Logs `AnalyticsEvent` after each chat completion. |
| OpenRouter Client | `lib/ai/openrouter.ts` | ✅ Done | OpenRouter client setup with `@openrouter/ai-sdk-provider`. Fallback logic included. |
| Langfuse Observability | `lib/observability/langfuse.ts` | ✅ Done | Langfuse OTEL initialization for trace capture. |
| Instrumentation | `instrumentation.ts` | ✅ Done | Next.js instrumentation file configuring `LangfuseSpanProcessor` and `NodeTracerProvider`. |

#### Frontend (Chat UI Components)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Chat Layout | `app/(user)/chat/[webletId]/layout.tsx` | ✅ Done | Split-screen layout: sidebar + main chat area. Uses `overflow-hidden` and `min-w-0` to prevent content blowout. |
| New Chat Page | `app/(user)/chat/[webletId]/page.tsx` | ✅ Done | Loads weblet config, parses conversation starters from prompt JSON. |
| Resume Chat Page | `app/(user)/chat/[webletId]/[sessionId]/page.tsx` | ✅ Done | Loads existing session with `initialMessages`. |
| Chat Container | `components/chat/chat-container.tsx` | ✅ Done | Full chat layout (header + messages + input). Uses `useChat` with `DefaultChatTransport`. Has `overflow-hidden` on root div. |
| Chat Header | `components/chat/chat-header.tsx` | ✅ Done | Weblet name, icon, back button. |
| Chat Sidebar | `components/chat/chat-sidebar.tsx` | ✅ Done | "New Chat" button, list of recent sessions for the current weblet, delete session support. |
| Message List | `components/chat/message-list.tsx` | ✅ Done | Scrollable message list with auto-scroll. Has `overflow-x-hidden` to prevent horizontal blowout. |
| Message Bubble | `components/chat/message-bubble.tsx` | ✅ Done | Individual message with markdown rendering via `ChatMarkdown`. User messages have `break-words`. Assistant messages show copy/thumbs up/thumbs down actions on hover. |
| Input Bar | `components/chat/input-bar.tsx` | ✅ Done | Textarea with send button. Disabled while streaming. |
| Typing Indicator | `components/chat/typing-indicator.tsx` | ✅ Done | Animated bouncing dots. |
| Starter Chips | `components/chat/starter-chips.tsx` | ✅ Done | Clickable conversation starter buttons shown in empty state. |
| Rating Dialog | `components/chat/rating-dialog.tsx` | ✅ Done | Modal triggered by thumbs down, collects text feedback. |

#### Shared UI Components (Created for Chat)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| ChatMarkdown | `components/ui/chat-markdown.tsx` | ✅ Done | Centralized markdown renderer used by both the main chat and builder preview. Uses `react-markdown` with `remark-gfm`, `remark-math`, `rehype-highlight`, `rehype-katex`. Custom `pre` renderer routes code blocks to `PremiumCodeBlock`. Custom `code` renderer styles inline code. Prose heading sizes tuned (h1: xl, h2: lg, h3: base, h4-h6: sm). Has `overflow-hidden`, `min-w-0`, `break-words`. |
| PremiumCodeBlock | `components/ui/premium-code-block.tsx` | ✅ Done | ChatGPT-style code block with dark `#0d0d0d` background, `#2f2f2f` header bar showing language name, "Copy code" / "Copied!" button with animated state. Uses plain `overflow-x-auto` (NOT Radix ScrollArea — it causes flex blowout). Has `max-w-full overflow-hidden` on root to prevent layout escape. |

#### Builder Preview (Updated)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Preview Chat | `components/builder/preview-chat.tsx` | ✅ Updated | Updated to use `ChatMarkdown` component instead of raw `ReactMarkdown`, so code blocks in the builder preview also get premium styling. |

---

## How It Was Done

### Step 1 — Chat API Route (`app/api/chat/route.ts`)

The core streaming endpoint (`POST /api/chat`) handles every chat interaction:

1. Verify the user is authenticated
2. Load the weblet's configuration (instructions, model, capabilities, actions)
3. Check access — if `ENABLE_PAYMENT_ENFORCEMENT` is `true` and the weblet is paid, verify the user has an active subscription. If the flag is `false`, skip this check entirely (everyone gets access).
4. Get the active prompt version (for RSIL A/B testing — returns the default instructions until Segment 15 implements version routing)
5. Build the tools array based on the weblet's enabled capabilities
6. Add any custom action tools parsed from the weblet's OpenAPI schemas
7. Wrap the AI call with Langfuse Telemetry to capture the execution trace natively using OpenTelemetry. This involves adding `experimental_telemetry` to the `streamText` options and capturing metadata like `userId`, `sessionId`, and `webletId`. Also, use Next.js's `after()` function to flush the Langfuse traces before the serverless execution terminates.
8. Stream the LLM response via the Vercel AI SDK through OpenRouter. **Implementation note (AI SDK v6):** Use `result.toUIMessageStreamResponse()` as the return value — this is the only streaming format compatible with the `useChat` hook's `DefaultChatTransport`. Do NOT use `toTextStreamResponse()` or `toDataStreamResponse()` as they are incompatible.
9. On completion, save messages to the database, log usage for billing, and log analytics events

### Step 2 — Payment Feature Flag

`ENABLE_PAYMENT_ENFORCEMENT = false` in `lib/constants.ts`.

The `checkAccess()` function in `lib/chat/access.ts` checks this flag:
- When `false` → immediately return (free access for everyone)
- When `true` → check if the weblet is paid, and if so, verify the user's subscription

### Step 3 — Tool Registry & Implementation

A registry (`lib/tools/registry.ts`) maps capability toggle names to actual tool implementations:

| Capability Toggle | Tool | External Service | Description |
|------------------|------|-----------------|-------------|
| `webSearch` | Web Search | Tavily API | Searches the internet and returns clean text results with sources |
| `codeInterpreter` | Code Interpreter | E2B Sandbox | Executes Python code in a secure cloud sandbox, returns stdout/stderr |
| `imageGeneration` | Image Generation | DALL-E 3 API | Generates images from text descriptions |
| `fileSearch` | Knowledge Search | pgvector (internal) | Searches uploaded files using **Hybrid Search**: combines semantic vector search (`pgvector`) with full-text keyword search (`tsvector`), merged using Reciprocal Rank Fusion (RRF). |
| (from actions JSON) | Custom Actions | Any API | Dynamically generated tools from OpenAPI schemas |

**Cost caps to prevent runaway spending:**
- Max 5 tool calls per message (via `maxSteps: 5`)
- Max 3 code interpreter executions per session
- Max 30 seconds per code execution
- Max 5 search results per web search

### Step 4 — Chat UI

The chat interface was built as a split-screen layout:

- **Chat Sidebar** — "New Chat" button, list of recent sessions (for current weblet only), delete sessions
- **Chat Header** — Weblet name, icon, back button
- **Message List** — Scrollable area with auto-scroll to latest message
- **Message Rendering** — Uses `ChatMarkdown` with remark-gfm, remark-math, rehype-highlight, rehype-katex
- **Code Block Display** — `PremiumCodeBlock` component with ChatGPT-style dark theme, language label, copy button
- **Starter Chips** — Clickable conversation starter buttons in empty state
- **Input Bar** — Textarea with Send button, disabled while streaming
- **Typing Indicator** — Animated bouncing dots
- **Message Actions** — Copy, Thumbs Up, Thumbs Down (hover to reveal)
- **Rating Dialog** — Modal for text feedback on Thumbs Down

### Step 5 — Langfuse Observability

- `instrumentation.ts` at project root configures `NodeTracerProvider` with `LangfuseSpanProcessor`
- `next.config.mjs` has `experimental: { instrumentationHook: true }`
- `lib/observability/langfuse.ts` handles Langfuse OTEL initialization
- Chat route uses `experimental_telemetry` in `streamText` and `after()` for trace flushing

---

## Critical Implementation Details

### Overflow Prevention (Flexbox Blowout Fix)

The split-screen chat layout had a critical CSS issue where long code blocks or text would expand the chat panel beyond its boundaries, pushing content off-screen. This was fixed at 5 levels:

1. **`layout.tsx`** — Root has `overflow-hidden` and `<main>` has `min-w-0`
2. **`chat-container.tsx`** — Root div has `overflow-hidden`
3. **`message-list.tsx`** — Scroll container has `overflow-x-hidden`
4. **`chat-markdown.tsx`** — Prose wrapper has `overflow-hidden`, `min-w-0`, `break-words`
5. **`premium-code-block.tsx`** — Root has `max-w-full overflow-hidden`, code body uses plain `overflow-x-auto` (NOT Radix ScrollArea, which causes flex blowout)

### Markdown Rendering Stack

```
ChatMarkdown (components/ui/chat-markdown.tsx)
  └── react-markdown v10.1.0
      ├── remark-gfm          (tables, strikethrough, etc.)
      ├── remark-math          (LaTeX math formulas)
      ├── rehype-highlight     (syntax highlighting)
      └── rehype-katex         (math rendering)
```

- `<pre>` tags → routed to `PremiumCodeBlock`
- `<code>` tags (inline) → styled with `bg-muted px-1.5 py-0.5`
- Headings scaled down: h1=xl, h2=lg, h3=base, h4-h6=sm
- KaTeX CSS imported in `globals.css`

### AI SDK v6 Notes

- Use `@openrouter/ai-sdk-provider` as primary provider (NOT `@ai-sdk/openai`)
- Use `result.toUIMessageStreamResponse()` in route handlers
- Frontend uses `useChat` with `DefaultChatTransport`
- Model IDs must match OpenRouter naming exactly (e.g., `meta-llama/llama-3.3-70b-instruct`)
- `@openrouter/ai-sdk-provider` does NOT support `maxTokens`/`maxOutputTokens` passthrough

---

## Files Created

```
app/(user)/chat/
├── [webletId]/
│   ├── layout.tsx                     ← Split-screen layout (sidebar + main)
│   ├── page.tsx                       ← New chat page (loads weblet config)
│   └── [sessionId]/
│       └── page.tsx                   ← Resume existing chat session

app/api/chat/
├── route.ts                           ← Streaming chat endpoint (POST)
├── feedback/
│   └── route.ts                       ← Rating/feedback endpoint (POST)
└── sessions/
    ├── route.ts                       ← List sessions (GET)
    └── [id]/
        └── route.ts                   ← Get session detail (GET)

instrumentation.ts                     ← Next.js instrumentation (LangfuseSpanProcessor)

lib/tools/
├── registry.ts                        ← Maps capability toggles → tool definitions
├── web-search.ts                      ← Tavily API integration
├── code-interpreter.ts                ← E2B sandbox integration
├── image-generation.ts                ← DALL-E 3 integration
├── file-search.ts                     ← pgvector RAG search
└── action-executor.ts                 ← Dynamic tool creation from OpenAPI schemas

lib/chat/
├── engine.ts                          ← Core chat orchestration (system prompt, version routing stub)
├── history.ts                         ← Load/save conversation history
├── access.ts                          ← Subscription access check with ENABLE_PAYMENT_ENFORCEMENT flag
└── analytics.ts                       ← Log analytics events after chat completion

lib/ai/
└── openrouter.ts                      ← OpenRouter client setup with fallback

lib/observability/
└── langfuse.ts                        ← Langfuse OTEL initialization

components/chat/
├── chat-container.tsx                 ← Full chat layout (header + messages + input)
├── chat-header.tsx                    ← Weblet name, icon, back button
├── chat-sidebar.tsx                   ← Session history sidebar
├── message-list.tsx                   ← Scrollable message list with auto-scroll
├── message-bubble.tsx                 ← Individual message with ChatMarkdown rendering
├── input-bar.tsx                      ← Message input with send button
├── typing-indicator.tsx               ← Animated dots while streaming
├── starter-chips.tsx                  ← Conversation starter buttons
└── rating-dialog.tsx                  ← Feedback modal for thumbs down

components/ui/
├── chat-markdown.tsx                  ← Centralized markdown renderer (shared by chat + builder preview)
└── premium-code-block.tsx             ← ChatGPT-style code block component

components/builder/
└── preview-chat.tsx                   ← Builder preview chat (updated to use ChatMarkdown)
```

---

## Environment Variables Required

```env
OPENROUTER_API_KEY=           # OpenRouter API key (primary LLM gateway)
TAVILY_API_KEY=               # Tavily API key (web search tool)
E2B_API_KEY=                  # E2B API key (code interpreter sandbox)
OPENAI_API_KEY=               # OpenAI key (DALL-E 3 image generation + embeddings)
LANGFUSE_PUBLIC_KEY=          # Langfuse public key
LANGFUSE_SECRET_KEY=          # Langfuse secret key
LANGFUSE_BASEURL=             # Langfuse base URL (e.g., https://cloud.langfuse.com)
```

---

## Dependencies Installed

```bash
npm install ai                           # Vercel AI SDK v6
npm install @ai-sdk/react                # React hooks for AI SDK
npm install @openrouter/ai-sdk-provider  # OpenRouter provider
npm install @ai-sdk/openai               # OpenAI provider (fallback + embeddings + DALL-E)
npm install @ai-sdk/anthropic            # Anthropic provider (fallback)
npm install zod                          # Schema validation for tool parameters
npm install @e2b/code-interpreter        # E2B code execution
npm install react-markdown               # Markdown rendering
npm install remark-gfm                   # GitHub-flavored markdown
npm install remark-math                  # Math formula parsing
npm install rehype-highlight             # Code syntax highlighting
npm install rehype-katex                 # Math rendering (KaTeX)
npm install katex                        # KaTeX CSS/runtime
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node @opentelemetry/sdk-trace-node @opentelemetry/api # Langfuse observability
```

---

## Acceptance Criteria

- [x] User can open a chat with any active weblet from the marketplace
- [x] Chat page shows weblet name, icon, and conversation starters
- [x] Messages stream in real-time (word by word via SSE)
- [x] Web Search tool works — shows search results inline with sources
- [x] Code Interpreter tool works — shows code + output
- [x] Image Generation tool works — shows generated image inline
- [x] Knowledge Search (RAG) works — retrieves relevant knowledge chunks
- [x] Custom Actions work — calls external APIs from OpenAPI schemas
- [x] Conversation history saved to ChatSession/ChatMessage tables
- [x] Users can resume previous chat sessions
- [x] **ENABLE_PAYMENT_ENFORCEMENT flag is set to false** — all weblets are free
- [x] When flag is false, checkAccess() always passes (no paywall shown)
- [x] Vercel AI SDK call is wrapped in Langfuse OpenTelemetry
- [x] Analytics event logged after each chat completion
- [x] Rating saved to AnalyticsEvent (Up/Down + text feedback)
- [x] Markdown rendered correctly in assistant messages (including math, syntax highlighting)
- [x] Premium code blocks with ChatGPT-style dark theme
- [x] Chat panel stays within split-screen boundaries (overflow prevented at 5 levels)
- [ ] Tool calls displayed as collapsible sections (basic inline display implemented, collapsible UI deferred)
- [ ] LLM fallback fully tested — if OpenRouter is down, direct provider is used
- [ ] Rate limiting: max 5 tool calls per message, max 3 code executions per session (configured but not enforced end-to-end)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OpenRouter rate limits | Retry with exponential backoff. Fallback to direct providers. |
| E2B costs at scale | Hard cap: 3 code executions per session, 30s timeout. Monitor weekly. |
| Tool calls take too long | Show loading states per tool ("Searching the web..."). 30s timeout per tool. |
| Large knowledge bases slow RAG | HNSW index ensures sub-100ms queries. Limit to top 5 chunks. |
| Payment flag confusion | Clear documentation. Flag is in one place (constants.ts). Tests cover both states. |
| Code blocks breaking chat layout | Fixed with 5-level overflow containment. Use plain CSS overflow-x-auto, NOT Radix ScrollArea. |
