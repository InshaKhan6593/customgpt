# Segment 08: Monetization & Cost Architecture

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
