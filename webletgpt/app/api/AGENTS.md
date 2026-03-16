# API SURFACE KNOWLEDGE BASE

## OVERVIEW
The webletgpt/app/api/ directory houses 18+ route groups for the WebletGPT SaaS marketplace and runtime.

## ROUTE MAP
- **chat/** — Core streaming endpoint (route.ts). 561 lines of async tool orchestration, stopping conditions, and credit deduction.
- **flows/** — Flow CRUD. [id]/execute/ triggers Inngest orchestrator background jobs.
- **inngest/** — Function registry. New background tasks MUST be added to the serve array in route.ts.
- **mcp/** — Proxy and discovery. Implements full OAuth 2.1 PKCE server-side flows.
- **builder/** — Developer-facing CRUD for the no-code weblet editor.
- **image/** — [id]/route.ts serves generated images from an in-memory LRU store (volatile).
- **marketplace/** — Public weblet listings and search endpoints.
- **weblets/** — Main weblet CRUD and [id]/mcp/ for server management.
- **billing/ & subscriptions/** — Stripe checkout sessions and credit plan management.
- **stripe/ & webhooks/** — Webhook handlers and billing portal access.
- **auth/** — NextAuth v5 auto-generated authentication routes.
- **dashboard/ & payouts/** — Developer-specific analytics and payment data.
- **profile/ & user-weblets/** — User identity and subscription status CRUD.
- **upgrade-role/** — Specific endpoint for USER to DEVELOPER role transitions.

## CONVENTIONS
- **Auth Proxy** — Most routes rely on proxy.ts for role-based access control (USER/DEVELOPER/ADMIN).
- **Streaming** — Use AI SDK v6 streamText for chat. Handle stop conditions for tool calls explicitly.
- **Error Handling** — Return standard JSON responses with appropriate status codes for client-side toast notifications.
- **Registry** — Tools are mapped via lib/tools/registry.ts based on weblet capability flags.

## NOTES
- **Volatile Storage** — Images in /api/image are not persisted. They are lost on server restart.
- **Inngest Serve** — Always check inngest/route.ts when adding new background functions.
- **MCP Tokens** — OAuth and discovery logic live here, but encryption is handled in lib/mcp/encryption.ts.
- **Credit Logic** — Usage logging and credit deduction are integrated directly into the chat streaming route.