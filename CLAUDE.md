# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is a monorepo with a single deployable app in `webletgpt/`. The root-level directories (`segments/`, `lovable_instructions/`, `Self_Improving_System_Starter_Kit/`) are planning/spec documents — not separate projects. All code changes happen inside `webletgpt/`.

## Commands

All commands run from the `webletgpt/` directory:

```bash
npm run dev              # Next.js dev server
npm run build            # Production build (use to verify changes compile)
npm run lint             # ESLint
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Push schema changes to database (dev)
npx prisma migrate dev --name <name>  # Create a migration
npx prisma studio        # Database browser
```

There are no test scripts configured — validation is via `npm run build` and `npm run lint`.

## Architecture

### Stack

- **Next.js 16 App Router** + React 19 + TypeScript (strict mode)
- **Tailwind CSS v4** + shadcn/ui (new-york style) + Radix UI
- **PostgreSQL** (Neon serverless) + Prisma v5 + pgvector
- **AI SDK v6** (`ai` package) + OpenRouter for multi-model routing
- **Auth.js** (NextAuth v5) — passwordless email OTP via Resend, JWT sessions
- **Inngest** for background jobs + Inngest Realtime for streaming orchestration events
- **Stripe** for subscriptions + credit-based billing
- **Vercel Blob** for storage

### What WebletGPT Is

A dual-sided SaaS marketplace for AI agents called "Weblets." Developers build AI agents via a no-code builder; users discover, subscribe to, and chat with them. Credits are the internal currency — every message costs credits based on token usage and model rates.

### Key Source Directories

```
webletgpt/
├── app/api/chat/         # Streaming chat endpoint (the core user-facing API)
├── app/api/flows/        # Workflow CRUD + execution triggers
├── app/api/mcp/          # MCP proxy, OAuth 2.1 PKCE flow
├── app/api/billing/      # Stripe checkout, plans, usage
├── lib/ai/openrouter.ts  # Model access: getLanguageModel(), getFallbackModel()
├── lib/composition/      # Weblet-to-weblet calling (child tool factory, cycle detection)
├── lib/orchestrator/     # Multi-agent roles, realtime streaming, auto-suggest
├── lib/inngest/          # Background jobs: orchestrator.ts (DAG executor), functions.ts (billing cron)
├── lib/mcp/              # MCP server connections, token encryption, OAuth refresh
├── lib/tools/            # Tool implementations (web search, code interpreter, image gen, file search, OpenAPI)
├── lib/billing/          # Credit calculation, cost tracking, revenue split
├── lib/knowledge/        # RAG: embedding, chunking, pgvector retrieval + full-text search (RRF fusion)
├── lib/chat/             # Chat engine, access control, history
├── prisma/schema.prisma  # 20+ models (see domain models below)
├── proxy.ts              # Route protection (Next.js 16 middleware equivalent)
└── instrumentation.ts    # OpenTelemetry + Langfuse tracing
```

### Domain Models (Prisma)

- **User** — roles: USER / DEVELOPER / ADMIN. Auto-provisions UserPlan + DeveloperPlan on sign-in.
- **Weblet** — AI agent definition with `capabilities` JSON (webSearch, codeInterpreter, imageGen, fileSearch). Has versioned prompts via WebletVersion (DRAFT → TESTING → ACTIVE).
- **WebletComposition** — Self-referential parent↔child relationships enabling weblet-to-weblet calling (max depth 3).
- **WebletMCPServer / UserMCPToken** — MCP server connections; tokens stored AES-256-GCM encrypted.
- **ChatSession / ChatMessage / UsageRecord** — Conversation history + per-message token/cost audit trail.
- **UserFlow** — Multi-agent workflow with `canvasState` (DAG nodes/edges) and execution mode (SEQUENTIAL/HYBRID).
- **UserPlan / DeveloperPlan** — Tiered credit allowances with billing cycle tracking.

### Multi-Agent Orchestration (Flows)

Flows execute as Inngest background jobs (`lib/inngest/orchestrator.ts`). The executor:
1. Loads the DAG from `canvasState.nodes` and `canvasState.edges`
2. Computes the execution frontier (nodes whose dependencies are satisfied)
3. Runs frontier nodes in parallel via `Promise.all`
4. Each node streams via AI SDK's `streamText`, publishing incremental events via Inngest Realtime
5. Supports Human-in-the-Loop (HITL) via `step.waitForEvent` with 24h timeout

Events published to frontend: `started`, `node_started`, `agent_text`, `tool_call`, `step_completed`, `node_completed`, `hitl_required`, `completed`, `failed`.

### MCP Integration

`lib/mcp/client.ts` connects to external MCP servers. Key patterns:
- Token resolution: user OAuth > user PAT > developer token > auth-required stub
- Transport: tries SSE first, falls back to HTTP `/mcp` endpoint
- Tool naming: `mcp_{sanitized_label}_{tool_name}`
- Missing auth produces stub tools returning `__mcp_auth_required: true` — frontend shows inline auth prompt
- OAuth flow is full OAuth 2.1 PKCE, server-side, via `app/api/mcp/oauth/`

### Tool System

`lib/tools/registry.ts` maps capability flags to tool instances:
- **webSearch** → Tavily API
- **codeInterpreter** → E2B sandbox (Python)
- **imageGen** → OpenAI DALL-E 3 (direct) with OpenRouter fallback; images stored in-memory, served via `/api/image/[id]`
- **fileSearch** → Hybrid RAG (pgvector cosine similarity + full-text search, merged via Reciprocal Rank Fusion)
- **OpenAPI** → `lib/tools/openapi.ts` parses OpenAPI 3.x schemas into AI SDK tool definitions

### Composition (Weblet-to-Weblet)

`lib/composition/child-tool-factory.ts` converts WebletComposition records into AI SDK tools named `weblet_{slug}`. Child execution uses `generateText` (synchronous, not streaming). BFS cycle detection in `resolver.ts` prevents circular references. Hard recursion limit: 3 levels.

### Auth & Route Protection

`proxy.ts` handles route protection:
- Public routes: `/login`, `/marketplace`, `/pricing`, `/api/auth`, `/api/webhooks`, `/api/inngest`, `/api/marketplace`
- `/dashboard` requires DEVELOPER or ADMIN role
- `/admin` requires ADMIN role
- JWT sessions (edge-compatible), not database sessions

### Styling

`app/globals.css` defines CSS custom properties using `oklch()` color space for light/dark modes. Dark mode uses `@custom-variant dark (&:is(.dark *))`. Code blocks use `highlight.js` github-dark theme; math rendering uses KaTeX.

## Conventions

- Path alias: `@/*` maps to `webletgpt/` root (e.g., `@/lib/prisma`)
- shadcn/ui components live in `components/ui/` — add new ones via `npx shadcn@latest add <component>`
- Model IDs use OpenRouter format: `"anthropic/claude-3.5-sonnet"`, `"openai/gpt-4o"`, `"meta-llama/llama-3.3-70b-instruct"`
- AI SDK v6 patterns: `streamText` for chat, `generateText` for child/composition calls, `generateObject` for structured output
- Prisma client singleton at `lib/prisma.ts`
- Always run `npx prisma generate` after modifying `schema.prisma`
- MCP tokens are encrypted with AES-256-GCM (`lib/mcp/encryption.ts`) — never store plaintext tokens
- Inngest functions are registered in `app/api/inngest/route.ts` — add new functions to the serve array there
- Images from generation are stored in an in-memory LRU store (max 500) — not persisted across restarts
