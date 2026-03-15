# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands should be run from the `webletgpt/` directory.

```bash
# Development
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint

# Database
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema changes to database (dev)
npx prisma migrate dev --name <name>  # Create a migration
npx prisma studio    # Open database browser
```

## Project Overview

**WebletGPT** is a SaaS marketplace platform for building, monetizing, and orchestrating AI agents called "Weblets." It's a dual-sided marketplace where:
- **Developers/Creators** build and publish AI agents via a no-code builder
- **End users** chat with Weblets and subscribe to them
- A **credits-based billing system** handles revenue sharing between the platform, creators, and users

## Architecture

### Tech Stack
- **Framework:** Next.js 16 App Router + React 19 + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui + Radix UI
- **Database:** PostgreSQL (Neon serverless) + Prisma v5 + pgvector (for RAG embeddings)
- **AI/LLM:** Vercel AI SDK v6 + OpenRouter (multi-model routing)
- **Auth:** Auth.js (NextAuth v5) — passwordless email OTP + optional OAuth (Google/GitHub)
- **Background Jobs:** Inngest (multi-agent orchestration, workflows)
- **Real-time:** Ably (WebSocket streams during agent runs)
- **Payments:** Stripe (subscriptions) + PayPal (developer payouts)
- **Storage:** Vercel Blob
- **Observability:** Langfuse + OpenTelemetry tracing

### Directory Structure

```
webletgpt/
├── app/
│   ├── (main)/          # Public routes (landing, marketplace)
│   ├── (user)/          # Authenticated routes (chat, dashboard, flows, billing)
│   └── api/             # API route handlers (43 routes)
├── components/
│   ├── ui/              # Base shadcn/ui components
│   ├── builder/         # Weblet builder tabs (capabilities, knowledge, compose, mcp, actions)
│   ├── chat/            # Chat interface components
│   ├── flows/           # Workflow builder UI
│   └── [feature]/       # Feature-specific component groups
├── lib/
│   ├── ai/              # LLM integration, OpenRouter, prompt builders
│   ├── billing/         # Credit calculation, cost tracking, subscription cycles
│   ├── chat/            # Chat engine, access control, history, analytics
│   ├── composition/     # Child tool factory for weblet-to-weblet composition
│   ├── knowledge/       # RAG: embedding, chunking, retrieval
│   ├── mcp/             # Model Context Protocol integrations
│   ├── observability/   # Langfuse tracing & evals
│   ├── orchestrator/    # Multi-agent orchestration (roles, team tools, streaming)
│   ├── inngest/         # Background job definitions
│   ├── stripe/          # Stripe event handlers
│   ├── tools/           # Standardized tool implementations (image, code, etc.)
│   ├── types/           # Shared TypeScript types
│   ├── prisma.ts        # Prisma client singleton
│   └── constants.ts     # Global constants
├── prisma/
│   └── schema.prisma    # Database schema (20+ models)
└── hooks/               # React hooks
```

### Key Domain Models (Prisma)

- **User** — role: `USER | DEVELOPER | ADMIN`; linked to `UserPlan` (FREE_USER/PLUS/POWER) and `DeveloperPlan` (STARTER/PRO/BUSINESS/ENTERPRISE)
- **Weblet** — AI agent definition; has versioned prompts via `WebletVersion` (DRAFT/TESTING/ACTIVE/ROLLED_BACK/ARCHIVED)
- **KnowledgeFile / KnowledgeChunk** — RAG documents and pgvector embeddings
- **ChatSession / ChatMessage** — conversation history; messages track token usage
- **UsageRecord** — per-message audit trail (tokens, cost, credits charged, source)
- **Subscription** — user subscriptions to weblets (Stripe-integrated)
- **Transaction / Payout** — credits economy and developer payouts
- **UserFlow** — multi-agent workflows with sequential/hybrid execution modes
- **WebletComposition** — parent-child relationships between weblets
- **WebletMCPServer / UserMCPToken** — MCP server connections and per-user auth tokens

### Multi-Agent Orchestration

Workflows (Flows) are orchestrated via Inngest background jobs. The orchestrator (`lib/orchestrator/`) handles:
- Sequential and hybrid (parallel) execution modes
- Streaming results back to the client via Ably
- Tool call routing between agent roles
- Handoff events between agents in the timeline

### Billing & Credits

Credits are the internal currency. `lib/billing/` handles:
- Cost calculation per message (input/output tokens × model rate)
- Credit deduction from user accounts
- Revenue split between platform, creator, and user rewards
- Subscription cycle management

### RAG / Knowledge

`lib/knowledge/` manages document ingestion via LlamaParse, chunking, and embedding storage in pgvector. Retrieval is performed at chat time to augment prompts.

### MCP Integration

Weblets can connect to external MCP servers. `lib/mcp/` handles server registration, capability discovery, and per-user token management. The `app/api/mcp/` routes expose MCP proxy endpoints.
