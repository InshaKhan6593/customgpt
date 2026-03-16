# COMPOSITION MODULE

## OVERVIEW
Enables weblet-to-weblet calling — parent weblets invoke child weblets as AI SDK tools with cycle detection.

## FILES
| File | Purpose | Key Export |
|------|---------|------------|
| `child-tool-factory.ts` | Converts WebletComposition → AI SDK tools | `createChildWebletTools()` |
| `executor.ts` | Runs child weblet synchronously (280 lines) | `executeChildWeblet()` |
| `resolver.ts` | BFS cycle detection | Prevents circular references |

## HOW IT WORKS
1. `createChildWebletTools()` reads `WebletComposition` records from DB
2. Each child becomes an AI SDK tool named `weblet_{slug}`
3. Parent calls child via `generateText` (synchronous, not streaming)
4. `resolver.ts` runs BFS to detect cycles before execution

## CONSTRAINTS
- **Hard recursion limit: 3 levels** — never increase without reviewing memory implications
- Child calls use `generateText` (not `streamText`) — results returned as tool output
- Type assertions exist in `executor.ts` and `child-tool-factory.ts`
