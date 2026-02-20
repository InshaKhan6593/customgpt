# Segment 15: Marketplace, Security & Launch

**Estimated effort:** 3 weeks
**Depends on:** All previous segments
**Produces:** Public marketplace, security hardening, performance optimization, monitoring, documentation, and production deployment

---

## Goal

The final segment. Make the platform production-ready: build the public-facing marketplace where users discover weblets, harden security, optimize performance, set up monitoring, write documentation, and deploy to production.

---

## What Already Exists (from Segments 1-11)

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
// middleware.ts — add rate limiting
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

