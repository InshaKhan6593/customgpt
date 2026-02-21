# Segment 03: Database & API Layer

**Estimated effort:** 2 weeks
**Depends on:** Segment 01 (Foundation & Auth)
**Produces:** Complete database schema (16 models), all REST API routes, seed data
**References:** segment-02-user-roles-permissions.md, segment-14-categories-discovery.md

---

## What This Segment Is

This segment builds the entire data foundation and API layer for the platform. Every table, every relationship, every API endpoint that the rest of the platform depends on is defined here. No UI is built in this segment — it is purely backend.

Think of it as building all the plumbing and wiring before putting up the walls. The builder (Segment 04), chat engine (Segment 05), dashboard (Segment 09), orchestration (Segment 11), and marketplace (Segment 17) all call the APIs created here.

> **Example:** When a developer later creates a weblet in the builder, the builder UI will call `POST /api/weblets` built here. When a user browses the marketplace, it calls `GET /api/marketplace/weblets` built here. When a user saves a sequential flow, it calls `POST /api/flows` built here. This segment makes all of that possible.

---

## How It Will Be Done

### Step 1 — Expand the Database Schema

Starting from the 4 foundation models created in Segment 01 (User with role, Account, Session, VerificationToken), add 12 more models to reach the full 16-model schema.

**Models organized by purpose:**


**Orchestration & Composability:**
- **UserFlow** — User-created sequential or hybrid flows combining multiple marketplace weblets.
- **WebletComposition** — Developer-defined parent-child weblet relationships for composability.

### Step 2 — Define All Enums

The schema uses these enums to enforce valid states:

| Enum | Values | Used By |
|------|--------|---------|
| **UserRole** | USER, DEVELOPER, ADMIN | User model (from Segment 01) |
| **WebletCategory** | WRITING, CODE, DATA_ANALYSIS, MARKETING, EDUCATION, CUSTOMER_SUPPORT, RESEARCH, CREATIVE, PRODUCTIVITY, FINANCE, HEALTH, LEGAL, OTHER | Weblet model |
| **AccessType** | FREE, SUBSCRIBERS_ONLY | Weblet model |
| **FlowMode** | SEQUENTIAL, HYBRID | UserFlow model |
| **VersionStatus** | DRAFT, TESTING, ACTIVE, ROLLED_BACK, ARCHIVED | WebletVersion model |
| **SubStatus** | ACTIVE, TRIALING, PAST_DUE, CANCELED, UNPAID | Subscription model |
| **TxType** | SUBSCRIPTION_PAYMENT, PAYOUT, REFUND | Transaction model |
| **TxStatus** | PENDING, COMPLETED, FAILED | Transaction model |
| **PayoutStatus** | PENDING, PROCESSING, COMPLETED, FAILED | Payout model |

### Step 3 — Key Fields to Pay Attention To

**On the Weblet model (fields that serve future segments):**

| Field | Purpose | Used By |
|-------|---------|---------|
| `category` (WebletCategory) | Developer picks a category — used for marketplace filtering and ranking | Segment 04 (builder), Segment 17 (marketplace), Segment 06 |
| `rsilEnabled` (Boolean, default false) | Developer opts in to automatic prompt optimization | Segment 15 (RSIL) |
| `rsilGovernance` (JSON, optional) | RSIL configuration: frequency, thresholds, approval requirements | Segment 15 (RSIL) |
| `accessType` (AccessType) | FREE or SUBSCRIBERS_ONLY — enforced only when payment flag is on | Segment 05 (chat), Segment 07 (payments) |
| `monthlyPrice`, `stripePriceId`, `stripeProductId` | Pricing fields — populated by developer but not enforced initially | Segment 07 (payments), Segment 07 |
| `capabilities` (JSON) | Which tools are enabled: web search, code interpreter, image gen, file search | Segment 05 (chat engine tools) |

**On the UserFlow model (new):**

| Field | Purpose |
|-------|---------|
| `userId` | The user who created this flow |
| `name` | Human-readable flow name (e.g., "My Content Pipeline") |
| `description` | Optional description of what the flow does |
| `steps` (JSON) | Array of step objects: `[{ webletId, order, inputMapping, hitlGate }]` |
| `mode` (FlowMode) | SEQUENTIAL or HYBRID |
| `masterWebletId` (optional) | For HYBRID mode — the weblet that decides routing |
| `isPublic` (Boolean) | Whether other users can discover and clone this flow |

> **Example of steps JSON:**
> ```json
> [
>   { "webletId": "abc123", "order": 1, "inputMapping": "original", "hitlGate": false },
>   { "webletId": "def456", "order": 2, "inputMapping": "previous_output", "hitlGate": true },
>   { "webletId": "ghi789", "order": 3, "inputMapping": "previous_output", "hitlGate": false }
> ]
> ```
> This means: Run weblet abc123 first with the user's original input. Pass its output to def456, but pause for human approval before running. Then pass def456's output to ghi789.

