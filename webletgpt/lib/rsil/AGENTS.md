# RSIL MODULE

## OVERVIEW
Reinforcement Self-Improving Loop — automated A/B testing and prompt optimization for weblet versions.

## FILES
| File | Purpose | Key Export |
|------|---------|------------|
| `ab-test.ts` | A/B test routing logic | Routes users to active vs candidate versions |
| `analyzer.ts` | Performance analysis | Evaluates version metrics |
| `generator.ts` | Candidate prompt generation | Creates optimized prompt variants |
| `deployer.ts` | Version promotion | Promotes winning variants to ACTIVE |
| `governance.ts` | Safety guardrails | Prevents harmful prompt mutations |
| `scheduler.ts` | Daily optimization cron | `rsilDailyOptimizer` Inngest function |

## FLOW
1. `scheduler.ts` triggers daily via Inngest cron
2. `analyzer.ts` evaluates current version performance
3. `generator.ts` creates candidate prompt variants
4. `governance.ts` validates candidates against safety rules
5. `ab-test.ts` routes traffic between ACTIVE and TESTING versions
6. `deployer.ts` promotes winners based on metric thresholds

## INTEGRATION
- `lib/chat/engine.ts` calls `ab-test.ts` during `getActiveVersion()` to route requests
- Scheduler registered in `app/api/inngest/route.ts` serve array
- TODO stubs remain for full RSIL enforcement (Segment 7/8)
