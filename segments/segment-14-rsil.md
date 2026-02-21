# Segment 14: RSIL (Recursive Self-Improving Loop)

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
