# WEBLETGPT DIRECTORY

## OVERVIEW
Next.js 16 SaaS marketplace for AI agents (Weblets) using App Router and route groups.

## STRUCTURE
```
webletgpt/
├── app/                    # Next.js 16 App Router (Core logic)
│   ├── (main)/             # Public marketplace routes
│   ├── (user)/             # User-facing pages (Billing, Chat)
│   ├── api/                # 18 API endpoints (Chat, Inngest, Stripe)
│   ├── dashboard/          # Developer-only workspace
│   └── flows/              # Multi-agent flow pages
├── components/             # React components (shadcn/ui new-york)
├── hooks/                  # debounce, mobile, orchestration-progress, toast
├── lib/                    # 13 business logic modules
├── prisma/                 # Schema + 2 migrations
├── styles/                 # Tailwind v4 globals
├── instrumentation.ts      # OpenTelemetry + Langfuse
└── proxy.ts                # Route protection (Auth logic)
```

## WHERE TO LOOK
- **Chat Interface**: `app/(user)/chat/[webletId]/[sessionId]/`
- **Marketplace**: `app/(main)/marketplace/`
- **Weblet Builder**: `app/dashboard/builder/[id]/`
- **Flow Designer**: `app/flows/builder/[id]/`
- **Dynamic Pages**: `app/[slug]/` handles custom weblet/marketplace URLs.
- **Developer Tools**: `app/dashboard/` (requires DEVELOPER or ADMIN role).

## ROUTING
- **Home/Landing**: `app/page.tsx`
- **Marketplace**: `app/(main)/marketplace/`
- **Billing**: `app/(user)/billing/`
- **Auth**: `app/login/`, `app/auth/error/`
- **User Areas**: `app/profile/`, `app/settings/`, `app/chats/`, `app/become-developer/`
- **Management**: `app/dashboard/weblets/`

## NOTES
- **Auth Guard**: `proxy.ts` handles all role-based access instead of `middleware.ts`.
- **Config**: `next.config.mjs` has `outputFileTracingRoot` and unoptimized images.
- **Path Aliases**: `@/*` points to this directory (configured in `tsconfig.json`).
- **Styling**: Tailwind v4 uses `oklch()` colors and custom dark variants.
- **Observability**: `instrumentation.ts` initializes tracing and Langfuse logs.
- **Components**: UI follows `components.json` (shadcn new-york style).
