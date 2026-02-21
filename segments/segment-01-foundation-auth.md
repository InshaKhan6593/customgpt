# Segment 01: Foundation & Authentication

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
