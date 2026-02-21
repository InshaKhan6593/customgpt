# WebletGPT — System Overview & Build Plan

## What Is WebletGPT?

WebletGPT is a SaaS platform where creators build, monetize, and orchestrate AI agents called **Weblets**. Creators use a visual no-code builder to configure AI agents with custom instructions, knowledge bases, and tools. End users discover Weblets in a public marketplace, chat with them, and subscribe for premium access.

## Tech Stack

Next.js 16 (React 19, TypeScript) · Tailwind CSS v4 + shadcn/ui · PostgreSQL + pgvector via Prisma v5.x + prisma-extension-pgvector · Auth.js (email OTP via Resend) · Vercel AI SDK + OpenRouter (GPT-4o, Claude, etc.) · LlamaParse API · Inngest · Stripe (subscriptions) · PayPal (creator payouts) · Ably (real-time WebSockets)

---

## Build Sequence (18 Segments)

The platform is built sequentially across 18 specialized segments, designed to be executed in this exact order to ensure all data models and core mechanics are in place before higher-level features are built on top:

1. **Segment 01:** Foundation & Authentication (Next.js scaffold, Auth.js magic links)
2. **Segment 02:** User Roles & Permissions (User vs Developer routing)
3. **Segment 03:** Database & API Layer (Prisma schemas, pgvector)
4. **Segment 04:** Weblet Builder (Split-pane UI, RAG upload, System Prompt)
5. **Segment 05:** Chat Engine & Tools (Vercel AI SDK, Tool Execution)
6. **Segment 06:** Payment Infrastructure (Stripe products and checkout)
7. **Segment 07:** Payment Subscription Architecture (Webhooks and access control)
8. **Segment 08:** Monetization & Cost Architecture (API limits, credit billing)
9. **Segment 09:** Developer Dashboard & Analytics (Recharts metrics)
10. **Segment 10:** Payouts & Creator Economics (PayPal integration)
11. **Segment 11:** Multi-Agent Orchestration (Inngest execution engine)
12. **Segment 12:** Composability & MCP Integration (Adding servers, recursive Weblets)
13. **Segment 13:** Orchestration Workflows & Flow Builder (Sequential UI mapping)
14. **Segment 14:** RSIL (Recursive Self-Improving Loop) (Automated optimization)
15. **Segment 15:** Observability & Evals (Langfuse tracing)
16. **Segment 16:** Categories & Discovery (Taxonomy and Marketplace filtering)
17. **Segment 17:** Marketplace, Security & Launch (Grid UI, Rate Limiting, Core Web Vitals)
18. **Segment 18:** Admin & Platform Defense (Moderation, Data quotas, Refund resolution)

---

Each segment is built incrementally, producing working and testable functionality on top of the previous one.
