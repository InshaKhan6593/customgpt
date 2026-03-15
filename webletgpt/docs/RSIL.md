# RSIL — Recursive Self-Improving Loop

## What is RSIL?

RSIL (Recursive Self-Improving Loop) is a planned system that allows Weblets to autonomously improve their own system prompts over time based on real user feedback signals captured through Langfuse observability.

The core idea: instead of a developer manually reviewing conversations and rewriting prompts, the platform periodically analyzes production traces, scores, and user ratings — then generates improved prompt candidates, runs them as A/B tests against live traffic, and automatically promotes winners to ACTIVE status.

---

## Current Implementation Status

### What IS implemented (on disk)

#### Schema fields (`prisma/schema.prisma`)

**On `Weblet` model:**
```prisma
rsilEnabled    Boolean  @default(false)   // opt-in flag per weblet
rsilGovernance Json?                      // governance config (thresholds, safety rules)
```

**On `WebletVersion` model:**
```prisma
isAbTest         Boolean   @default(false)   // marks versions created by RSIL as A/B tests
abTestTrafficPct Int       @default(50)      // % of traffic routed to this challenger version
abTestStartedAt  DateTime?                   // when A/B test began
abTestEndedAt    DateTime?                   // when test concluded
abTestWinner     Boolean?                    // true = promoted, false = discarded, null = pending
avgScore         Float?                      // cached avg Langfuse score for this version
```

**On `ChatSession` model:**
```prisma
langfuseTraceId String?   // links each session to a Langfuse trace for score lookup
```

#### Langfuse REST Client (`lib/langfuse/client.ts`)

Five API functions already implemented:

| Function | Purpose |
|---|---|
| `pushScore({ traceId, name, value, comment })` | Push a thumbs-up/down or numeric score to Langfuse, linked to a session trace |
| `fetchTraces({ webletId, fromTimestamp, limit })` | Pull production traces for a weblet — used by RSIL analyzer |
| `fetchScores({ webletId, fromTimestamp, limit })` | Pull scores for a weblet — the signal RSIL optimizes against |
| `upsertTrace({ id, name, userId, ... })` | Create/update a Langfuse trace anchored to a `ChatSession.id` |
| `fetchSessions({ webletId, limit })` | Fetch Langfuse session aggregates |

Every chat response in `app/api/chat/route.ts` calls `upsertTrace()` on completion, writing the session ID as the trace ID. This creates the data pipeline RSIL needs.

#### Prompt Sync (`lib/langfuse/prompt-sync.ts`)

`syncPromptToLangfuse({ webletId, webletName, prompt, versionNum, isActive })` pushes every `WebletVersion` prompt to Langfuse Prompt Management, tagging it `"production"` (active) or `"staging"` (draft/test). This gives the Langfuse UI a version history view and lets RSIL retrieve historical prompts via the Langfuse API.

---

### What is NOT yet implemented

The following files/modules are **planned but do not exist on disk**:

```
lib/rsil/
├── scheduler.ts      # Inngest cron — triggers daily RSIL analysis per enabled weblet
├── analyzer.ts       # Fetches Langfuse traces + scores, computes per-version avgScore
├── generator.ts      # Calls GPT-4o to generate improved prompt candidates
├── ab-test.ts        # Creates new WebletVersion with isAbTest=true, routes traffic
├── deployer.ts       # Promotes winner to ACTIVE, archives loser
└── governance.ts     # Safety checks using rsilGovernance config before auto-deploy
```

---

## Planned Architecture

### Data Flow

```
Production chat
      │
      ▼
ChatSession created ──► upsertTrace() ──► Langfuse trace (tagged webletId:xxx)
      │
      ▼ (user thumbs up/down)
pushScore() ──► Langfuse score linked to traceId
      │
      ▼ (daily Inngest cron)
RSIL Scheduler
      │
      ├─► Analyzer: fetchScores() + fetchTraces()
      │         └── Compute avgScore per WebletVersion
      │         └── Update WebletVersion.avgScore in DB
      │
      ├─► Generator (if avgScore < threshold)
      │         └── GPT-4o reads low-scoring conversations
      │         └── Generates improved system prompt
      │
      ├─► A/B Test Creator
      │         └── Create new WebletVersion (isAbTest=true, abTestTrafficPct=50)
      │         └── Route 50% of new sessions to challenger
      │
      └─► Deployer (after N days or M sessions)
                └── Compare champion vs challenger avgScore
                └── governance.ts safety check (rsilGovernance rules)
                └── Winner → ACTIVE, loser → ROLLED_BACK
```

