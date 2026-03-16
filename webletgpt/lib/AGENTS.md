# WEBLETGPT LIB KNOWLEDGE BASE

## OVERVIEW
The `lib/` directory contains the core business logic, AI orchestration, and financial infrastructure of WebletGPT.

## MODULE MAP
- **ai/**: `openrouter.ts` (model selection), `stop-conditions.ts` (loop/progress detection). No internal lib dependencies.
- **billing/**: `credit-calculator.ts`, `usage-logger.ts`, `quota-check.ts`. Atomic credit deductions via `$transaction`.
- **chat/**: `engine.ts` (versioning + A/B routing), `history.ts`. Depends on `rsil/`.
- **composition/**: `child-tool-factory.ts`, `resolver.ts` (BFS cycle detection). Recursive limit of 3.
- **inngest/**: `orchestrator.ts` (753-line DAG executor), `functions.ts` (billing cron). Complex cross-module dependencies.
- **knowledge/**: `process.ts`, `embed.ts`. Full RAG pipeline using `pgvector`.
- **mcp/**: `client.ts`, `encryption.ts` (AES-256-GCM). Manages Model Context Protocol tool resolution.
- **orchestrator/**: `roles.ts` (system prompts), `realtime.ts` (Ably progress updates).
- **rsil/**: `ab-test.ts`, `analyzer.ts`, `scheduler.ts`. Reinforcement Self-Improving Loop for prompt optimization.
- **stripe/**: `webhook-handlers.ts`, `checkout.ts`. Handles subscription life cycles and payments.
- **tools/**: `registry.ts` (capability mapping), `image-store.ts` (LRU), `openapi.ts`.
- **langfuse/** + **observability/**: Stubs for Langfuse tracing (TODO — Segment 16).
- **types/**: `index.ts` barrel export + shared TypeScript definitions.
- **utils/**: `truncate.ts` and shared helper functions.

**Root files**: `prisma.ts` (singleton), `auth.ts` + `auth.config.ts` (NextAuth v5), `constants.ts`, `email.ts` (Resend), `ably.ts` (realtime), `tools.ts`, `types.ts`, `utils.ts`.

## CROSS-CUTTING PATTERNS
- **Persistence**: Single Prisma client instance imported from `@/lib/prisma`.
- **AI SDK v6**: `streamText` for chat, `generateText` for child calls, `generateObject` for structured data.
- **Atomicity**: All credit and billing updates must run within `db.$transaction`.
- **Validation**: Zod schemas enforce data integrity across all service boundaries.
- **Stability**: Standard try/catch blocks with detailed logging and graceful degradation.

## WHERE TO LOOK
- **DAG Execution**: `lib/inngest/orchestrator.ts` contains the primary workflow engine.
- **Tool Mapping**: `lib/tools/registry.ts` links Weblet capability flags to tool instances.
- **Version Control**: `lib/chat/engine.ts` manages Weblet deployment versions and A/B test routing.
- **Encryption**: `lib/mcp/encryption.ts` handles all sensitive token storage logic.

## ANTI-PATTERNS
- **Circular Deps**: Don't add internal `lib/` imports to `lib/ai/`.
- **Recursion**: Never exceed the depth limit of 3 in `lib/composition/`.
- **Plaintext**: Don't bypass `lib/mcp/encryption.ts` for any third-party credentials.
- **Middleware**: Keep auth logic in `lib/auth.ts` or `proxy.ts`, not `middleware.ts`.
