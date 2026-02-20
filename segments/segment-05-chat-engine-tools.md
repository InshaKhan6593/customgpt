# Segment 05: Chat Engine & Tool Execution

**Estimated effort:** 3 weeks
**Depends on:** Segment 04 (Weblet Builder — knowledge files must be embeddable)
**Produces:** Working chat interface where users talk to weblets, with streaming responses, 5 tool types, and the payment feature flag

---

## What This Segment Is

This is the most important segment — it is what users directly interact with. A user opens a weblet, sends a message, and receives an AI-powered streaming response. The AI can call tools (web search, code interpreter, image generation, knowledge search, custom API actions) based on what the developer enabled in the builder.

This segment also introduces the **payment feature flag** (`ENABLE_PAYMENT_ENFORCEMENT`). The entire payment infrastructure is designed to work, but the flag is set to `false` at launch — meaning all weblets are free to use. When the platform is ready for monetization, flipping this flag to `true` activates all payment checks without any code changes.

> **Example:** User Jordan opens the "Blog Writer" weblet from the marketplace. He types "Write a blog post about remote work trends in 2025." The AI streams a response in real-time. Midway, it calls the Web Search tool to find current statistics, which appear as a collapsible section in the chat. The final response includes the blog post with real data citations. Jordan rates it 4 stars. Because `ENABLE_PAYMENT_ENFORCEMENT` is false, Jordan didn't need to pay even though the developer set a $5/month price — that will be enforced later.

---

## How It Will Be Done

### Step 1 — Build the Chat API Route

The core streaming endpoint (`POST /api/chat`) handles every chat interaction:

1. Verify the user is authenticated
2. Load the weblet's configuration (instructions, model, capabilities, actions)
3. Check access — if `ENABLE_PAYMENT_ENFORCEMENT` is `true` and the weblet is paid, verify the user has an active subscription. If the flag is `false`, skip this check entirely (everyone gets access).
4. Get the active prompt version (for RSIL A/B testing — returns the default instructions until Segment 13 implements version routing)
5. Build the tools array based on the weblet's enabled capabilities
6. Add any custom action tools parsed from the weblet's OpenAPI schemas
7. Stream the LLM response via the Vercel AI SDK through OpenRouter
8. On completion, save messages to the database and log analytics events

### Step 2 — Implement the Payment Feature Flag

Add a constant to `lib/constants.ts`:

```
ENABLE_PAYMENT_ENFORCEMENT = false
```

The `checkAccess()` function in `lib/chat/access.ts` checks this flag:
- When `false` → immediately return (free access for everyone)
- When `true` → check if the weblet is paid, and if so, verify the user's subscription

This means:
- Developers CAN set prices in the builder (the fields exist)
- The Stripe product/price CAN be created (Segment 06)
- But users will NOT see the paywall until the flag is flipped
- All the payment UI is hidden behind conditional checks on this same flag

> **Why a feature flag instead of just removing payment code?** Because we want the complete payment flow to be built, tested, and ready. When it's time to monetize, it's a single constant change — no code rewrite, no new deployment logic.

### Step 3 — Build the Tool Registry

A registry that maps capability toggle names to actual tool implementations:

| Capability Toggle | Tool | External Service | Description |
|------------------|------|-----------------|-------------|
| `webSearch` | Web Search | Tavily API | Searches the internet and returns clean text results with sources |
| `codeInterpreter` | Code Interpreter | E2B Sandbox | Executes Python code in a secure cloud sandbox, returns stdout/stderr |
| `imageGeneration` | Image Generation | DALL-E 3 API | Generates images from text descriptions |
| `fileSearch` | Knowledge Search | pgvector (internal) | Searches the weblet's uploaded knowledge files using vector similarity |
| (from actions JSON) | Custom Actions | Any API | Dynamically generated tools from OpenAPI schemas |

Each tool is defined with:
- A description (tells the LLM when to use it)
- Input parameters (Zod schema for type safety)
- An execute function (calls the external service and returns results)

**Cost caps to prevent runaway spending:**
- Max 5 tool calls per message
- Max 3 code interpreter executions per session
- Max 30 seconds per code execution
- Max 5 search results per web search

### Step 4 — Implement Each Tool

