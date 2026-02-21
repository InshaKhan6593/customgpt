# Lovable Prompt: Segments 11 & 13 - Multi-Agent Orchestration & Workflow Builder

**Context:** Users can string multiple Weblets together into a "Flow". For example, passing the output of a "Research Agent" directly into a "Writing Agent".

**Design Guidance:** This requires a node-based visual editor or a clean linear step-by-step list builder. Shadcn drag-and-drop lists work well here if a full canvas is too complex.

## Core Directives (CRITICAL)
1. **NO EXTRA ROUTES:** Only build the `/flows` and `/flows/builder/[id]` routes.
2. **NO EXTRA FIELDS:** Stick exactly to the flow schema.

---

## 1. Route: `/flows` (User Flows Dashboard)

**Purpose:** Where users see the multi-agent workflows they have created.

**Required UI Elements:**
*   **Header:** "My AI Workflows"
*   **Button:** "Create New Flow" (Primary, top right).
*   **List/Grid:** Showing existing saved flows.
    *   Card shows: Flow Name, Flow Description.
    *   Tags/Badges indicating the Weblets used (e.g., "[ResearchBot] ➔ [WriterBot]").
    *   Actions: "Run Flow", "Edit", "Delete".

## 2. Route: `/flows/builder/[id]` (Workflow Builder)

**Purpose:** The visual studio where users map out how agents pass data to each other.

**Required UI Elements:**
*   **Top Bar:** Flow Name Input, Save Button, "Run Flow" Button, "Simulate Run" Button (Secondary style).
*   **Execution Mode Toggle:** A radio group or toggle for "Sequential" (A → B → C) vs "Hybrid" (Master Agent delegates to others).
*   **Auto-Suggest Team Button:** A magic wand icon button labeled "Auto-Suggest Team" (Description: "Let the LLM pick the best agents for your flow goal").
*   **Main Area (Sequential Mode):**
    *   A vertical list of "Steps". Users can click "Add Step" to append a new agent to the chain.
*   **Main Area (Hybrid Mode):**
    *   A top fixed card for the "Master Weblet".
    *   A list below it for "Available Sub-Weblets" that the master can choose to call.
*   **Step Component UI:**
    *   **Agent Selection:** A Shadcn Combobox/Select to pick which Weblet runs at this step.
    *   **Input Mapping:** A dropdown asking: "What should this agent use as its prompt?" Options: "User's Original Prompt", "Output of Previous Step".
    *   **Human-in-the-Loop Toggle:** A switch labeled "Pause for my approval before running this step."
    *   **Delete Icon:** Remove this step from the flow.

**Logic / State:**
*   The first step in the flow cannot select "Output of Previous Step" (it must be the Original Prompt).
*   Clicking "Run Flow" should open a modal that looks like the standard Chat interface, but includes a progress tracker at the top (e.g., "Step 1: Researching... (Spinner) ➔ Step 2: Pending...").