### Step 4 — Enable pgvector

After running the Prisma migration, manually enable the pgvector extension and create the HNSW index:

1. Enable the extension: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Create the HNSW index on the `knowledge_chunks` table for cosine similarity search
3. This index is critical for the RAG pipeline in Segment 04 and the file search tool in Segment 05

### Step 5 — Build All API Routes

Every API route follows the same pattern:
1. Check authentication (call `auth()` — return 401 if no session)
2. Check role permissions (call `requireRole()` — return 403 if insufficient)
3. Validate request body with Zod (return 400 if invalid)
4. Perform database operation
5. Return JSON response with appropriate HTTP status code

**Weblet CRUD (DEVELOPER role required):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/weblets` | GET | List the authenticated developer's weblets (paginated) |
| `/api/weblets` | POST | Create a new weblet (developer must select a category) |
| `/api/weblets/[id]` | GET | Get weblet by ID (public if active, developer-only if draft) |
| `/api/weblets/[id]` | PATCH | Update weblet config (only the owning developer) |
| `/api/weblets/[id]` | DELETE | Soft delete weblet (set isActive=false) |

**Weblet Sub-resources (DEVELOPER role required):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/weblets/[id]/versions` | GET | List prompt versions (for RSIL dashboard) |
| `/api/weblets/[id]/versions` | POST | Create new version |
| `/api/weblets/[id]/knowledge` | GET | List knowledge files |
| `/api/weblets/[id]/knowledge` | POST | Upload knowledge file (FormData with file) |
| `/api/weblets/[id]/knowledge/[fileId]` | DELETE | Delete knowledge file and its chunks |
| `/api/weblets/[id]/analytics` | GET | Get analytics events (with date range and event type filters) |

**Marketplace (public):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/marketplace/weblets` | GET | Browse active weblets (filterable by category, sortable by popularity/rating/newest) |
| `/api/marketplace/weblets/[id]` | GET | Get full details of a single weblet (for landing page) |

**User Flows (any authenticated user):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/flows` | GET | List the user's saved flows |
| `/api/flows` | POST | Create a new flow |
| `/api/flows/[id]` | GET | Get flow details with populated weblet info |
| `/api/flows/[id]` | PATCH | Update flow steps or configuration |
| `/api/flows/[id]` | DELETE | Delete a flow |

**Chat (any authenticated user):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Send message to weblet (streaming response — detailed in Segment 05) |
| `/api/chat/sessions` | GET | List user's chat sessions (paginated, sorted by most recent) |
| `/api/chat/sessions/[id]` | GET | Get chat session with all messages |

**Subscriptions (any authenticated user — built but deferred):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/subscriptions` | GET | List user's active subscriptions |
| `/api/subscriptions` | POST | Create subscription (triggers Stripe Checkout — Segment 07) |
| `/api/subscriptions/[id]` | DELETE | Cancel subscription |

**Payouts (DEVELOPER role required — built but deferred):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/payouts` | GET | List developer's payout history |
| `/api/payouts` | POST | Request a payout |

**Developer Dashboard (DEVELOPER role required):**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/dashboard/overview` | GET | Aggregate stats across all developer's weblets |
| `/api/dashboard/weblets/[id]` | GET | Detailed analytics for a specific weblet |

### Step 6 — Create Shared Utilities

Build the utility files that every API route will use:

- **api-response.ts** — Standardized response builders: `success()`, `error()`, `paginated()`
- **auth-guard.ts** — `requireRole()` function that checks session and role hierarchy
- **slugify.ts** — Generate URL-safe slugs for weblet names (e.g., "My Writing Bot" → "my-writing-bot")
- **constants.ts** — Add platform-wide constants: `PLATFORM_FEE_RATE` (TBD), `MAX_KNOWLEDGE_FILES`, `MAX_FILE_SIZE`, `ENABLE_PAYMENT_ENFORCEMENT`

### Step 7 — Write the Seed Script

Create `prisma/seed.ts` that populates the database with test data:

- 2 DEVELOPER users and 2 USER users (with emails)
- 5 weblets across different categories (WRITING, CODE, DATA_ANALYSIS, CREATIVE, PRODUCTIVITY) — 3 free, 2 with pricing set
- Sample knowledge file metadata (no actual embeddings — those come in Segment 04)
- 50 analytics events spread across 30 days (mix of chat_started, chat_completed, rating_given, abandoned)
- 2 active subscriptions (for testing payment flows later)
- 5 transactions
- 1 completed payout
- 1 sample UserFlow (sequential, 3 steps using the seed weblets)

> **Example seed user:** Developer "Alex" has 3 weblets: "Blog Writer" (WRITING, free), "Code Reviewer" (CODE, free), and "Data Analyzer" (DATA_ANALYSIS, $5/mo set but not enforced). User "Jordan" has used Blog Writer and Data Analyzer, and has a saved flow: "Blog Writer → Code Reviewer" that writes content then reviews the code snippets within it.

---

## Files to Create

```
prisma/
├── schema.prisma            ← Full 16-model schema with all enums
├── migrations/              ← Auto-generated by npx prisma migrate dev
└── seed.ts                  ← Test data population script

