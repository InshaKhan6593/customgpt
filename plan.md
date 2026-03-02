# Plan: Add Per-Step Instructions & Default Prompt to Flow Builder

## Summary
Add a `stepPrompt` textarea to each step in the flow builder, giving users explicit control over what each agent should do. Also add a `defaultPrompt` field to the flow itself, so the initial user prompt is configured at build time (pre-filling the run page).

## Changes

### 1. Prisma Schema — Add `defaultPrompt` column
**File:** `prisma/schema.prisma` (line 144)
- Add `defaultPrompt String?` to the `UserFlow` model
- Run `npx prisma db push` (no migration needed for dev)

### 2. API Zod Schemas — Add `stepPrompt` to step objects + `defaultPrompt` to flow
**File:** `app/api/flows/route.ts` (lines 8-21)
- Add `stepPrompt: z.string().optional()` to the step object schema
- Add `defaultPrompt: z.string().max(2000).optional()` to the create schema

**File:** `app/api/flows/[id]/route.ts` (lines 8-21)
- Same: add `stepPrompt` to step schema, `defaultPrompt` to update schema

### 3. Flow Builder UI — Add `defaultPrompt` textarea + per-step `stepPrompt`
**File:** `app/flows/builder/[id]/page.tsx`
- **Left sidebar:** Add a "Default Prompt" textarea below the Execution Mode selector. This is the prompt that pre-fills the run page.
- **Each step card:** Add a `stepPrompt` textarea below the existing fields (agent, role, input source) and above the HITL toggle. Label: "Instructions for this agent". Placeholder: "Tell this agent exactly what to do..."
- **Save function:** Include `defaultPrompt` in the PATCH payload
- **addStep:** Include `stepPrompt: ""` in default step object

### 4. Run Page — Pre-fill with `defaultPrompt`
**File:** `app/flows/run/[id]/page.tsx`
- When flow loads (line 39-40), set `initialInput` to `flow.defaultPrompt` if it exists
- Keep the textarea editable so users can modify per-run
- If `defaultPrompt` exists, show a subtle label "Pre-filled from flow config"

### 5. Orchestrator — Inject `stepPrompt` into system prompt
**File:** `lib/inngest/orchestrator.ts` (lines 146-166)
- After building the system prompt (with or without role), append `stepPrompt` if present:
  ```
  if (currentStep.stepPrompt) {
    systemPrompt += `\n\nADDITIONAL INSTRUCTIONS:\n${currentStep.stepPrompt}`;
  }
  ```
- This goes after `buildRolePrompt` so it's the last thing the agent sees in system prompt

### 6. Roles.ts — No changes needed
The `buildRolePrompt` and `buildHandoffMessage` functions don't need modification. `stepPrompt` is injected at the orchestrator level after role prompt is built.

## Architecture Notes
- `stepPrompt` is stored in the `steps` Json field (no migration needed)
- `defaultPrompt` is a new column on `UserFlow` (requires db push)
- Backward compatible: existing flows without these fields work fine (both are optional)
- `stepPrompt` goes into the system prompt (instructions FOR the agent), not the user message
