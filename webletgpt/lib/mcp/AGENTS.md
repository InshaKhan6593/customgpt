# MCP MODULE

## OVERVIEW
Model Context Protocol integration — connects external tool servers with encrypted token management and OAuth 2.1 PKCE.

## FILES
| File | Purpose | Key Export |
|------|---------|------------|
| `client.ts` | Server connections, tool fetching | `getMCPTools()`, `closeMCPClients()` |
| `encryption.ts` | AES-256-GCM token encrypt/decrypt | `encrypt()`, `decrypt()` |
| `oauth-refresh.ts` | OAuth token refresh logic | `getValidAccessToken()` |
| `oauth-providers.ts` | Provider configurations | OAuth provider registry |
| `config.ts` | MCP server configuration | Connection settings |
| `discover.ts` | Server capability discovery | Discovery endpoints |
| `catalog.ts` | MCP server catalog | Available server listings |

## TOKEN RESOLUTION ORDER
`getMCPTools()` resolves credentials in priority: user OAuth token → user PAT → developer token → auth-required stub.

Missing auth produces stub tools returning `__mcp_auth_required: true` — frontend shows inline auth prompt.

## TRANSPORT
Tries SSE first, falls back to HTTP `/mcp` endpoint. Tool naming: `mcp_{sanitized_label}_{tool_name}`.

## ANTI-PATTERNS
- **NEVER** store tokens without `encryption.ts` — `MCP_ENCRYPTION_KEY` env var required (throws if missing)
- **NEVER** bypass token resolution order in `client.ts`
- Type assertions exist in `client.ts` and `discover.ts` — avoid adding more
