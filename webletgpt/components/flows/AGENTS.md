# FLOWS COMPONENTS

## OVERVIEW
React Flow-based UI for building and monitoring multi-agent workflows (DAGs).

## STRUCTURE
```
flows/
├── canvas/                    # Flow builder interface
│   ├── flow-canvas.tsx        # Main canvas (1008 lines) — React Flow state, node/edge management
│   └── weblet-node.tsx        # Custom node component (271 lines) — weblet selection, role config
└── run/                       # Execution monitoring
    └── agent-timeline.tsx     # Execution trace viewer (687 lines) — real-time Inngest event rendering
```

## WHERE TO LOOK
- **Adding node types**: `flow-canvas.tsx` — `nodeTypes` mapping + custom node components
- **Execution events**: `agent-timeline.tsx` — consumes Inngest Realtime events (`agent_text`, `tool_call`, `node_completed`, etc.)
- **Canvas state**: Persisted as `canvasState` JSON in `UserFlow` Prisma model

## NOTES
- `flow-canvas.tsx` has `as any` type assertions — avoid adding more
- Canvas state shape must match what `lib/inngest/orchestrator.ts` expects (nodes + edges)
- Agent timeline is the primary debugging UI for background flow execution
