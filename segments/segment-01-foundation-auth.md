# Segment 01: Foundation & Authentication

**Estimated effort:** 2 weeks
**Depends on:** Nothing (first segment)
**Produces:** Deployed Next.js app with passwordless authentication, role-based access control, and all foundational patterns
**References:** segment-02-user-roles-permissions.md

---

## What This Segment Is

This is the foundation of the entire platform. Everything — the builder, marketplace, chat, orchestration — depends on what is built here. This segment sets up the Next.js project, establishes the authentication system (passwordless email OTP), implements the role system (USER, DEVELOPER, ADMIN), configures route protection based on roles, and creates all the coding patterns that every future segment must follow.

> **Example:** A user visits webletgpt.com for the first time. They click "Get Started," enter their email, receive a 6-digit code in their inbox within seconds, enter the code, and land on the marketplace as a USER. If they click "Become a Developer" from their profile, their role upgrades and they see the Developer Dashboard.

---

## How It Will Be Done

### Step 1 — Scaffold the Next.js Project

Set up a new Next.js 15 project with TypeScript strict mode, Tailwind CSS v4, and shadcn/ui as the component library. Configure the project structure, install all base dependencies, and set up the development environment.

**Technical decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15.x (App Router) | Latest stable. Do NOT use 16. |
| Language | TypeScript 5.x, strict mode | Type-safe tool definitions, better DX |
| CSS | Tailwind CSS v4 + shadcn/ui | Rapid UI development, consistent design system |
| Auth | Auth.js v5 (NextAuth v5) | Passwordless email OTP, session management |
| ORM | Prisma (latest) | Type-safe queries, migrations, seeding |
| Database | PostgreSQL 16+ (Supabase or Neon) | ACID, JSON columns, pgvector support |
| Email | Resend | Transactional email delivery for OTP codes |
| Hosting | Vercel (Pro plan) | Zero-config Next.js, edge functions, auto-scaling |
| IDs | cuid() via Prisma @default(cuid()) | URL-safe, sortable, consistent across all models |
| Real-time strategy | SSE for chat, Ably for multi-agent | Vercel does NOT support persistent WebSocket (Socket.io incompatible) |

### Step 2 — Set Up the Database with Foundation Models

Connect Prisma to PostgreSQL and create the initial migration with the foundation models:

- **User** — The core identity model. Every person on the platform is a User. Includes a `role` field with the `UserRole` enum (USER, DEVELOPER, ADMIN). New signups default to USER.
- **Account** — NextAuth managed. Links external auth providers to users.
- **Session** — NextAuth managed. Tracks active sessions.
- **VerificationToken** — NextAuth managed. Stores hashed OTP codes with expiration.

The `UserRole` enum is defined at this level because every future segment depends on role-based access.

### Step 3 — Build the Passwordless Email OTP Login

The authentication flow works like this:

1. User navigates to `/login` and sees a clean email input form
2. User enters their email and clicks "Continue"
3. The server generates a 6-digit OTP code, hashes it, and stores it in the `VerificationToken` table with a 10-minute expiration
4. Resend delivers the code to the user's inbox (branded email template with the WebletGPT logo)
5. User is redirected to `/verify` where they enter the 6-digit code
6. The server verifies the code against the stored hash
7. If valid: a session is created, a cookie is set, and the user is redirected based on their role
8. If invalid: an error message appears with the option to resend

> **Example:** Maria enters maria@example.com. She receives an email: "Your WebletGPT code is 847293." She types 847293 on the verify page. Since it's her first time, she's created as a USER and lands on the marketplace. If she were a DEVELOPER, she'd land on her dashboard.

**Post-login redirect logic:**
- USER → `/explore` (marketplace)
- DEVELOPER → `/dashboard` (developer overview)
- ADMIN → `/dashboard` (same as developer, with admin panel in nav)

### Step 4 — Implement Role-Based Route Protection

The Next.js middleware intercepts every request and enforces access rules:

**Route groups and their protection:**

| Route Group | Requires Login | Minimum Role | Contains |
|-------------|---------------|-------------|----------|
| `/(auth)/` | No | None | `/login`, `/verify` |
| `/(public)/` | No | None | Marketplace browse, weblet pages, pricing, docs |
| `/(user)/` | Yes | USER | Chat, flows, profile, subscriptions |
| `/(dashboard)/` | Yes | DEVELOPER | Builder, analytics, RSIL, weblet management, payouts |
| `/(admin)/` | Yes | ADMIN | User management, moderation, platform metrics |

