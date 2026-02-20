# Segment 02: User Roles & Permissions

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
| `/(auth)/` | Anyone (unauthenticated) | Login page, OTP verification page |
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

### Step 5 — Configure Middleware for Route Protection

The Next.js middleware intercepts every request and:

1. Checks if the route requires authentication (everything except `/(auth)/` and `/(public)/`)
2. If authenticated, checks the user's role against the route group requirements
3. Redirects unauthorized users:
   - Not logged in → `/login`
   - USER trying to access `/(dashboard)/` → `/explore` (marketplace) with a toast: "Upgrade to Developer to access this feature"
   - Non-ADMIN trying to access `/(admin)/` → `/dashboard` or `/explore` depending on role

### Step 6 — Adapt the UI Based on Role

The header navigation and sidebar change depending on the user's role:

**USER sees:**
- Explore (marketplace)
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
- **Segment 08** (Developer Dashboard) is gated to DEVELOPER role
- **Segment 10** (Multi-Agent) flow builder is available to all authenticated users
- **Segment 15** (Marketplace) is public — no role required to browse
- **MODULE-orchestration-workflows** references this module for flow creation permissions