**Web Search (Tavily):**
The AI sends a search query → Tavily returns up to 5 clean text results with titles, URLs, and content → the AI incorporates the information into its response.

> **Example:** User asks "What are the latest React 19 features?" → AI calls webSearch("React 19 new features 2025") → Tavily returns 5 results → AI synthesizes them into a comprehensive answer with source links.

**Code Interpreter (E2B):**
The AI writes Python code → E2B runs it in a secure sandbox → stdout and stderr are returned → the AI explains the results.

> **Example:** User asks "Calculate the compound interest on $10,000 at 5% for 10 years" → AI writes Python code → E2B executes it → returns "$16,288.95" → AI presents the result with the formula explanation.

**Image Generation (DALL-E 3):**
The AI crafts a detailed prompt → DALL-E 3 generates an image → the image URL is returned and displayed inline in the chat.

> **Example:** User asks "Create a logo for a coffee shop called 'Bean There'" → AI calls imageGeneration with a detailed prompt → DALL-E returns an image URL → the image appears in the chat.

**Knowledge Search (pgvector RAG):**
The user's query is embedded → pgvector finds the 5 most similar knowledge chunks using cosine similarity → the chunks are included in the AI's context → the AI answers based on the developer's uploaded documents.

> **Example:** Developer uploaded a company handbook. User asks "What is the vacation policy?" → the query is embedded → pgvector finds the chunks about PTO → AI answers: "According to the handbook, you get 20 days PTO per year..."

**Custom Actions (OpenAPI):**
The developer's OpenAPI schema is parsed into tool definitions → the AI can call external APIs during conversation.

> **Example:** Developer defined a weather API action. User asks "What's the weather in Tokyo?" → AI calls GET /weather?city=Tokyo → API returns weather data → AI presents: "It's currently 22°C and sunny in Tokyo."

### Step 5 — Implement LLM Fallback Strategy

OpenRouter is the primary LLM gateway (100+ models, single API key). If OpenRouter is unavailable:
1. Extract the provider from the model ID (e.g., "anthropic/claude-3.5-sonnet" → Anthropic)
2. Fall back to the direct Anthropic or OpenAI SDK
3. If no fallback is available, return an error to the user

This prevents a single point of failure — users should almost never see "service unavailable."

### Step 6 — Build the Chat UI

The chat interface includes:

- **Chat Header** — Weblet name, model badge, and a back button to the marketplace
- **Message List** — Scrollable area with user and assistant messages. Auto-scrolls to the latest message.
- **Message Rendering** — Assistant messages render markdown (bold, italic, lists, links, code blocks with syntax highlighting)
- **Tool Call Display** — When the AI calls a tool, it appears as a collapsible section: "Searching the web..." → expands to show query, results, and sources
- **Image Display** — Generated images appear inline in the message
- **Starter Chips** — When the conversation is empty, show clickable chips with the weblet's conversation starters
- **Input Bar** — Text input with Send button. Supports Ctrl+Enter to send. Disabled while the AI is streaming.
- **Typing Indicator** — Animated dots while the response is streaming
- **Rating Dialog** — After 3+ messages in a conversation, a subtle prompt appears: "Rate this conversation" with 1-5 stars. Rating is saved to AnalyticsEvent (feeds RSIL in Segment 13).

### Step 7 — Implement Version Routing Stub

For RSIL A/B testing (fully implemented in Segment 13), the chat engine includes a stub function `getActiveVersion()` that returns the currently active prompt version. In this segment, it simply returns the weblet's default instructions. Segment 13 will add deterministic hash-based traffic splitting.

---

## Files to Create