**Redirect behavior:**
- Not logged in + trying to access protected route → redirect to `/login` with a return URL
- USER trying to access `/(dashboard)/` → redirect to `/explore` with a toast message: "Upgrade to Developer to access this"
- After login → redirect to the return URL (if one was saved) or the role-based default

### Step 5 — Build the Role Upgrade Flow

Create the "Become a Developer" feature:

1. Add a "Become a Developer" button in the user's profile dropdown menu and as a card on the `/explore` page sidebar
2. Clicking it opens a page (`/(user)/become-developer`) showing:
   - Benefits of being a developer (build weblets, access dashboard, publish to marketplace, earn revenue in the future)
   - Developer Terms of Service (text content, must scroll to bottom)
   - "I agree to the Terms" checkbox + "Upgrade to Developer" button
3. On confirmation:
   - API call to `POST /api/upgrade-role` updates the user's role from USER to DEVELOPER
   - Session is refreshed with the new role
   - User is redirected to `/dashboard` with a welcome banner: "Welcome to your Developer Dashboard!"

This is a **one-way upgrade**. Developers keep all USER capabilities.

### Step 6 — Build the Layout Shells

Create two distinct layout shells:

**User Layout** (`/(user)/layout.tsx`):
- Top header with: Logo, Search (marketplace), navigation links (Explore, My Chats, My Flows), user menu dropdown
- User menu contains: Profile, Settings, "Become a Developer" (if USER role), Sign Out

**Developer Layout** (`/(dashboard)/layout.tsx`):
- Sidebar navigation with: Dashboard, Builder, My Weblets, Analytics, RSIL, Payouts
- Top header with: Search, notification bell (future), user menu
- User menu contains: Profile, Settings, "View as User" (switches to marketplace), Sign Out

Both layouts share the same header component that adapts based on role.

### Step 7 — Establish Foundational Coding Patterns

These patterns are mandatory for ALL future segments:

| Pattern | Convention |
|---------|-----------|
| Prisma client | Always import from `lib/prisma.ts` — never create a new PrismaClient() |
| Auth | Always import `{ auth }` from `lib/auth.ts` — never call NextAuth directly |
| Route groups | `/(auth)/` for login, `/(public)/` for marketplace, `/(user)/` for user features, `/(dashboard)/` for developer features |
| Components | `components/ui/` for shadcn/ui, `components/[feature]/` for feature-specific |
| API routes | `app/api/[resource]/route.ts` with auth guard at the top of each handler |
| Role checking | Always use `requireRole()` from `lib/utils/auth-guard.ts` |
| Error handling | Use Next.js error boundaries. API routes return `{ error: string }` with appropriate HTTP status |
| Type safety | All API request/response types defined in `lib/types/` |
| Feature flags | Platform-wide flags defined in `lib/constants.ts` (e.g., ENABLE_PAYMENT_ENFORCEMENT) |

### Step 8 — Configure Environment Variables

Set up `.env.local` (secret, never committed) and `.env.example` (template, committed):