### Traffic Routing (planned)

When a weblet has an A/B test version (`isAbTest=true`), `lib/chat/engine.ts → getActiveVersion()` would:
1. Check if any `WebletVersion` has `isAbTest=true` and `abTestEndedAt=null`
2. Use a deterministic hash of `userId` to assign them to champion or challenger
3. Return the appropriate version for the session

This ensures each user consistently sees the same version throughout a test window (no version switching mid-conversation).

### Governance (`rsilGovernance` JSON field)

The `rsilGovernance` field on `Weblet` stores per-weblet safety configuration:

```json
{
  "minSampleSize": 50,
  "minScoreThreshold": 0.6,
  "maxAutoDeployScoreDelta": 0.2,
  "requireHumanApprovalAbove": 0.15,
  "blockedTopics": ["medical advice", "legal advice"],
  "testDurationDays": 7
}
```

Auto-deploy is only permitted when:
- Sample size exceeds `minSampleSize`
- Score improvement delta is within `maxAutoDeployScoreDelta` (prevents runaway prompts)
- If delta exceeds `requireHumanApprovalAbove`, a notification is sent to the developer for manual review

---

## Implementation Guide (Next Steps)

### Step 1 — Traffic routing in `getActiveVersion()`

Modify `lib/chat/engine.ts`:

```ts
// If an A/B test is active, route user deterministically
const challenger = versions.find(v => v.isAbTest && !v.abTestEndedAt)
if (challenger) {
  const hash = hashUserId(userId) % 100
  if (hash < challenger.abTestTrafficPct) return challenger
}
return versions.find(v => v.status === "ACTIVE") ?? null
```

### Step 2 — Analyzer Inngest function

```ts
// lib/rsil/analyzer.ts
export async function analyzeWeblet(webletId: string) {
  const since = subDays(new Date(), 7).toISOString()
  const scores = await fetchScores({ webletId, fromTimestamp: since })
  // Group by versionId from trace metadata
  // Compute avgScore per version
  // Update WebletVersion.avgScore in DB
}
```

### Step 3 — Generator (GPT-4o prompt improver)

```ts
// lib/rsil/generator.ts
export async function generateImprovedPrompt(webletId: string, currentPrompt: string, badTraces: Trace[]) {
  const { object } = await generateObject({
    model: getLanguageModel("openai/gpt-4o"),
    schema: z.object({ improvedPrompt: z.string(), reasoning: z.string() }),
    prompt: `You are a prompt engineer. Here is the current system prompt and examples of low-scoring conversations. Generate an improved prompt that addresses the failures.\n\nCurrent prompt:\n${currentPrompt}\n\nLow-scoring examples:\n${formatTraces(badTraces)}`
  })
  return object
}
```

### Step 4 — Inngest cron scheduler

```ts
// lib/rsil/scheduler.ts
export const rsilDailyCron = inngest.createFunction(
  { id: "rsil-daily-optimizer" },
  { cron: "0 2 * * *" }, // 2am daily
  async ({ step }) => {
    const weblets = await step.run("fetch-rsil-weblets", () =>
      prisma.weblet.findMany({ where: { rsilEnabled: true, isActive: true } })
    )
    for (const weblet of weblets) {
      await step.run(`analyze-${weblet.id}`, () => analyzeWeblet(weblet.id))
    }
  }
)
```

---

## Enabling RSIL for a Weblet

Once implemented, developers opt in via the Builder UI (Optimize tab):

1. Toggle `rsilEnabled = true` on the Weblet
2. Configure `rsilGovernance` thresholds
3. The daily cron automatically picks up the weblet on its next run

User feedback (thumbs up/down in chat) → Langfuse scores → RSIL signal.

---

## Related Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `Weblet.rsilEnabled`, `WebletVersion.isAbTest/avgScore/abTest*` |
| `lib/langfuse/client.ts` | `fetchTraces`, `fetchScores`, `pushScore`, `upsertTrace` |
| `lib/langfuse/prompt-sync.ts` | Pushes prompts to Langfuse on every version publish |
| `app/api/chat/route.ts` | Calls `upsertTrace()` on every completed chat → creates the data pipeline |
| `lib/chat/engine.ts` | `getActiveVersion()` — where A/B routing logic will be added |
| `lib/inngest/functions.ts` | Where the RSIL cron function needs to be registered |
