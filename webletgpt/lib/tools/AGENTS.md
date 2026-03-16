# TOOLS MODULE

## OVERVIEW
Maps weblet capability flags to AI SDK tool instances for chat and flow execution.

## FILES
| File | Purpose | Key Export |
|------|---------|------------|
| `registry.ts` | Capability → tool mapping | `getToolsFromCapabilities()` |
| `web-search.ts` | Tavily API integration | Web search tool |
| `code-interpreter.ts` | E2B Python sandbox | Code execution tool |
| `image-generation.ts` | DALL-E 3 (direct) + OpenRouter fallback | Image gen tool |
| `image-store.ts` | In-memory LRU (max 500) | `storeImage()`, `getImage()` |
| `file-search.ts` | Hybrid RAG (pgvector + full-text, RRF fusion) | File search tool |
| `openapi.ts` | OpenAPI 3.x → AI SDK tool definitions | Schema parser |
| `action-executor.ts` | Action execution | **Stub — TODO for OpenAPI parsing** |

## WHERE TO LOOK
- **Adding a new tool**: Create tool file, then register in `registry.ts` under capability flag
- **Image serving**: Images stored via `image-store.ts`, served via `app/api/image/[id]/route.ts`
- **RAG search**: `file-search.ts` uses Reciprocal Rank Fusion to merge vector + text results

## NOTES
- `code-interpreter.ts` checks `E2B_API_KEY` — gracefully degrades if missing
- `image-store.ts` is in-memory only — images lost on restart/redeploy
- `code-interpreter.ts` has `as any` type assertion for dynamic property access
- Tool names for MCP follow `mcp_{sanitized_label}_{tool_name}` convention (see `lib/mcp/`)
