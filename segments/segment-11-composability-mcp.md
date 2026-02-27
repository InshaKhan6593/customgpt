# Segment 12: Composability & MCP

**Estimated effort:** 3 weeks
**Depends on:** Segment 05 (Chat Engine & Tools)
**Produces:** Weblet composability system (build weblets on top of other weblets) + MCP server integration for extending tool capabilities

---

## Goal

Build two related features that expand the platform's capabilities:

1. **Weblet Composability** — Developers can create new weblets that use other weblets as building blocks. A "Marketing Suite" weblet could compose "Content Writer" + "Image Generator" + "Data Analyzer" weblets.

2. **MCP (Model Context Protocol) Integration** — Creators can connect MCP servers to their weblets, instantly gaining access to tools like GitHub, Slack, Google Drive, databases, etc.

---

## What Already Exists (from Segments 01-05)

```
Database:
  WebletComposition — parentWebletId, childWebletId, config (JSON for input/output mapping)
Chat Engine:
  chatWithWeblet(webletId, messages) — can be called programmatically for any weblet
  Tool Registry — maps capabilities to tool definitions
  Vercel AI SDK — native MCP support via tool definitions
```

---

## Part A: Weblet Composability

### Architecture: 4 Layers

```
Layer 4: Meta-Weblets (orchestrate composites)
    ↑
Layer 3: Composite Weblets (combine base weblets)
    ↑
Layer 2: Base Weblets (single-purpose: writer, analyzer, generator)
    ↑
Layer 1: Infrastructure (APIs, state engine, event bus, auth, payments)
```

### How Composition Works

A composite weblet has:
- Its own system prompt (orchestration instructions)
- References to child weblets (via WebletComposition table)
- A config defining how children are used (input/output mapping, execution order)

At runtime, when a user chats with a composite weblet:
1. The composite's system prompt guides the LLM
2. Child weblets are exposed as tools (the LLM can "call" a child weblet)
3. Each child weblet call runs through the full chat engine (tools, RAG, etc.)
4. Results from children flow back to the composite

### Files to Create

```
app/(dashboard)/builder/[id]/compose/
└── page.tsx                          ← Composition editor (add/remove children, map I/O)

lib/composition/
├── resolver.ts                       ← Resolve child weblet dependencies (detect cycles)
├── child-tool-factory.ts             ← Create tool definitions for child weblets
└── executor.ts                       ← Execute composed weblet chains

components/builder/compose/
├── child-weblet-picker.tsx           ← Search and add child weblets
├── composition-graph.tsx             ← Visual graph showing parent → children relationships
├── io-mapper.tsx                     ← Map parent inputs to child inputs
└── composition-preview.tsx           ← Preview how composition will execute
```

### Implementation Details

**Child Weblets as Tools:**

```typescript
// lib/composition/child-tool-factory.ts
export function createChildWebletTools(compositions: WebletComposition[]) {
  const tools: Record<string, any> = {};

  for (const comp of compositions) {
    const child = comp.childWeblet;
    tools[`weblet_${child.slug}`] = tool({
      description: `Use the "${child.name}" weblet: ${child.description}`,
      parameters: z.object({
        message: z.string().describe("What to ask this weblet"),
      }),
      execute: async ({ message }) => {
        // Call the child weblet through the standard chat engine
        const result = await chatWithWeblet(child.id, [
          { role: "user", content: message },
        ]);
        return { response: result };
      },
    });
  }

  return tools;
}
```

**Runtime integration in chat API:**

```typescript
// In app/api/chat/route.ts — add after existing tool resolution:
if (weblet.compositions.length > 0) {
  const childTools = createChildWebletTools(weblet.compositions);
  Object.assign(tools, childTools);
}
```

**Cycle Detection:**

```typescript
// lib/composition/resolver.ts
export function detectCycles(parentId: string, childId: string): boolean {
  // BFS/DFS to check if adding childId as a child of parentId creates a cycle
  const visited = new Set<string>();
  const queue = [childId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === parentId) return true; // Cycle detected!
    if (visited.has(current)) continue;
    visited.add(current);

    // Get children of current
    const children = await db.webletComposition.findMany({
      where: { parentWebletId: current },
      select: { childWebletId: true },
    });
    queue.push(...children.map(c => c.childWebletId));
  }

  return false;
}
```

**Composition Editor UI:**

The builder gets a new "Compose" tab:
- Search bar to find existing weblets
- Click to add as child
- For each child: show name, description, and a toggle for "required" vs "optional"
- Visual graph showing the composition tree
- Cycle detection: show error if adding a child would create a circular dependency

### Composition Acceptance Criteria

