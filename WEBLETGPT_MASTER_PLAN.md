# WebletGPT Master Build Plan (Segments Only)

## Table of Contents
1. [Segment 01 Foundation Auth](#segment-01-foundation-auth)
2. [Segment 02 User Roles Permissions](#segment-02-user-roles-permissions)
3. [Segment 03 Database Api](#segment-03-database-api)
4. [Segment 04 Weblet Builder](#segment-04-weblet-builder)
5. [Segment 05 Chat Engine Tools](#segment-05-chat-engine-tools)
6. [Segment 06 Payment Infrastructure](#segment-06-payment-infrastructure)
7. [Segment 07 Payment Subscription](#segment-07-payment-subscription)
8. [Segment 08 Monetization Cost Architecture](#segment-08-monetization-cost-architecture)
9. [Segment 09 Developer Dashboard](#segment-09-developer-dashboard)
10. [Segment 10 Payouts](#segment-10-payouts)
11. [Segment 11 Multi Agent](#segment-11-multi-agent)
12. [Segment 12 Composability Mcp](#segment-12-composability-mcp)
13. [Segment 13 Orchestration Workflows](#segment-13-orchestration-workflows)
14. [Segment 14 Rsil](#segment-14-rsil)
15. [Segment 15 Observability Evals](#segment-15-observability-evals)
16. [Segment 16 Categories Discovery](#segment-16-categories-discovery)
17. [Segment 17 Marketplace Launch](#segment-17-marketplace-launch)
18. [Segment 18 Admin Platform Defense](#segment-18-admin-platform-defense)

---

## Segment 01 Foundation Auth


**Estimated effort:** 2 weeks
**Depends on:** Nothing (first segment)
**Produces:** Deployed Next.js app with passwordless authentication, role-based access control, and all foundational patterns
**References:** segment-02-user-roles-permissions.md

---

## What This Segment Is

This is the foundation of the entire platform. Everything — the builder, marketplace, chat, orchestration — depends on what is built here. This segment sets up the Next.js project, establishes the authentication system (passwordless email OTP code), implements the role system (USER, DEVELOPER, ADMIN), configures route protection based on roles, and creates all the coding patterns that every future segment must follow.

> **Example:** A user visits webletgpt.com for the first time. They click "Get Started," enter their email, receive a 6-digit verification code in their inbox within seconds, enter the code on the same page, and land on the marketplace as a USER. If they click "Become a Developer" from their settings, their role upgrades and they see the Developer Dashboard.

---

## How It Will Be Done

### Step 1 — Scaffold the Next.js Project

Set up a Next.js 16 project with TypeScript strict mode, Tailwind CSS v4, and shadcn/ui as the component library. Configure the project structure, install all base dependencies, and set up the development environment.

**Technical decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 16.x (App Router) | Latest stable with Turbopack and `proxy.ts` route interception |
| Language | TypeScript 5.x, strict mode | Type-safe tool definitions, better DX |
| CSS | Tailwind CSS v4 + shadcn/ui | Rapid UI development, consistent design system |
| Auth | Auth.js v5 (NextAuth v5) | Passwordless email OTP (6-digit code) + Google/GitHub social login |
| ORM | Prisma 5.x | Type-safe queries, migrations, seeding. Do NOT use Prisma 7 — it has breaking constructor changes incompatible with `@auth/prisma-adapter` |
| Database | PostgreSQL 16+ (Neon) | ACID, JSON columns, pgvector support |
| Email | Resend | Transactional email delivery for verification codes |
| Hosting | Vercel (Pro plan) | Zero-config Next.js, edge functions, auto-scaling |
| IDs | cuid() via Prisma @default(cuid()) | URL-safe, sortable, consistent across all models |
| Real-time strategy | SSE for chat, Ably for multi-agent | Vercel does NOT support persistent WebSocket (Socket.io incompatible) |

### Step 2 — Set Up the Database with Foundation Models

Connect Prisma to PostgreSQL and create the initial migration with the foundation models:

- **User** — The core identity model. Every person on the platform is a User. Includes a `role` field with the `UserRole` enum (USER, DEVELOPER, ADMIN). New signups default to USER.
- **Account** — NextAuth managed. Links external auth providers (Google, GitHub) to users.
- **Session** — NextAuth managed. Tracks active sessions.
- **VerificationToken** — NextAuth managed. Stores hashed OTP codes with expiration (10 min).

The `UserRole` enum is defined at this level because every future segment depends on role-based access.

### Step 3 — Build the Passwordless Email OTP Login

The authentication flow works like this:

1. User navigates to `/login` and sees a clean email input form with Google/GitHub social login buttons
2. User enters their email and clicks "Sign in with Email"
3. Auth.js generates a 6-digit code via `generateVerificationToken()`, hashes it, and stores it in the `VerificationToken` table (10-minute expiry)
4. Resend delivers the code to the user's inbox (from `noreply@resend.dev`) — styled email showing the 6-digit code prominently
5. The `/login` page swaps to a 6-digit OTP input within the same card (no page navigation)
6. User enters the code — on the 6th digit, the frontend redirects to Auth.js's callback (`/api/auth/callback/resend?token=CODE&email=EMAIL`)
7. Auth.js verifies the hashed code, creates a session, sets a cookie, and redirects based on role
8. If the code is expired or invalid, the user lands on `/auth/error`

Alternatively, user can click "Continue with Google" or "Continue with GitHub" for social login.

> **Example:** Maria enters maria@example.com. She sees a 6-digit code input. She checks her email, finds the code "482931", enters it, and is instantly signed in. Since it's her first time, she's created as a USER and lands on the marketplace. If she were a DEVELOPER, she'd land on her dashboard.

**Post-login redirect logic:**
- USER → `/marketplace` (marketplace browse)
- DEVELOPER → `/dashboard` (developer overview)
- ADMIN → `/dashboard` (same as developer, with admin panel in nav)

### Step 4 — Implement Role-Based Route Protection

The Next.js `proxy.ts` (replaces `middleware.ts` in Next.js 16) intercepts every request and enforces access rules:

**Route groups and their protection:**

| Route Group | Requires Login | Minimum Role | Contains |
|-------------|---------------|-------------|----------|
| `/(auth)/` | No | None | `/login`, `/auth/error` |
| `/(public)/` | No | None | Marketplace browse, weblet pages, pricing, docs |
| `/(user)/` | Yes | USER | Chat, flows, settings, subscriptions |
| `/(dashboard)/` | Yes | DEVELOPER | Builder, analytics, RSIL, weblet management, payouts |
| `/(admin)/` | Yes | ADMIN | User management, moderation, platform metrics |

**Redirect behavior:**
- Not logged in + trying to access protected route → redirect to `/login` with a return URL
- USER trying to access `/(dashboard)/` → redirect to `/marketplace` with a toast message: "Upgrade to Developer to access this"
- After login → redirect to the return URL (if one was saved) or the role-based default

### Step 5 — Build the Role Upgrade Flow

Create the "Become a Developer" feature via the `/settings` page (Developer Options tab):

1. If the user's role is USER, show an upgrade banner: "Unlock Developer Mode" with benefits listed
2. Clicking "Become a Developer" opens a confirmation modal: "Are you sure you want to upgrade your account? This will give you access to the Weblet Builder and Marketplace publishing tools." → [Confirm Upgrade] [Cancel]
3. On confirmation:
   - API call to `POST /api/upgrade-role` updates the user's role from USER to DEVELOPER
   - Session is refreshed with the new role
   - User is redirected to `/dashboard` with a welcome banner
4. If the user is already a DEVELOPER, show a status card: "You are a registered Developer." with a "Go to Developer Dashboard" button

This is a **one-way upgrade**. Developers keep all USER capabilities.

### Step 6 — Build the Layout Shells

Create the navigation header that adapts based on login state and role:

**Navigation Header (Logged Out State):**
- Logo (left): "WebletGPT" text with icon
- Links (center): "Marketplace", "Pricing", "For Developers"
- Buttons (right): "Sign In" (routes to `/login`) and "Get Started" (routes to `/login`, primary style)

**Navigation Header (Logged In State):**
- Logo (left)
- Links (center): "Marketplace", "My Chats"
- User Dropdown (right): Avatar component, clicking opens dropdown:
  - "Dashboard" (routes to `/dashboard`)
  - "Settings" (routes to `/settings`)
  - Divider
  - "Sign Out" (triggers logout action)

**Developer Layout** (`dashboard/layout.tsx`):
- Sidebar navigation with: Dashboard, Builder, My Weblets, Analytics, RSIL, Payouts
- Top header with user menu

### Step 7 — Establish Foundational Coding Patterns

These patterns are mandatory for ALL future segments:

| Pattern | Convention |
|---------|-----------|
| Prisma client | Always import from `lib/prisma.ts` — never create a new PrismaClient() |
| Auth | Always import `{ auth }` from `lib/auth.ts` — never call NextAuth directly |
| Route protection | `proxy.ts` at project root — Next.js 16 convention (replaces `middleware.ts`) |
| Components | `components/ui/` for shadcn/ui, `components/[feature]/` for feature-specific |
| API routes | `app/api/[resource]/route.ts` with auth guard at the top of each handler |
| Role checking | Always use `requireRole()` from `lib/utils/auth-guard.ts` |
| Error handling | Use Next.js error boundaries. API routes return `{ error: string }` with appropriate HTTP status |
| Type safety | All API request/response types defined in `lib/types/` |
| Feature flags | Platform-wide flags defined in `lib/constants.ts` (e.g., ENABLE_PAYMENT_ENFORCEMENT) |

### Step 8 — Configure Environment Variables

Set up `.env` (secret, never committed) and `.env.example` (template, committed):

**Required variables for this segment:**
- NEXTAUTH_URL — Base URL (http://localhost:3000 in dev)
- AUTH_SECRET — Random 32-byte secret for session encryption
- DATABASE_URL — PostgreSQL connection string (Neon)
- RESEND_API_KEY — For sending verification code emails

### Step 9 — Deploy to Vercel

Deploy the foundation to Vercel:
1. Connect the GitHub repository to Vercel
2. Set all environment variables in Vercel dashboard
3. Configure the production domain
4. Verify the login flow works end-to-end in production
5. Verify proxy correctly protects routes

---

## Files to Create

```
/ (project root)
├── .env                             ← All secrets (never committed)
├── .env.example                     ← Template with placeholder values
├── next.config.mjs                  ← Next.js configuration
├── tsconfig.json                    ← TypeScript strict mode
├── prisma/
│   └── schema.prisma                ← Foundation models (User with role, Account, Session, VerificationToken)
├── app/
│   ├── layout.tsx                   ← Root layout with providers (SessionProvider, ThemeProvider)
│   ├── page.tsx                     ← Landing page (marketing placeholder)
│   ├── login/page.tsx               ← Email input + social buttons + "Check your email" state
│   ├── auth/error/page.tsx          ← Auth error page (expired/invalid link)
│   ├── settings/page.tsx            ← Account settings with General + Developer Options tabs
│   ├── dashboard/
│   │   ├── layout.tsx               ← Developer layout with sidebar navigation
│   │   └── page.tsx                 ← Dashboard home
│   └── api/
│       ├── auth/[...nextauth]/route.ts  ← NextAuth API route handler
│       └── upgrade-role/route.ts    ← POST: Upgrade USER to DEVELOPER
├── lib/
│   ├── auth.ts                      ← NextAuth config (singleton — ALL segments import from here)
│   ├── auth.config.ts               ← Auth config object (pages, session strategy, callbacks)
│   ├── prisma.ts                    ← Prisma client singleton (ALL segments import from here)
│   ├── email.ts                     ← Resend email sending wrapper
│   ├── constants.ts                 ← App-wide constants (app name, URLs, limits, feature flags)
│   ├── utils.ts                     ← cn() utility for class merging
│   ├── types/
│   │   └── index.ts                 ← Shared types (UserRole, SessionUser, API response types)
│   └── utils/
│       ├── api-response.ts          ← Standardized API response builders
│       └── auth-guard.ts            ← requireRole() utility with role hierarchy
├── components/
│   ├── ui/                          ← shadcn/ui components (button, input, card, form, toast)
│   ├── nav-header.tsx               ← Adaptive header (logged in vs logged out, role-based)
│   ├── providers.tsx                ← Client-side providers wrapper (SessionProvider)
│   └── theme-provider.tsx           ← Theme provider
└── proxy.ts                         ← Role-based route protection (Next.js 16 convention)
```

---

## Acceptance Criteria

- [ ] Next.js 16 project scaffolded with TypeScript strict mode, App Router, Tailwind CSS v4
- [ ] shadcn/ui installed with base components (button, input, card, form, toast, dropdown-menu, separator, avatar)
- [ ] Prisma 5.x connected to PostgreSQL (Neon), schema pushed with User (including role field), Account, Session, VerificationToken
- [ ] UserRole enum defined: USER (default), DEVELOPER, ADMIN
- [ ] User can enter email on `/login` and receive a 6-digit verification code via Resend
- [ ] User can enter the code on the OTP input and be authenticated
- [ ] Social login buttons present: "Continue with Google", "Continue with GitHub"
- [ ] OTP input (6 digits) appears within the same card after email submission, with "Resend code" option
- [ ] `/auth/error` page shows error message with "Back to Login" button
- [ ] New users are created with role USER by default
- [ ] Session includes user id and role, persists across page refreshes
- [ ] Post-login redirects: USER → `/marketplace`, DEVELOPER → `/dashboard`
- [ ] `proxy.ts` blocks USER from accessing `/dashboard/*` routes with redirect to `/marketplace`
- [ ] `proxy.ts` blocks unauthenticated users from protected routes
- [ ] Developer upgrade works via `/settings` Developer Options tab with confirmation modal
- [ ] After upgrade, user is redirected to `/dashboard` and sees developer sidebar navigation
- [ ] Developer sidebar shows: Dashboard, Builder, My Weblets, Analytics, RSIL, Payouts
- [ ] Nav header adapts: logged out shows Sign In/Get Started, logged in shows avatar dropdown
- [ ] `.env.example` committed with all required variable names
- [ ] All coding patterns established and used consistently

---

## After Completion, the User Will Be Able To

1. **Visit webletgpt.com** and see a landing page
2. **Sign up / Log in** using just their email (6-digit code) or Google/GitHub
3. **Enter the code** from their email and be logged in
4. **Land on the marketplace** (as a USER) or the **dashboard** (as a DEVELOPER)
5. **Navigate** using role-appropriate menus — logged-out sees Marketplace/Pricing, logged-in sees Marketplace/Chats with avatar dropdown
6. **Upgrade to Developer** from Settings with one-click confirmation
7. **Be properly redirected** if they try to access a page above their role level

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Email deliverability | Resend has good deliverability. Add SPF/DKIM records for the domain. Test with Gmail, Outlook, Yahoo. |
| Vercel cold starts | Use Edge Runtime for auth API routes to minimize latency. |
| Role confusion in UI | Clear visual separation — developer sidebar is distinct from user header navigation. |
| Session not updating after role change | Force session refresh after role upgrade using NextAuth's `update()` function. |
| Prisma version incompatibility | Pin to Prisma 5.x — version 7 has breaking PrismaClient constructor changes that are incompatible with `@auth/prisma-adapter`. |

---

## Segment 02 User Roles Permissions


**Type:** Cross-cutting concern (applies to all segments)
**Depends on:** Segment 01 (Auth), Segment 03 (Database)
**Referenced by:** Every segment that checks authentication

---

## What This Module Is

WebletGPT has two primary audiences with fundamentally different goals:

- **Developers** — They build AI agents (weblets), publish them to the marketplace, monitor performance, optimize prompts, and (eventually) earn revenue.
- **Users** — They explore the marketplace, chat with weblets, build sequential flows by combining weblets, and rate their experiences.

This module defines the role system, how permissions work across the platform, how routing is protected, and how a User upgrades to a Developer.

> **Example:** Sarah signs up to try a writing assistant weblet. She is a USER. She chats, rates, and even creates a flow combining a "Research" weblet with a "Writer" weblet. Later, she decides to build her own weblet. She clicks "Become a Developer," accepts the terms, and now has access to the builder, dashboard, and analytics — while keeping everything she had as a User.

---

## How It Will Be Done

### Step 1 — Define the Role Enum

Three roles exist in the system, organized as a hierarchy where higher roles inherit all capabilities of lower roles:

| Role | Level | Who Is This? |
|------|-------|-------------|
| **USER** | 1 | Default role on signup. Can explore marketplace, chat with weblets, create flows, rate conversations. |
| **DEVELOPER** | 2 | Can do everything a USER can, plus: create weblets, access the builder, view the developer dashboard, opt into RSIL, set pricing (future), manage payouts (future). |
| **ADMIN** | 3 | Can do everything a DEVELOPER can, plus: moderate content, manage users, view platform-wide analytics, handle escalated issues. |

Every new account starts as USER. There is no "developer signup" — it is always an upgrade.

### Step 2 — Build the Role Upgrade Flow

When a User wants to become a Developer, the process is:

1. User navigates to their profile or sees a "Become a Developer" prompt in the sidebar
2. A modal or page appears with:
   - What developers can do (build weblets, access dashboard, publish to marketplace)
   - Developer Terms of Service (must accept to proceed)
   - A single "Upgrade to Developer" button
3. On confirmation:
   - The user's role is updated from USER to DEVELOPER in the database
   - The session is refreshed to include the new role
   - The user is redirected to the Developer Dashboard with a welcome message
4. This is a **one-way upgrade** — developers cannot downgrade back to USER (they retain all USER capabilities anyway)

> **Example:** Ahmed has been using weblets for two weeks. He clicks "Become a Developer" in his profile dropdown. He reads the terms, clicks "Upgrade," and is immediately taken to his new Developer Dashboard. His marketplace access, saved flows, and chat history are all still there.

### Step 3 — Define the Permission Matrix

Every API route and page is protected based on role:

**Pages:**

| Route Group | Who Can Access | What It Contains |
|-------------|---------------|-----------------|
| `/(auth)/` | Anyone (unauthenticated) | Login page (email OTP + social login) |
| `/(public)/` | Anyone (no login needed) | Marketplace browse, weblet landing pages, pricing page, documentation |
| `/(user)/` | Any authenticated user (USER, DEVELOPER, ADMIN) | Chat interface, saved flows, flow builder, profile, subscription management |
| `/(dashboard)/` | DEVELOPER and ADMIN only | Weblet builder, weblet management, analytics, RSIL settings, payout management |
| `/(admin)/` | ADMIN only | User management, content moderation, platform analytics, escalation queue |

**API Routes:**

| Endpoint | Allowed Roles | Purpose |
|----------|--------------|---------|
| `POST /api/weblets` | DEVELOPER, ADMIN | Create a new weblet |
| `GET /api/weblets` | DEVELOPER, ADMIN | List developer's own weblets |
| `PATCH /api/weblets/[id]` | DEVELOPER, ADMIN | Update own weblet |
| `DELETE /api/weblets/[id]` | DEVELOPER, ADMIN | Delete own weblet |
| `GET /api/marketplace/weblets` | ALL (public) | Browse marketplace |
| `GET /api/marketplace/weblets/[id]` | ALL (public) | View single weblet details |
| `POST /api/chat` | USER, DEVELOPER, ADMIN | Send chat message to a weblet |
| `GET /api/chat/sessions` | USER, DEVELOPER, ADMIN | List user's chat history |
| `POST /api/flows` | USER, DEVELOPER, ADMIN | Create a sequential flow |
| `GET /api/flows` | USER, DEVELOPER, ADMIN | List user's saved flows |
| `PATCH /api/flows/[id]` | USER, DEVELOPER, ADMIN | Update own flow |
| `DELETE /api/flows/[id]` | USER, DEVELOPER, ADMIN | Delete own flow |
| `GET /api/dashboard/*` | DEVELOPER, ADMIN | Dashboard analytics |
| `POST /api/rsil/*` | DEVELOPER, ADMIN | RSIL configuration |
| `POST /api/upgrade-role` | USER | Upgrade to DEVELOPER role |
| `GET /api/admin/*` | ADMIN | Platform administration |

### Step 4 — Implement Auth Guard with Role Hierarchy

The auth guard function checks if the current user's role level meets the required level:

- ADMIN (level 3) can access everything
- DEVELOPER (level 2) can access DEVELOPER and USER routes
- USER (level 1) can only access USER routes

This is implemented as a single utility function (`requireRole`) that every API route and server component calls. If the role check fails, the user gets a 403 Forbidden response (API) or is redirected to the appropriate page (UI).

### Step 5 — Configure Route Protection (proxy.ts)

The Next.js 16 `proxy.ts` (replaces `middleware.ts`) intercepts every request and:

1. Checks if the route requires authentication (everything except `/(auth)/` and `/(public)/`)
2. If authenticated, checks the user's role against the route group requirements
3. Redirects unauthorized users:
   - Not logged in → `/login`
   - USER trying to access `/(dashboard)/` → `/marketplace` with a toast: "Upgrade to Developer to access this feature"
   - Non-ADMIN trying to access `/(admin)/` → `/dashboard` or `/marketplace` depending on role

### Step 6 — Adapt the UI Based on Role

The header navigation and sidebar change depending on the user's role:

**USER sees:**
- Marketplace
- My Chats (chat history)
- My Flows (saved sequential flows)
- Profile (with "Become a Developer" option)

**DEVELOPER sees:**
- Dashboard (overview stats)
- Builder (create/edit weblets)
- My Weblets (manage published weblets)
- Analytics (per-weblet metrics)
- RSIL (optimization settings)
- Explore (marketplace — developers are users too)
- My Chats
- My Flows
- Profile

**ADMIN sees:**
- Everything DEVELOPER sees, plus:
- Admin Panel (user management, moderation, platform metrics)
- Escalation Queue (HITL escalations from orchestration)

---

## After Completion, the User Will Be Able To

1. **Sign up** and land as a USER with access to the marketplace, chat, and flow builder
2. **Upgrade to Developer** at any time with a single click + ToS acceptance
3. **See different navigation** based on their role — no confusion about what they can do
4. **Be properly blocked** from developer features if they haven't upgraded — with a clear prompt to upgrade
5. **Retain all data** after upgrading — chat history, saved flows, and subscriptions carry over
6. **Admins can manage** the platform without a separate admin app — it's built into the same interface

---

## Connections to Other Segments

- **Segment 01** implements the auth system and adds the role enum to the User model
- **Segment 03** includes the role field in the database schema and seed data
- **Segment 09** (Developer Dashboard) is gated to DEVELOPER role
- **Segment 11** (Multi-Agent) flow builder is available to all authenticated users
- **Segment 17** (Marketplace) is public — no role required to browse
- **MODULE-orchestration-workflows** references this module for flow creation permissions

---

## Segment 03 Database Api


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

---

## Segment 04 Weblet Builder


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

1. **Name** — Text input. Required. Auto-generates a URL slug (e.g., "Blog Writer" → "blog-writer")
2. **Category** — Searchable dropdown showing all 13 categories with icons and descriptions. Required before publishing, optional for drafts. See segment-14-categories-discovery.md for the full taxonomy.
3. **Description** — Textarea. A short description shown on the marketplace card (max 300 characters)
4. **Instructions** — Large textarea for the system prompt. This is what defines the weblet's personality and behavior. Shows character count. Supports markdown formatting.
5. **Model Selector** — Dropdown with curated LLM models from OpenRouter. Each option shows the provider name, model name, cost indicator ($, $$, $$$), and a one-line description.
6. **Conversation Starters** — Editable list. Developer adds suggested opening messages. Users see these as clickable chips in the chat interface. Can add, remove, and reorder.
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
- [ ] Name, description, instructions, model, starters, privacy policy fields save correctly
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

---

## Segment 05 Chat Engine Tools


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
4. Get the active prompt version (for RSIL A/B testing — returns the default instructions until Segment 15 implements version routing)
5. Build the tools array based on the weblet's enabled capabilities
6. Add any custom action tools parsed from the weblet's OpenAPI schemas
7. Wrap the AI call with Langfuse Telemetry to capture the execution trace (Segment 16)
8. Stream the LLM response via the Vercel AI SDK through OpenRouter
9. On completion, save messages to the database, log usage for billing, and log analytics events

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
- The Stripe product/price CAN be created (Segment 07)
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
- **Rating Dialog** — After 3+ messages in a conversation, a subtle prompt appears: "Rate this conversation" with 1-5 stars. Rating is saved to AnalyticsEvent and sent to Langfuse to feed RSIL evaluations (Segment 15/17).

### Step 7 — Implement Version Routing Stub

For RSIL A/B testing (fully implemented in Segment 15), the chat engine includes a stub function `getActiveVersion()` that returns the currently active prompt version. In this segment, it simply returns the weblet's default instructions. Segment 15 will add deterministic hash-based traffic splitting.

---

## Files to Create

```
app/(user)/chat/
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

lib/observability/
└── langfuse.ts                     ← Langfuse OTEL initialization and score pushing (Segment 16)

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
- [ ] Vercel AI SDK call is wrapped in Langfuse OpenTelemetry
- [ ] Analytics event logged after each chat completion (eventType, metadata with tokens, tools, rating)
- [ ] Rating saved to AnalyticsEvent and sent to Langfuse `/scores` API
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

---

## Segment 06 Payment Infrastructure


**Estimated effort:** 2.5 weeks
**Depends on:** Segment 05 (Chat Engine — checkAccess() must exist)
**Produces:** Complete Stripe payment flow — built, tested, and ready to activate via feature flag
**References:** segment-08-payment-subscription.md

---

## What This Segment Is

This segment builds the entire payment system — Stripe products, checkout sessions, subscription management, and webhook handling. However, **none of this is enforced at launch.** The `ENABLE_PAYMENT_ENFORCEMENT` flag (introduced in Segment 05) is set to `false`, which means:

- Developers CAN set prices in the builder (the UI exists)
- Stripe Products and Prices CAN be created (for testing)
- The paywall component EXISTS but renders nothing when the flag is off
- All webhook handlers WORK (testable via Stripe CLI)
- But users will NOT be charged or blocked from any weblet

When the platform is ready to monetize, flipping `ENABLE_PAYMENT_ENFORCEMENT` to `true` activates everything instantly.

> **Example (current state, flag=false):** Developer Alex sets his "Code Reviewer" weblet to $5/month in the builder. Behind the scenes, a Stripe Product and Price are created (for testing). User Jordan opens Code Reviewer and chats freely — no paywall appears because the flag is off. Alex can see on his dashboard that the price is set and ready.

> **Example (future state, flag=true):** Same setup, but now when Jordan opens Code Reviewer, the paywall appears: "$5.00/month — 7-day free trial — Subscribe." Jordan clicks Subscribe, completes Stripe Checkout, and gets immediate access. Alex sees $4.25 in revenue (after platform fee).

---

## How It Will Be Done

### Step 1 — Create Stripe Product and Price When Developer Sets Price

When a developer sets a monthly price in the builder and saves:

1. The builder sends a PATCH to update the weblet's `monthlyPrice` and `accessType`
2. If `accessType` is SUBSCRIBERS_ONLY and a price is set, the API calls Stripe to create a Product and a recurring Price
3. The Stripe Product ID and Price ID are saved back to the weblet record
4. If the developer later changes the price, a new Stripe Price is created (existing subscribers stay on the old price until their next renewal)

The developer sees: "Price set: $5.00/month. This will be enforced when monetization is enabled."

### Step 2 — Build the Paywall Component

The paywall is a UI overlay that appears when the chat API returns a 402 (Payment Required) status. It shows:

- The weblet name and description
- The monthly price
- Trial days (if any)
- Feature list: "Full access to AI chat", "All tools included", "Cancel anytime"
- A "Subscribe" or "Start Free Trial" button
- A "Restore" link for users who think they already subscribed

**Conditional rendering:** The paywall component checks `ENABLE_PAYMENT_ENFORCEMENT`. When the flag is `false`, the component returns `null` — it never renders. The builder's price field shows a note: "Price (will apply when monetization is enabled)."

### Step 3 — Implement Stripe Checkout Session

When a user clicks "Subscribe" on the paywall (once payments are enabled):

1. The frontend calls `POST /api/stripe/create-checkout`
2. The API finds or creates a Stripe Customer for the user
3. Creates a Stripe Checkout Session with the weblet's Price ID
4. Includes trial days if the developer configured them
5. Saves the user's payment method for future use
6. Redirects the user to Stripe's hosted checkout page
7. After successful payment, Stripe redirects back to the chat page

### Step 4 — Handle Stripe Webhooks

Build the webhook endpoint (`POST /api/webhooks/stripe`) that processes Stripe events:

| Event | What Happens |
|-------|-------------|
| `checkout.session.completed` | Create a Subscription record in the database (status: ACTIVE or TRIALING). Create a Transaction record. |
| `invoice.paid` | Update subscription period dates. Create a Transaction record. Credit the developer's balance (minus platform fee) OR refill developer credits if it's an auto-reload invoice. |
| `customer.subscription.updated` | Sync the subscription status (active, past_due, canceled). |
| `customer.subscription.deleted` | Mark the subscription as CANCELED. |
| `invoice.payment_failed` | Mark the subscription as PAST_DUE. If this was an auto-reload charge for developer credits, immediately suspend the developer's weblets to prevent platform LLM cost losses (Segment 14). |

**Revenue calculation:** When an invoice is paid for a weblet subscription, the platform takes the configured fee (stored in `PLATFORM_FEE_RATE` — amount TBD) and credits the remainder to the developer's balance. The exact fee percentage will be decided later.

**Auto-Reload processing:** When an invoice is paid for an auto-reload charge (e.g., developer hit 0 credits), the platform allocates 2,000 credits to the developer's quota. Enterprise BYOK plans skip this process entirely.

### Step 5 — Build Stripe Customer Portal Integration

Allow users to manage their subscriptions through Stripe's hosted portal:
- View active subscriptions
- Update payment method
- Cancel a subscription
- View invoice history

Accessible from the user's profile page at `/(user)/profile/subscriptions`.

### Step 6 — Test the Complete Flow

Even though payments are deferred, the entire flow must be testable:

1. Use Stripe test mode API keys
2. Developer sets a price in the builder → Stripe Product/Price created (verify in Stripe Dashboard)
3. Temporarily set `ENABLE_PAYMENT_ENFORCEMENT = true` locally
4. User opens the weblet → paywall appears
5. User clicks Subscribe → Stripe Checkout opens (test card: 4242 4242 4242 4242)
6. Complete payment → redirected to chat → access granted
7. Verify webhook creates Subscription and Transaction records
8. Reset the flag to `false` for production deployment

---

## Files to Create

```
app/api/
├── stripe/
│   ├── create-checkout/route.ts      ← Create Stripe Checkout session
│   ├── create-product/route.ts       ← Create Stripe Product + Price for a weblet
│   ├── cancel-subscription/route.ts  ← Cancel a user's subscription
│   └── customer-portal/route.ts      ← Redirect to Stripe Customer Portal
├── webhooks/
│   └── stripe/route.ts               ← Webhook handler for all Stripe events

components/monetization/
├── paywall.tsx                        ← Paywall overlay (hidden when flag is false)
├── pricing-card.tsx                   ← Price display with trial info
├── subscribe-button.tsx               ← "Subscribe" or "Start Free Trial" button
└── subscription-status.tsx            ← Shows subscription status in chat header

lib/stripe/
├── client.ts                          ← Stripe SDK singleton
├── create-product.ts                  ← Create Stripe Product + Price
├── create-checkout-session.ts         ← Create Checkout session
└── webhook-handlers.ts                ← Handler functions for each event type
```

---

## Acceptance Criteria

- [ ] Developer can set monthly price ($2.00 minimum) in weblet builder
- [ ] Setting price creates Stripe Product + Price via API (visible in Stripe Dashboard)
- [ ] **When ENABLE_PAYMENT_ENFORCEMENT is false:** paywall never renders, all weblets are accessible
- [ ] **When ENABLE_PAYMENT_ENFORCEMENT is true:** paywall shows for paid weblets without subscription
- [ ] Paywall shows price, trial days, and Subscribe button
- [ ] Stripe Checkout flow works end-to-end in test mode
- [ ] Webhook `checkout.session.completed` creates Subscription record
- [ ] Webhook `invoice.paid` creates Transaction + credits developer balance (minus platform fee)
- [ ] Webhook `invoice.paid` (auto-reload) correctly adds 2,000 credits to developer account
- [ ] Webhook `customer.subscription.updated` syncs status
- [ ] Webhook `customer.subscription.deleted` marks as CANCELED
- [ ] Webhook `invoice.payment_failed` marks as PAST_DUE and suspends weblets if it was an auto-reload charge
- [ ] Stripe Customer Portal accessible for subscription management
- [ ] Builder price field shows "Price (will apply when monetization is enabled)" when flag is false
- [ ] All Stripe API calls use test mode keys during development
- [ ] `PLATFORM_FEE_RATE` stored as a configurable constant (not hardcoded)

---

## After Completion, the Platform Will Have

1. **Complete payment infrastructure** — Stripe Products, Prices, Checkout, webhooks, subscription lifecycle — all built and tested
2. **Feature flag control** — A single constant flip activates all monetization
3. **Developer pricing** — Developers can set prices now, and those prices will take effect when monetization is enabled
4. **User protection** — No user is charged anything until the flag is intentionally turned on
5. **Ready for MODULE-payment-subscription** — The detailed payment architecture (Stripe Connect, revenue splits, composability billing) builds on top of this foundation

---

## Environment Variables to Add

```env
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Webhook delivery failures | Stripe retries for up to 3 days. Implement idempotency (check if subscription exists before creating). |
| Feature flag accidentally turned on | Add a check in CI/CD that confirms the flag is false for production. Document clearly. |
| Stripe test vs live mode confusion | Use environment-specific keys. Show "TEST MODE" banner in dev. |
| Platform fee not confirmed | Store as constant. Easy to change before enabling payments. |

---

## Segment 07 Payment Subscription


**Type:** Cross-cutting concern (monetization layer)
**Depends on:** Segment 05 (feature flag), Segment 07 (Stripe integration)
**Referenced by:** Segment 07, Segment 10 (Payouts), Segment 13 (Orchestration billing), Segment 12 (Composability revenue)

---

## What This Module Is

This module documents the complete monetization architecture for WebletGPT — how developers set prices, how users subscribe, how revenue is split, how payments work when weblets are composed or orchestrated, and how to activate the payment system when ready.

Everything described here is **designed but deferred**. The `ENABLE_PAYMENT_ENFORCEMENT` feature flag controls activation. At launch, all weblets are free. This module serves as the blueprint for when monetization is turned on.

> **Example of the full payment lifecycle:** Developer Priya creates "Essay Editor" and sets it to $8/month with a 7-day trial. User Tom discovers it on the marketplace (currently free). When payments are enabled, Tom sees a paywall: "$8.00/month — 7-day free trial." He clicks "Start Free Trial," completes Stripe Checkout, and chats for free during the trial. On day 8, his card is charged $8. Priya receives $8 minus the platform fee in her connected Stripe account. The cycle repeats monthly.

---

## How It Will Be Done

### Step 1 — Platform Payment Model

**Revenue flow:**
```
User pays $X/month
  → Stripe processes payment
  → Platform takes PLATFORM_FEE_RATE (TBD — exact percentage decided later)
  → Remainder goes to the developer
```

**Key constants (all TBD, stored as configurable values):**
- `PLATFORM_FEE_RATE` — Percentage the platform keeps (industry range: 10-20%)
- `MINIMUM_PRICE` — Minimum monthly price a developer can set ($2.00 suggested)
- `MINIMUM_PAYOUT` — Minimum balance for developer withdrawal ($10.00 suggested)
- `PAYOUT_SCHEDULE` — How often payouts are processed (weekly suggested)

> **Why are these TBD?** The exact pricing will be decided based on platform growth, competitive analysis, and developer feedback. The architecture supports any values — changing them requires updating a single constants file, not rewriting code.

### Step 2 — Stripe Connect Integration (Future)

When payments are enabled, the platform will use **Stripe Connect (Express)** for two-sided marketplace payments:

**How it works:**
1. Developer clicks "Set Up Payments" in their dashboard
2. They are redirected to Stripe's Express onboarding flow (handles identity verification, bank account linking, tax forms)
3. After completing onboarding, a StripeConnectedAccount record is created linking the developer to their Stripe account
4. When a user subscribes to the developer's weblet, the payment is processed through Stripe Connect:
   - Stripe handles the full payment
   - The platform fee is automatically deducted
   - The remainder is deposited into the developer's connected Stripe account
5. Payouts from Stripe to the developer's bank happen on a configurable schedule

**Why Stripe Connect Express?**
- The platform acts as **Merchant of Record** — handles tax compliance, refunds, and disputes
- Developers don't need to set up their own Stripe accounts or handle PCI compliance
- The Express type gives the platform control over the payment flow while minimizing developer friction
- Supports 40+ countries for developer payouts

> **Example:** Developer Alex in Germany completes Stripe Connect onboarding. A user in the US subscribes to his weblet for $10/month. Stripe converts the payment, deducts the platform fee, and deposits the remainder into Alex's German bank account in EUR — all automatically.

### Step 2b — Developer Platform Subscriptions

Developers themselves are also subscribers to the platform. 

**Standard Developer Plans (Pro/Business):**
- Paid via standard Stripe subscriptions
- Give the developer a monthly starting credit balance
- **Auto-Reload:** When the balance drops to 0, Stripe automatically charges $10 to buy 2,000 more credits. If this fails, their weblets are immediately suspended (Segment 14).

**Enterprise Developers (BYOK):**
- Pay a high flat SaaS fee via Stripe
- Provide their own OpenRouter API key
- Consume 0 platform credits (pass-through pricing)
- Restricted to Private Workspace weblets only

### Step 3 — Subscription Model

**Current plan (V1):** Monthly recurring subscriptions per weblet.

**Subscription lifecycle:**
```
User discovers paid weblet
  → Sees paywall with price and trial info
  → Clicks "Subscribe" or "Start Free Trial"
  → Redirected to Stripe Checkout
  → Enters payment info
  → Subscription created: TRIALING or ACTIVE
  → After trial ends: auto-converts to ACTIVE (card charged)
  → Monthly renewal: card charged, access continues
  → If payment fails: status → PAST_DUE (grace period)
  → If not resolved: status → CANCELED (access revoked)
  → User can cancel anytime: access continues until period ends
```

**State machine:**
```
NONE → TRIALING → ACTIVE → PAST_DUE → CANCELED
              ↘ ACTIVE → CANCELED (user cancels)
```

**Future pricing options (designed but not built yet):**
- **Annual subscriptions** — Discount for yearly commitment
- **Usage-based pricing** — Pay per chat message or per tool call
- **Tiered pricing** — Free tier (limited messages), Pro tier (unlimited), Enterprise tier (API access)
- **One-time payments** — Pay once for lifetime access
- **Bundle pricing** — Subscribe to multiple weblets at a discount

*(Note: Developer plans already use a hybrid model with monthly base + auto-reload usage billing, as defined in Segment 14).*

### Step 4 — Composability Payment Distribution

When a developer builds a composite weblet that uses other developers' weblets as children (Segment 12), revenue must be distributed fairly.

**The problem:** User subscribes to Composite Weblet C ($10/month). C uses Child Weblet A ($5/month) and Child Weblet B ($3/month) as tools. Who gets paid?

**Proposed revenue split (exact percentages TBD):**
```
User pays $10/month for Composite Weblet C
  → Platform fee: $10 × PLATFORM_FEE_RATE = $X
  → Remaining pool: $10 - $X
  → Developer of C (composite creator): receives a majority share
  → Developer of A: receives a proportional share based on A's standalone price
  → Developer of B: receives a proportional share based on B's standalone price
```

**How proportions are calculated:**
- Child prices are used as weights: A=$5, B=$3, total child weight = $8
- Developer A gets: (5/8) of the child allocation
- Developer B gets: (3/8) of the child allocation
- The split between composite creator and child developers is configurable

**Stored in:** `WebletComposition.config.revenueShare` JSON field

> **Example:** C charges $10. Platform takes 15% ($1.50). Remaining $8.50 split: C's developer gets 50% ($4.25), child developers share 50% ($4.25) proportionally — A's developer gets $2.66, B's developer gets $1.59.

**Open questions for later:**
- What if a child weblet is free? Does its developer still get a share?
- What if the composite price is lower than the sum of child prices?
- Should child developers approve being used in compositions?

### Step 5 — Orchestration Flow Billing

When a user runs a sequential or hybrid flow that includes paid weblets:

**V1 approach (when payments enabled):**
- The user must have an active subscription to EACH paid weblet in the flow individually
- Free weblets in the flow require no subscription
- The flow executor checks `checkAccess()` for each weblet before running it
- If any paid weblet fails the access check, the flow pauses and shows: "Step 3 requires a subscription to [Weblet Name] — Subscribe to continue"

**Future approaches:**
- **Flow-level subscription** — Subscribe to a flow for a bundled price
- **Per-execution pricing** — Pay per flow run instead of monthly
- **Usage-based** — Pay based on total tokens consumed across all weblets in the flow

> **Example (V1):** User Tom creates a flow: "Research Bot" (free) → "Blog Writer" ($5/month) → "SEO Optimizer" ($3/month). Tom needs subscriptions to Blog Writer and SEO Optimizer to run the full flow. Research Bot is free, so no subscription needed.

### Step 6 — Feature Flag Activation Checklist

When the platform is ready to enable monetization, follow this checklist:

1. **Pre-activation:**
   - [ ] Confirm `PLATFORM_FEE_RATE` value with stakeholders
   - [ ] Ensure Stripe is in live mode (not test mode)
   - [ ] Verify all webhook handlers work correctly
   - [ ] Set up Stripe Connect onboarding flow (if using Connect)
   - [ ] Ensure developers have had time to set prices in the builder
   - [ ] Update terms of service with payment terms
   - [ ] Test the full payment flow end-to-end in a staging environment

2. **Activation:**
   - [ ] Set `ENABLE_PAYMENT_ENFORCEMENT = true` in `lib/constants.ts`
   - [ ] Deploy to production
   - [ ] Verify paywall appears for paid weblets
   - [ ] Complete one test subscription with a real card

3. **Post-activation monitoring (48 hours):**
   - [ ] Monitor Stripe webhook delivery success rate
   - [ ] Check for failed payments or checkout errors
   - [ ] Verify developer balances are updating correctly
   - [ ] Monitor user complaints or confusion
   - [ ] Have a rollback plan (set flag back to `false`)

---

## After This Module Is Implemented, the Platform Will Have

1. **Clear monetization path** — Every piece of the payment puzzle is documented and designed
2. **Flexible pricing** — Architecture supports subscriptions, trials, usage-based, and bundles
3. **Fair revenue sharing** — Composability and orchestration billing are solved
4. **Zero-risk launch** — Everything is free at launch, monetization activates with one flag
5. **Developer confidence** — Developers can set prices and see their payment setup is ready

---

## Connections to Other Segments

- **Segment 05** — Introduces the `ENABLE_PAYMENT_ENFORCEMENT` flag and `checkAccess()`
- **Segment 07** — Builds the Stripe integration (Products, Checkout, webhooks)
- **Segment 10** — Payouts: developers withdraw their earnings (PayPal or Stripe payouts via Connect)
- **Segment 13** — Orchestration billing: how flows with paid weblets are handled
- **Segment 12** — Composability revenue: how child weblet developers are compensated
- **Segment 15** — Marketplace: pricing display on weblet cards, filter by free/paid

---

## Segment 08 Monetization Cost Architecture


**Type:** Cross-cutting concern (billing, usage metering, developer plans, user plans)
**Depends on:** Segment 03 (Database), Segment 05 (Chat Engine), Segment 07 (Stripe), Segment 12 (Composability), Segment 13 (Orchestration Workflows)
**Referenced by:** All segments involving LLM calls, tool execution, or user-facing features

---

## Goal

Define and implement the complete monetization architecture — who owns the API keys, how developers and users are charged, how costs flow through composability and workflows, and how the platform sustains itself financially.

---

## The Core Problem

WebletGPT has **three actors**, each with different cost relationships:

| Actor | Role | Cost They Generate |
|-------|------|-------------------|
| **Platform** (WebletGPT) | Hosts everything | Servers, DB, OpenRouter API, tool APIs (Tavily, E2B, DALL-E), Ably, Inngest |
| **Developer** (creator) | Builds weblets | Their weblets consume LLM tokens when users chat with them |
| **User** (consumer) | Chats with weblets | Every message generates LLM tokens, tool calls, embeddings |

### Example Problem: The API Key Dilemma

> **Scenario:** Developer Priya builds "Essay Editor." User Tom chats with it. The LLM call to Claude costs $0.02.
>
> **Who pays that $0.02?**
> - If Priya provides her own API key → she pays, but she has no idea how much Tom will chat. Could bankrupt her.
> - If Tom provides his own API key → terrible UX. "Please go to OpenRouter, create an account, get a key, paste it here." Tom leaves.
> - If the platform provides the key → the platform pays, but recoups it through subscription fees.

---

## Critical Decision: Platform Manages All API Keys

**Decision:** WebletGPT holds **one OpenRouter API key**. All LLM calls go through this key. The platform meters every token and charges both developers and users through subscription plans.

**Why NOT "Bring Your Own Key" (BYOK)?**

### Example Problem: Composability Breaks BYOK

> **Scenario:** Developer A builds "Marketing Suite." It composes Developer B's "Content Writer" and Developer C's "Image Generator" as child tools.
>
> User Sarah chats with "Marketing Suite." The LLM decides to call "Content Writer" (Developer B's weblet).
>
> **If BYOK:** Whose API key pays for the Content Writer call?
> - Developer A's key? But it's Developer B's weblet doing the work.
> - Developer B's key? But Developer B didn't initiate the call — Developer A's composite did.
> - User Sarah's key? She doesn't even know composability is happening.
>
> **Solution with Platform Key:** The platform's single key handles all calls. The platform's metering system logs that Developer B's weblet was called (decrement B's quota) and Developer A's weblet orchestrated it (decrement A's quota). Sarah's user quota goes down by 1 (she sent one message). Clean, fair, trackable.

### Example Problem: Workflows Break BYOK

> **Scenario:** User Tom creates a workflow: "Research Bot" (Dev A) → "Blog Writer" (Dev B) → "SEO Optimizer" (Dev C). He runs it with the task "Write about AI in healthcare."
>
> **If BYOK:** Three different developers, three different API keys. Plus the orchestrator planner needs an LLM call to decompose the task — whose key pays for THAT?
>
> **Solution with Platform Key:** One key, three usage records. Dev A: -1 message, Dev B: -1 message, Dev C: -1 message. Tom: -3 messages. The planner LLM call is platform infrastructure cost (covered by subscription margins).

### Example Problem: RSIL Breaks BYOK

> **Scenario:** The RSIL engine runs at midnight. It evaluates Developer A's weblet using GPT-4o, generates an improved prompt variant, and starts an A/B test.
>
> **If BYOK:** Developer A's key pays for the GPT-4o evaluation call. But Developer A didn't trigger it — the automated system did. What if their key has no credits? The whole RSIL system fails silently.
>
> **Solution with Platform Key:** Platform pays for RSIL as infrastructure. Cost is ~$0.05 per optimization cycle per weblet — negligible at scale and covered by developer plan fees.

---

## Why "1 Message = 1 Message" Doesn't Work — The Tool Call Cost Problem

Before defining pricing, you need to understand what ACTUALLY happens under the hood when a user sends a single message.

### Example Problem: A Simple Message vs. A Tool-Heavy Message

> **Simple message:** User sends "What is machine learning?" to a weblet.
>
> | Step | What Happens | Tokens | Cost |
> |------|-------------|--------|------|
> | **LLM Call 1** | LLM reads message, generates response | ~500 in / ~800 out | **$0.005** |
> | **Total** | | ~1,300 tokens | **$0.005** |
>
> **Tool-heavy message:** User sends "Search the web for AI trends and create an image of a futuristic city."
>
> | Step | What Happens | Tokens | Cost |
> |------|-------------|--------|------|
> | **LLM Call 1** | LLM reads message + 5 tool definitions (~2,000 tokens just for definitions). Decides to call `web_search` AND `image_gen`. | ~2,500 in / ~200 out | $0.008 |
> | **Tool Exec 1** | Tavily web search runs externally | — | $0.01 |
> | **Tool Exec 2** | DALL-E 3 generates image externally | — | $0.04 |
> | **LLM Call 2** | Tool results (~3,000 tokens of search results + image URL) sent BACK to LLM. LLM generates final response. | ~5,500 in / ~800 out | $0.018 |
> | **Total** | | ~9,000 tokens + 2 API calls | **$0.076** |
>
> **The tool-heavy message costs 15x more.** If both counted as "1 message," the platform would hemorrhage money on tool-heavy weblets.

### How Other Platforms Solve This

| Platform | Approach | How Tool Costs Are Handled |
|----------|----------|---------------------------|
| **Lovable** | Abstract credits, variable per complexity | "Agent Mode" dynamically calculates credit consumption. Simple action = <1 credit. Complex generation = 3-5+ credits. |
| **Vercel v0** | Dollar-based credits, per-token | Moved FROM messages TO tokens in May 2025. Users pay exact token consumption. $5 credit = ~100 simple prompts or ~10 complex ones. |
| **Botpress** | "AI Spend" at provider rates | Pure token-based. Every LLM call (including tool definition tokens, tool result tokens) counts. $5/mo credit included, overage billed. |
| **MindStudio** | Pass-through pricing | Zero markup on LLM provider rates. Platform charges subscription + exact AI usage. |

**Key takeaway: NONE of them use flat "1 message = 1 message."** They all account for variable costs.

---

## WebletGPT Billing Unit: Credits

WebletGPT uses a **credit-based system** where actions consume different amounts of credits based on their real cost.

### What Is a Credit?

A credit is an abstract unit of AI usage. 1 credit ≈ the cost of one simple LLM chat completion (~1,000 tokens, no tools).

### Credit Multiplier Table

Every action has a credit cost based on what it actually consumed:

| Action | Credits Consumed | Why |
|--------|-----------------|-----|
| Simple chat (no tools) | **1 credit** | Base unit. One LLM call, ~1,000 tokens. |
| Chat with RAG / Knowledge Search | **2 credits** | Embedding query + pgvector search + LLM call with injected context. |
| Chat with Web Search (Tavily) | **3 credits** | LLM call 1 (decide to search) + Tavily API + LLM call 2 (synthesize results). |
| Chat with Code Interpreter (E2B) | **3 credits** | LLM generates code + E2B executes + LLM summarizes output. |
| Chat with Image Generation (DALL-E 3) | **5 credits** | LLM call + DALL-E 3 API ($0.04 alone). Most expensive tool. |
| Chat with Custom Action (HTTP) | **2 credits** | LLM call + external HTTP call + LLM response. |
| Chat with multiple tools | **Sum of tool credits** | If LLM calls web search + image gen = 3 + 5 = **8 credits**. |
| MCP tool call | **2 credits** | Per MCP tool invoked. |
| Composability (child weblet call) | **Credits of child's action** | Child weblet runs through same credit calculation. |
| Workflow step | **Credits of each step** | Each step is separately charged. |

> **Implementation detail:** Credits are calculated AFTER the LLM call completes — based on what actually happened (which tools were called, how many tokens were used), not before.

### Example Problem: How Credits Are Calculated Dynamically

> **Scenario:** User asks "Design Assistant": "Create a logo for my bakery."
>
> The LLM decides to call DALL-E 3 (image gen).
>
> **Credit calculation:**
> - Base chat: 1 credit
> - DALL-E 3 tool call: +4 credits (total multiplier = 5)
> - **Total: 5 credits deducted from user and developer**
>
> Compare: If User asks "What colors work for bakery logos?" (no tools)
> - Base chat: 1 credit
> - **Total: 1 credit deducted**
>
> **User sees:** "You've used 47 of 200 credits this month" — they understand heavy actions cost more.

### Example Problem: User Doesn't Know How Many Credits Before Sending

> **Scenario:** User has 3 credits left. They send a message. The LLM calls web search + image gen = 8 credits needed. But user only has 3.
>
> **How to handle this (two options):**
>
> **Option A (Lovable's approach — execute then deduct):** Let the message complete. Deduct 8 credits. User goes -5 credits into overage. Show: "You've exceeded your monthly credits. Upgrade to continue."
>
> **Option B (Pre-check — safer for platform):** Before calling LLM, check if user has ≥5 credits remaining (minimum for any tool-capable weblet). If not, show upgrade modal before executing. This prevents surprise overages.
>
> **Recommendation for WebletGPT:** Option A is better UX for *users* (never block mid-thought). However, for *developers*, we must use strict pre-paid auto-reloads (see Developer Plans below) to protect the platform.

---

## Revenue Stream 1: Developer Plans (Monthly Subscription)

Developers pay a monthly fee to BUILD, HOST, and SERVE weblets on the platform.

### Pricing Tiers

| Plan | Price | Weblets | Credits/Month | RSIL | Composability | MCP |
|------|-------|---------|---------------|------|--------------|-----|
| **Starter** | $0/mo | 1 | 200 | ❌ | ❌ | ❌ |
| **Pro** | $29/mo | 5 | 10,000 | ✅ | ✅ | ❌ |
| **Business** | $99/mo | Unlimited | 50,000 | ✅ | ✅ | ✅ |
| **Enterprise** | Custom | Unlimited | **Pass-Through (BYOK)** | ✅ | ✅ | ✅ |

> **Why credits not messages:** A developer who builds a text-only Q&A weblet uses far fewer resources than a developer who builds an image-generating design assistant. Credits make billing proportional to actual platform cost.
>
> **Enterprise BYOK (Bring Your Own Key):** For Enterprise clients, abstract credits don't work. We charge them a high flat SaaS fee (e.g., $999/mo for hosting/SLA) and allow them to input their own OpenRouter API key. We pass through the raw token costs with zero markup. *Note: BYOK weblets are restricted to "Private Workspace" only to protect marketplace composability.*

### Example Problem: Developer Credit Consumption with Tool-Heavy Weblet

> **Scenario:** Developer Alex builds "Design Assistant" (has Image Gen + Web Search enabled). Developer Priya builds "Essay Editor" (text-only, no tools).
>
> Both are on Pro plan (10,000 credits/mo).
>
> **Alex's weblet (avg 5 credits per message):**
> - 10,000 credits ÷ 5 = ~2,000 conversations/month
>
> **Priya's weblet (avg 1 credit per message):**
> - 10,000 credits ÷ 1 = ~10,000 conversations/month
>
> This is FAIR. Alex's weblet costs the platform 5x more per conversation. Without credits, both would get 5,000 "messages" — and Alex would cost the platform 5x more while paying the same amount.

### Example Problem: Developer Auto-Reload Overage (Pre-Paid)

> **Scenario:** Developer Priya is on Pro (10,000 credits/mo). Her "Essay Editor" goes viral. By day 20, she's used 10,000 credits.
>
> **What happens? (The Auto-Reload Model)**
> 1. Priya gets an email at 80% usage: "You are running low on credits."
> 2. When her balance hits 0, the platform automatically charges her card $10 via Stripe (buys 2,000 overage credits at $0.005/credit).
> 3. Her weblet continues to work perfectly with the new 2,000 credits.
> 4. If the $10 charge *declines*, the platform immediately suspends her weblets until a valid card is added.
>
> **Why this is critical:** If we used post-paid overage (billing at the end of the month), Priya could rack up $500 in LLM costs. If her card declines, the platform eats that $500 loss. Auto-reload protects the platform's bottom line.

---

## Revenue Stream 2: User Weblet Subscriptions (Per-Weblet Access)

This is already designed in Segments 05–07. Developers set a price for their weblet. Users subscribe via Stripe. Platform takes a cut.

| Component | Amount |
|-----------|--------|
| Weblet price (set by developer) | e.g., $10/mo |
| Platform fee | 15% ($1.50) |
| Stripe processing | 2.9% + $0.30 (~$0.59) |
| Developer receives | $7.91 |

### Example Problem: Free vs. Paid Weblets

> **Scenario:** Developer Alex builds "Python Tutor" and makes it FREE. Users chat without subscribing.
>
> **Who pays for the LLM costs?**
> - Alex's developer quota still gets decremented (his weblet is being used).
> - The user's user quota gets decremented.
> - Alex doesn't earn revenue from this weblet, but he chose to make it free (for exposure, portfolio, etc.).
>
> **If Alex wants to monetize later:** He switches "Python Tutor" to paid ($5/mo). Existing free users get a grace period, then must subscribe.

---

## Revenue Stream 3: User Platform Plans (Credit Quota)

Users need a platform-level plan to chat with weblets. This is SEPARATE from per-weblet subscriptions.

### Pricing Tiers

| Plan | Price | Credits/Month | Workflows | Multi-Agent |
|------|-------|---------------|-----------|-------------|
| **Free** | $0/mo | 100 | 2 runs/mo | ❌ |
| **Plus** | $9.99/mo | 1,000 | 20 runs/mo | ✅ (5 agents) |
| **Power** | $19.99/mo | Unlimited | Unlimited | ✅ (Unlimited) |

### What Users See

Users see a simple progress bar — NOT raw token counts:

```
┌──────────────────────────────────────────────────┐
│  Credits: ████████░░░░░░░  147 / 1,000 used      │
│  Resets in 18 days                                │
└──────────────────────────────────────────────────┘
```

When they hover over a used-credits breakdown:
```
Today:   12 credits (3 chats with Blog Writer, 1 image gen)
This week: 47 credits
This month: 147 credits
```

### Example Problem: User Hits Free Limit

> **Scenario:** Free user Tom has used 95 credits. He sends a message to "Design Assistant" which calls DALL-E (5 credits).
>
> **At 100 credits:** Tom sees a modal:
> ```
> ┌──────────────────────────────────────────┐
> │  You've used all your free credits       │
> │  this month.                              │
> │                                            │
> │  Upgrade to Plus for 1,000 credits/mo    │
> │  at just $9.99/month.                     │
> │                                            │
> │  [Upgrade to Plus →]  [Maybe Later]       │
> └──────────────────────────────────────────┘
> ```
> The image gen message still completes (Option A — execute then deduct). Tom goes slightly negative. Next message is blocked until upgrade or next month.

### Example Problem: User Understands Credit Costs

> **Scenario:** User Sarah is on Plus (1,000 credits). She chats with different weblets:
>
> | Day | Weblet | Action | Credits Used |
> |-----|--------|--------|-------------|
> | Mon | Blog Writer | 5 simple chats | 5 credits |
> | Tue | Code Reviewer | 3 chats with code interpreter | 9 credits (3×3) |
> | Wed | Design Assistant | 1 chat with image gen | 5 credits |
> | Thu | Research Bot | 2 chats with web search | 6 credits (2×3) |
> | **Week total** | | **11 conversations** | **25 credits** |
>
> At this rate, Sarah will use ~100 credits/month from 44 conversations — well within her 1,000 limit. She'd need to be a very heavy user (400+ conversations with tools) to exceed it.

### Example Problem: User Subscriptions Stack

> **Scenario:** User Sarah is on Plus ($9.99/mo, 1,000 credits). She also subscribes to "AI Marketer Pro" ($10/mo) and "Code Reviewer" ($5/mo).
>
> **Sarah's total monthly bill:**
> - Platform: $9.99 (Plus plan — gives her 1,000 credits)
> - AI Marketer Pro: $10.00 (access to this specific weblet)
> - Code Reviewer: $5.00 (access to this specific weblet)
> - **Total: $24.99/mo**
>
> **Note:** Free weblets don't require per-weblet subscriptions. Sarah can chat with free weblets using her 1,000 credit quota. Per-weblet subscriptions are only required for weblets the developer has marked as PAID.

---

## How Costs Flow: Complete Scenarios (with Credits)

### Scenario 1: Simple Chat (1 credit)

```
User Tom (Plus plan, 1,000 credits) → "Blog Writer" (Developer Priya, Pro plan, FREE weblet)

1. Tom sends: "Write a blog post about AI trends"
2. Platform checks: Tom has 853/1,000 credits remaining ✅
3. Platform checks: Priya has 8,460/10,000 credits remaining ✅
4. Platform calls OpenRouter (Claude 3.5 Sonnet) using platform's API key
5. Response streams to Tom (no tools called)
6. Credit calculation: simple chat, no tools → 1 credit
7. Platform logs UsageRecord:
   - userId: Tom, developerId: Priya, webletId: blog-writer
   - tokensIn: 450, tokensOut: 1200, cost: $0.005, creditsUsed: 1
   - source: DIRECT_CHAT
8. Tom's credits: 852/1,000 (-1)
9. Priya's credits: 8,459/10,000 (-1)
```

**Platform cost:** $0.005
**Platform revenue from Tom this month:** $9.99
**Platform revenue from Priya this month:** $29.00

### Scenario 2: Chat with Expensive Tools (8 credits)

```
User Sarah (Plus plan) → "Design Assistant" (Dev Alex, Pro plan, $8/mo PAID weblet)

1. Sarah sends: "Create a logo for my bakery and search for color trends"
2. Credit checks pass ✅
3. Subscription check: Sarah has active $8/mo subscription to Design Assistant ✅
4. LLM Call 1: reads message + 5 tool definitions (~2,500 tokens in).
   Decides to call web_search AND image_gen.
5. Tool Exec 1: Tavily web search → $0.01
6. Tool Exec 2: DALL-E 3 image gen → $0.04
7. LLM Call 2: tool results (~3,000 tokens) sent back to LLM.
   LLM generates final response combining search + image.
8. Credit calculation: web search (3) + image gen (5) = 8 credits
9. UsageRecord logged:
   - tokensIn: 8,000, tokensOut: 1,000, cost: $0.076, creditsUsed: 8
   - toolCalls: { tavily: 1, dalle: 1 }
   - source: DIRECT_CHAT
10. Sarah's credits: -8
11. Alex's credits: -8
```

**Platform cost per interaction:** $0.076 (vs. $0.005 for simple chat — **15x more**)
**Credits charged:** 8 (vs. 1 for simple chat — **proportional to real cost**)
**Platform revenue from Sarah:** $9.99 (Plus) + $8.00 (weblet sub) = $17.99/mo
**Platform revenue from Alex:** $29.00 (Pro plan)

### Scenario 3: Composability (Parent Calls Child Weblets)

```
User Sarah (Plus plan) → "Marketing Suite" (Dev A, Business plan)
  └→ calls "Content Writer" (Dev B, Pro plan) as child tool
  └→ calls "Data Analyzer" (Dev C, Pro plan) as child tool

Step-by-step:
1. Sarah sends: "Create a marketing plan for my bakery launch"
2. Check Sarah's user quota ✅
3. Check Dev A's quota ✅
4. Platform calls LLM for Marketing Suite
5. LLM decides: "I need Content Writer for the copy and Data Analyzer for market research"
6. Platform calls Content Writer (checks Dev B's quota ✅, calls LLM)
7. Platform calls Data Analyzer (checks Dev C's quota ✅, calls LLM)
8. Marketing Suite LLM compiles results into final response
9. Response streams to Sarah

Usage Records Created:
┌─────────────────────────────────────────────────────────────┐
│ Record 1: Marketing Suite (Dev A)                            │
│   tokensIn: 800, tokensOut: 500, cost: $0.02                │
│   source: DIRECT_CHAT                                        │
│   Dev A quota: -1                                            │
├─────────────────────────────────────────────────────────────┤
│ Record 2: Content Writer (Dev B)                             │
│   tokensIn: 600, tokensOut: 1200, cost: $0.025              │
│   source: COMPOSABILITY, triggeredByWebletId: marketing-suite│
│   Dev B quota: -1                                            │
├─────────────────────────────────────────────────────────────┤
│ Record 3: Data Analyzer (Dev C)                              │
│   tokensIn: 500, tokensOut: 900, cost: $0.018               │
│   source: COMPOSABILITY, triggeredByWebletId: marketing-suite│
│   Dev C quota: -1                                            │
└─────────────────────────────────────────────────────────────┘

Sarah's credits: -2 (base chat for parent = 1, plus 1 for orchestration overhead)
Total platform cost: $0.063

Credit distribution:
  Dev A credits: -1 (parent weblet LLM call)
  Dev B credits: -1 (child weblet — simple text response)
  Dev C credits: -1 (child weblet — simple text response)
  Sarah's credits: -2 (1 for the chat + 1 composability overhead)

Revenue distribution (if Sarah pays $15/mo for Marketing Suite):
  Platform: 15% = $2.25
  Dev A: 55% = $8.25 (built the composite)
  Dev B: 20% = $3.00 (content writer used frequently)
  Dev C: 10% = $1.50 (data analyzer used less)
```

> **Key Rule:** Developer credits are decremented per weblet invocation based on what that weblet consumed. User credits are based on the top-level action plus composability overhead. Tool calls inside child weblets add to that child developer's credit cost.

### Scenario 4: User Workflow (3-Step Pipeline)

```
User Tom (Plus plan) runs workflow:
  Step 1: "Research Bot" (Dev A) — gather data
  Step 2: "Blog Writer" (Dev B) — write the article  [HITL: ON]
  Step 3: "SEO Optimizer" (Dev C) — optimize for search

1. Tom enters task: "Write a blog post about AI in healthcare"
2. Platform checks Tom's quota: 486/500 ✅ (needs 3 messages for 3 steps)
3. Orchestrator planner LLM call → decomposes task into 3 steps
   Cost: $0.02 → NOT counted against any developer (platform overhead)
4. Step 1: Research Bot
   - Checks Dev A quota ✅
   - LLM call → web search tool → response
   - Dev A: -1, Tom: -1 (now 485)
   - UsageRecord: source=WORKFLOW
5. Step 2: Blog Writer (HITL enabled)
   - Checks Dev B quota ✅
   - LLM call → generates blog post
   - Dev B: -1, Tom: -1 (now 484)
   - HITL pause → Tom reviews → approves
6. Step 3: SEO Optimizer
   - Checks Dev C quota ✅
   - LLM call → optimizes the post
   - Dev C: -1, Tom: -1 (now 483)
7. Final output presented to Tom

Credit Summary:
  Tom:   -5 credits (1 per simple step × 3 steps + 2 workflow overhead)
  Dev A: -3 credits (Research Bot used web search tool)
  Dev B: -1 credit (Blog Writer, text only)
  Dev C: -1 credit (SEO Optimizer, text only)
  Platform overhead: 1 planner call ($0.02) — not charged to anyone
```

> **Note:** If Research Bot used web search, that step costs Dev A 3 credits (not 1). Tom's credits reflect the sum of actual step costs. This is why credits are better than flat messages — the user's 3-step workflow with tool-heavy steps costs more than a 3-step text-only workflow, which is proportional to real platform cost.

### Scenario 5: What Happens When a Developer's Quota Runs Out Mid-Workflow

> **Scenario:** Tom runs a 3-step workflow. Step 1 (Dev A) completes. Step 2 uses Dev B's weblet, but Dev B has 0 messages remaining on their Starter plan.
>
> **What happens?**
> 1. Step 2 fails the quota check.
> 2. The workflow pauses with an error: "Blog Writer is temporarily unavailable (creator quota exceeded)."
> 3. Tom gets options: **Skip this step** (pass Step 1's output directly to Step 3) or **Cancel workflow**.
> 4. Dev B gets an email: "Your weblet 'Blog Writer' couldn't serve a request due to quota limits. Upgrade your plan to avoid losing users."
> 5. Tom's quota is only decremented for steps that actually ran (just 1, not 3).
>
> **This is important:** Users should NEVER be blocked because of a developer's billing issue. The graceful degradation (skip or cancel) protects UX.

### Scenario 6: RSIL Optimization Costs

```
Midnight RSIL run for Dev A's weblet "Essay Editor":

1. Collect metrics (DB queries only) → $0.00
2. Evaluate performance (GPT-4o call) → $0.05
3. Generate variant (GPT-4o call) → $0.03
4. Create WebletVersion + start A/B test → $0.00

Total cost: $0.08 per optimization cycle
Frequency: Weekly per weblet
Monthly cost per weblet: ~$0.32

Who pays? → PLATFORM absorbs this.
It's covered by Dev A's $29/mo Pro plan (Dev A opted into RSIL).
```

---

## Database Models

### New Models to Add to Prisma Schema

```prisma
// ── Developer Subscription Plan ──
model DeveloperPlan {
  id                   String    @id @default(cuid())
  userId               String    @unique
  user                 User      @relation(fields: [userId], references: [id])
  tier                 DevTier   @default(STARTER)
  creditsIncluded      Int       // Monthly credit quota (e.g., 200, 10000, 50000)
  creditsUsed          Int       @default(0)
  billingCycleStart    DateTime
  billingCycleEnd      DateTime
  stripeSubscriptionId String?
  stripePriceId        String?
  autoReloadEnabled    Boolean   @default(true)  // Automatically buy credits when 0
  autoReloadAmount     Int       @default(2000)  // How many credits to buy at a time
  overageRate          Decimal   @default(0.005) // $/credit
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}

// ── User Platform Plan ──
model UserPlan {
  id                   String    @id @default(cuid())
  userId               String    @unique
  user                 User      @relation(fields: [userId], references: [id])
  tier                 UserTier  @default(FREE_USER)
  creditsIncluded      Int       // Monthly credit quota (e.g., 100, 1000, unlimited=-1)
  creditsUsed          Int       @default(0)
  workflowRunsIncluded Int       @default(2)
  workflowRunsUsed     Int       @default(0)
  billingCycleStart    DateTime
  billingCycleEnd      DateTime
  stripeSubscriptionId String?
  stripePriceId        String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}

// ── Per-Message Usage Record (Audit Trail) ──
model UsageRecord {
  id             String      @id @default(cuid())
  userId         String      // Who initiated the chat
  webletId       String      // Which weblet was called
  developerId    String      // Who owns the weblet
  sessionId      String?     // Chat session (null for RSIL)
  workflowId     String?     // If part of a workflow
  tokensIn       Int         // Input tokens consumed
  tokensOut      Int         // Output tokens consumed
  modelId        String      // e.g., "anthropic/claude-3.5-sonnet"
  toolCalls      Json?       // e.g., { "tavily": 1, "dalle": 0, "e2b": 0, "rag": 2 }
  creditsCharged Int         // Credits deducted for this action
  estimatedCost  Decimal     // Platform's estimated cost in USD
  source         UsageSource // Where this usage came from
  parentRecordId String?     // If triggered by composability, link to parent
  createdAt      DateTime    @default(now())

  @@index([userId, createdAt])
  @@index([developerId, createdAt])
  @@index([webletId, createdAt])
}

// ── Enums ──
enum DevTier {
  STARTER
  PRO
  BUSINESS
  ENTERPRISE
}

enum UserTier {
  FREE_USER
  PLUS
  POWER
}

enum UsageSource {
  DIRECT_CHAT       // User chatted directly with weblet
  COMPOSABILITY     // Weblet called as a child by another weblet
  WORKFLOW          // Part of a user workflow pipeline
  ORCHESTRATION     // Part of multi-agent orchestration
  RSIL              // Automated optimization (platform cost)
}
```

---

## Chat Engine Integration (Changes to Segment 05)

### Quota Check Middleware

Every `chatWithWeblet()` call must check quotas BEFORE making the LLM call:

```typescript
// lib/billing/quota-check.ts
export async function checkQuotas(userId: string, webletId: string): Promise<{
  allowed: boolean;
  reason?: string;
  userPlan: UserPlan;
  devPlan: DeveloperPlan;
}> {
  const [userPlan, weblet] = await Promise.all([
    db.userPlan.findUnique({ where: { userId } }),
    db.weblet.findUnique({ where: { id: webletId }, include: { creator: true } }),
  ]);

  const devPlan = await db.developerPlan.findUnique({
    where: { userId: weblet.creatorId },
  });

  // Check user credits (hard cap for free users, soft cap for paid)
  if (userPlan.creditsIncluded !== -1 && userPlan.creditsUsed >= userPlan.creditsIncluded) {
    if (userPlan.tier === 'FREE_USER') {
      return { allowed: false, reason: "user_credits_exceeded", userPlan, devPlan };
    }
    // Paid users: allow but flag overage (soft cap)
  }

  // Check developer credits
  if (devPlan.creditsUsed >= devPlan.creditsIncluded) {
    if (devPlan.autoReloadEnabled && !devPlan.isSuspended) {
      // Allow the call, the background job will trigger the Stripe auto-reload charge
      return { allowed: true, userPlan, devPlan, triggerReload: true };
    } else {
      // Developer has 0 credits, auto-reload failed or is off -> suspend weblet
      return { allowed: false, reason: "developer_credits_exhausted", userPlan, devPlan };
    }
  }

  return { allowed: true, userPlan, devPlan };
}
```

### Credit Calculation After Each LLM Call

```typescript
// lib/billing/credit-calculator.ts
const CREDIT_MULTIPLIERS = {
  base: 1,            // Simple chat, no tools
  rag: 2,             // Knowledge search (embedding + pgvector + LLM)
  tavily: 3,          // Web search (LLM + Tavily API + LLM)
  e2b: 3,             // Code interpreter (LLM + E2B sandbox + LLM)
  dalle: 5,           // Image generation (LLM + DALL-E 3 API)
  custom_action: 2,   // Custom HTTP action
  mcp: 2,             // MCP server tool call
} as const;

export function calculateCredits(toolCalls: Record<string, number>): number {
  if (!toolCalls || Object.keys(toolCalls).length === 0) {
    return CREDIT_MULTIPLIERS.base; // No tools = 1 credit
  }

  let credits = 0;
  for (const [tool, count] of Object.entries(toolCalls)) {
    const multiplier = CREDIT_MULTIPLIERS[tool] || CREDIT_MULTIPLIERS.base;
    credits += multiplier * count;
  }
  return Math.max(credits, 1); // Minimum 1 credit
}
```

### Usage Logging After Each LLM Call

```typescript
// lib/billing/usage-logger.ts
export async function logUsage(params: {
  userId: string;
  webletId: string;
  developerId: string;
  sessionId: string;
  tokensIn: number;
  tokensOut: number;
  modelId: string;
  toolCalls: Record<string, number>;
  source: UsageSource;
  parentRecordId?: string;
}) {
  const cost = calculateCost(params.modelId, params.tokensIn, params.tokensOut, params.toolCalls);
  const credits = calculateCredits(params.toolCalls);

  await db.$transaction([
    // Log the usage record
    db.usageRecord.create({ data: { ...params, creditsCharged: credits, estimatedCost: cost } }),

    // Decrement developer credits
    db.developerPlan.update({
      where: { userId: params.developerId },
      data: { creditsUsed: { increment: credits } },
    }),

    // Decrement user credits (only for non-composability sources)
    ...(params.source !== "COMPOSABILITY" ? [
      db.userPlan.update({
        where: { userId: params.userId },
        data: { creditsUsed: { increment: credits } },
      }),
    ] : []),
  ]);
}
```

> **Note:** For `COMPOSABILITY` source, user credits are charged a flat 1-credit overhead on the parent call — NOT the full child credit cost. This prevents users from being penalized for composability they can't control.

---

## Monthly Billing Cycle Reset

A scheduled job resets quotas at the start of each billing cycle:

```typescript
// Inngest cron: runs daily, resets users whose billing cycle has ended
export const resetBillingCycles = inngest.createFunction(
  { id: "reset-billing-cycles" },
  { cron: "0 0 * * *" }, // Midnight daily
  async ({ step }) => {
    const now = new Date();

    // Reset developer plans
    await step.run("reset-dev-plans", async () => {
      await db.developerPlan.updateMany({
        where: { billingCycleEnd: { lte: now } },
        data: {
          creditsUsed: 0,
          billingCycleStart: now,
          billingCycleEnd: addMonths(now, 1),
        },
      });
    });

    // Reset user plans
    await step.run("reset-user-plans", async () => {
      await db.userPlan.updateMany({
        where: { billingCycleEnd: { lte: now } },
        data: {
          creditsUsed: 0,
          workflowRunsUsed: 0,
          billingCycleStart: now,
          billingCycleEnd: addMonths(now, 1),
        },
      });
    });
  }
);
```

---

## Environment Variables

```env
# OpenRouter (single platform key for all LLM calls)
OPENROUTER_API_KEY=sk-or-xxxxx

# Stripe Products for Developer Plans
STRIPE_DEV_PRO_PRICE_ID=price_xxxxx
STRIPE_DEV_BUSINESS_PRICE_ID=price_xxxxx

# Stripe Products for User Plans
STRIPE_USER_PLUS_PRICE_ID=price_xxxxx
STRIPE_USER_POWER_PRICE_ID=price_xxxxx

# Billing Configuration
PLATFORM_FEE_RATE=0.15           # 15% platform take on weblet subscriptions
DEV_OVERAGE_RATE=0.005           # $0.005 per credit after quota
ENABLE_PAYMENT_ENFORCEMENT=false # Feature flag (false at launch)
```

---

## Cost Summary: Who Pays What

| Cost Item | Paid By | Credits | How |
|-----------|---------|---------|-----|
| Simple chat (no tools) | Dev + User | 1 credit each | Both credit pools decremented |
| Chat with RAG | Dev + User | 2 credits each | Embedding + vector search + LLM |
| Chat with web search | Dev + User | 3 credits each | Tavily API + extra LLM round-trip |
| Chat with code interpreter | Dev + User | 3 credits each | E2B sandbox + LLM |
| Chat with image gen | Dev + User | 5 credits each | DALL-E 3 ($0.04) is the expensive part |
| Chat with multiple tools | Dev + User | Sum of tool credits | Web search (3) + image gen (5) = 8 |
| Composability (child call) | Child dev only | Child's credits | User charged 1 overhead on parent |
| Workflow step | Step dev + User | Step's credits | User charged per step |
| Orchestrator planner LLM | Platform | 0 (platform cost) | Covered by subscription margins |
| RSIL optimization | Platform | 0 (platform cost) | ~$0.08/cycle, covered by dev plan fees |
| Developer overage | Developer | — | **Auto-reload:** Card charged $10 for 2K credits when balance hits 0 |
| User upgrade | User | — | Monthly subscription |
| Enterprise BYOK | Enterprise Client | 0 (Pass-through) | Client uses their own OpenRouter key, pays 0 platform credits |

---

## Acceptance Criteria

- [ ] Platform uses a single OpenRouter API key for all LLM calls
- [ ] OpenRouter `user` parameter passed with userId for per-user tracking
- [ ] Credit multiplier table implemented (1/2/3/5 credits by tool type)
- [ ] Credits calculated AFTER LLM call based on actual tools invoked
- [ ] `DeveloperPlan` model tracks tier, credit quota, and usage per billing cycle
- [ ] `UserPlan` model tracks tier, credit quota, and usage per billing cycle
- [ ] `UsageRecord` logs every LLM call with tokens, cost, credits charged, source, and tool calls
- [ ] Credit check runs before every LLM call (user + developer)
- [ ] User sees upgrade modal when credits are exceeded
- [ ] Developer gets email notification at 80% credit usage
- [ ] **Developer Auto-Reload:** When credits hit 0, Stripe automatically charges $10 for 2,000 credits
- [ ] If Auto-Reload Stripe charge fails, developer's weblets are immediately suspended (returns 402)
- [ ] **Enterprise BYOK:** Business/Enterprise plans can provide their own API key, overriding platform credits
- [ ] BYOK weblets are restricted to "Private Workspace" mode only
- [ ] Composability: child weblet calls decrement child developer's credits based on actual usage
- [ ] Composability: user credits charged 1 overhead on parent call, not full child cost
- [ ] Workflows: user credits decremented per step based on actual tool usage
- [ ] Workflows: graceful degradation if a step's developer is over quota
- [ ] RSIL costs absorbed by platform (not charged to developer credits)
- [ ] Billing cycle reset runs daily via Inngest
- [ ] Stripe products created for Dev Pro/Business and User Plus/Power plans
- [ ] Usage dashboard shows developers their credits used/remaining with breakdown by tool type
- [ ] Usage dashboard shows users their credits used/remaining with visual progress bar
- [ ] `ENABLE_PAYMENT_ENFORCEMENT` flag gates all credit checks (off at launch)

---

## Files to Create

```
lib/billing/
├── quota-check.ts          ← Check user + developer credit quotas before LLM calls
├── credit-calculator.ts    ← Credit multiplier table + calculate credits from tool calls
├── usage-logger.ts         ← Log UsageRecord with credits after every LLM call
├── cost-calculator.ts      ← Calculate $ cost from tokens + model + tools
├── overage.ts              ← Handle developer overage billing at month end
└── cycle-reset.ts          ← Inngest cron to reset monthly quotas

app/api/billing/
├── plans/route.ts          ← GET available plans, POST upgrade/downgrade
├── usage/route.ts          ← GET current usage for authenticated user/developer
└── checkout/route.ts       ← POST create Stripe Checkout for plan upgrade

components/billing/
├── credit-bar.tsx          ← Visual progress bar showing credits used/remaining
├── upgrade-modal.tsx       ← Modal shown when user exceeds credits
├── plan-selector.tsx       ← Plan comparison cards for upgrade page
├── usage-table.tsx         ← Detailed usage breakdown table with credit costs per tool
└── dev-usage-dashboard.tsx ← Developer dashboard widget showing credits + overage
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Platform LLM costs exceed revenue | Credit multipliers already scale with actual cost. Monitor cost-per-credit and adjust multipliers if needed. |
| Developer credit card declines on overage | **Mitigated:** Auto-reload charges $10 *before* allowing more usage. If charge fails, weblet is suspended immediately. Platform max loss = 0. |
| BYOK breaks composability | **Mitigated:** BYOK weblets are strictly locked to Private Workspace. They cannot be listed in the public marketplace or used as tools in public composites. |
| DALL-E 3 abuse (expensive tool) | 5-credit multiplier means image gen uses credits 5x faster. Free users with 100 credits can do ~20 images max. Rate limit to 10 images/day. |
| Developer creates many free weblets to drain platform LLM budget | Starter plan limits to 1 weblet and 200 credits. Requires plan upgrade for more. |
| OpenRouter outage | Fallback to direct OpenAI/Anthropic API keys (maintain backup keys). |
| Users game free tier (multiple accounts) | Rate limit by IP + email domain. Flag suspicious patterns. |
| Composability cost explosion (deeply nested calls) | Max depth: 3 levels. Each level counts against developer's credits. Credit multipliers compound — keeps costs proportional. |
| Credit multipliers feel unfair to users | Show tool-by-tool credit breakdown after each message. Transparency builds trust. Users understand "image gen costs more" intuitively. |

---

## Segment 09 Developer Dashboard


**Estimated effort:** 2 weeks
**Depends on:** Segment 05 (Chat Engine — analytics events must exist)
**Produces:** Full developer dashboard with overview stats, weblet management, per-weblet analytics, category insights, and RSIL improvement tracking
**References:** segment-14-categories-discovery.md

---

## What This Segment Is

The Developer Dashboard is where developers go to understand how their weblets are performing. It shows aggregate stats across all weblets, per-weblet deep-dive analytics, category rankings, and (for weblets with RSIL enabled) prompt improvement tracking over time.

Crucially, this is also where developers review **RSIL Suggestions** — an inbox of prompt improvements generated by the AI when a Weblet's performance score falls into the "Needs Approval" tier (3.0 - 3.9 on the 5-point Rubric).

> **Example:** Developer Priya logs into her dashboard and sees: 3,841 total chats across her 5 weblets. She clicks into Essay Editor's analytics and sees the RSIL section has 2 new "Suggestions" waiting for her approval. The AI suggests adding a strict formatting rule to the prompt to fix a recurring issue. She clicks "Approve & Deploy", and the new prompt version is instantly A/B tested in production.

---

## How It Will Be Done

### Step 1 — Build the Overview Page (Dashboard Home)

The first page developers see after login. Shows aggregate metrics across ALL their weblets:

**Stats Cards (top row):**
- **Total Chats** — Sum of all chat sessions across all weblets
- **Average Rating** — Mean of all 1-5 star ratings across all weblets
- **Active Subscribers** — Count of active subscriptions (shows "Available when monetization is enabled" if payment flag is off)
- **Total Revenue** — Sum of all earnings after platform fee (shows "Available when monetization is enabled" if payment flag is off)

**Category Breakdown Chart:**
A pie or donut chart showing the developer's weblets by category. For example: 2 WRITING, 1 CODE, 1 DATA_ANALYSIS, 1 CREATIVE.

**Top Weblets Table:**
A summary table showing the developer's best-performing weblets ranked by chat volume:

| Name | Category | Chats (30d) | Rating | Status |
|------|----------|-------------|--------|--------|
| Essay Editor | Writing | 1,247 | 4.7 | Active |
| Code Reviewer | Code | 891 | 4.2 | Active |
| Data Helper | Data Analysis | 650 | 4.5 | Active |

**Revenue Trend Line Chart:** (hidden when payment flag is off)
A line chart showing daily revenue over the selected date range.

### Step 2 — Build the Weblet List Page

A full table of all the developer's weblets with sortable columns:

| Column | Description |
|--------|-------------|
| Name | Weblet name with icon |
| Category | Category badge with icon |
| Status | Active / Draft badge |
| Total Chats | Chat count in selected date range |
| Avg Rating | Star display with numeric value |
| Active Subs | Subscriber count (hidden when payment flag off) |
| Revenue | Earnings in selected date range (hidden when payment flag off) |
| Actions | View Analytics, Edit in Builder, Settings |

Sortable by any column. Filterable by status (Active/Draft) and category.

### Step 3 — Build Per-Weblet Analytics Page

When a developer clicks into a specific weblet, they see a detailed analytics page with these metrics:

**Metric 1 — Total Chats (Counter Card)**
A large number showing the total chat sessions for this weblet. Shows comparison to previous period: "+12% vs last 30 days."

**Metric 2 — Daily Chat Trend (Bar Chart)**
A bar chart showing chats per day over the selected date range. Helps identify usage patterns and spikes.

> **Example:** The chart shows 45 chats on Monday, 38 on Tuesday, a spike to 120 on Wednesday (maybe the weblet was shared on social media), then back to normal.

**Metric 3 — Average Rating (Star Display)**
Stars with the numeric average and total count. Example: "4.3 (from 287 ratings)"

**Metric 4 — Category Rank**
The weblet's position within its category in the marketplace. Example: "Rank #2 in Writing" with a link to the category page. Calculated by the ranking algorithm from Segment 06.

**Metric 5 — Latest Chat Topics (Keyword List)**
Keywords extracted from recent conversations (from analytics event metadata). Shows what users are asking about most.

> **Example:** Top topics for "Essay Editor": college essays (34%), grammar help (22%), blog posts (18%), research papers (15%), cover letters (11%)

**Metric 6 — Usage Patterns (Bar Charts)**
Two charts:
- **Hourly usage** — 24 bars showing which hours of the day are busiest
- **Daily usage** — 7 bars showing which days of the week are busiest

**Metric 7 — Revenue Details (hidden when payment flag off)**
- Total revenue for this weblet
- Revenue breakdown by period (daily/weekly/monthly)
- Transaction table: date, user (anonymized), amount, fee, net

**Metric 8 — RSIL Performance & Inbox (shown only when rsilEnabled is true)**
For weblets that have opted into RSIL (Segment 15):
- **Suggestions Inbox** — A queue of `RsilSuggestion` records where the AI scored recent conversations between 3.0 and 3.9 and suggested a prompt fix. The developer can click "Approve" (auto-deploys as a new active version) or "Dismiss".
- **Reflection Logs** — A view of the `ReflectionLog` table showing the raw 5-point rubric scores (Completeness, Depth, Tone, Scope, Missed Opportunities) for recent evaluations.
- **Version History** — List of prompt versions with their performance scores.
- **Improvement Chart** — Line chart showing average rating over time as versions are deployed.
- **Active A/B Test** — If a test is running, show: Version A (control) vs Version B (challenger), traffic split, current results.

> **Example:** The RSIL Suggestions Inbox shows: "The AI missed an opportunity to up-sell the premium tier in 14 recent chats. Suggested prompt addition: 'Always mention the premium tier when users ask about file uploads.' [Approve] [Dismiss]"

**Metric 9 — Execution Logs (Observability - Segment 16)**
A dedicated tab utilizing Langfuse traces to help developers debug composite weblets and hallucinations.
- **Session List** — Table of recent chat sessions with `sessionId`, latency, tokens used.
- **Trace View** — Clicking a session opens a detailed trace showing exactly what happened: System prompt sent → Initial LLM Call → Tool Call (e.g. DALL-E) → Tool Response → Final Output.

### Step 4 — Implement Date Range Filters

All metrics support date range filtering:
- 7 days
- 30 days (default)
- 90 days
- All time
- Custom (date picker)

The filter applies to all charts and metrics on the page simultaneously. Data refreshes without a full page reload (client-side state change triggers new API call).

### Step 5 — Build the Analytics API

The dashboard APIs aggregate data from the AnalyticsEvent, Subscription, and Transaction tables:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/dashboard/overview` | Aggregate stats across all developer's weblets |
| `GET /api/dashboard/weblets/[id]` | Detailed analytics for a specific weblet with date range |
| `GET /api/dashboard/weblets/[id]/subscribers` | Subscriber list for a weblet (when payments enabled) |
| `GET /api/dashboard/weblets/[id]/traces` | Fetches Langfuse traces for the "Execution Logs" tab |

All queries run in parallel using `Promise.all` for performance. Database indexes on `(webletId, createdAt)` and `(webletId, eventType)` ensure fast queries even with thousands of events.

### Step 6 — Handle the Payment Flag in UI

When `ENABLE_PAYMENT_ENFORCEMENT` is `false`:
- Revenue stats cards show: "Revenue tracking will be available when monetization is enabled" with a lock icon
- Revenue chart is hidden
- Subscriber count column is hidden in the weblet table
- Transaction table is hidden in per-weblet analytics
- All other metrics (chats, ratings, topics, usage, RSIL) work normally

This ensures developers aren't confused by $0 revenue — they know monetization is coming.

---

## Files to Create

```
app/(dashboard)/
├── page.tsx                                ← Overview: stats cards, category chart, top weblets
├── weblets/
│   ├── page.tsx                            ← Weblet list table with sortable columns
│   └── [id]/
│       ├── page.tsx                        ← Individual weblet overview
│       ├── analytics/page.tsx              ← Full analytics charts page
│       └── logs/page.tsx                   ← Execution Logs (Langfuse traces)

app/api/dashboard/
├── overview/route.ts                       ← Aggregate stats across all weblets
├── weblets/[id]/analytics/route.ts         ← Per-weblet analytics with date range
├── weblets/[id]/subscribers/route.ts       ← Subscriber list (when payments enabled)
└── weblets/[id]/traces/route.ts            ← Fetch Langfuse traces for a weblet

components/dashboard/
├── stats-cards.tsx                         ← Row of stat cards with optional payment-aware display
├── weblet-table.tsx                        ← Table with category column, sortable
├── date-range-picker.tsx                   ← Date range selector
├── charts/
│   ├── daily-chats-chart.tsx               ← Bar chart: chats per day (Recharts)
│   ├── hourly-usage-chart.tsx              ← Bar chart: 24 bars for hourly distribution
│   ├── category-breakdown-chart.tsx        ← Pie/donut chart: weblets by category
│   ├── revenue-chart.tsx                   ← Line chart: revenue over time (hidden when flag off)
│   ├── rating-display.tsx                  ← Star display with average and count
│   ├── rsil-improvement-chart.tsx          ← Line chart: rating improvement over versions
│   └── topic-cloud.tsx                     ← Keyword list from recent chat topics
└── subscriber-table.tsx                    ← Table: email, status, date, revenue (hidden when flag off)
```

---

## Acceptance Criteria

- [ ] Dashboard overview shows aggregate stats for all developer's weblets
- [ ] Stats cards show: Total Chats, Avg Rating, Active Subs, Revenue (last two hidden when payment flag off)
- [ ] **Category breakdown chart** shows developer's weblets by category
- [ ] Weblet list table includes **Category column** with badges
- [ ] Per-weblet analytics shows all 8 metrics described above
- [ ] **Category Rank** displayed: "Rank #N in [Category]"
- [ ] **RSIL Inbox** allows developers to Approve or Dismiss AI-generated prompt suggestions
- [ ] **Reflection Logs** UI shows the 5-point rubric scores from recent RSIL evaluations
- [ ] **RSIL Performance** section shows version history and improvement chart (only when rsilEnabled)
- [ ] **Execution Logs** tab displays Langfuse traces showing exact prompt/tool/latency execution
- [ ] Date range filters work (7d, 30d, 90d, All time, Custom)
- [ ] Revenue-related UI hidden when ENABLE_PAYMENT_ENFORCEMENT is false
- [ ] Charts render within 2 seconds for weblets with 10,000+ events
- [ ] Data refreshes when date range changes (no full page reload)

---

## After Completion, the Developer Will Be Able To

1. **See an overview** of all their weblets' performance at a glance
2. **Understand category positioning** — which categories they're in and how they rank
3. **Deep-dive into any weblet** — daily chat trends, rating, topics, usage patterns
4. **Track RSIL improvements** — see how prompt optimization is improving their weblet over time
5. **Sort and filter** their weblet list by category, status, or performance
6. **Know monetization is coming** — revenue sections are clearly marked as "available when enabled"

---

## Dependencies to Install

```bash
npm install recharts        # Chart library
npm install date-fns        # Date manipulation for aggregations
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Slow analytics queries on large datasets | Database indexes on (webletId, createdAt) and (webletId, eventType). Pre-aggregate if needed. |
| Recharts bundle size | Lazy-load chart components. Only import used chart types. |
| RSIL data not available yet | RSIL section shows "Enable RSIL in your weblet settings to see optimization data" when not enabled. |
| Topic extraction from JSON | Use Prisma raw queries for JSON field access. PostgreSQL JSON operators handle this well. |

---

## Segment 10 Payouts


**Estimated effort:** 1.5 weeks
**Depends on:** Segment 09 (Creator Dashboard — balance data visible)
**Produces:** Complete payout system with PayPal withdrawals, balance tracking, transaction history, and PayPal email confirmation

---

## Goal

Enable creators to withdraw their earnings. Creators view their balance (accumulated from subscription revenue minus platform fee), request a withdrawal to PayPal, confirm their PayPal email, and receive funds within 24 hours.

---

## What Already Exists (from Segments 01-08)

```
Database:
  User.balance — Decimal field, updated by Stripe webhook on invoice.paid (Segment 07)
  Transaction — logs every subscription payment with amount, fee, status
  Payout — model exists with creatorId, amount, paypalEmail, status, timestamps
API:
  /api/payouts (GET, POST) — stubs from Segment 03
Dashboard:
  Creator can see weblet revenue in analytics (Segment 09)
```

**Revenue flow already working:**
```
User pays $8/month → Stripe webhook fires → Transaction created →
Creator balance incremented by $6.80 (after 15% platform fee)
```

**What you build:** The "withdraw" side — letting creators get that $6.80 out to their PayPal.

---

## Important: PayPal Business Account Required

The PayPal Payouts API requires:
1. A **PayPal Business account** (not personal)
2. **Explicit approval** from PayPal to use the Payouts API
3. This approval process can take **1-3 weeks**

**Action:** Apply for PayPal Payouts API access IMMEDIATELY when starting this segment. Use PayPal Sandbox for development while waiting for production approval.

---

## Files to Create

```
app/(dashboard)/balance/
├── page.tsx                           ← Balance overview + withdrawal form
└── history/page.tsx                   ← Full transaction history (paginated)

app/api/payouts/
├── route.ts                           ← GET (list payouts) + POST (request payout)
├── [id]/route.ts                      ← GET single payout status
└── verify-email/route.ts              ← Verify PayPal email before first withdrawal

components/balance/
├── balance-overview.tsx               ← Cards: Available, Pending, Total Earned, Total Withdrawn
├── withdrawal-form.tsx                ← Amount input + PayPal email + submit
├── paypal-email-verification.tsx      ← Confirm PayPal email step (was missing from original plan)
├── transaction-table.tsx              ← Full transaction log table
└── payout-status-badge.tsx            ← Status indicator (pending, processing, completed, failed)

lib/paypal/
├── client.ts                          ← PayPal SDK client singleton
└── create-payout.ts                   ← PayPal Payouts API integration

app/api/webhooks/
└── paypal/route.ts                    ← PayPal webhook for payout status updates
```

---

## Implementation Details

### 1. Balance Overview Page

```
┌──────────────────────────────────────────────────┐
│  My Balance                                       │
├───────────┬───────────┬───────────┬──────────────┤
│ Available │ Pending   │ Total     │ Total        │
│ Balance   │ Balance   │ Earned    │ Withdrawn    │
│ $247.60   │ $34.00    │ $891.20   │ $609.60      │
├───────────┴───────────┴───────────┴──────────────┤
│                                                    │
│  Paid Users: 38                                    │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │  Withdraw to PayPal                          │  │
│  │  Amount: [$247.60        ] (min $10.00)      │  │
│  │  PayPal: [sarah@creator.com]  ✓ Verified     │  │
│  │  [Request Withdrawal]                        │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  Recent Transactions                [View All →]  │
│  ┌───────┬────────┬───────┬──────┬────────────┐  │
│  │ Date  │ User   │ Type  │ Amt  │ Status     │  │
│  ├───────┼────────┼───────┼──────┼────────────┤  │
│  │ Feb 1 │ john@  │ Sub   │+$6.80│ Completed  │  │
│  │ Jan 28│ —      │Payout │-$100 │ Completed  │  │
│  │ Jan 25│ jane@  │ Sub   │+$6.80│ Completed  │  │
│  └───────┴────────┴───────┴──────┴────────────┘  │
└──────────────────────────────────────────────────┘
```

**Balance calculations:**
- **Available Balance** = `User.balance` (already calculated by Segment 07 webhook)
- **Pending Balance** = Sum of transactions from last 7 days (Stripe holds funds briefly)
- **Total Earned** = Sum of all COMPLETED transactions where type = SUBSCRIPTION_PAYMENT (creator's share)
- **Total Withdrawn** = Sum of all COMPLETED payouts
- **Paid Users** = Distinct count of users with ACTIVE subscriptions across all creator's weblets

### 2. PayPal Email Verification (Client Requirement — Was Missing)

Before the first withdrawal, creators must verify their PayPal email:

1. Creator enters PayPal email address
2. System sends a verification code to that email (via Resend)
3. Creator enters the code
4. PayPal email is saved to `User.paypalEmail` and marked verified

```typescript
// app/api/payouts/verify-email/route.ts
export async function POST(req: Request) {
  const { email, code } = await req.json();
  const session = await auth();

  if (code) {
    // Verify the code
    const stored = await redis.get(`paypal-verify:${session.user.id}`);
    if (stored !== code) {
      return Response.json({ error: "Invalid code" }, { status: 400 });
    }
    // Save verified email
    await db.user.update({
      where: { id: session.user.id },
      data: { paypalEmail: email, paypalEmailVerified: true },
    });
    await redis.del(`paypal-verify:${session.user.id}`);
    return Response.json({ verified: true });
  }

  // Send verification code
  const verifyCode = Math.random().toString().slice(2, 8); // 6 digits
  await redis.set(`paypal-verify:${session.user.id}`, verifyCode, { ex: 600 }); // 10 min expiry
  await sendEmail(email, "Verify your PayPal email", `Your code: ${verifyCode}`);
  return Response.json({ sent: true });
}
```

**Database addition:**
```prisma
// Add to User model:
paypalEmailVerified Boolean @default(false)
```

### 3. Payout Request

```typescript
// app/api/payouts/route.ts — POST handler
export async function POST(req: Request) {
  const session = await auth();
  const { amount } = await req.json();
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  // Validations
  if (!user.paypalEmail || !user.paypalEmailVerified) {
    return Response.json({ error: "Please verify your PayPal email first" }, { status: 400 });
  }
  if (amount < 10) {
    return Response.json({ error: "Minimum withdrawal is $10.00" }, { status: 400 });
  }
  if (Number(user.balance) < amount) {
    return Response.json({ error: "Insufficient balance" }, { status: 400 });
  }

  // Check for pending payouts (prevent double withdrawal)
  const pendingPayout = await db.payout.findFirst({
    where: { creatorId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (pendingPayout) {
    return Response.json({ error: "You already have a pending withdrawal" }, { status: 400 });
  }

  // Create payout record
  const payout = await db.payout.create({
    data: {
      creatorId: user.id,
      amount,
      paypalEmail: user.paypalEmail,
      status: "PENDING",
    },
  });

  // Deduct from balance immediately
  await db.user.update({
    where: { id: user.id },
    data: { balance: { decrement: amount } },
  });

  // Send PayPal payout
  try {
    await sendPayPalPayout(payout);
    await db.payout.update({ where: { id: payout.id }, data: { status: "PROCESSING" } });
  } catch (error) {
    // Refund balance on failure
    await db.user.update({ where: { id: user.id }, data: { balance: { increment: amount } } });
    await db.payout.update({ where: { id: payout.id }, data: { status: "FAILED" } });
    return Response.json({ error: "PayPal payout failed. Balance restored." }, { status: 500 });
  }

  return Response.json({ payout });
}
```

### 4. PayPal Payouts API

```typescript
// lib/paypal/create-payout.ts
import paypal from "@paypal/payouts-sdk";

export async function sendPayPalPayout(payout: Payout) {
  const request = new paypal.payouts.PayoutsPostRequest();
  request.requestBody({
    sender_batch_header: {
      sender_batch_id: `webletgpt_${payout.id}`,
      email_subject: "Your WebletGPT earnings have arrived!",
      email_message: "Thank you for creating on WebletGPT.",
    },
    items: [{
      recipient_type: "EMAIL",
      amount: { value: payout.amount.toString(), currency: "USD" },
      receiver: payout.paypalEmail,
      note: `WebletGPT payout - ${payout.id}`,
      sender_item_id: payout.id,
    }],
  });

  return await paypalClient.execute(request);
}
```

### 5. PayPal Webhook (Payout Status Updates)

```typescript
// app/api/webhooks/paypal/route.ts
// Handle: PAYMENT.PAYOUTSBATCH.SUCCESS, PAYMENT.PAYOUTSBATCH.DENIED
export async function POST(req: Request) {
  const body = await req.json();
  // Verify webhook signature with PayPal

  const payoutId = body.resource.sender_batch_header.sender_batch_id.replace("webletgpt_", "");

  if (body.event_type === "PAYMENT.PAYOUTSBATCH.SUCCESS") {
    await db.payout.update({
      where: { id: payoutId },
      data: { status: "COMPLETED", processedAt: new Date() },
    });
  }

  if (body.event_type === "PAYMENT.PAYOUTSBATCH.DENIED") {
    const payout = await db.payout.findUnique({ where: { id: payoutId } });
    // Refund balance
    await db.user.update({
      where: { id: payout.creatorId },
      data: { balance: { increment: payout.amount } },
    });
    await db.payout.update({
      where: { id: payoutId },
      data: { status: "FAILED" },
    });
  }

  return Response.json({ received: true });
}
```

### 6. Transaction History

Full paginated table showing:
- Date
- User email (for subscription payments) or "—" (for payouts)
- Weblet name
- Type: "Subscription" / "Payout" / "Refund"
- Amount (positive for income, negative for payouts)
- Fee (platform fee deducted)
- Net (amount after fee)
- Status badge (pending, completed, failed)

Support CSV export for accounting.

---

## Acceptance Criteria

- [ ] Balance page shows: Available Balance, Pending Balance, Total Earned, Total Withdrawn
- [ ] Balance page shows Number of Paid Users across all weblets
- [ ] PayPal email verification flow works (enter email → get code → verify)
- [ ] Verified PayPal email saved to user profile with `paypalEmailVerified: true`
- [ ] Withdrawal request validates: minimum $10, sufficient balance, no pending payouts
- [ ] Withdrawal request deducts from balance immediately
- [ ] PayPal Payouts API called successfully (sandbox mode)
- [ ] PayPal webhook updates payout status to COMPLETED
- [ ] Failed PayPal payout restores creator's balance
- [ ] Transaction history table shows all payments and payouts
- [ ] Transaction table is paginated (20 per page)
- [ ] Transaction table supports CSV export
- [ ] Payout status badge shows correct state (pending → processing → completed)
- [ ] Creator cannot withdraw if PayPal email is not verified
- [ ] Creator cannot withdraw more than available balance
- [ ] Creator cannot have multiple pending payouts simultaneously

---

## Environment Variables to Add

```env
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
PAYPAL_MODE=sandbox          # "sandbox" or "live"
PAYPAL_WEBHOOK_ID=xxxxx
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PayPal Payouts API approval takes weeks | Start approval process on Day 1 of this segment. Use Sandbox for all development. |
| PayPal webhook verification | Use PayPal's official SDK webhook verification. Never trust unverified webhooks. |
| Race condition: double withdrawal | Check for pending payouts + use database transaction for balance deduction |
| Exchange rates (non-USD creators) | V1: USD only. Note in UI. V2: Add currency conversion. |

---

## Segment 11 Multi Agent


**Estimated effort:** 4 weeks
**Depends on:** Segment 05 (Chat Engine & Tools)
**Produces:** Multi-agent chat interface where weblets collaborate sequentially/concurrently/hybrid with human-in-the-loop, role assignment, auto-team suggestion, and real-time progress

---

## Goal

Build the most advanced module — a multi-agent orchestration system where multiple weblets collaborate on complex tasks. Users can select teams of weblets, assign roles, choose execution modes, and intervene at any point.

This is the client's key differentiator: "the chat user interface enables weblet-to-weblet conversations, human loop in conversations, decisions/roles among weblets, weblets working sequentially, simultaneously or concurrently."

---

## What Already Exists (from Segments 01-05)

```
Chat Engine:
  chatWithWeblet(webletId, messages) → returns AI response with tool calls
  Tool registry resolves capabilities per weblet
  Streaming via SSE (Vercel AI SDK)
Database:
  Weblet — all configs, ChatSession, ChatMessage, AnalyticsEvent
```

**Key reuse:** The existing chat engine's `chatWithWeblet()` function is called per-agent. The orchestrator coordinates multiple calls.

---

## Critical Technical Decisions

### 1. Real-Time Communication

**Problem:** Vercel's serverless architecture does NOT support persistent WebSocket connections. Socket.io is incompatible.

**Solution:** Use **Ably** (managed real-time service) for multi-agent progress updates.

| Use Case | Technology | Why |
|----------|-----------|-----|
| Single chat streaming | SSE via Vercel AI SDK | Already works, native Vercel support |
| Multi-agent progress | Ably (pub/sub) | Managed WebSocket, works on serverless, generous free tier |
| HITL approval | Ably + Server Actions | Publish pause event → client shows UI → client publishes approval → server continues |

**Ably free tier:** 6M messages/month, 200 concurrent connections. More than enough for early stage.

### 2. Bypassing Serverless Timeouts

**Problem:** Vercel has strict execution limits (e.g. 60s for Pro). A multi-agent orchestration workflow involving several LLM calls will almost certainly exceed this and get killed mid-execution.

**Solution:** Use **Inngest** for background job execution. The orchestrator engine runs as an Inngest step function, which can pause and resume indefinitely without hitting Vercel's timeouts.

---

## Files to Create

```
app/(chat)/orchestrate/
├── page.tsx                          ← Multi-agent chat page
└── [sessionId]/page.tsx              ← Resume orchestration session

app/api/orchestrate/
├── route.ts                          ← Start orchestration (POST)
├── approve/route.ts                  ← Human-in-the-loop approval (POST)
└── cancel/route.ts                   ← Cancel running orchestration (POST)

lib/orchestrator/
├── engine.ts                         ← Core orchestration logic (sequential, concurrent, hybrid)
├── planner.ts                        ← Breaks user task into steps + assigns weblets
├── sequential.ts                     ← Execute weblets one after another
├── concurrent.ts                     ← Execute weblets in parallel (Promise.all)
├── hybrid.ts                         ← Mix: some steps sequential, some concurrent
├── roles.ts                          ← Role assignment system for weblets
├── hitl.ts                           ← Human-in-the-loop pause/resume/override
├── auto-suggest.ts                   ← LLM-based team recommendation
├── simulator.ts                      ← Dry-run simulation before execution
└── realtime.ts                       ← Ably pub/sub wrapper for progress events

components/orchestrate/
├── orchestrate-container.tsx         ← Full layout for multi-agent interface
├── task-input.tsx                    ← Task description input + "Optimize & Execute" button
├── agent-selector.tsx                ← Pick weblets for the team (search + select)
├── auto-suggest-panel.tsx            ← Shows AI-recommended team with reasoning
├── role-assignment.tsx               ← Assign roles to selected weblets (dropdown per weblet)
├── execution-mode-toggle.tsx         ← Sequential / Concurrent / Hybrid radio buttons
├── hitl-settings.tsx                 ← Human-in-the-loop configuration
├── agent-timeline.tsx                ← Visual timeline showing step-by-step execution
├── agent-card.tsx                    ← Shows individual agent's status, output, tools used
├── handoff-display.tsx               ← Shows data flowing between agents
├── hitl-approval-dialog.tsx          ← Modal: Review output + Approve / Edit / Reject
├── simulation-preview.tsx            ← Shows planned execution steps before running
└── control-panel.tsx                 ← Execution mode, simulator toggle, HITL settings
```

---

## Implementation Details

### 1. Orchestrator Engine

The core loop that coordinates multiple weblets:

```typescript
// lib/orchestrator/engine.ts
export async function orchestrate(config: OrchestrationConfig) {
  const { task, agents, mode, hitlConfig, sessionId } = config;

  // 1. Plan the execution
  const plan = await createExecutionPlan(task, agents);
  await publishProgress(sessionId, "plan_created", { plan });

  // 2. Execute based on mode
  let results: AgentResult[];
  switch (mode) {
    case "sequential":
      results = await executeSequential(plan.steps, sessionId, hitlConfig);
      break;
    case "concurrent":
      results = await executeConcurrent(plan.steps, sessionId, hitlConfig);
      break;
    case "hybrid":
      results = await executeHybrid(plan.steps, sessionId, hitlConfig);
      break;
  }

  // 3. Compile final output
  const finalOutput = await compileFinalOutput(results, task);
  await publishProgress(sessionId, "completed", { finalOutput });

  // 4. Log analytics
  await logOrchestrationAnalytics(sessionId, config, results);

  return finalOutput;
}
```

### 2. Execution Plan (LLM-Powered)

Use an LLM to break the task into steps and decide which weblets handle each step:

```typescript
// lib/orchestrator/planner.ts
export async function createExecutionPlan(task: string, agents: WebletSummary[]) {
  const result = await generateObject({
    model: openrouter("anthropic/claude-3.5-sonnet"),
    schema: z.object({
      steps: z.array(z.object({
        stepNumber: z.number(),
        description: z.string(),
        agentId: z.string(),
        agentRole: z.string(), // "researcher", "writer", "reviewer", etc.
        dependsOn: z.array(z.number()), // Step numbers this depends on
        canRunConcurrently: z.boolean(),
        requiresHumanApproval: z.boolean(),
      })),
    }),
    prompt: `Given this task: "${task}"
And these available AI agents:
${agents.map(a => `- ${a.name} (${a.id}): ${a.description}`).join("\n")}

Create an execution plan. Break the task into steps, assign each step to the best agent,
identify dependencies between steps, and mark which steps can run concurrently.
Mark steps that produce high-risk or user-facing output as requiring human approval.`,
  });

  return result.object;
}
```

### 3. Sequential Execution

```typescript
// lib/orchestrator/sequential.ts
export async function executeSequential(steps: Step[], sessionId: string, hitl: HITLConfig) {
  const results: AgentResult[] = [];
  let context = ""; // Accumulated context from previous agents

  for (const step of steps) {
    await publishProgress(sessionId, "agent_started", { step });

    // Build message with context from previous agents
    const messages = [
      { role: "user", content: `${step.description}\n\nContext from previous steps:\n${context}` },
    ];

    // Execute the agent
    const result = await chatWithWeblet(step.agentId, messages);
    results.push({ step, output: result });

    await publishProgress(sessionId, "agent_completed", { step, output: result });

    // Human-in-the-loop check
    if (step.requiresHumanApproval || hitl.mode === "always") {
      await publishProgress(sessionId, "hitl_required", { step, output: result });
      const approval = await waitForHumanApproval(sessionId, step.stepNumber);

      if (approval.action === "reject") {
        throw new OrchestrationCanceled("Rejected by human reviewer");
      }
      if (approval.action === "edit") {
        // Re-run step with human's feedback
        const revisedMessages = [...messages, { role: "user", content: approval.feedback }];
        const revised = await chatWithWeblet(step.agentId, revisedMessages);
        results[results.length - 1] = { step, output: revised };
      }
    }

    // Add to context for next agent
    context += `\n\n--- ${step.agentRole} (${step.description}) ---\n${result}`;
  }

  return results;
}
```

### 4. Concurrent Execution

```typescript
// lib/orchestrator/concurrent.ts
export async function executeConcurrent(steps: Step[], sessionId: string, hitl: HITLConfig) {
  // Group steps by dependency level
  const levels = groupByDependencyLevel(steps);

  const results: AgentResult[] = [];

  for (const level of levels) {
    // Execute all steps in this level concurrently
    const levelResults = await Promise.all(
      level.map(async (step) => {
        await publishProgress(sessionId, "agent_started", { step });
        const result = await chatWithWeblet(step.agentId, [
          { role: "user", content: step.description },
        ]);
        await publishProgress(sessionId, "agent_completed", { step, output: result });
        return { step, output: result };
      })
    );

    results.push(...levelResults);

    // HITL check after each level
    if (hitl.mode === "after_each_level") {
      await publishProgress(sessionId, "hitl_required", { level: levelResults });
      await waitForHumanApproval(sessionId, level[0].stepNumber);
    }
  }

  return results;
}
```

### 5. Role System (Was Missing)

The client requires "decisions/roles among weblets." Implement a role assignment system:

```typescript
// lib/orchestrator/roles.ts
export const PREDEFINED_ROLES = [
  { id: "researcher", label: "Researcher", description: "Gathers information and data" },
  { id: "writer", label: "Writer", description: "Creates written content" },
  { id: "reviewer", label: "Reviewer", description: "Reviews and provides feedback" },
  { id: "editor", label: "Editor", description: "Refines and polishes content" },
  { id: "analyst", label: "Analyst", description: "Analyzes data and provides insights" },
  { id: "coder", label: "Coder", description: "Writes and debugs code" },
  { id: "designer", label: "Designer", description: "Creates visual designs" },
  { id: "custom", label: "Custom", description: "User-defined role" },
];

// Role is injected into the agent's system prompt at runtime:
function buildRolePrompt(originalInstructions: string, role: string, taskContext: string) {
  return `${originalInstructions}

YOUR ROLE IN THIS COLLABORATION: ${role}
You are working as part of a team. Focus specifically on your role.
Other agents will handle their own responsibilities.

TASK CONTEXT: ${taskContext}`;
}
```

### 6. Auto-Team Suggestion (Was Missing)

The client says the system should "automatically suggest the best team of weblets":

```typescript
// lib/orchestrator/auto-suggest.ts
export async function suggestTeam(task: string, availableWeblets: WebletSummary[]) {
  const result = await generateObject({
    model: openrouter("anthropic/claude-3.5-sonnet"),
    schema: z.object({
      suggestedTeam: z.array(z.object({
        webletId: z.string(),
        role: z.string(),
        reason: z.string(), // Why this weblet was chosen
      })),
      executionMode: z.enum(["sequential", "concurrent", "hybrid"]),
      reasoning: z.string(), // Overall explanation
    }),
    prompt: `Given this task: "${task}"
And these available weblets:
${availableWeblets.map(w => `- ${w.id}: ${w.name} — ${w.description} (Capabilities: ${JSON.stringify(w.capabilities)})`).join("\n")}

Suggest the optimal team of weblets to accomplish this task.
For each weblet, explain its role and why it was chosen.
Recommend the best execution mode (sequential, concurrent, or hybrid).`,
  });

  return result.object;
}
```

### 7. Simulation Preview (Was Missing)

The client mentions "availability of simulator." Before executing, show a dry-run preview:

```typescript
// lib/orchestrator/simulator.ts
export async function simulateExecution(plan: ExecutionPlan) {
  // Don't actually call LLMs — just show the planned steps
  return {
    steps: plan.steps.map(step => ({
      ...step,
      estimatedTime: estimateStepTime(step), // Based on agent's avg response time
      estimatedTokens: estimateTokens(step),
      estimatedCost: estimateCost(step),
    })),
    totalEstimatedTime: sum(steps.map(s => s.estimatedTime)),
    totalEstimatedCost: sum(steps.map(s => s.estimatedCost)),
    hitlPausePoints: plan.steps.filter(s => s.requiresHumanApproval).length,
  };
}
```

Show this to the user before they click "Execute" so they know what will happen.

### 8. Real-Time Progress via Ably

```typescript
// lib/orchestrator/realtime.ts
import Ably from "ably";

const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export async function publishProgress(sessionId: string, event: string, data: any) {
  const channel = ably.channels.get(`orchestration:${sessionId}`);
  await channel.publish(event, data);
}

// Client-side hook
export function useOrchestrationProgress(sessionId: string) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);

  useEffect(() => {
    const ably = new Ably.Realtime(process.env.NEXT_PUBLIC_ABLY_KEY!);
    const channel = ably.channels.get(`orchestration:${sessionId}`);

    channel.subscribe((msg) => {
      setEvents(prev => [...prev, { type: msg.name, data: msg.data, timestamp: new Date() }]);
    });

    return () => { channel.unsubscribe(); ably.close(); };
  }, [sessionId]);

  return events;
}
```

### 9. Human-in-the-Loop Controls

Three modes (from client requirements):

| Mode | Behavior |
|------|----------|
| **Auto Trigger** | System pauses when confidence is low or output is high-risk (determined by planner) |
| **Manual Review** | Human reviews every agent's output before the next step |
| **Override Required** | Specific steps marked as requiring explicit human approval |

The approval dialog shows:
- Agent name and role
- Full output from the agent
- Three buttons: **Approve** / **Edit & Resubmit** / **Reject**
- Optional feedback text field

---

## Acceptance Criteria

- [ ] User can select 2+ weblets for a multi-agent task
- [ ] Auto-team suggestion: system recommends weblets with reasoning
- [ ] Role assignment: user can assign roles to each weblet from predefined list
- [ ] Execution mode toggle: Sequential / Concurrent / Hybrid
- [ ] Simulation preview shows planned steps, estimated time, and cost before execution
- [ ] Sequential execution: Agent A finishes → output passed to Agent B → etc.
- [ ] Concurrent execution: Independent agents run simultaneously
- [ ] Hybrid execution: Mix of sequential and concurrent based on dependencies
- [ ] Real-time progress via Ably: shows which agent is active, tool calls, completion
- [ ] Agent timeline visualizes step-by-step execution
- [ ] Each agent's output displayed individually with expandable details
- [ ] Human-in-the-loop: Auto Trigger mode pauses at high-risk steps
- [ ] Human-in-the-loop: Manual Review mode pauses after every agent
- [ ] HITL approval dialog: Approve / Edit & Resubmit / Reject buttons
- [ ] Rejected step cancels orchestration with clear message
- [ ] Edit & Resubmit re-runs the agent with human's feedback
- [ ] Data handoff between agents is visible (shows what was passed)
- [ ] Cancel button stops orchestration mid-execution
- [ ] Analytics logged: total agents, execution time, mode, HITL count

---

## Dependencies to Install

```bash
npm install ably                  # Real-time pub/sub
npm install inngest               # Background workflow orchestration
```

---

## Environment Variables to Add

```env
ABLY_API_KEY=xxxxx               # Server-side
NEXT_PUBLIC_ABLY_KEY=xxxxx       # Client-side (publishable)
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM planner creates bad execution plans | Allow users to edit the plan before execution. Show simulation preview. |
| Concurrent agents produce conflicting outputs | Final compilation step (LLM) resolves conflicts and merges outputs |
| Long orchestrations timeout on Vercel | The orchestration engine runs inside an Inngest background workflow, safely bypassing Vercel timeout limits. |
| Ably free tier limits | 6M messages/month is generous. Monitor usage. Upgrade if needed ($29/month). |
| Auto-suggest quality | Include weblet descriptions and capabilities in the prompt. Allow user override. |

---

## Segment 12 Composability Mcp


**Estimated effort:** 3 weeks
**Depends on:** Segment 05 (Chat Engine & Tools)
**Produces:** Weblet composability system (build weblets on top of other weblets) + MCP server integration for extending tool capabilities

---

## Goal

Build two related features that expand the platform's capabilities:

1. **Weblet Composability** — Developers can create new weblets that use other weblets as building blocks. A "Marketing Suite" weblet could compose "Content Writer" + "Image Generator" + "Data Analyzer" weblets.

2. **MCP (Model Context Protocol) Integration** — Creators can connect MCP servers to their weblets, instantly gaining access to tools like GitHub, Slack, Google Drive, databases, etc.

---

## What Already Exists (from Segments 01-05)

```
Database:
  WebletComposition — parentWebletId, childWebletId, config (JSON for input/output mapping)
Chat Engine:
  chatWithWeblet(webletId, messages) — can be called programmatically for any weblet
  Tool Registry — maps capabilities to tool definitions
  Vercel AI SDK — native MCP support via tool definitions
```

---

## Part A: Weblet Composability

### Architecture: 4 Layers

```
Layer 4: Meta-Weblets (orchestrate composites)
    ↑
Layer 3: Composite Weblets (combine base weblets)
    ↑
Layer 2: Base Weblets (single-purpose: writer, analyzer, generator)
    ↑
Layer 1: Infrastructure (APIs, state engine, event bus, auth, payments)
```

### How Composition Works

A composite weblet has:
- Its own system prompt (orchestration instructions)
- References to child weblets (via WebletComposition table)
- A config defining how children are used (input/output mapping, execution order)

At runtime, when a user chats with a composite weblet:
1. The composite's system prompt guides the LLM
2. Child weblets are exposed as tools (the LLM can "call" a child weblet)
3. Each child weblet call runs through the full chat engine (tools, RAG, etc.)
4. Results from children flow back to the composite

### Files to Create

```
app/(dashboard)/builder/[id]/compose/
└── page.tsx                          ← Composition editor (add/remove children, map I/O)

lib/composition/
├── resolver.ts                       ← Resolve child weblet dependencies (detect cycles)
├── child-tool-factory.ts             ← Create tool definitions for child weblets
└── executor.ts                       ← Execute composed weblet chains

components/builder/compose/
├── child-weblet-picker.tsx           ← Search and add child weblets
├── composition-graph.tsx             ← Visual graph showing parent → children relationships
├── io-mapper.tsx                     ← Map parent inputs to child inputs
└── composition-preview.tsx           ← Preview how composition will execute
```

### Implementation Details

**Child Weblets as Tools:**

```typescript
// lib/composition/child-tool-factory.ts
export function createChildWebletTools(compositions: WebletComposition[]) {
  const tools: Record<string, any> = {};

  for (const comp of compositions) {
    const child = comp.childWeblet;
    tools[`weblet_${child.slug}`] = tool({
      description: `Use the "${child.name}" weblet: ${child.description}`,
      parameters: z.object({
        message: z.string().describe("What to ask this weblet"),
      }),
      execute: async ({ message }) => {
        // Call the child weblet through the standard chat engine
        const result = await chatWithWeblet(child.id, [
          { role: "user", content: message },
        ]);
        return { response: result };
      },
    });
  }

  return tools;
}
```

**Runtime integration in chat API:**

```typescript
// In app/api/chat/route.ts — add after existing tool resolution:
if (weblet.compositions.length > 0) {
  const childTools = createChildWebletTools(weblet.compositions);
  Object.assign(tools, childTools);
}
```

**Cycle Detection:**

```typescript
// lib/composition/resolver.ts
export function detectCycles(parentId: string, childId: string): boolean {
  // BFS/DFS to check if adding childId as a child of parentId creates a cycle
  const visited = new Set<string>();
  const queue = [childId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === parentId) return true; // Cycle detected!
    if (visited.has(current)) continue;
    visited.add(current);

    // Get children of current
    const children = await db.webletComposition.findMany({
      where: { parentWebletId: current },
      select: { childWebletId: true },
    });
    queue.push(...children.map(c => c.childWebletId));
  }

  return false;
}
```

**Composition Editor UI:**

The builder gets a new "Compose" tab:
- Search bar to find existing weblets
- Click to add as child
- For each child: show name, description, and a toggle for "required" vs "optional"
- Visual graph showing the composition tree
- Cycle detection: show error if adding a child would create a circular dependency

### Composition Acceptance Criteria

- [ ] Creator can add child weblets to a parent weblet
- [ ] Cycle detection prevents circular dependencies
- [ ] Child weblets appear as callable tools in the parent's chat
- [ ] Calling a child tool runs through the full chat engine (with the child's own tools)
- [ ] Composition graph visualizes parent → children relationships
- [ ] Results from child weblets flow back to the parent conversation
- [ ] Child weblet access respects subscription status (user must have access to children)
- [ ] Compositions can be nested (composite can use another composite)
- [ ] Max depth limit: 3 levels (prevent infinite nesting)

---

## Part B: MCP Server Integration

### What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI models to external tools and data sources. MCP servers expose tools via a standard protocol, and AI SDKs can discover and call these tools automatically.

### How It Works on WebletGPT

Creators add MCP server URLs in the builder. The platform discovers available tools from the server and makes them available to the weblet's LLM at runtime.

### Files to Create

```
components/builder/
├── mcp-tab/
│   ├── mcp-server-list.tsx           ← List of added MCP servers
│   ├── mcp-server-add.tsx            ← Add new MCP server (URL, label, description)
│   └── mcp-tool-browser.tsx          ← Browse discovered tools from MCP server

lib/mcp/
├── discover.ts                       ← Discover tools from MCP server URL
├── tool-factory.ts                   ← Create AI SDK tool definitions from MCP tools
└── config.ts                         ← MCP configuration types
```

### Implementation

**Builder UI: Add MCP Server**

A new "MCP Servers" tab in the builder:

```
┌──────────────────────────────────────────┐
│  MCP Servers                              │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ GitHub MCP                           │ │
│  │ URL: mcp.github.example.com          │ │
│  │ Tools: create_issue, list_repos, ... │ │
│  │ Status: ✓ Connected  [Remove]        │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  [+ Add MCP Server]                       │
│                                           │
│  Server URL: [https://mcp.example.com  ] │
│  Label:      [My Custom Server         ] │
│  Description:[Connects to my database  ] │
│  [Discover Tools]  [Save]                │
└──────────────────────────────────────────┘
```

**Database addition:**
```prisma
// Add to Weblet model or create new model:
model WebletMCPServer {
  id          String @id @default(cuid())
  webletId    String
  weblet      Weblet @relation(fields: [webletId], references: [id], onDelete: Cascade)
  serverUrl   String
  label       String
  description String?
  tools       Json?   // Cached tool definitions discovered from server
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())

  @@unique([webletId, serverUrl])
}
```

**MCP Tool Discovery:**

```typescript
// lib/mcp/discover.ts
export async function discoverMCPTools(serverUrl: string) {
  // Use the MCP client to discover available tools
  // The exact implementation depends on the MCP SDK version
  const response = await fetch(`${serverUrl}/tools`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const tools = await response.json();
  return tools; // Array of { name, description, inputSchema }
}
```

**Runtime Integration:**

```typescript
// lib/mcp/tool-factory.ts
export function createMCPTools(mcpServers: WebletMCPServer[]) {
  const tools: Record<string, any> = {};

  for (const server of mcpServers) {
    if (!server.isActive || !server.tools) continue;

    for (const mcpTool of server.tools as MCPToolDef[]) {
      tools[`mcp_${server.label}_${mcpTool.name}`] = tool({
        description: `[${server.label}] ${mcpTool.description}`,
        parameters: jsonSchemaToZod(mcpTool.inputSchema),
        execute: async (params) => {
          const res = await fetch(`${server.serverUrl}/call`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool: mcpTool.name, arguments: params }),
          });
          return await res.json();
        },
      });
    }
  }

  return tools;
}
```

**Integration in chat API:**
```typescript
// In app/api/chat/route.ts — add after composition tools:
const mcpServers = await db.webletMCPServer.findMany({
  where: { webletId, isActive: true },
});
if (mcpServers.length > 0) {
  const mcpTools = createMCPTools(mcpServers);
  Object.assign(tools, mcpTools);
}
```

### MCP Acceptance Criteria

- [ ] Creator can add MCP server URL in builder
- [ ] "Discover Tools" button fetches available tools from server
- [ ] Discovered tools displayed with name and description
- [ ] Creator can enable/disable individual MCP tools
- [ ] Enabled MCP tools available to the weblet's LLM at runtime
- [ ] MCP tool calls execute correctly and return results
- [ ] Tool results displayed inline in chat (like other tools)
- [ ] Error handling: graceful failure if MCP server is unreachable
- [ ] Cached tool definitions refresh on demand ("Refresh Tools" button)

---

## Dependencies to Install

```bash
npm install @modelcontextprotocol/sdk  # MCP client SDK (if available)
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Child weblet calls are slow (nested LLM calls) | Set timeout per child call (30s). Show "Using [child name]..." loading state. Cache frequent results. |
| MCP servers may be unreachable | Timeout after 10s. Show error inline. Don't block the rest of the conversation. |
| MCP protocol may change | Use official SDK. Pin version. MCP is standardized and unlikely to have breaking changes. |
| Composition depth explosion | Hard limit: 3 levels of nesting. Warn creator if approaching limit. |
| Security: MCP servers could return malicious data | Sanitize MCP responses. Don't render raw HTML. Limit response size (1MB). |

---

## Segment 13 Orchestration Workflows


**Type:** Cross-cutting concern (orchestration, user flows, HITL)
**Depends on:** Segment 05 (Chat Engine), Segment 11 (Multi-Agent), Segment 12 (Composability)
**Referenced by:** Segment 11, Segment 17 (Marketplace)

---

## What This Module Is

This module defines how users and developers create and run multi-weblet workflows. There are two distinct paradigms:

1. **User Flows** — Any authenticated user can combine marketplace weblets into a pipeline. The user defines the sequence. Simple and visual.
2. **Developer Orchestration** — Developers build complex multi-agent systems with LLM-powered planning, conditional logic, and advanced execution modes.

Both paradigms support **Human-in-the-Loop (HITL)** — the ability for a human to pause, review, approve, modify, or reject steps during execution.

> **Example of a User Flow:** Marketing manager Sarah wants to create content for her company blog. She opens the Flow Builder, searches the marketplace, and adds three weblets: "Research Bot" → "Blog Writer" → "SEO Optimizer." She saves this as "Content Pipeline." When she runs it with the task "Write a blog post about AI in healthcare," the Research Bot gathers data, passes it to Blog Writer which drafts the post, and SEO Optimizer refines it for search engines. Sarah reviews the output at each step.

> **Example of Developer Orchestration:** Developer Alex builds a "Customer Support Team" that uses an LLM planner to analyze incoming support tickets and route them to the right specialist weblet — "Technical Support," "Billing Help," or "General FAQ" — based on the ticket content. The master weblet decides in real-time which sub-weblet handles each request.

---

## How It Will Be Done

### Step 1 — Understand the Two Paradigms

**User Flows (simple):**
- Created by any authenticated user (USER or DEVELOPER role)
- Built via a visual drag-and-drop Flow Builder
- Two modes: SEQUENTIAL (A → B → C) and HYBRID (master weblet decides routing)
- Steps are weblets picked from the marketplace
- Stored in the `UserFlow` database model
- No LLM planner — the user defines everything manually

**Developer Orchestration (advanced):**
- Created by developers within the context of a multi-agent setup (Segment 11)
- Uses an LLM-powered planner to decompose tasks and assign weblets
- Three execution modes: Sequential, Concurrent (parallel), and Hybrid
- Supports dynamic task assignment and conditional branching
- More complex HITL with confidence-based gates

> **Why two paradigms?** Users want simplicity — "connect these three weblets in a line." Developers want power — "build a multi-agent team that makes decisions." Separating them keeps the user experience clean while giving developers full control.

### Step 2 — Build the User Flow Builder UI

The Flow Builder is accessible to all authenticated users at `/(user)/flows/`:

**Flow List Page (`/(user)/flows/`):**
- Shows all of the user's saved flows in a card grid
- Each card shows: flow name, step count, mode (Sequential/Hybrid), last run date
- "Create New Flow" button

**Flow Builder Page (`/(user)/flows/new`):**
The builder has three sections:

**Section A — Weblet Picker (left panel):**
- Search bar connected to the marketplace API
- Category filter tabs (from Segment 06)
- Grid of weblet cards showing: name, category, rating, description
- Click a weblet to add it to the flow

**Section B — Flow Canvas (center panel):**
- Visual representation of the flow steps
- For SEQUENTIAL mode: vertical list of step cards connected by arrows
  ```
  ┌─────────────┐
  │ Research Bot │  Step 1 — "Use original input"
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │ Blog Writer  │  Step 2 — "Use output from Step 1" [HITL: ON]
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │ SEO Helper   │  Step 3 — "Use output from Step 2"
  └─────────────┘
  ```
- For HYBRID mode: a master weblet at the top, sub-weblets below
  ```
  ┌──────────────────┐
  │  Master Weblet    │  Decides which sub-weblet to call
  └────────┬─────────┘
       ┌───┼───┐
       ↓   ↓   ↓
  ┌────┐ ┌────┐ ┌────┐
  │ A  │ │ B  │ │ C  │  Available sub-weblets
  └────┘ └────┘ └────┘
  ```
- Drag-and-drop to reorder steps (sequential only)
- Click a step to configure it

**Section C — Step Configuration (right panel, appears when a step is selected):**
- Input mapping: "Use original user input" or "Use output from Step N"
- HITL gate: Toggle "Pause for my review before this step"
- Remove step button

### Step 3 — Define the Sequential Flow Execution

When a user runs a SEQUENTIAL flow:

```
User enters task: "Write a blog post about AI in healthcare"
  ↓
Step 1: Research Bot
  Input: "Write a blog post about AI in healthcare" (original)
  → AI researches the topic, returns findings
  Output: "Key findings: AI in diagnostics is growing 40%..."
  ↓
[HITL Gate — if enabled]
  User reviews Research Bot's output
  Options: Approve | Modify | Reject | Skip
  ↓
Step 2: Blog Writer
  Input: Research Bot's output (previous step)
  → AI writes the blog post using the research
  Output: "# AI in Healthcare: 5 Trends..." (full blog post)
  ↓
Step 3: SEO Optimizer
  Input: Blog Writer's output (previous step)
  → AI optimizes for SEO
  Output: "# AI in Healthcare: 5 Trends..." (SEO-optimized version)
  ↓
Final output presented to user
```

**State machine for each step:**
```
PENDING → RUNNING → COMPLETED → (next step)
                  → HITL_WAITING → APPROVED → COMPLETED
                                 → MODIFIED → RUNNING (re-run with modified input)
                                 → REJECTED → FAILED
                                 → SKIPPED → (next step with previous output)
                  → FAILED → RETRYING → RUNNING
                           → FAILED (permanent — user decides: skip or cancel)
```

**State machine for the entire flow:**
```
CREATED → RUNNING → COMPLETED (all steps done)
                  → PAUSED (HITL waiting)
                  → FAILED (unrecoverable step failure)
                  → CANCELED (user canceled)
```

### Step 4 — Define the Hybrid / Master Weblet Routing

In HYBRID mode, a "master weblet" decides which sub-weblet to call:

1. The user selects a master weblet and a set of available sub-weblets
2. At runtime, the sub-weblets are exposed as tools to the master weblet's LLM
3. The master weblet analyzes the user's task and decides which sub-weblet(s) to call
4. The master can call multiple sub-weblets in sequence, combine their outputs, and present a unified response
5. The master can also decide NOT to call any sub-weblet and respond directly

> **Example:** The master weblet is "Customer Support Router." Sub-weblets are "Technical Support," "Billing Help," and "General FAQ." A user writes "I can't log in and I was charged twice." The master recognizes two issues: it calls Technical Support for the login issue, then Billing Help for the charge issue, and combines both responses into a single answer.

**How sub-weblets become tools:**
Each sub-weblet is registered as a callable tool with:
- Tool name: the sub-weblet's name (slugified)
- Tool description: the sub-weblet's description (tells the master when to use it)
- Tool input: the task/question to delegate
- Tool execution: runs the full chat engine for the sub-weblet (same as a regular chat)

This reuses the composability infrastructure from Segment 12 — child weblets as tools.

### Step 5 — Design Human-in-the-Loop (HITL) in Detail

HITL allows humans to intervene during flow execution. There are three types of gates and four types of responses.

**Gate Types:**

| Gate Type | When It Triggers | Use Case |
|-----------|-----------------|----------|
| **Pre-step** | Before a step runs. User reviews the planned input. | "Let me check what's being sent to the next weblet" |
| **Post-step** | After a step runs. User reviews the output. | "Let me verify this output before passing it along" |
| **Confidence-based** | System auto-pauses when it detects uncertainty | "The AI seems unsure about this — please review" (future, advanced) |

**Response Types:**

| Response | What Happens | Example |
|----------|-------------|---------|
| **Approve** | Flow continues to the next step | "This research looks good, proceed to writing" |
| **Modify** | User edits the output. Modified version is passed to the next step. | "Change the tone to be more professional" — user edits the text |
| **Reject with Feedback** | The step is re-run with the user's feedback appended to the input | "This missed the key point about pricing. Focus on pricing." — step re-runs |
| **Escalate** | The flow pauses permanently. The task is flagged in the admin escalation queue. | "This is too sensitive for AI. A human specialist needs to handle this." |

**HITL UI — The Approval Dialog:**

```
┌────────────────────────────────────────────────────────┐
│  Step 2: Blog Writer                    ⏱ Paused 2m    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Output from Blog Writer:                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ # AI in Healthcare: 5 Trends Reshaping Medicine  │  │
│  │                                                    │  │
│  │ Artificial intelligence is transforming...        │  │
│  │ [full output shown, scrollable]                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Approve  │ │  Modify  │ │  Reject  │ │ Escalate │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                        │
│  [Cancel entire flow]                                  │
└────────────────────────────────────────────────────────┘
```

**Timeout:** If no response within 30 minutes (configurable), the flow auto-cancels. A notification is sent.

**Audit trail:** Every HITL interaction is logged to the `AnalyticsEvent` table with eventType `hitl_decision`, including: step number, decision type, original output, modified output (if applicable), and response time.

### Step 6 — Real-Time Progress Updates

During flow execution, the user sees real-time progress via Ably pub/sub:

```
┌────────────────────────────────────────┐
│  Running: Content Pipeline             │
│                                        │
│  ✅ Step 1: Research Bot      Done     │
│  ⏳ Step 2: Blog Writer     Running... │
│  ⬜ Step 3: SEO Optimizer    Pending   │
│                                        │
│  [Cancel Flow]                         │
└────────────────────────────────────────┘
```

Each step card shows:
- Step number and weblet name
- Status icon: ⬜ Pending, ⏳ Running, ⏸ Paused (HITL), ✅ Completed, ❌ Failed
- Execution time
- Expandable output (click to see what the step produced)

Updates are pushed via Ably channels:
- Channel: `flow:{flowId}`
- Events: `step:started`, `step:completed`, `step:failed`, `step:hitl_waiting`, `flow:completed`, `flow:failed`

### Step 7 — Error Handling and Recovery

**When a step fails:**
1. Auto-retry once with the same input
2. If retry fails: pause the flow and show the error to the user
3. User can: Fix the input and retry, Skip this step (next step gets the previous step's output), or Cancel the flow

**When the Ably connection drops:**
1. Auto-reconnect with exponential backoff
2. On reconnect, fetch the current flow state from the server
3. Replay any missed events

**When a step times out (30 seconds default):**
1. Mark the step as failed
2. Show the user: "Step timed out. Retry or skip?"

---

## Files Summary

```
app/(user)/flows/
├── page.tsx                      ← List user's saved flows
├── new/page.tsx                  ← Flow Builder (create new flow)
└── [id]/
    ├── page.tsx                  ← Run/view a saved flow
    └── edit/page.tsx             ← Edit flow configuration

components/flows/
├── flow-builder.tsx              ← Main builder with 3 panels
├── weblet-picker.tsx             ← Marketplace search panel for adding weblets
├── flow-canvas.tsx               ← Visual flow representation (sequential or hybrid)
├── step-card.tsx                 ← Individual step in the canvas
├── step-config.tsx               ← Step configuration panel (input mapping, HITL)
├── flow-runner.tsx               ← Execute flow with real-time progress
├── flow-progress.tsx             ← Real-time progress display
├── hitl-dialog.tsx               ← HITL approval dialog (approve/modify/reject/escalate)
└── flow-output.tsx               ← Final aggregated output display

lib/orchestrator/
├── flow-executor.ts              ← Execute UserFlow (sequential and hybrid modes)
├── master-router.ts              ← Master weblet routing for hybrid mode
├── state.ts                      ← Orchestration state management
├── hitl.ts                       ← Human-in-the-loop logic and timeout handling
└── realtime.ts                   ← Ably pub/sub wrapper for flow updates
```

---

## After This Module Is Implemented, Users Will Be Able To

1. **Create flows** by picking weblets from the marketplace and arranging them in sequence
2. **Choose hybrid mode** where a master weblet decides routing automatically
3. **Set HITL gates** on any step to review outputs before continuing
4. **Run flows** and watch real-time progress as each step executes
5. **Approve, modify, reject, or escalate** at HITL gates
6. **Save and reuse flows** — run the same pipeline with different inputs
7. **Recover from errors** — retry failed steps, skip them, or cancel

---

## Connections to Other Segments

- **Segment 03** — `UserFlow` database model stores flow configurations
- **Segment 05** — `chatWithWeblet()` function runs each step (same chat engine)
- **Segment 11** — Advanced orchestration (LLM planner, concurrent execution) for developer use
- **Segment 12** — Composability infrastructure reused for master weblet tool calls
- **Segment 17** — Marketplace weblet picker reused in the flow builder
- **Segment 07** — Flow billing (users need subscriptions to paid weblets in the flow)


---

## Segment 14 Rsil


**Estimated effort:** 3 weeks
**Depends on:** Segment 05 (Chat Engine) + Segment 09 (Dashboard)
**Produces:** Automated prompt optimization system with data collection, variant generation, A/B testing, statistical analysis, auto-deployment, rollback, and governance

---

## Goal

Build the RSIL engine — an automated system that continuously improves weblet performance by:
1. Collecting performance data from every chat interaction
2. Analyzing patterns to identify weaknesses
3. Using GPT-4o to generate improved prompt variants
4. A/B testing variants with real traffic
5. Auto-deploying winners and rolling back regressions

This is the client's unique selling point: "organizations can achieve statistically significant performance improvements at scale without manual intervention."

---

## What Already Exists (from Segments 01-08)

```
Chat Engine (Segment 05):
  - getActiveVersion(webletId, userId) — STUB that returns default version. You implement the real one.
  - logChatAnalytics() — logs to AnalyticsEvent on every chat completion
  - Rating dialog — users rate conversations 1-5 stars → saved as AnalyticsEvent

Database:
  - WebletVersion — versionNumber, instructions, configSnapshot, performanceScore, status, trafficPct
  - AnalyticsEvent — eventType, metadata (tokens, rating, tools, versionId, userMessage, abandoned)

Dashboard (Segment 09):
  - Per-weblet analytics page exists. You add an "Optimize" tab.
```

**You need to implement:**
1. Real `getActiveVersion()` with hash-based traffic splitting
2. Enhanced analytics collection (abandonment detection, topic extraction)
3. The optimizer (analyzes data → generates new prompts)
4. A/B testing engine (traffic split, statistical significance)
5. Auto-deploy + rollback logic
6. Governance configuration
7. Creator UI for the optimize tab

---

## Files to Create

```
lib/rsil/
├── collector.ts            ← Enhanced metrics collection (beyond basic analytics)
├── analyzer.ts             ← Identifies patterns and weaknesses from metrics
├── generator.ts            ← Uses GPT-4o to generate improved prompt variants
├── ab-test.ts              ← Traffic splitting + statistical significance testing
├── deployer.ts             ← Gradual rollout (10% → 25% → 50% → 100%) + rollback
├── governance.ts           ← Configurable rules: max frequency, min data threshold, approval required
└── scheduler.ts            ← Inngest background workflow for optimization cycles

app/(dashboard)/weblets/[id]/optimize/
└── page.tsx                ← RSIL dashboard for a weblet

app/api/rsil/
├── run/route.ts            ← Manually trigger optimization for a weblet
├── evaluate/route.ts       ← Evaluate running A/B test
├── rollback/route.ts       ← Rollback to a previous version
└── config/route.ts         ← Get/set RSIL governance configuration

components/rsil/
├── optimize-toggle.tsx     ← "Enable Auto-Optimize" switch
├── version-history.tsx     ← Table: V1 → V2 → V3 with scores, traffic %, status
├── ab-test-status.tsx      ← Shows active A/B test: control vs variant with live metrics
├── optimization-log.tsx    ← Log entries: "V3 improved rating by 18% by adding healthcare examples"
├── rollback-button.tsx     ← One-click rollback with confirmation dialog
├── governance-config.tsx   ← Configuration panel for optimization rules
└── performance-chart.tsx   ← Line chart showing performance score over versions
```

---

## Implementation Details

### 1. Real getActiveVersion() — Hash-Based Traffic Splitting

Replace the Segment 05 stub with deterministic A/B routing:

```typescript
// lib/rsil/ab-test.ts
import { createHash } from "crypto";

export async function getActiveVersion(webletId: string, userId: string) {
  const versions = await db.webletVersion.findMany({
    where: { webletId, status: { in: ["ACTIVE", "TESTING"] } },
    orderBy: { versionNumber: "asc" },
  });

  if (versions.length === 0) return null; // Use weblet.instructions default
  if (versions.length === 1) return versions[0]; // No A/B test active

  // Deterministic bucket: same user always gets same version
  const hash = createHash("md5").update(`${userId}:${webletId}`).digest("hex");
  const bucket = parseInt(hash.slice(0, 8), 16) % 100; // 0-99

  let cumulative = 0;
  for (const version of versions) {
    cumulative += version.trafficPct;
    if (bucket < cumulative) return version;
  }

  return versions[0]; // Fallback to control
}
```

### 2. Enhanced Data Collection

Add to the existing `logChatAnalytics()`:

```typescript
// lib/rsil/collector.ts
export async function collectRSILMetrics(sessionId: string, webletId: string, versionId: string) {
  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });

  const metrics = {
    versionId,
    messageCount: session.messages.length,
    userMessages: session.messages.filter(m => m.role === "user").map(m => m.content),
    abandoned: detectAbandonment(session), // No user message for 5+ minutes after last assistant msg
    topicKeywords: extractTopics(session.messages), // TF-IDF or LLM-based extraction
    toolCallSuccess: analyzeToolSuccess(session.messages), // Did tool calls return useful results?
    responseLatency: calculateLatency(session.messages), // Avg time between user msg and first assistant token
  };

  await db.analyticsEvent.create({
    data: {
      webletId,
      eventType: "rsil_metrics",
      metadata: metrics,
      versionId,
    },
  });
}

function detectAbandonment(session: ChatSession): boolean {
  const lastAssistantMsg = session.messages.findLast(m => m.role === "assistant");
  const lastUserMsg = session.messages.findLast(m => m.role === "user");
  if (!lastAssistantMsg || !lastUserMsg) return false;

  // If the last message is from assistant and session hasn't been touched in 5 min
  return lastAssistantMsg.createdAt > lastUserMsg.createdAt &&
    Date.now() - lastAssistantMsg.createdAt.getTime() > 5 * 60 * 1000;
}
```

### 3. Variant Generator (The "Ruthless Critic")

The core of RSIL uses the 5-point Starter Kit Evaluation Rubric to score the current AI performance.

```typescript
// lib/rsil/analyzer.ts
export async function evaluatePerformance(webletId: string): Promise<{ score: number, decision: "NONE" | "SUGGESTION" | "AUTO_UPDATE", evaluation: string }> {
  // Gather last 24 hours of messages tagged with the current prompt version
  // ...fetch metrics logic...

  const result = await generateText({
    model: openai("gpt-4o"),
    system: `You are a RUTHLESS AI performance critic. Evaluate the AI's responses against this 5-point Rubric:
1. Completeness (25%): Did the AI fully answer the prompt?
2. Depth (25%): Does the response show subject matter expertise?
3. Tone (20%): Does the tone match the weblet's defined persona?
4. Scope (15%): Did the AI stay within its defined boundaries/guardrails?
5. Missed Opportunities (15%): Did the AI anticipate follow-up needs?

Score the overall performance out of 5.0. Be extremely harsh.
Format:
SCORE: [0.0 - 5.0]
ANALYSIS: [Why you gave this score]`,
    prompt: `RECENT CONVERSATIONS: ...`,
  });

  const score = extractScore(result.text); // Extract float from SCORE line
  
  // The 3-Tier Decision Matrix:
  let decision = "NONE";
  if (score < 3.0) decision = "AUTO_UPDATE";
  else if (score >= 3.0 && score < 4.0) decision = "SUGGESTION";

  return { score, decision, evaluation: result.text };
}

// lib/rsil/generator.ts
export async function generateVariant(webletId: string, evaluationText: string): Promise<string> {
  const weblet = await db.weblet.findUnique({ where: { id: webletId } });

  const result = await generateText({
    model: openai("gpt-4o"),
    system: `You are an expert prompt engineer. You just gave this AI a failing grade.
Generate a new, improved system prompt that directly fixes your criticisms.
Rules:
- Keep the core persona and purpose identical
- Add specific examples for areas where performance is low
- Add guardrails for common failure modes
- Return ONLY the improved system prompt text`,
    prompt: `CURRENT PROMPT:\n${weblet.instructions}\n\nRUTHLESS EVALUATION:\n${evaluationText}`,
  });

  return result.text;
}
```

### 4. Statistical Significance Testing

```typescript
// lib/rsil/ab-test.ts
export function isStatisticallySignificant(
  control: { good: number; total: number },
  variant: { good: number; total: number }
): { significant: boolean; zScore: number; pValue: number; winner: "control" | "variant" | "none" } {
  const p1 = control.good / control.total;
  const p2 = variant.good / variant.total;

  const pooled = (control.good + variant.good) / (control.total + variant.total);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / control.total + 1 / variant.total));

  if (se === 0) return { significant: false, zScore: 0, pValue: 1, winner: "none" };

  const zScore = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore))); // Two-tailed test

  return {
    significant: pValue < 0.05,
    zScore,
    pValue,
    winner: pValue < 0.05 ? (p2 > p1 ? "variant" : "control") : "none",
  };
}

// "Good" = rating >= 4 OR completed without abandonment
function getMetricsForVersion(webletId: string, versionId: string, since: Date) {
  const events = await db.analyticsEvent.findMany({
    where: { webletId, versionId, createdAt: { gte: since } },
  });

  return {
    good: events.filter(e => {
      const meta = e.metadata as any;
      return (meta.rating && meta.rating >= 4) || (!meta.abandoned && meta.messageCount >= 2);
    }).length,
    total: events.length,
  };
}
```

### 5. Deployment & Rollback

```typescript
// lib/rsil/deployer.ts
export async function promoteVariant(webletId: string, versionId: string) {
  // Gradual rollout: set winner to 100%, archive old
  await db.$transaction([
    // Archive all current ACTIVE versions
    db.webletVersion.updateMany({
      where: { webletId, status: "ACTIVE" },
      data: { status: "ARCHIVED", trafficPct: 0 },
    }),
    // Promote winner
    db.webletVersion.update({
      where: { id: versionId },
      data: { status: "ACTIVE", trafficPct: 100, deployedAt: new Date() },
    }),
  ]);

  // Log the promotion
  await db.analyticsEvent.create({
    data: {
      webletId,
      eventType: "rsil_promoted",
      metadata: { versionId, reason: "A/B test winner" },
    },
  });
}

export async function rollback(webletId: string) {
  const current = await db.webletVersion.findFirst({
    where: { webletId, status: "ACTIVE" },
    orderBy: { versionNumber: "desc" },
  });

  const previous = await db.webletVersion.findFirst({
    where: { webletId, versionNumber: { lt: current.versionNumber }, status: "ARCHIVED" },
    orderBy: { versionNumber: "desc" },
  });

  if (!previous) throw new Error("No previous version to rollback to");

  await db.$transaction([
    db.webletVersion.update({
      where: { id: current.id },
      data: { status: "ROLLED_BACK", trafficPct: 0 },
    }),
    db.webletVersion.update({
      where: { id: previous.id },
      data: { status: "ACTIVE", trafficPct: 100, deployedAt: new Date() },
    }),
  ]);
}
```

### 6. Governance Configuration

Configurable rules per weblet to ensure safety and control API costs:

```typescript
// lib/rsil/governance.ts
export interface RSILGovernance {
  enabled: boolean;
  minInteractionsBeforeOptimize: number; // Default: 100. Don't optimize with too little data.
  optimizationFrequency: "daily" | "weekly" | "manual"; // How often to run
  cooldownHours: number; // Default: 6. Hours to wait before allowing another generation to prevent endless loops.
  maxUpdatesPerDay: number; // Default: 3. Hard cap on A/B tests launched per day.
  minTestDuration: number; // Minimum hours for A/B test (default: 48)
  maxConcurrentTests: number; // Default: 1. Only one A/B test at a time.
  requireCreatorApproval: boolean; // If true, EVERYTHING becomes a "Suggestion" instead of Auto-Update
  performanceFloor: number; // If rating drops below this, auto-rollback (default: 3.0)
  maxVersionsToKeep: number; // Default: 10. Archive old versions.
}
```

### 7. Scheduler (Inngest Workflow)

```typescript
// Run via Inngest background workflow to avoid Vercel timeouts
// Schedule: Every 24 hours
export const rsilScheduledRun = inngest.createFunction(
  { id: "rsil-scheduled-run" },
  { cron: "0 0 * * *" }, // Run at midnight
  async ({ step }) => {
    const weblets = await step.run("fetch-active-weblets", async () => {
      return db.weblet.findMany({
        where: { rsilEnabled: true, isActive: true },
      });
    });

    for (const weblet of weblets) {
      await step.run(`optimize-weblet-${weblet.id}`, async () => {
        const governance = weblet.rsilGovernance as RSILGovernance;

    // Check if enough data
    const recentEvents = await db.analyticsEvent.count({
      where: { webletId: weblet.id, createdAt: { gte: subDays(new Date(), 7) } },
    });
    if (recentEvents < governance.minInteractionsBeforeOptimize) continue;

    // Check for running A/B test — evaluate it
    const runningTest = await db.webletVersion.findFirst({
      where: { webletId: weblet.id, status: "TESTING" },
    });
    if (runningTest) {
      await evaluateABTest(weblet.id, runningTest.id);
      continue; // Don't start new optimization while test is running
    }

    // Generate new variant based on Decision Matrix
    const { score, decision, evaluation } = await evaluatePerformance(weblet.id);
    
    // Log the reflection
    await db.reflectionLog.create({ data: { webletId: weblet.id, score, decision, evaluation } });

    if (decision === "NONE") continue; // Score > 4.0, doing great.
    
    const newInstructions = await generateVariant(weblet.id, evaluation);

    if (decision === "SUGGESTION" || governance.requireCreatorApproval) {
      // Score 3.0 - 3.9 -> Queue for Human Review in the Dashboard
      await db.rsilSuggestion.create({
        data: { webletId: weblet.id, suggestedInstructions: newInstructions, reason: evaluation }
      });
      continue;
    }

    // decision === "AUTO_UPDATE" (Score < 3.0) -> Start A/B test
    const currentVersion = await db.webletVersion.findFirst({
      where: { webletId: weblet.id, status: "ACTIVE" },
      orderBy: { versionNumber: "desc" },
    });

    await db.webletVersion.create({
      data: {
        webletId: weblet.id,
        versionNumber: (currentVersion?.versionNumber || 0) + 1,
        instructions: newInstructions,
        configSnapshot: weblet,
        status: "TESTING",
        trafficPct: 50, // 50/50 split
      },
    });

    // Reduce control traffic to 50%
    if (currentVersion) {
      await db.webletVersion.update({
        where: { id: currentVersion.id },
        data: { trafficPct: 50 },
      });
    }
      }); // End step.run
    }
  }
); // End inngest.createFunction
```

**Database addition needed:**
```prisma
// Add to Weblet model:
rsilEnabled     Boolean @default(false)
rsilGovernance  Json?   // RSILGovernance config
```

---

## Creator UI: Optimize Tab

```
┌──────────────────────────────────────────────────┐
│  Optimization  [Enable Auto-Optimize: ON ●]       │
├──────────────────────────────────────────────────┤
│  Current Version: V4  │  Score: 8.3/10            │
│  Status: Active (100% traffic)                    │
├──────────────────────────────────────────────────┤
│  📊 Active A/B Test                               │
│  ┌─────────────┬─────────────┐                   │
│  │ Control (V4) │ Variant (V5) │                   │
│  │ 50% traffic  │ 50% traffic  │                   │
│  │ Rating: 4.2  │ Rating: 4.5  │                   │
│  │ 234 sessions │ 228 sessions │                   │
│  │              │ p = 0.032 ✓  │                   │
│  └─────────────┴─────────────┘                   │
│  [Promote V5 Now]  [End Test]                     │
├──────────────────────────────────────────────────┤
│  Version History                                   │
│  V4 ★8.3  Active    Feb 10  "Added healthcare..." │
│  V3 ★7.8  Archived  Feb 3   "Improved greetings"  │
│  V2 ★7.1  Archived  Jan 25  "Clarified pricing"   │
│  V1 ★6.5  Archived  Jan 15  "Initial version"     │
│                                     [Rollback ↩]  │
├──────────────────────────────────────────────────┤
│  ⚙ Governance Settings                            │
│  Min data before optimize: [100] interactions      │
│  Frequency: [Weekly ▼]                             │
│  Min test duration: [48] hours                     │
│  Require approval: [OFF]                           │
│  Auto-rollback below: [3.0] rating                │
│  [Run Optimization Now]                            │
└──────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] `getActiveVersion()` routes traffic deterministically (same user → same version)
- [ ] A/B test splits traffic correctly (50/50 or configured ratio)
- [ ] Metrics collected per version: rating, completion rate, abandonment, tool success
- [ ] Optimizer generates improved prompt variants using GPT-4o
- [ ] Statistical significance correctly calculated (p < 0.05 threshold)
- [ ] Winning variant auto-promoted to 100% traffic
- [ ] Losing variant discarded, new variant generated on next cycle
- [ ] One-click rollback restores previous version instantly
- [ ] Governance settings configurable per weblet
- [ ] Auto-rollback triggers when rating drops below floor
- [ ] Scheduled optimization runs via Inngest background workflow
- [ ] Version history shows all versions with scores and changelog
- [ ] Optimization log explains what changed and why
- [ ] Creator can enable/disable auto-optimization
- [ ] Creator can manually trigger optimization
- [ ] Creator can require approval before auto-deploy
- [ ] Performance chart shows score progression across versions

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Not enough data for statistical significance | Governance rule: min 100 interactions before optimizing. Show "insufficient data" in UI. |
| GPT-4o generates worse prompts | A/B testing catches regressions. Auto-rollback if performance drops. |
| Optimization costs (GPT-4o calls) | One GPT-4o call per optimization cycle (daily/weekly). Cost: ~$0.05 per run. Negligible. |
| Too many versions | Governance rule: max 10 versions kept. Auto-archive oldest. |

---

## Segment 15 Observability Evals


**Estimated effort:** 1 week
**Depends on:** Segment 05 (Chat Engine), Segment 09 (Developer Dashboard), Segment 15 (RSIL)
**Produces:** Deep integration with Langfuse for tracing LLM execution, managing prompts, and running automated evaluations (Evals).

---

## Goal

While the `UsageRecord` database table (Segment 14) is perfect for billing, developers need a way to **debug** and **evaluate** their weblets. 

If a composite weblet fails, or if a user complains about a hallucination, the developer needs to see the exact execution trace: *What was the system prompt? What tools were called? What did the tools return? How long did the OpenRouter API call take?*

Furthermore, the Recursive Self-Improving Loop (RSIL - Segment 15) requires a way to score conversations automatically based on a rubric. 

To solve this without reinventing the wheel, we will integrate **Langfuse**, an open-source LLM observability and evaluation platform that integrates natively with the Vercel AI SDK.

---

## What Langfuse Provides to WebletGPT

1.  **Tracing & Observability:** Captures the full lifecycle of every chat request, including raw prompts, LLM parameters, latency, tool calls, and tool outputs.
2.  **Prompt Management:** Allows storing and versioning system prompts outside of the main codebase (useful for A/B testing in RSIL).
3.  **Evaluations (Evals):** Automated scoring of LLM outputs (e.g., scoring a response 1-5 for accuracy, tone, or helpfulness).
4.  **Cost Tracking Validation:** While WebletGPT uses `UsageRecord` for user/developer billing, Langfuse provides an independent dashboard to monitor raw OpenRouter costs and token usage for platform admins.

---

## How It Will Be Done

### Step 1 — Setup Langfuse in the Vercel AI SDK

Langfuse provides a native Vercel AI SDK wrapper. We will wrap the core OpenRouter calls in Segment 05.

**Integration in `lib/chat/engine.ts`:**

Instead of calling `streamText` directly, we wrap the AI SDK call with Langfuse's tracing wrapper. We pass custom tags to Langfuse so we can filter traces later:

```typescript
// Example Implementation Strategy
import { observeOutput } from "@langfuse/node";

// When calling the AI SDK in POST /api/chat:
const result = await streamText({
    model: openrouter(weblet.modelId),
    messages,
    tools,
    // Add telemetry data for Langfuse
    experimental_telemetry: {
        isEnabled: true,
        functionId: `weblet-${weblet.id}`,
        metadata: {
            developerId: weblet.developerId,
            userId: user.id,
            sessionId: sessionId,
            webletVersion: activeVersion.id
        }
    }
});
```

*Note: The Vercel AI SDK `experimental_telemetry` feature automatically sends OpenTelemetry data to Langfuse when the `LANGFUSE_OTEL_EXPORTER_OTLP_ENDPOINT` env var is present.*

### Step 2 — Exposing Traces to Developers (Dashboard Integration)

Developers should not need to log into the main Langfuse platform (which is for platform admins). Instead, we will fetch specific traces from the Langfuse API and display them in the Developer Dashboard (Segment 09).

**Updates to Developer Dashboard (`app/(dashboard)/weblets/[id]/analytics/page.tsx`):**
Add a new tab called **"Execution Logs"**.

When a developer clicks on a specific chat session, we query the Langfuse API to fetch the trace for that `sessionId`.

**What the developer sees:**
*   A timeline view of the execution.
*   **Step 1:** The exact System Prompt injected by the system.
*   **Step 2:** The user's message.
*   **Step 3:** The LLM's decision to call a tool (e.g., `webSearch`).
*   **Step 4:** The JSON payload returned by Tavily (the search results).
*   **Step 5:** The final markdown response generated by the LLM.

This is critical for debugging Composability (Segment 12), where a parent weblet calls a child weblet. The trace will visually show the nested execution.

### Step 3 — Automated Evaluations (Evals) for RSIL

In Segment 15 (RSIL), the system automatically grades conversations on a 5-point rubric. We will use Langfuse's **Model-Based Evaluations** feature to execute this, rather than writing bespoke background jobs.

**How Evals Work:**
1.  A user completes a chat session.
2.  The trace is sent to Langfuse.
3.  Langfuse triggers an evaluation job (using a cheaper model like `gpt-4o-mini`) based on the prompt: *"Score this conversation on a scale of 1-5 for helpfulness. Ignore the prompt, focus on the user's intent."*
4.  Langfuse attaches a `score` to the trace.
5.  Our Inngest cron job (Segment 15) queries the Langfuse API daily: *"Get all traces for Weblet X where the Eval Score is < 4.0."*
6.  The RSIL optimizer uses those low-scoring traces to generate a better system prompt.

### Step 4 — User Feedback Synchronization

In Segment 05, users can rate a conversation 1-5 stars.
When a user submits a rating, we will log it to our `AnalyticsEvent` table as planned, but we will *also* push it to Langfuse using their `/scores` API endpoint.

```typescript
// When user rates the chat:
await langfuse.score({
    traceId: traceId,
    name: "user_rating",
    value: ratingPercentage, // e.g., 5 stars = 1.0, 1 star = 0.2
    comment: userFeedbackText
});
```
This allows platform admins to look at Langfuse and instantly sort all platform traffic by "worst user feedback" to identify failing models or bad weblets.

---

## Environmental Variables to Add

```env
# Langfuse connection details
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASEURL=https://us.cloud.langfuse.com
# Enables automatic OpenTelemetry export from Vercel AI SDK
LANGFUSE_OTEL_EXPORTER_OTLP_ENDPOINT=https://us.cloud.langfuse.com/api/public/otel
```

---

## Files to Create / Modify

```
lib/observability/
├── langfuse.ts                   ← Langfuse client initialization
└── fetch-traces.ts               ← Functions to fetch specific developer traces from Langfuse API

app/(dashboard)/weblets/[id]/logs/
├── page.tsx                      ← New "Execution Logs" tab in Dev Dashboard
└── [traceId]/page.tsx            ← Detailed view of a single trace (prompt, tools, latency)
```

**Files to Update:**
*   `lib/chat/engine.ts`: Add `experimental_telemetry` to the `streamText` calls.
*   `components/chat/rating-dialog.tsx`: Update the submit function to send the score to the Langfuse API.
*   `segments/TECH_STACK.md`: Add Langfuse to the stack.
*   `segments/segment-05-chat-engine-tools.md`: Mention telemetry wrapper.
*   `segments/segment-08-developer-dashboard.md`: Add the "Execution Logs" tab.

---

## Acceptance Criteria

- [ ] Langfuse environment variables are configured.
- [ ] Vercel AI SDK `streamText` calls inject standard telemetry data.
- [ ] Every chat session generates a trace in the Langfuse cloud dashboard, containing `webletId`, `developerId`, and `sessionId`.
- [ ] Tool calls (e.g., Tavily, DALL-E) and their raw JSON results are visible in the Langfuse trace.
- [ ] User 1-5 star ratings are successfully sent via the Langfuse `/scores` API and attached to the correct trace.
- [ ] **Developer Dashboard:** Developers can view a list of recent chat sessions for their weblets in the new "Execution Logs" tab.
- [ ] **Developer Dashboard:** Clicking a session shows a simplified timeline of the trace (System Prompt → User Message → Tool Calls → Response).
- [ ] Developers CANNOT see traces for weblets they do not own (security check).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Langfuse API goes down | The Vercel AI SDK telemetry is non-blocking. If telemetry fails, the core chat experience (streaming to the user) must still work perfectly. |
| Exposing PII to Developers | Traces in the Developer Dashboard should redact the user's name/email. Only the `userId` (CUID) should be visible to developers. |
| Cost of tracking every token | Open-source Langfuse or Langfuse Cloud is very cheap compared to LLM API costs. Retention can be set to 30 days to manage database size. |
| Slowing down chat response | OpenTelemetry exporting happens asynchronously in the background via the Vercel AI SDK. It does not add latency to the first token streamed to the user. |

---

## Segment 16 Categories Discovery


**Type:** Cross-cutting concern (marketplace, builder, dashboard)
**Depends on:** Segment 03 (WebletCategory enum), Segment 04 (Builder UI), Segment 17 (Marketplace)
**Referenced by:** Segment 04, Segment 09, Segment 17

---

## What This Module Is

Every weblet belongs to a category. Developers choose a category when building their weblet, and users browse the marketplace by category. This module defines the category taxonomy, how weblets are ranked and discovered, and how the marketplace search and filtering works.

Without categories, the marketplace would be a flat list of hundreds of weblets with no organization. With categories, a user looking for a coding assistant can immediately filter to "Code" and find what they need.

> **Example:** Developer Priya builds a weblet called "Essay Editor" that helps students improve their writing. She selects the WRITING category in the builder. When user Tom opens the marketplace and clicks the "Writing" tab, Essay Editor appears alongside other writing-focused weblets, ranked by popularity and rating. Tom can also search "essay" and find it directly.

---

## How It Will Be Done

### Step 1 — Define the Category Taxonomy

The platform uses 13 fixed categories. These are defined as a Prisma enum (in Segment 03) and cannot be created by users — this prevents tag proliferation and keeps the marketplace organized.

| Category | Icon (lucide-react) | Description | Example Weblets |
|----------|-------------------|-------------|-----------------|
| **WRITING** | PenTool | Content creation, copywriting, editing, blogging | Blog Writer, Email Composer, Story Editor |
| **CODE** | Code | Programming, debugging, code review, documentation | Python Tutor, Code Reviewer, API Helper |
| **DATA_ANALYSIS** | BarChart3 | Data analysis, visualization, spreadsheets, SQL | CSV Analyzer, SQL Helper, Chart Generator |
| **MARKETING** | Megaphone | Marketing strategy, SEO, social media, ads | SEO Optimizer, Ad Copywriter, Social Planner |
| **EDUCATION** | GraduationCap | Teaching, tutoring, learning, course content | Math Tutor, Language Coach, Quiz Maker |
| **CUSTOMER_SUPPORT** | Headphones | Support automation, FAQ bots, ticket handling | Ticket Classifier, FAQ Bot, Feedback Analyzer |
| **RESEARCH** | Search | Research assistance, literature review, fact-checking | Paper Summarizer, Fact Checker, Source Finder |
| **CREATIVE** | Palette | Art direction, design feedback, creative writing, brainstorming | Story Writer, Design Critic, Brainstorm Partner |
| **PRODUCTIVITY** | Zap | Task management, scheduling, meeting notes, automation | Meeting Summarizer, Task Planner, Email Sorter |
| **FINANCE** | DollarSign | Financial analysis, accounting, budgeting, investing | Budget Analyzer, Tax Helper, Invoice Generator |
| **HEALTH** | Heart | Health information, wellness, fitness, nutrition | Symptom Explainer, Diet Planner, Workout Coach |
| **LEGAL** | Scale | Legal research, contract review, compliance | Contract Reviewer, Legal Q&A, Privacy Checker |
| **OTHER** | MoreHorizontal | Anything that doesn't fit the above categories | Custom tools, niche assistants |

> **Why fixed categories instead of free-form tags?** Platforms like the App Store and GPT Store use curated categories because they prevent fragmentation. "code" vs "coding" vs "programming" vs "dev" would all be different tags but mean the same thing. Fixed categories keep the marketplace clean.

### Step 2 — Developer Picks a Category in the Builder

In the Weblet Builder (Segment 04), the Configure tab includes a category selector:

1. The selector appears as the second field, right after the weblet name
2. It is a searchable dropdown — the developer can type to filter (e.g., typing "code" shows CODE)
3. Each option shows the icon, category name, and a short description
4. Category is **required before publishing** to the marketplace — but optional for drafts
5. The developer can change the category at any time after publishing (the weblet moves in the marketplace)

> **Example:** Developer Alex is building a weblet that helps with SQL queries. He starts typing "data" in the category dropdown and sees "Data Analysis" with the BarChart3 icon. He selects it. Later, he realizes it's more of a "Code" tool and switches the category — the weblet immediately appears under Code in the marketplace.

### Step 3 — Marketplace Category Navigation

The marketplace uses a horizontal scrollable tab bar at the top:

```
[All (247)] [Writing (42)] [Code (38)] [Data Analysis (31)] [Marketing (28)] [Education (25)] ...
```

- "All" is selected by default and shows all weblets
- Each tab shows the count of active weblets in that category
- Clicking a tab filters the grid to show only that category's weblets
- On mobile, the tabs are horizontally scrollable

Below the category tabs, additional filters are available:
- **Rating**: 4+ stars, 3+ stars, All
- **Capabilities**: Has web search, Has code interpreter, Has image generation, Has knowledge base
- **Sort**: Popular (default), Newest, Top Rated, Most Active (last 7 days)

### Step 4 — Search Implementation

The marketplace search bar searches across:
- Weblet name (highest weight)
- Weblet description (medium weight)
- Category name (medium weight)
- Conversation starters (lower weight)

The search uses PostgreSQL full-text search with weighted vectors for ranking. Results are instant (debounced 300ms input).

> **Example:** User searches "help me write emails." The search finds weblets with "write" and "email" in their name or description. "Email Composer" (WRITING category) ranks highest because both terms appear in the name. "Business Writer" ranks second because "email" appears in its description.

### Step 5 — Ranking Algorithm

Weblets are ranked within each category using a score that combines four factors:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| **Chat Volume** | 35% | Total number of chat sessions — indicates popularity |
| **Average Rating** | 30% | Mean of all 1-5 star ratings — indicates quality |
| **Recency** | 20% | Ratio of chats in last 7 days vs total chats — indicates current relevance |
| **Completion Rate** | 15% | Non-abandoned sessions / total sessions — indicates user satisfaction |

**How ranking works:**
1. A Vercel Cron job runs every hour
2. It calculates the rank score for every active weblet
3. Scores are stored in a cached field (or Redis) for fast marketplace queries
4. The marketplace API sorts by this cached score when "Popular" sort is selected

**New weblet boost:** Weblets published in the last 7 days get a temporary 1.5x multiplier to their rank score so they have a chance to appear before accumulating ratings. The boost decays linearly over the 7 days.

> **Example:** "Code Reviewer" has 500 chats, 4.2 avg rating, 80 chats this week, and 90% completion rate. Its score: (0.35 × 0.5) + (0.30 × 0.84) + (0.20 × 0.16) + (0.15 × 0.90) = 0.175 + 0.252 + 0.032 + 0.135 = 0.594. A newer weblet with 50 chats but 4.8 rating might score lower overall but appear in "Newest" and "Top Rated" sorts.

### Step 6 — Category-Specific Leaderboard

Each category has its own leaderboard that is visible:
- **To users** — "Top in Writing" section on the category page
- **To developers** — "Your rank in [Category]: #N" on the developer dashboard

The leaderboard shows the top 10 weblets per category with their rank score, chat count, and rating.

### Step 7 — Featured Sections on Marketplace Home

The marketplace home page (before any category is selected) shows curated sections:

| Section | Logic | Display |
|---------|-------|---------|
| **Trending This Week** | Highest week-over-week growth in chat sessions | Horizontal scroll of 8 weblet cards |
| **New Arrivals** | Most recently published weblets (last 14 days) | Horizontal scroll of 8 weblet cards |
| **Top Rated** | Highest average rating with minimum 10 ratings | Horizontal scroll of 8 weblet cards |
| **Popular in [Category]** | Top 4 weblets per category (rotated daily) | Grid of category cards, each showing 4 weblets |

### Step 8 — Database Indexes for Performance

Add these indexes to ensure marketplace queries remain fast as the platform scales:

- Composite index on `(category, isActive)` — for category filtering
- Composite index on `(category, rankScore DESC)` where `isActive = true` — for sorted category pages
- Full-text search index on `(name, description)` — for search queries
- Index on `createdAt DESC` where `isActive = true` — for "Newest" sort

---

## After Completion, the User Will Be Able To

1. **Developers** can select a category when creating/editing a weblet in the builder
2. **Developers** can see their weblet's rank within its category on the dashboard
3. **Users** can browse the marketplace by category using tabs
4. **Users** can search for weblets and get ranked results
5. **Users** can sort by Popular, Newest, Top Rated, or Most Active
6. **Users** can filter by rating and capabilities
7. **Everyone** sees curated featured sections (Trending, New Arrivals, Top Rated)

---

## Connections to Other Segments

- **Segment 03** defines the WebletCategory enum and the category field on the Weblet model
- **Segment 04** (Builder) adds the category selector to the Configure tab
- **Segment 09** (Developer Dashboard) shows category breakdown chart and category rank metric
- **Segment 17** (Marketplace) implements the category navigation, search, and ranking display
- **MODULE-orchestration-workflows** — flow builder lets users filter weblets by category when adding to a flow

---

## Segment 17 Marketplace Launch


**Estimated effort:** 3 weeks
**Depends on:** All previous segments
**Produces:** Public marketplace, security hardening, performance optimization, monitoring, documentation, and production deployment

---

## Goal

The final segment. Make the platform production-ready: build the public-facing marketplace where users discover weblets, harden security, optimize performance, set up monitoring, write documentation, and deploy to production.

---

## What Already Exists (from Segments 01-16)

```
Complete platform:
  ✓ Auth (web + OAuth for GPT Actions)
  ✓ Database (14 models + pgvector)
  ✓ Weblet Builder + GPT Integration Wizard
  ✓ Chat Engine with 5 tool types + MCP + Composability
  ✓ Stripe Payments + PayPal Payouts
  ✓ Creator Dashboard + Analytics
  ✓ Multi-Agent Orchestration
  ✓ RSIL Self-Improving Loop
```

---

## Part A: Public Marketplace (1 week)

### Files to Create

```
app/(public)/
├── page.tsx                          ← Landing page / homepage (marketing)
├── marketplace/
│   └── page.tsx                      ← Browse all public weblets
├── weblet/[slug]/
│   └── page.tsx                      ← Individual weblet landing page
├── pricing/
│   └── page.tsx                      ← Platform pricing (for creators)
└── competition/
    └── page.tsx                      ← Preserved Competition page (CLIENT REQUIREMENT)

components/marketplace/
├── weblet-card.tsx                   ← Card: icon, name, description, rating, price, creator
├── weblet-grid.tsx                   ← Responsive grid of weblet cards
├── search-bar.tsx                    ← Search + filter weblets
├── category-filter.tsx               ← Filter by category/capability
├── sort-dropdown.tsx                 ← Sort by: popular, newest, rating, price
└── creator-badge.tsx                 ← Creator info badge

app/api/marketplace/
├── weblets/route.ts                  ← GET: search/filter public weblets (no auth required)
└── weblets/[slug]/route.ts           ← GET: individual weblet details + reviews
```

### Marketplace Page

```
┌──────────────────────────────────────────────────────┐
│  WebletGPT Marketplace                                │
│  Discover AI agents built by creators                 │
│                                                       │
│  [🔍 Search weblets...                    ]           │
│  [All] [Writing] [Code] [Data] [Marketing] [Free]    │
│  Sort by: [Popular ▼]                                 │
│                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ 🤖      │  │ 📊      │  │ ✍️      │              │
│  │AI Market│  │Data     │  │Content  │              │
│  │er Pro   │  │Analyzer │  │Writer   │              │
│  │★4.7(847)│  │★4.5(312)│  │★4.8(567)│              │
│  │$8/mo    │  │Free     │  │$5/mo    │              │
│  │[Try →]  │  │[Try →]  │  │[Try →]  │              │
│  └─────────┘  └─────────┘  └─────────┘              │
│                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ ...     │  │ ...     │  │ ...     │              │
│  └─────────┘  └─────────┘  └─────────┘              │
│                                                       │
│  [Load More]                                          │
└──────────────────────────────────────────────────────┘
```

### Individual Weblet Landing Page

```
┌──────────────────────────────────────────────────────┐
│  🤖 AI Marketer Pro                                   │
│  by Sarah Mitchell                                    │
│  ★4.7 (847 reviews) · 3,200+ chats                   │
│                                                       │
│  Expert AI marketing copywriter. Creates landing      │
│  pages, email campaigns, social media content, and    │
│  more. Powered by Claude 3.5 Sonnet.                  │
│                                                       │
│  Capabilities: 🔍 Web Search · 💻 Code · 📁 RAG      │
│                                                       │
│  ┌───────────────────────────────────────┐            │
│  │  $8.00/month · 14-day free trial       │            │
│  │  [Start Free Trial →]                  │            │
│  └───────────────────────────────────────┘            │
│                                                       │
│  Conversation Starters:                               │
│  • "Write a tagline for my business"                  │
│  • "Create an email campaign for..."                  │
│  • "Analyze my competitor's landing page"             │
│                                                       │
│  Reviews:                                             │
│  ★★★★★ "Best marketing AI I've used" — John R.       │
│  ★★★★☆ "Great for email copy" — Jane S.              │
└──────────────────────────────────────────────────────┘
```

### Search & Filter API

```typescript
// app/api/marketplace/weblets/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") || "popular";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  const where = {
    isActive: true,
    isExternalGPT: false, // Only show native weblets in marketplace
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    }),
    ...(category === "free" && { accessType: "FREE" }),
  };

  const orderBy = {
    popular: { analytics: { _count: "desc" } },
    newest: { createdAt: "desc" },
    rating: { /* custom sort by avg rating */ },
  }[sort];

  const weblets = await db.weblet.findMany({
    where, orderBy,
    skip: (page - 1) * limit, take: limit,
    include: { creator: { select: { name: true, email: true } } },
  });

  return Response.json({ weblets, page, hasMore: weblets.length === limit });
}
```

### Competition Page

**CLIENT REQUIREMENT:** "All existing pages permanently removed except the Competition page."

- [ ] Identify the current Competition page content and URL
- [ ] Recreate it as a static page at `/(public)/competition/page.tsx`
- [ ] Verify it renders identically to the original
- [ ] Add to navigation

---

## Part B: Security Hardening (1 week)

### GDPR Compliance (Was Missing)

| Requirement | Implementation |
|-------------|---------------|
| **Right to access** | API endpoint: `GET /api/user/data-export` — exports all user data as JSON |
| **Right to deletion** | API endpoint: `DELETE /api/user/delete-account` — deletes account + anonymizes data |
| **Consent** | Cookie consent banner. Terms of Service + Privacy Policy pages. Consent checkbox at signup. |
| **Data retention** | Chat messages auto-deleted after 90 days (configurable). Analytics anonymized after 180 days. |

### Security Checklist

| Category | Action | Priority |
|----------|--------|----------|
| **Auth** | Verify all API routes check `auth()` | Critical |
| **Auth** | Rate limit login/OTP endpoints (5 attempts per 15 min) | Critical |
| **Auth** | OAuth token expiry: 1 hour access tokens | Critical |
| **Input validation** | Validate all request bodies with Zod schemas | Critical |
| **XSS** | Sanitize user-generated content (weblet names, descriptions) before rendering | Critical |
| **CSRF** | Verify Next.js built-in CSRF protection is enabled for mutations | High |
| **CSP** | Add Content-Security-Policy headers via next.config.ts | High |
| **Injection** | Verify Prisma parameterized queries (no raw SQL with user input) | Critical |
| **Rate limiting** | Upstash Redis rate limiter on all API routes | High |
| **API keys** | Rotate all API keys (OpenRouter, Stripe, PayPal, Tavily, E2B). Store in Vercel env vars. | High |
| **Webhooks** | Verify Stripe webhook signatures. Verify PayPal webhook signatures. | Critical |
| **File upload** | Validate file types + size. Scan for malware (ClamAV or VirusTotal API). | High |
| **Secrets** | Audit that no secrets are in code or git history | Critical |
| **HTTPS** | Enforce HTTPS everywhere (Vercel does this by default) | Critical |
| **Headers** | Add security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy | Medium |

### Rate Limiting Implementation

```typescript
// proxy.ts — add rate limiting (Next.js 16 convention)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"), // 60 requests per minute
});

// Specific limits:
const authLimit = new Ratelimit({ /* 5 requests per 15 minutes */ });
const chatLimit = new Ratelimit({ /* 20 messages per minute */ });
const apiLimit = new Ratelimit({ /* 100 requests per minute */ });
```

### Content Moderation (Was Missing)

| Level | Implementation |
|-------|---------------|
| **Weblet names/descriptions** | Block profanity + banned words (use `bad-words` npm package) |
| **System prompts** | Flag prompts that attempt jailbreaks or produce harmful content |
| **Chat outputs** | Use OpenAI moderation API to scan assistant responses (or rely on model safety) |
| **Knowledge files** | Scan uploaded files for malicious content |

### Abuse Prevention (Was Missing)

| Risk | Prevention |
|------|-----------|
| Spam weblets | Rate limit weblet creation (5 per day). Manual review for first weblet. |
| Fraudulent payouts | Require email verification. Minimum 30-day wait before first payout. |
| Bot traffic | CAPTCHA on signup. Rate limit chat API per IP. |
| API key theft | Monitor for unusual usage patterns. Alert on spike. |

---

## Part C: Performance & Monitoring (0.5 weeks)

### Performance Optimization

| Area | Action |
|------|--------|
| **Core Web Vitals** | Target LCP < 2.5s, FID < 100ms, CLS < 0.1 |
| **Image optimization** | Use `next/image` for all images. WebP format. |
| **Bundle size** | Analyze with `@next/bundle-analyzer`. Lazy-load heavy components (Monaco editor, Recharts). |
| **Database** | Add missing indexes. Use `prisma.$queryRaw` for complex aggregations. Connection pooling via Prisma Accelerate or PgBouncer. |
| **Caching** | Cache weblet configs in Upstash Redis (5 min TTL). Cache marketplace results (1 min TTL). |
| **API** | Use Next.js ISR for marketplace pages. Edge runtime for auth endpoints. |

### Monitoring Setup

| Tool | Purpose |
|------|---------|
| **Sentry** | Error tracking + performance monitoring |
| **Vercel Analytics** | Web Vitals, page performance |
| **Uptime monitoring** | Ping critical endpoints every 5 min (use Vercel's built-in or BetterStack) |
| **Custom alerts** | Webhook failures > 10/hour, Error rate > 5%, Response time > 5s |

### Health Check Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    stripe: await checkStripe(),
    openrouter: await checkOpenRouter(),
  };

  const healthy = Object.values(checks).every(c => c.status === "ok");
  return Response.json({ status: healthy ? "healthy" : "degraded", checks },
    { status: healthy ? 200 : 503 });
}
```

---

## Part D: Documentation (0.5 weeks)

### Documentation Pages

| Doc | Audience | Content |
|-----|----------|---------|
| **Creator Guide** | Weblet creators | How to build, configure, monetize, and optimize weblets |
| **GPT Integration Guide** | GPT creators | How to connect existing OpenAI GPTs for monetization |
| **User Guide** | End users | How to discover, subscribe to, and chat with weblets |
| **API Reference** | Developers | REST API endpoints, request/response schemas, auth |
| **Composability SDK** | Developers | How to build composite weblets, child weblet API |

Publish as pages within the app at `/(public)/docs/` using MDX.

---

## Acceptance Criteria

### Marketplace
- [ ] Marketplace page lists all public active weblets
- [ ] Search bar filters weblets by name and description
- [ ] Category filters work (Writing, Code, Data, Marketing, Free)
- [ ] Sort options work (Popular, Newest, Rating)
- [ ] Pagination / infinite scroll loads more results
- [ ] Individual weblet landing page shows full details + reviews
- [ ] "Try" / "Subscribe" button routes to chat or paywall
- [ ] Competition page preserved and accessible at original route
- [ ] Landing page (homepage) redesigned for the new platform

### Security
- [ ] All API routes verified for auth guards
- [ ] Rate limiting active on all endpoints
- [ ] Stripe + PayPal webhook signatures verified
- [ ] Input validation with Zod on all POST/PATCH routes
- [ ] CSP headers configured
- [ ] No secrets in code or git history
- [ ] GDPR: data export endpoint works
- [ ] GDPR: account deletion endpoint works
- [ ] Cookie consent banner displayed
- [ ] Content moderation blocks profanity in weblet names
- [ ] File upload validation (type, size, malware scan)

### Performance
- [ ] LCP < 2.5s on marketplace page (3G connection)
- [ ] Bundle analyzer run, no unnecessary large imports
- [ ] Heavy components lazy-loaded
- [ ] Database queries optimized with proper indexes
- [ ] Redis caching active for frequently accessed data

### Monitoring
- [ ] Sentry integrated for error tracking
- [ ] Health check endpoint returns status of all services
- [ ] Uptime monitoring configured
- [ ] Alert rules for error rate spikes and webhook failures

### Documentation
- [ ] Creator Guide published
- [ ] GPT Integration Guide published
- [ ] User Guide published
- [ ] API Reference published

### Deployment
- [ ] Custom domain configured (webletgpt.com)
- [ ] SSL certificate active
- [ ] Environment variables set for production (Stripe live keys, PayPal live mode)
- [ ] Database migrated to production
- [ ] Vercel Cron jobs configured (RSIL scheduler)
- [ ] Production deployment verified end-to-end

---

## Environment Variables to Add

```env
# Upstash Redis (rate limiting + caching)
UPSTASH_REDIS_REST_URL=xxxxx
UPSTASH_REDIS_REST_TOKEN=xxxxx

# Sentry
SENTRY_DSN=xxxxx
NEXT_PUBLIC_SENTRY_DSN=xxxxx

# Production flags
NODE_ENV=production
STRIPE_MODE=live
PAYPAL_MODE=live
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Security audit finds critical issues | Budget 2-3 days for fixing findings. Use automated tools (Snyk, npm audit) first. |
| Performance issues at scale | Load test with k6 or Artillery before launch. Identify bottlenecks early. |
| Competition page content unknown | Ask client for the exact content immediately. Don't wait until this segment. |
| Production Stripe/PayPal migration | Test thoroughly with small amounts first. Keep sandbox mode available as fallback. |
| Missing documentation | Prioritize Creator Guide and GPT Integration Guide. API docs can be auto-generated from types. |


---

## Segment 18 Admin Platform Defense


## Goal
To implement critical administrative controls, platform defense mechanisms, and missing developer features required for a secure, production-ready SaaS application.

## Core Problem
While prior segments build out the full user and developer experience, the platform lacks a backend interface for administrators to govern the ecosystem. It also lacks defense mechanisms against abusive users (large file uploads, TOS violations) and edge-case financial scenarios (refunds/chargebacks).

## Files to Create
- `app/(admin)/admin/page.tsx` (Admin overview dashboard)
- `app/(admin)/admin/users/page.tsx` (User management table)
- `app/(admin)/admin/weblets/page.tsx` (Weblet moderation table)
- `app/(admin)/admin/payouts/page.tsx` (Manual payout review)
- `app/(dashboard)/dashboard/api-keys/page.tsx` (Developer API key generation)
- `components/report-dialog.tsx` (Report abuse modal for users)
- `lib/billing/refund-logic.ts` (Chargeback reconciliation script)

## Implementation Details

### 1. Admin Control Panel
- Build a dedicated `/admin` route group protected by the `ADMIN` role.
- **User Management**: View all users, impersonate testing accounts, and ban/suspend abusive users.
- **Weblet Moderation**: View all published Weblets (sorted by most reported). Administrators can force a Weblet back to "Draft" status or delete it entirely for TOS violations.
- **Global Metrics**: High-level platform stats (Total MRR, Total Platform Credit consumption, new users today).

### 2. Developer API Key Management
- Add an "API Keys" page to the Developer Dashboard.
- Allow developers to generate up to 5 API keys (e.g., `sk_weblet_live_...`).
- Keys are hashed in the database using bcrypt/argon2; only shown once upon creation.
- Used to authenticate external REST requests to specific Weblets.

### 3. File Storage Limits & RAG Quotas
- Implement strict validation in the Weblet Builder file upload endpoint (Phase 04).
- Free users: Max 5MB per file, Max 3 files per Weblet.
- Paid/Subscribed developers: Max 50MB per file, Max 20 files per Weblet.
- Integrate pdf-parse or similar library *before* sending to LlamaParse to reject files with >1,000 pages to prevent massive indexing bills.

### 4. Refund & Chargeback Reconciliation
- When Stripe fires a `charge.refunded` or `charge.dispute.created` webhook, log a `REFUND` transaction in Prisma.
- Logic: Deduct the creator's share from their `pendingBalance`. If `pendingBalance` < 0, subtract from `availableBalance`. Overdrawn accounts are flagged in the Admin Panel for review before any future payouts.

### 5. Manual Versioning & Rollbacks (Builder History)
- Add a "Revision History" tab or modal to the Weblet Builder.
- Allow developers to view the last 10 saved iterations of their Weblet (System Prompt + Tools).
- "Restore this version" button safely overrides the draft config with the historical config.

### 6. User Reporting Workflows
- Add a "Report Weblet" flag/icon in the `/marketplace/weblet/[slug]` page and the `/chat/[id]` interface.
- Opens a dialog: "Why are you reporting this Weblet?" (Options: Inappropriate Content, Spam, Broken/Non-functional).
- Submitting writes to a new `Report` table linked to the Weblet and flags it in the Admin Dashboard.

### 7. GDPR Cascading Deletion
- In the `/settings` page, add a highly destructive "Delete Account" button.
- For `USER` roles: instantly delete all data and PII.
- For `DEVELOPER` roles: Do not instantly delete. Mark as `PENDING_DELETION`. 
- Sunset Logic: Cancel all active Stripe subscriptions connected to their Weblets so no future renewals occur. Keep the Weblet active until the end of the current billing cycle so paid users aren't abruptly cut off, then purge data.

## Acceptance Criteria
- [ ] Admin dashboard is accessible only to users with `role === "ADMIN"`.
- [ ] Admins can ban a user, immediately terminating their login session.
- [ ] Developers can generate, view, and revoke API keys.
- [ ] Uploading a >5MB file as a free user returns a 413 Payload Too Large error.
- [ ] Stripe refund webhooks successfully reduce creator balances.
- [ ] Users can report a Weblet; reports appear in the Admin Panel.
- [ ] Account deletion initiates proper sunsetting for creators.

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Admin Panel security breach | Implement multi-factor authentication (MFA) requirement for ADMIN role logins. Hardcode initial admin emails in env vars. |
| API Key scraping | Ensure API keys are fully hashed in the database and rate-limited. |

---

