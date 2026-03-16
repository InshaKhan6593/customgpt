# INNGEST MODULE

## OVERVIEW
Background job execution via Inngest — DAG orchestrator for multi-agent flows + billing cron.

## FILES
| File | Purpose | Key Export |
|------|---------|------------|
| `orchestrator.ts` | DAG executor (753 lines) | `executeFlow` Inngest function |
| `client.ts` | Inngest client setup | `inngest` client instance |
| `functions.ts` | Billing cron job | `resetBillingCycles` function |

## ORCHESTRATOR (orchestrator.ts)
The most complex file in the project. Execution flow:
1. Loads DAG from `canvasState.nodes` + `canvasState.edges`
2. Computes execution frontier (nodes with satisfied deps)
3. Runs frontier nodes in parallel via `Promise.all`
4. Each node streams via AI SDK `streamText` + publishes events via Inngest Realtime
5. Supports Human-in-the-Loop (HITL) via `step.waitForEvent` (24h timeout)

## CROSS-DEPENDENCIES
Heaviest import graph in the project:
- `lib/chat/engine` — version resolution
- `lib/ai/openrouter` — model access
- `lib/tools/registry` — tool provisioning
- `lib/mcp/client` — external tools
- `lib/composition/child-tool-factory` — weblet nesting
- `lib/billing/*` — usage logging
- `lib/utils/truncate` — output truncation

## REGISTRATION
All Inngest functions MUST be added to the serve array in `app/api/inngest/route.ts`.

## EVENTS
Published to frontend: `started`, `node_started`, `agent_text`, `tool_call`, `step_completed`, `node_completed`, `hitl_required`, `completed`, `failed`.
