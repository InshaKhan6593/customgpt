# PROJECT KNOWLEDGE BASE

**Project:** WebletGPT — dual-sided SaaS marketplace for AI agents ("Weblets")  
**Stack:** Next.js 16 App Router · TypeScript · Prisma · Tailwind CSS v4 · shadcn/ui · AI SDK v6  
**All code lives in:** `webletgpt/`

---

## COMMANDS

All commands run from `webletgpt/` directory:

```bash
npm run dev                              # Next.js dev server
npm run build                            # Production build — primary verification method
npm run lint                             # ESLint (default config, no custom rules)
npm run start                            # Start production server

npx prisma generate                      # REQUIRED after any schema.prisma change
npx prisma db push                       # Push schema to dev database (no migration file)
npx prisma migrate dev --name <name>     # Create a named migration
```

**No test framework is configured.** Validation = `npm run build` + `npm run lint`. Both must pass clean before marking work complete.

---

## STRUCTURE

```
joseph-customgpt/
├── webletgpt/                  # ← ALL code changes happen here
│   ├── app/                    # Next.js App Router: pages, layouts, API routes
│   │   ├── api/                # API routes (chat, inngest, stripe, auth, etc.)
│   │   ├── (main)/             # Route group: marketing/public pages
│   │   └── (user)/             # Route group: authenticated user pages
│   ├── components/             # React components, organized by feature
│   │   └── ui/                 # shadcn/ui primitives (DO NOT hand-edit)
│   ├── lib/                    # Core business logic (13+ modules)
│   ├── hooks/                  # React hooks (use-*.ts naming)
│   ├── prisma/                 # schema.prisma + migrations
│   ├── proxy.ts                # Route protection — NOT middleware.ts
│   └── instrumentation.ts      # OpenTelemetry + Langfuse tracing
├── segments/                   # Planning docs — NEVER modify
├── lovable_instructions/       # Planning docs — NEVER modify
└── Self_Improving_System_Starter_Kit/  # Planning docs — NEVER modify
```

---

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Chat streaming | `app/api/chat/route.ts` | ~561 lines. Streaming, auth, tool assembly |
| Multi-agent flows | `lib/inngest/orchestrator.ts` | DAG executor, ~753 lines, Inngest background job |
| Flow canvas UI | `components/flows/canvas/flow-canvas.tsx` | React Flow, ~1008 lines |
| AI model access | `lib/ai/openrouter.ts` | `getLanguageModel()`, `getFallbackModel()` |
| Tool registration | `lib/tools/registry.ts` | Maps capability flags → tool instances |
| MCP connections | `lib/mcp/client.ts` | `getMCPTools()`, token resolution, transport fallback |
| Billing/credits | `lib/billing/` | Credit calc, usage logging, quota checks |
| Weblet composition | `lib/composition/` | Parent→child tool factory, cycle detection |
| Auth config | `lib/auth.ts` + `lib/auth.config.ts` | NextAuth v5, email OTP, JWT sessions |
| Route protection | `proxy.ts` | Role-based guards: USER / DEVELOPER / ADMIN |
| Database schema | `prisma/schema.prisma` | 20+ models, pgvector extension |
| Self-improving AI | `lib/rsil/` | A/B testing, prompt optimization pipeline |
| Stripe integration | `lib/stripe/` | Webhooks, checkout, subscription management |
| Shared types | `lib/types.ts` | Global TypeScript definitions |

---

## CODE STYLE

### Imports
- Use `@/*` path alias for all intra-project imports: `import { prisma } from '@/lib/prisma'`
- Use relative imports only within the same module directory: `import { authConfig } from './auth.config'`
- Named imports preferred over default imports: `import { streamText, generateId } from 'ai'`
- No barrel `index.ts` in `lib/billing/` — import files directly: `import { calculateCredits } from './credit-calculator'`
- Group imports: external packages → `@/` alias imports → relative imports (no enforced blank lines, but keep logical)

### Naming
| Construct | Convention | Example |
|-----------|-----------|---------|
| Files | kebab-case | `credit-calculator.ts`, `use-mobile.ts` |
| React components | PascalCase | `Button`, `FlowCanvas` |
| Functions / variables | camelCase | `getLanguageModel()`, `toolCalls` |
| React hooks | `use` prefix, camelCase | `useDebounce`, `useMobile` |
| Prisma models | PascalCase | `User`, `Weblet`, `UserPlan` |
| Prisma fields | camelCase | `userId`, `billingCycleStart` |
| Constants | SCREAMING_SNAKE or `as const` object | `CREDIT_MULTIPLIERS`, `FORMATTING_INSTRUCTIONS` |
| Types / interfaces | PascalCase | `WebletConfig`, `ToolCapabilities` |

