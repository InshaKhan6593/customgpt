# Segment 12: Orchestration Workflows & Flow Builder

**Type:** Cross-cutting concern (orchestration, user flows, HITL)
**Depends on:** Segment 05 (Chat Engine), Segment 10 (Multi-Agent), Segment 11 (Composability)
**Referenced by:** Segment 10, Segment 15 (Marketplace)

---

## What This Module Is

This module defines how users and developers create and run multi-weblet workflows. There are two distinct paradigms:

1. **User Flows** — Any authenticated user can combine marketplace weblets into a pipeline. The user defines the sequence. Simple and visual.
2. **Developer Orchestration** — Developers build complex multi-agent systems with LLM-powered planning, conditional logic, and advanced execution modes.

Both paradigms support **Human-in-the-Loop (HITL)** — the ability for a human to pause, review, approve, modify, or reject steps during execution.

> **Example of a User Flow:** Marketing manager Sarah wants to create content for her company blog. She opens the Flow Builder, searches the marketplace, and adds three weblets: "Research Bot" → "Blog Writer" → "SEO Optimizer." She saves this as "Content Pipeline." When she runs it with the task "Write a blog post about AI in healthcare," the Research Bot gathers data, passes it to Blog Writer which drafts the post, and SEO Optimizer refines it for search engines. Sarah reviews the output at each step.

> **Example of Developer Orchestration:** Developer Alex builds a "Customer Support Team" that uses an LLM planner to analyze incoming support tickets and route them to the right specialist weblet — "Technical Support," "Billing Help," or "General FAQ" — based on the ticket content. The master weblet decides in real-time which sub-weblet handles each request.

---

## How It Will Be Done

### Step 1 — Understand the Two Paradigms

**User Flows (simple):**
- Created by any authenticated user (USER or DEVELOPER role)
- Built via a visual drag-and-drop Flow Builder
- Two modes: SEQUENTIAL (A → B → C) and HYBRID (master weblet decides routing)
- Steps are weblets picked from the marketplace
- Stored in the `UserFlow` database model
- No LLM planner — the user defines everything manually

**Developer Orchestration (advanced):**
- Created by developers within the context of a multi-agent setup (Segment 10)
- Uses an LLM-powered planner to decompose tasks and assign weblets
- Three execution modes: Sequential, Concurrent (parallel), and Hybrid
- Supports dynamic task assignment and conditional branching
- More complex HITL with confidence-based gates

> **Why two paradigms?** Users want simplicity — "connect these three weblets in a line." Developers want power — "build a multi-agent team that makes decisions." Separating them keeps the user experience clean while giving developers full control.

### Step 2 — Build the User Flow Builder UI

The Flow Builder is accessible to all authenticated users at `/(user)/flows/`:

**Flow List Page (`/(user)/flows/`):**
- Shows all of the user's saved flows in a card grid
- Each card shows: flow name, step count, mode (Sequential/Hybrid), last run date
- "Create New Flow" button

**Flow Builder Page (`/(user)/flows/new`):**
The builder has three sections:

**Section A — Weblet Picker (left panel):**
- Search bar connected to the marketplace API
- Category filter tabs (from MODULE-categories-discovery)
- Grid of weblet cards showing: name, category, rating, description
- Click a weblet to add it to the flow

**Section B — Flow Canvas (center panel):**
- Visual representation of the flow steps
- For SEQUENTIAL mode: vertical list of step cards connected by arrows
  ```
  ┌─────────────┐
  │ Research Bot │  Step 1 — "Use original input"
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │ Blog Writer  │  Step 2 — "Use output from Step 1" [HITL: ON]
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │ SEO Helper   │  Step 3 — "Use output from Step 2"
  └─────────────┘
  ```
- For HYBRID mode: a master weblet at the top, sub-weblets below
  ```
  ┌──────────────────┐
  │  Master Weblet    │  Decides which sub-weblet to call
  └────────┬─────────┘
       ┌───┼───┐
       ↓   ↓   ↓
  ┌────┐ ┌────┐ ┌────┐
  │ A  │ │ B  │ │ C  │  Available sub-weblets
  └────┘ └────┘ └────┘
  ```
- Drag-and-drop to reorder steps (sequential only)
- Click a step to configure it

**Section C — Step Configuration (right panel, appears when a step is selected):**
- Input mapping: "Use original user input" or "Use output from Step N"
- HITL gate: Toggle "Pause for my review before this step"
- Remove step button

