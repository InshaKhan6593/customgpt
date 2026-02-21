# WebletGPT Project Context (High-Level)

**Core Mission:** Build a SaaS platform where creators can build, monetize, and orchestrate AI agents ("Weblets"). This is a ground-up rebuild, not a wrapper.

## Key Features
1. **Weblet Builder:** Creators build AI agents (Native Weblets) with custom instructions, knowledge (RAG), and tools (Web Search, Code Interpreter, Image Gen).
2. **GPT Monetization:** Creators can also link *existing* OpenAI Custom GPTs to monetize them via our auth/payment system.
3. **Chat Engine:** Users chat with Weblets via a streaming UI that supports rich tool outputs.
4. **Marketplace:** A public directory to discover and use Weblets.
5. **Multi-Agent Orchestration:** Users can combine Weblets into teams (Sequential/Concurrent execution).
6. **Recursive Self-Improvement (RSIL):** System auto-optimizes prompts based on user ratings and A/B testing.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui
- **Backend:** Next.js Server Actions / API Routes + **Inngest** (for reliable background jobs/workflows)
- **Database:** PostgreSQL + pgvector (Neon) via Prisma ORM v5.x + **prisma-extension-pgvector**
- **Auth:** Auth.js (NextAuth v5) with Passwordless Email OTP (6-digit code) via Resend + Google/GitHub social login
- **AI:** Vercel AI SDK 4.x + OpenRouter (access to GPT-4o, Claude 3.5, etc.) + **LlamaParse API** (for document parsing)
- **Payments:** Stripe (Subscriptions/Connect) + PayPal (Payouts)
- **Real-time:** Ably (WebSockets) for multi-agent updates

## Architecture
- **Monorepo-style:** Single Next.js app (`/app`) handling UI, API, and background jobs.
- **RAG:** Knowledge files are chunked, embedded, and stored in `knowledge_chunks` table.
- **Tools:** Standardized tool registry in `lib/tools/`.
- **Ecosystem:** Weblets are composable (Weblet A can call Weblet B).

## Current Status
Check the `segments/` directory for the active development phase. Always follows the instructions in the specific segment plan file you are working on.
