# Orchestrator Quality Improvements Plan

## Context
The orchestrator currently sends a single user message for both initial execution and HITL revisions. When an agent is asked to refine with feedback, it doesn't see its own prior output as a natural conversation turn — just a concatenated string. This produces lower quality revisions. Additionally, there are no "preserve unchanged" instructions, no per-role temperature defaults, and prompts are scattered across code rather than stored centrally.

## Files to Modify
1. **`webletgpt/lib/inngest/orchestrator.ts`** — Main execution loop (multi-turn messages, temperature)
2. **`webletgpt/lib/orchestrator/roles.ts`** — Prompt builders (handoff messages, revision instructions)
3. **`webletgpt/lib/orchestrator/prompts.ts`** — NEW file for centralized prompt constants

---

## Changes

### 1. Create `lib/orchestrator/prompts.ts` — Centralized Prompt Constants

Store all orchestrator prompts as named constants so they're easy to find, edit, and track in Langfuse:

- `REVISION_INSTRUCTION` — injected when HITL feedback triggers a redo
- `PRESERVE_UNCHANGED` — tells agent to only change what feedback mentions
- `INTERMEDIATE_STEP_NOTE` / `FINAL_STEP_NOTE` — step position context
- `ROLE_TEMPERATURES` — per-role temperature defaults (researcher: 0.2, writer: 0.6, coder: 0.1, etc.)
- `DEFAULT_TEMPERATURE` — fallback: 0.4

### 2. Multi-Turn Messages for HITL Revisions

**Current:** Always sends single user message (concatenated context + feedback):
```
messages: [{ role: "user", content: everything_concatenated }]
```

**New:** For revisions, use natural multi-turn conversation:
```
messages: [
  { role: "user", content: originalTaskMessage },
  { role: "assistant", content: agentPreviousOutput },
  { role: "user", content: feedbackWithPreserveInstruction },
]
```

This gives the model conversational memory of what it produced — dramatically improving revision quality.

### 3. New `buildRevisionMessages()` Function

Returns a multi-turn array with 3 messages:
- Turn 1 (user): Original task + previous step context
- Turn 2 (assistant): Agent's own previous output
- Turn 3 (user): Reviewer feedback + preserve unchanged instruction

### 4. "Preserve Unchanged" Instruction

```
IMPORTANT REVISION RULES:
- ONLY modify the specific aspects mentioned in the feedback.
- Keep all other parts of your output UNCHANGED.
- Do not rewrite from scratch unless the feedback explicitly asks for it.
- If the output is long, clearly indicate what you changed.
```

### 5. Per-Role Temperature Defaults

| Role | Temperature | Reasoning |
|------|------------|-----------|
| Researcher | 0.2 | Factual accuracy |
| Analyst | 0.2 | Data precision |
| Reviewer | 0.15 | Consistency |
| Editor | 0.15 | Precision |
| Writer | 0.6 | Creativity |
| Designer | 0.5 | Creative concepts |
| Coder | 0.1 | Code precision |
| Custom/Default | 0.4 | Balanced |

### 6. Track `previousStepOutput` Separately

Add dedicated variable to avoid confusion between "previous step's output" and "current step's output during revision".

### 7. Enhanced Langfuse Telemetry

Add to metadata: `temperature`, `messageFormat` (single_turn vs multi_turn_revision), `inputMapping`.

---

## Verification
1. Create a 2-step flow with HITL on step 1
2. Run → Step 1 generates → HITL card appears
3. Approve with feedback → Verify revision uses 3 messages in Langfuse
4. Verify revised output preserves unchanged sections
5. Verify step 2 receives step 1's output correctly
6. Test flow WITHOUT HITL still works (no regression)

---

## Competitor Research Summary

### What Platforms Do

| Platform | Context Passing | HITL | Quality Features |
|----------|----------------|------|-----------------|
| **CrewAI** | Task `context` param + shared memory (short/long/entity) | `human_input=True` flag + HumanTool | Guardrails, Pydantic validation, auto-retry, `expected_output` rubric |
| **AutoGen** | Shared message thread in GroupChat | `UserProxyAgent` with 3 modes (ALWAYS/TERMINATE/NEVER) | Code execution sandbox, `Teachability`, termination functions |
| **LangGraph** | Typed state graph with reducer functions | `interrupt_before/after` + `Command` API + time-travel | Checkpointing, conditional edges, subgraphs, streaming |
| **Relevance AI** | Visual wiring + shared variables + knowledge bases | Approval nodes + escalation rules + review queues | A/B testing, analytics dashboards, confidence thresholds |
| **n8n** | Node wiring with expression references | Wait nodes + webhook resume | Error branches, retry with backoff, conditional routing |
| **OpenAI Assistants** | Persistent Threads | `requires_action` status pause | Code interpreter self-heal, structured outputs, JSON mode |

### WebletGPT Competitive Strengths
- Auto-suggest team via LLM (unique)
- Real-time Ably monitoring (comparable to AutoGen Studio)
- Inngest background execution (solves serverless timeouts)
- Role assignment system (comparable to CrewAI)

### Priority Features to Implement (Future)

| Priority | Feature | Effort | Inspired By |
|----------|---------|--------|-------------|
| P0 | Quality gates (LLM-as-judge auto-retry) | Medium | CrewAI guardrails |
| P0 | Execution history persistence + replay | Medium | n8n, LangGraph |
| P1 | Structured output schemas per step | Medium | CrewAI, OpenAI |
| P1 | Per-run cost & time tracking in UI | Small | Relevance AI |
| P1 | Webhook/API triggers for flows | Medium | n8n, Stack AI |
| P2 | Conditional branching / error paths | Large | LangGraph, n8n |
| P2 | Confidence-based auto-escalation | Small | Relevance AI |
| P2 | Persistent agent memory across runs | Medium | CrewAI, AutoGen |
| P3 | Template gallery / marketplace | Medium | Flowise, AutoGen Studio |
| P3 | Parallel fan-out steps | Large | LangGraph |