### Step 3 — Define the Sequential Flow Execution

When a user runs a SEQUENTIAL flow:

```
User enters task: "Write a blog post about AI in healthcare"
  ↓
Step 1: Research Bot
  Input: "Write a blog post about AI in healthcare" (original)
  → AI researches the topic, returns findings
  Output: "Key findings: AI in diagnostics is growing 40%..."
  ↓
[HITL Gate — if enabled]
  User reviews Research Bot's output
  Options: Approve | Modify | Reject | Skip
  ↓
Step 2: Blog Writer
  Input: Research Bot's output (previous step)
  → AI writes the blog post using the research
  Output: "# AI in Healthcare: 5 Trends..." (full blog post)
  ↓
Step 3: SEO Optimizer
  Input: Blog Writer's output (previous step)
  → AI optimizes for SEO
  Output: "# AI in Healthcare: 5 Trends..." (SEO-optimized version)
  ↓
Final output presented to user
```

**State machine for each step:**
```
PENDING → RUNNING → COMPLETED → (next step)
                  → HITL_WAITING → APPROVED → COMPLETED
                                 → MODIFIED → RUNNING (re-run with modified input)
                                 → REJECTED → FAILED
                                 → SKIPPED → (next step with previous output)
                  → FAILED → RETRYING → RUNNING
                           → FAILED (permanent — user decides: skip or cancel)
```

**State machine for the entire flow:**
```
CREATED → RUNNING → COMPLETED (all steps done)
                  → PAUSED (HITL waiting)
                  → FAILED (unrecoverable step failure)
                  → CANCELED (user canceled)
```

### Step 4 — Define the Hybrid / Master Weblet Routing

In HYBRID mode, a "master weblet" decides which sub-weblet to call:

1. The user selects a master weblet and a set of available sub-weblets
2. At runtime, the sub-weblets are exposed as tools to the master weblet's LLM
3. The master weblet analyzes the user's task and decides which sub-weblet(s) to call
4. The master can call multiple sub-weblets in sequence, combine their outputs, and present a unified response
5. The master can also decide NOT to call any sub-weblet and respond directly

> **Example:** The master weblet is "Customer Support Router." Sub-weblets are "Technical Support," "Billing Help," and "General FAQ." A user writes "I can't log in and I was charged twice." The master recognizes two issues: it calls Technical Support for the login issue, then Billing Help for the charge issue, and combines both responses into a single answer.

**How sub-weblets become tools:**
Each sub-weblet is registered as a callable tool with:
- Tool name: the sub-weblet's name (slugified)
- Tool description: the sub-weblet's description (tells the master when to use it)
- Tool input: the task/question to delegate
- Tool execution: runs the full chat engine for the sub-weblet (same as a regular chat)

This reuses the composability infrastructure from Segment 11 — child weblets as tools.

### Step 5 — Design Human-in-the-Loop (HITL) in Detail

HITL allows humans to intervene during flow execution. There are three types of gates and four types of responses.

**Gate Types:**

| Gate Type | When It Triggers | Use Case |
|-----------|-----------------|----------|
| **Pre-step** | Before a step runs. User reviews the planned input. | "Let me check what's being sent to the next weblet" |
| **Post-step** | After a step runs. User reviews the output. | "Let me verify this output before passing it along" |
| **Confidence-based** | System auto-pauses when it detects uncertainty | "The AI seems unsure about this — please review" (future, advanced) |

**Response Types:**

| Response | What Happens | Example |
|----------|-------------|---------|
| **Approve** | Flow continues to the next step | "This research looks good, proceed to writing" |
| **Modify** | User edits the output. Modified version is passed to the next step. | "Change the tone to be more professional" — user edits the text |
| **Reject with Feedback** | The step is re-run with the user's feedback appended to the input | "This missed the key point about pricing. Focus on pricing." — step re-runs |
| **Escalate** | The flow pauses permanently. The task is flagged in the admin escalation queue. | "This is too sensitive for AI. A human specialist needs to handle this." |

**HITL UI — The Approval Dialog:**

```
┌────────────────────────────────────────────────────────┐
│  Step 2: Blog Writer                    ⏱ Paused 2m    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Output from Blog Writer:                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ # AI in Healthcare: 5 Trends Reshaping Medicine  │  │
│  │                                                    │  │
│  │ Artificial intelligence is transforming...        │  │
│  │ [full output shown, scrollable]                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Approve  │ │  Modify  │ │  Reject  │ │ Escalate │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                        │
│  [Cancel entire flow]                                  │
└────────────────────────────────────────────────────────┘
```