**Required variables for this segment:**
- NEXTAUTH_URL — Base URL (http://localhost:3000 in dev)
- NEXTAUTH_SECRET — Random 32-byte secret for session encryption
- DATABASE_URL — PostgreSQL connection string
- RESEND_API_KEY — For sending OTP emails

### Step 9 — Deploy to Vercel

Deploy the foundation to Vercel:
1. Connect the GitHub repository to Vercel
2. Set all environment variables in Vercel dashboard
3. Configure the production domain
4. Verify the login flow works end-to-end in production
5. Verify middleware correctly protects routes

---

## Files to Create

```
/ (project root)
├── .env.local                        ← All secrets (never committed)
├── .env.example                      ← Template with placeholder values
├── next.config.ts                    ← Next.js configuration
├── tailwind.config.ts                ← Tailwind CSS v4 config
├── tsconfig.json                     ← TypeScript strict mode
├── prisma/
│   └── schema.prisma                 ← Foundation models (User with role, Account, Session, VerificationToken)
├── app/
│   ├── layout.tsx                    ← Root layout with providers (SessionProvider, ThemeProvider)
│   ├── page.tsx                      ← Landing page (marketing placeholder)
│   ├── (auth)/
│   │   ├── login/page.tsx            ← Email input form
│   │   └── verify/page.tsx           ← 6-digit OTP input form
│   ├── (user)/
│   │   ├── layout.tsx                ← User layout with header navigation
│   │   ├── become-developer/page.tsx ← Role upgrade page with ToS
│   │   └── profile/page.tsx          ← User profile page
│   ├── (dashboard)/
│   │   ├── layout.tsx                ← Developer layout with sidebar navigation
│   │   └── page.tsx                  ← Dashboard home (placeholder: "Welcome, [name]")
│   └── api/
│       ├── auth/[...nextauth]/route.ts  ← NextAuth API route handler
│       └── upgrade-role/route.ts     ← POST: Upgrade USER to DEVELOPER
├── lib/
│   ├── auth.ts                       ← NextAuth config (singleton — ALL segments import from here)
│   ├── prisma.ts                     ← Prisma client singleton (ALL segments import from here)
│   ├── email.ts                      ← Resend email sending (OTP codes)
│   ├── constants.ts                  ← App-wide constants (app name, URLs, limits, feature flags)
│   └── utils/
│       ├── api-response.ts           ← Standardized API response builders
│       └── auth-guard.ts             ← requireRole() utility with role hierarchy
├── components/
│   ├── ui/                           ← shadcn/ui components (button, input, card, form, toast)
│   ├── auth/
│   │   ├── login-form.tsx            ← Email input component
│   │   └── verify-form.tsx           ← OTP input component
│   └── layout/
│       ├── sidebar.tsx               ← Developer dashboard sidebar navigation
│       ├── header.tsx                ← Adaptive header (changes based on role)
│       ├── user-nav.tsx              ← User navigation links
│       └── providers.tsx             ← Client-side providers wrapper
└── middleware.ts                     ← Role-based route protection
```

---

## Acceptance Criteria

- [ ] Next.js project scaffolded with TypeScript strict mode, App Router, Tailwind CSS v4
- [ ] shadcn/ui installed with base components (button, input, card, form, toast, dropdown-menu)
- [ ] Prisma connected to PostgreSQL, initial migration run with User (including role field), Account, Session, VerificationToken
- [ ] UserRole enum defined: USER (default), DEVELOPER, ADMIN
- [ ] User can enter email on `/login` and receive 6-digit OTP via Resend within 5 seconds
- [ ] User can enter code on `/verify` and be authenticated
- [ ] New users are created with role USER by default
- [ ] Session includes user id and role, persists across page refreshes
- [ ] Post-login redirects: USER → `/explore`, DEVELOPER → `/dashboard`
- [ ] Middleware blocks USER from accessing `/(dashboard)/*` routes with redirect to `/explore`
- [ ] Middleware blocks unauthenticated users from `/(user)/*` and `/(dashboard)/*` routes
- [ ] "Become a Developer" page works: USER can upgrade to DEVELOPER role
- [ ] After upgrade, user is redirected to `/dashboard` and sees developer navigation
- [ ] Developer sidebar shows: Dashboard, Builder, My Weblets, Analytics, RSIL, Payouts
- [ ] User header shows: Explore, My Chats, My Flows, Profile
- [ ] App deployed and accessible on Vercel
- [ ] `.env.example` committed with all required variable names
- [ ] All coding patterns established and used consistently

---

## After Completion, the User Will Be Able To

1. **Visit webletgpt.com** and see a landing page
2. **Sign up / Log in** using just their email — no password needed
3. **Receive a 6-digit code** in their email and verify it
4. **Land on the marketplace** (as a USER) or the **dashboard** (as a DEVELOPER)
5. **Navigate** using role-appropriate menus — Users see Explore/Chats/Flows, Developers see Dashboard/Builder/Analytics
6. **Upgrade to Developer** at any time with one click and Terms acceptance
7. **Be properly redirected** if they try to access a page above their role level

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Email deliverability | Resend has good deliverability. Add SPF/DKIM records for the domain. Test with Gmail, Outlook, Yahoo. |
| Vercel cold starts | Use Edge Runtime for auth API routes to minimize latency. |
| Role confusion in UI | Clear visual separation — developer sidebar is distinct from user header navigation. "Become a Developer" CTA is prominent but not intrusive. |
| Session not updating after role change | Force session refresh after role upgrade using NextAuth's `update()` function. |
