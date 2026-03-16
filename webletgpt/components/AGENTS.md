# COMPONENTS KNOWLEDGE BASE

## OVERVIEW
UI component layer for WebletGPT marketplace and builder.

## STRUCTURE
- `ui/`: 60+ shadcn/ui primitives. `sidebar.tsx` (726 lines) and `chart.tsx` (353 lines) are core.
- `chat/`: Core user interface. `tool-invocation-toggle.tsx` (615 lines) handles interactive tool states.
- `builder/`: Developer IDE. Multi-tab logic in `configure-tab/` and specialized `mcp-tab/` modules.
- `flows/`: Node-based logic. `canvas/flow-canvas.tsx` (1000+ lines) manages React Flow state.
- `chats/`: `my-chats-client.tsx` (726 lines) manages session listing and filtering.
- `billing/` & `monetization/`: Credit management and developer payout UIs.
- `marketplace/`: Weblet discovery and subscription flows.

## WHERE TO LOOK
| Feature | Path | Key Files |
|---------|------|-----------|
| Chat Interface | `chat/` | `chat-container.tsx`, `message-list.tsx` |
| Weblet Builder | `builder/` | `builder-layout.tsx`, `preview-chat.tsx` |
| Flow Canvas | `flows/canvas/` | `flow-canvas.tsx`, `weblet-node.tsx` |
| Execution Trace | `flows/run/` | `agent-timeline.tsx` (687 lines) |
| Layout Shell | Root | `nav-header.tsx`, `providers.tsx` |

## NOTES
- `chat-markdown.tsx` uses numerous `as any` type assertions for custom rendering.
- `premium-code-block.tsx` handles syntax highlighting and copy-to-clipboard logic.
- Builder state is split across specialized tab directories (e.g., `knowledge-tab/`, `mcp-tab/`).
- Sidebar implementation is heavy (700+ lines); check `ui/sidebar.tsx` for navigation logic.
- Use `agent-timeline.tsx` for debugging background Inngest execution visually.