```
app/(chat)/
├── [webletId]/
│   └── page.tsx                    ← Chat page (loads weblet config, shows chat UI)
└── [webletId]/[sessionId]/
    └── page.tsx                    ← Resume existing chat session

app/api/chat/
└── route.ts                        ← Streaming chat endpoint (POST)

lib/tools/
├── registry.ts                     ← Maps capability toggles → tool definitions
├── web-search.ts                   ← Tavily API integration
├── code-interpreter.ts             ← E2B sandbox integration
├── image-generation.ts             ← DALL-E 3 integration
├── file-search.ts                  ← pgvector RAG search
└── action-executor.ts              ← Dynamic tool creation from OpenAPI schemas

lib/chat/
├── engine.ts                       ← Core chat orchestration (system prompt building, version routing stub)
├── history.ts                      ← Load/save conversation history from ChatSession/ChatMessage
├── access.ts                       ← Subscription access check with ENABLE_PAYMENT_ENFORCEMENT flag
└── analytics.ts                    ← Log analytics events after each chat completion

lib/ai/
├── openrouter.ts                   ← OpenRouter client setup with fallback
└── embeddings.ts                   ← OpenAI embedding client (reused from Segment 04)

components/chat/
├── chat-container.tsx              ← Full chat layout (header + messages + input)
├── chat-header.tsx                 ← Weblet name, model badge, back button
├── message-list.tsx                ← Scrollable message list with auto-scroll
├── message-bubble.tsx              ← Individual message with markdown rendering
├── tool-call-display.tsx           ← Collapsible display for tool results
├── input-bar.tsx                   ← Message input with send button
├── typing-indicator.tsx            ← Animated dots while streaming
├── starter-chips.tsx               ← Conversation starter buttons
└── rating-dialog.tsx               ← 1-5 star rating after conversation
```

---

## Acceptance Criteria

- [ ] User can open a chat with any active weblet from the marketplace
- [ ] Chat page shows weblet name, model, and conversation starters
- [ ] Messages stream in real-time (word by word via SSE)
- [ ] Web Search tool works — shows search results inline with sources
- [ ] Code Interpreter tool works — shows code + output
- [ ] Image Generation tool works — shows generated image inline
- [ ] Knowledge Search (RAG) works — retrieves relevant knowledge chunks
- [ ] Custom Actions work — calls external APIs from OpenAPI schemas
- [ ] Tool calls displayed as collapsible sections
- [ ] Conversation history saved to ChatSession/ChatMessage tables
- [ ] Users can resume previous chat sessions
- [ ] **ENABLE_PAYMENT_ENFORCEMENT flag is set to false** — all weblets are free
- [ ] When flag is false, checkAccess() always passes (no paywall shown)
- [ ] When flag is true (tested manually), paid weblets show 402 response
- [ ] Analytics event logged after each chat completion (eventType, metadata with tokens, tools, rating)
- [ ] Rating saved to AnalyticsEvent with eventType "rating_given"
- [ ] LLM fallback works — if OpenRouter is down, direct provider is used
- [ ] Rate limiting: max 5 tool calls per message, max 3 code executions per session
- [ ] Markdown rendered correctly in assistant messages
- [ ] Error handling: tool failures show user-friendly message, not crash

---

## After Completion, the User Will Be Able To

1. **Chat with any weblet** from the marketplace — type a message and get a streaming AI response
2. **See the AI use tools** — web search results, code execution output, generated images, and knowledge search results all appear inline
3. **Use conversation starters** — clickable chips to begin a conversation
4. **Resume conversations** — come back to a previous chat session
5. **Rate conversations** — provide 1-5 star feedback that feeds the developer's analytics
6. **Access everything for free** — the payment flag is off, so all weblets are accessible

---

## Dependencies to Install

```bash
npm install ai                           # Vercel AI SDK
npm install @openrouter/ai-sdk-provider  # OpenRouter provider
npm install @ai-sdk/openai               # OpenAI provider (fallback + embeddings)
npm install @ai-sdk/anthropic            # Anthropic provider (fallback)
npm install zod                          # Schema validation for tool parameters
npm install @e2b/code-interpreter        # E2B code execution
npm install react-markdown               # Markdown rendering
npm install remark-gfm                   # GitHub-flavored markdown
npm install rehype-highlight             # Code syntax highlighting
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OpenRouter rate limits | Retry with exponential backoff. Fallback to direct providers. |
| E2B costs at scale | Hard cap: 3 code executions per session, 30s timeout. Monitor weekly. |
| Tool calls take too long | Show loading states per tool ("Searching the web..."). 30s timeout per tool. |
| Large knowledge bases slow RAG | HNSW index ensures sub-100ms queries. Limit to top 5 chunks. |
| Payment flag confusion | Clear documentation. Flag is in one place (constants.ts). Tests cover both states. |