**Timeout:** If no response within 30 minutes (configurable), the flow auto-cancels. A notification is sent.

**Audit trail:** Every HITL interaction is logged to the `AnalyticsEvent` table with eventType `hitl_decision`, including: step number, decision type, original output, modified output (if applicable), and response time.

### Step 6 — Real-Time Progress Updates

During flow execution, the user sees real-time progress via Ably pub/sub:

```
┌────────────────────────────────────────┐
│  Running: Content Pipeline             │
│                                        │
│  ✅ Step 1: Research Bot      Done     │
│  ⏳ Step 2: Blog Writer     Running... │
│  ⬜ Step 3: SEO Optimizer    Pending   │
│                                        │
│  [Cancel Flow]                         │
└────────────────────────────────────────┘
```

Each step card shows:
- Step number and weblet name
- Status icon: ⬜ Pending, ⏳ Running, ⏸ Paused (HITL), ✅ Completed, ❌ Failed
- Execution time
- Expandable output (click to see what the step produced)

Updates are pushed via Ably channels:
- Channel: `flow:{flowId}`
- Events: `step:started`, `step:completed`, `step:failed`, `step:hitl_waiting`, `flow:completed`, `flow:failed`

### Step 7 — Error Handling and Recovery

**When a step fails:**
1. Auto-retry once with the same input
2. If retry fails: pause the flow and show the error to the user
3. User can: Fix the input and retry, Skip this step (next step gets the previous step's output), or Cancel the flow

**When the Ably connection drops:**
1. Auto-reconnect with exponential backoff
2. On reconnect, fetch the current flow state from the server
3. Replay any missed events

**When a step times out (30 seconds default):**
1. Mark the step as failed
2. Show the user: "Step timed out. Retry or skip?"

---

## Files Summary

```
app/(user)/flows/
├── page.tsx                      ← List user's saved flows
├── new/page.tsx                  ← Flow Builder (create new flow)
└── [id]/
    ├── page.tsx                  ← Run/view a saved flow
    └── edit/page.tsx             ← Edit flow configuration

components/flows/
├── flow-builder.tsx              ← Main builder with 3 panels
├── weblet-picker.tsx             ← Marketplace search panel for adding weblets
├── flow-canvas.tsx               ← Visual flow representation (sequential or hybrid)
├── step-card.tsx                 ← Individual step in the canvas
├── step-config.tsx               ← Step configuration panel (input mapping, HITL)
├── flow-runner.tsx               ← Execute flow with real-time progress
├── flow-progress.tsx             ← Real-time progress display
├── hitl-dialog.tsx               ← HITL approval dialog (approve/modify/reject/escalate)
└── flow-output.tsx               ← Final aggregated output display

lib/orchestrator/
├── flow-executor.ts              ← Execute UserFlow (sequential and hybrid modes)
├── master-router.ts              ← Master weblet routing for hybrid mode
├── state.ts                      ← Orchestration state management
├── hitl.ts                       ← Human-in-the-loop logic and timeout handling
└── realtime.ts                   ← Ably pub/sub wrapper for flow updates
```

---

## After This Module Is Implemented, Users Will Be Able To

1. **Create flows** by picking weblets from the marketplace and arranging them in sequence
2. **Choose hybrid mode** where a master weblet decides routing automatically
3. **Set HITL gates** on any step to review outputs before continuing
4. **Run flows** and watch real-time progress as each step executes
5. **Approve, modify, reject, or escalate** at HITL gates
6. **Save and reuse flows** — run the same pipeline with different inputs
7. **Recover from errors** — retry failed steps, skip them, or cancel

---

## Connections to Other Segments

- **Segment 03** — `UserFlow` database model stores flow configurations
- **Segment 05** — `chatWithWeblet()` function runs each step (same chat engine)
- **Segment 10** — Advanced orchestration (LLM planner, concurrent execution) for developer use
- **Segment 11** — Composability infrastructure reused for master weblet tool calls
- **Segment 15** — Marketplace weblet picker reused in the flow builder
- **MODULE-payment-subscription** — Flow billing (users need subscriptions to paid weblets in the flow)