### TypeScript
- Strict mode enabled (`"strict": true` in tsconfig)
- Prefer explicit types on function parameters and return values
- Use `z.object(...)` (Zod) for all external input validation — see `chatSchema` in `route.ts`
- Use `as const` for literal objects instead of enums
- **NEVER add `as any`, `@ts-ignore`, or `@ts-expect-error`** — 25+ pre-existing occurrences already exist; do not add more
- Component props: use `React.ComponentProps<'button'>` intersection pattern over custom interface when extending HTML elements

### React & Components
- Functional components only — `function Button(...)` not `const Button = () =>`
- shadcn/ui components live in `components/ui/` — add new ones via `npx shadcn@latest add <component>`, never hand-edit
- Use `cn()` from `@/lib/utils` for conditional class merging
- Use `cva()` from `class-variance-authority` for variant-driven component styling
- Tailwind CSS v4: use `oklch()` colors, dark mode via `@custom-variant dark (&:is(.dark *))`

### Error Handling
- API routes: wrap handler body in `try/catch`; return `NextResponse.json({ error: "...", details: ... }, { status: N })`
- Validate all request bodies with Zod `.safeParse()` before destructuring; return 400 on failure
- Prisma operations that must be atomic: use `prisma.$transaction([...])`
- Never swallow errors with empty `catch` blocks

### AI SDK (v6)
- `streamText()` → chat responses (streaming)
- `generateText()` → child weblet tool calls (non-streaming)
- `generateObject()` → structured output with a Zod schema
- Model IDs always in OpenRouter format: `"anthropic/claude-3.5-sonnet"`, `"openai/gpt-4o"`

---

## KEY PATTERNS

### Prisma Singleton
```ts
// lib/prisma.ts — always import from here
import { prisma } from '@/lib/prisma'
```
Global singleton in dev to prevent connection pool exhaustion. Never instantiate `new PrismaClient()` directly.

### Route Protection
Use `proxy.ts` — **not** `middleware.ts`. Next.js 16 pattern. Role check order: USER → DEVELOPER → ADMIN.

### MCP Token Security
Always use `lib/mcp/encryption.ts` (AES-256-GCM). **NEVER** store MCP tokens in plaintext — not in DB, not in logs.

### Inngest Background Jobs
Register all Inngest functions in the `serve([...])` array in `app/api/inngest/route.ts`. Missing registration = silent failure.

### In-Memory Image Store
Max 500 images via LRU. **Not persisted across server restarts.** Do not use for durable storage.

---

## ANTI-PATTERNS

- `as any` / `@ts-ignore` — never add; pre-existing ones are tech debt
- `middleware.ts` for route guards — use `proxy.ts`
- Plaintext MCP tokens — always encrypt
- Bare `new PrismaClient()` — use the singleton
- Empty catch blocks — always handle or rethrow
- Direct shadcn component edits in `components/ui/` — use overrides or wrappers

---

## REQUIRED ENV VARS

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon PostgreSQL |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Yes | JWT signing |
| `OPENROUTER_API_KEY` | Yes | AI model access |
| `MCP_ENCRYPTION_KEY` | Yes | Throws on startup if missing |
| `RESEND_API_KEY` | Yes | Email OTP auth |
| `STRIPE_SECRET_KEY` | Yes | Billing |
| `E2B_API_KEY` | Optional | Code interpreter (graceful degradation) |
| `OPENAI_API_KEY` | Optional | Direct fallback for some models |
| `ENABLE_PAYMENT_ENFORCEMENT` | Optional | Feature flag for billing enforcement |

---

## DATA FLOW

```
Request → proxy.ts (auth + role check)
  → app/api/chat/route.ts
  → chat/engine.getActiveVersion()       # weblet config + A/B test selection
  → tools/registry.getToolsFromCapabilities()
  → mcp/client.getMCPTools()
  → composition/child-tool-factory.createChildWebletTools()
  → ai/openrouter.getLanguageModel()
  → AI SDK streamText() with stop conditions
  → billing/usage-logger.logUsage()      # credits deducted via $transaction
  → Streamed response to client
```

---

## NOTES

- `segments/`, `lovable_instructions/`, `Self_Improving_System_Starter_Kit/` are planning artifacts — never edit for code tasks
- TODO stubs exist for: action executor OpenAPI parsing, Langfuse observability (Segment 16), RSIL enforcement (Segments 7/8)
- Deployment target: Vercel (inferred from `@vercel/blob`, `@vercel/analytics` deps)
- No CI/CD pipeline — validate manually with `npm run build && npm run lint`