app/api/
├── weblets/
│   ├── route.ts             ← GET (list), POST (create)
│   └── [id]/
│       ├── route.ts         ← GET, PATCH, DELETE
│       ├── versions/route.ts     ← GET (list), POST (create)
│       ├── knowledge/
│       │   ├── route.ts     ← GET (list), POST (upload)
│       │   └── [fileId]/route.ts ← DELETE
│       └── analytics/route.ts    ← GET (with filters)
├── marketplace/
│   └── weblets/
│       ├── route.ts         ← GET (browse with category/sort/search)
│       └── [id]/route.ts    ← GET (single weblet details)
├── flows/
│   ├── route.ts             ← GET (list), POST (create)
│   └── [id]/route.ts        ← GET, PATCH, DELETE
├── chat/
│   ├── route.ts             ← POST (send message — streaming, Segment 05)
│   └── sessions/
│       ├── route.ts         ← GET (list sessions)
│       └── [id]/route.ts    ← GET (session with messages)
├── subscriptions/
│   ├── route.ts             ← GET (list), POST (create)
│   └── [id]/route.ts        ← DELETE (cancel)
├── payouts/route.ts         ← GET (list), POST (request)
└── dashboard/
    ├── overview/route.ts    ← GET (aggregate stats)
    └── weblets/[id]/route.ts ← GET (per-weblet analytics)

lib/
├── types/
│   ├── api.ts               ← Shared request/response types
│   └── weblet.ts            ← Weblet-related types (WebletConfig, Capabilities, etc.)
├── utils/
│   ├── api-response.ts      ← JSON response builders
│   ├── auth-guard.ts        ← requireRole() with role hierarchy
│   └── slugify.ts           ← URL-safe slug generation
└── constants.ts              ← Add: PLATFORM_FEE_RATE, ENABLE_PAYMENT_ENFORCEMENT, limits
```

---

## Acceptance Criteria

- [ ] All 16 database models created with Prisma migration
- [ ] pgvector extension enabled and HNSW index created on knowledge_chunks.embedding
- [ ] All enums defined (UserRole, WebletCategory, AccessType, FlowMode, VersionStatus, SubStatus, TxType, TxStatus, PayoutStatus)
- [ ] Seed script runs successfully with test data (4 users, 5 weblets, events, 1 flow)
- [ ] All API routes return correct data with proper status codes (200, 201, 400, 401, 403, 404)
- [ ] All API routes require authentication (return 401 without session)
- [ ] Weblet CRUD routes require DEVELOPER role (return 403 for USER role)
- [ ] Marketplace routes are publicly accessible
- [ ] Flow routes work for any authenticated user
- [ ] API routes validate request bodies with Zod (return 400 for invalid input)
- [ ] GET endpoints support pagination (`?page=1&limit=20`)
- [ ] Marketplace GET supports filtering by category and sorting by popularity/rating/newest
- [ ] Analytics GET supports date range filters (`?from=&to=`)
- [ ] `PLATFORM_FEE_RATE` stored as a configurable constant
- [ ] `ENABLE_PAYMENT_ENFORCEMENT` flag defined in constants (set to false)

---

## After Completion, the User Will Be Able To

1. **See a fully structured database** with all 16 tables and their relationships
2. **Call any API endpoint** from Postman or the future UI to create, read, update, and delete resources
3. **Browse marketplace data** via the public API with category filtering and sorting
4. **Create and manage flows** via the flows API
5. **Run the seed script** and have a populated database for testing all future segments
6. **See proper error responses** for invalid requests, missing auth, and insufficient permissions

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| pgvector not available on hosting provider | Supabase and Neon both support pgvector. Verify before starting. |
| Schema may need changes in later segments | Design for extensibility — use JSON fields for flexible metadata, keep the schema normalized |
| Seed data won't have real embeddings | That's fine — knowledge chunk embeddings are generated in Segment 04 (builder) and used in Segment 05 (chat) |
| Too many API routes to test manually | Use a Postman collection or automated API tests to verify all endpoints |