- [ ] Creator can add child weblets to a parent weblet
- [ ] Cycle detection prevents circular dependencies
- [ ] Child weblets appear as callable tools in the parent's chat
- [ ] Calling a child tool runs through the full chat engine (with the child's own tools)
- [ ] Composition graph visualizes parent → children relationships
- [ ] Results from child weblets flow back to the parent conversation
- [ ] Child weblet access respects subscription status (user must have access to children)
- [ ] Compositions can be nested (composite can use another composite)
- [ ] Max depth limit: 3 levels (prevent infinite nesting)

---

## Part B: MCP Server Integration

### What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI models to external tools and data sources. MCP servers expose tools via a standard protocol, and AI SDKs can discover and call these tools automatically.

### How It Works on WebletGPT

Creators add MCP server URLs in the builder. The platform discovers available tools from the server and makes them available to the weblet's LLM at runtime.

### Files to Create

```
components/builder/
├── mcp-tab/
│   ├── mcp-server-list.tsx           ← List of added MCP servers
│   ├── mcp-server-add.tsx            ← Add new MCP server (URL, label, description)
│   └── mcp-tool-browser.tsx          ← Browse discovered tools from MCP server

lib/mcp/
├── discover.ts                       ← Discover tools from MCP server URL
├── tool-factory.ts                   ← Create AI SDK tool definitions from MCP tools
└── config.ts                         ← MCP configuration types
```

### Implementation

**Builder UI: Add MCP Server**

A new "MCP Servers" tab in the builder:

```
┌──────────────────────────────────────────┐
│  MCP Servers                              │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ GitHub MCP                           │ │
│  │ URL: mcp.github.example.com          │ │
│  │ Tools: create_issue, list_repos, ... │ │
│  │ Status: ✓ Connected  [Remove]        │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  [+ Add MCP Server]                       │
│                                           │
│  Server URL: [https://mcp.example.com  ] │
│  Label:      [My Custom Server         ] │
│  Description:[Connects to my database  ] │
│  [Discover Tools]  [Save]                │
└──────────────────────────────────────────┘
```

**Database addition:**
```prisma
// Add to Weblet model or create new model:
model WebletMCPServer {
  id          String @id @default(cuid())
  webletId    String
  weblet      Weblet @relation(fields: [webletId], references: [id], onDelete: Cascade)
  serverUrl   String
  label       String
  description String?
  tools       Json?   // Cached tool definitions discovered from server
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())

  @@unique([webletId, serverUrl])
}
```

**MCP Tool Discovery:**

```typescript
// lib/mcp/discover.ts
export async function discoverMCPTools(serverUrl: string) {
  // Use the MCP client to discover available tools
  // The exact implementation depends on the MCP SDK version
  const response = await fetch(`${serverUrl}/tools`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const tools = await response.json();
  return tools; // Array of { name, description, inputSchema }
}
```

**Runtime Integration:**

```typescript
// lib/mcp/tool-factory.ts
export function createMCPTools(mcpServers: WebletMCPServer[]) {
  const tools: Record<string, any> = {};

  for (const server of mcpServers) {
    if (!server.isActive || !server.tools) continue;

    for (const mcpTool of server.tools as MCPToolDef[]) {
      tools[`mcp_${server.label}_${mcpTool.name}`] = tool({
        description: `[${server.label}] ${mcpTool.description}`,
        parameters: jsonSchemaToZod(mcpTool.inputSchema),
        execute: async (params) => {
          const res = await fetch(`${server.serverUrl}/call`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool: mcpTool.name, arguments: params }),
          });
          return await res.json();
        },
      });
    }
  }

  return tools;
}
```

**Integration in chat API:**
```typescript
// In app/api/chat/route.ts — add after composition tools:
const mcpServers = await db.webletMCPServer.findMany({
  where: { webletId, isActive: true },
});
if (mcpServers.length > 0) {
  const mcpTools = createMCPTools(mcpServers);
  Object.assign(tools, mcpTools);
}
```

### MCP Acceptance Criteria

- [ ] Creator can add MCP server URL in builder
- [ ] "Discover Tools" button fetches available tools from server
- [ ] Discovered tools displayed with name and description
- [ ] Creator can enable/disable individual MCP tools
- [ ] Enabled MCP tools available to the weblet's LLM at runtime
- [ ] MCP tool calls execute correctly and return results
- [ ] Tool results displayed inline in chat (like other tools)
- [ ] Error handling: graceful failure if MCP server is unreachable
- [ ] Cached tool definitions refresh on demand ("Refresh Tools" button)

---

## Dependencies to Install

```bash
npm install @modelcontextprotocol/sdk  # MCP client SDK (if available)
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Child weblet calls are slow (nested LLM calls) | Set timeout per child call (30s). Show "Using [child name]..." loading state. Cache frequent results. |
| MCP servers may be unreachable | Timeout after 10s. Show error inline. Don't block the rest of the conversation. |
| MCP protocol may change | Use official SDK. Pin version. MCP is standardized and unlikely to have breaking changes. |
| Composition depth explosion | Hard limit: 3 levels of nesting. Warn creator if approaching limit. |
| Security: MCP servers could return malicious data | Sanitize MCP responses. Don't render raw HTML. Limit response size (1MB). |
