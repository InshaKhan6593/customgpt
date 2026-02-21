# Lovable Prompt: Segment 09 - Developer Dashboard & Analytics

**Context:** The Developer Dashboard is a complex analytics and control center where developers review the performance of their AI agents across thousands of user interactions.

**Design Guidance:** Data-dense, analytical, sidebar-driven dashboard. Use Shadcn components, Recharts for graphing, and data tables.

## Core Directives (CRITICAL)
1. **NO EXTRA ENDPOINTS:** WebletGPT tracks specific events (chats, ratings, revenue, RSIL scores). Do not invent stats like "Bounce Rate" or "Session Length" that we aren't tracking in Prisma.
2. **NO EXTRA ROUTES:** Build `/dashboard` and `/dashboard/weblet/[id]`.

---

## 1. Route: `/dashboard` (All-Weblet Overview Page)

**Purpose:** High-level overview of the developer's entire portfolio.

**Required UI Elements:**
*   **Top Row (Stats Cards):** 4 Cards.
    *   "Total Chats" (Number + trend arrow).
    *   "Average Rating" (Star + x.x/5.0).
    *   "Active Subscribers" (Number).
    *   "Total Revenue" (Dollar amount, e.g., $1,240.00).
*   **Main Graph (Revenue & Usage Trend):**
    *   A combination Line/Bar chart comparing Chats (Bars) against Revenue (Line) over the last 30 days.
*   **Bottom Section (My Weblets Table):**
    *   A table of their Weblets sorted by chat volume.
    *   Columns: Weblet Name, Category (Badge), Status (Active/Draft), 30-Day Chats, Avg Rating, Revenue.
    *   Action: "View Analytics" button on each row linking to `/dashboard/weblet/[id]`.

---

## 2. Route: `/dashboard/weblet/[id]` (Per-Weblet Deep Dive)

**Purpose:** Drilling down into a specific AI agent's performance and reviewing AI-generated Suggestions (RSIL).

**Required UI Elements (Tabs):**
*   **Header:** Weblet Name, Status Badge, "Edit deeply in Builder" button.
*   **Tab 1: Overview**
    *   Daily Chat Trend (Bar chart).
    *   "Latest Chat Topics" (A tag cloud or list of common phrases).
    *   "Category Rank" (e.g., "Rank #4 in Finance").
*   **Tab 2: RSIL Settings & Inbox (CRITICAL)**
    *   This is the Recursive Self-Improving Loop management tab.
    *   **Top Card (Active A/B Test):** Shows "Control (V2)" vs "Challenger (V3)". Displays the traffic split (e.g., 50/50) and current ratings for both. Includes a "Deploy Winner" and "End Test" buttons.
    *   **Middle Section (Suggestions Inbox):** 
        *   A list/feed of `RsilSuggestion` cards.
        *   Each card shows: "The AI gave dangerous advice and scored 2.6/5.0."
        *   Each card shows a proposed System Prompt update.
        *   Action Buttons on each card: "[Approve & A/B Test]" (Primary) or "[Dismiss]" (Secondary/Ghost).
    *   **Bottom Section (Reflection Logs):**
        *   A standard data table tracking the last 50 automated evaluations.
        *   Columns: Date, Score (x.x/5.0), Decision (None, Suggestion, Auto-Update).
        *   Must support a dropdown/accordion to expand a row and read the full "Ruthless Evaluation Text" explaining the score.
*   **Tab 3: Monetization**
    *   Subscriber List (Table of user emails, subscription date, status).
    *   Revenue History (Line chart).
*   **Tab 4: Execution Logs (Observability - Segment 15)**
    *   Powered by Langfuse.
    *   A list of recent chat sessions showing Session ID, Date, User ID, and Latency.
    *   When a developer clicks a session, show a timeline trace view:
        *   Step 1: The exact System Prompt injected.
        *   Step 2: The User's Message.
        *   Step 3: Tool Calls (e.g., "Called WebSearch with payload {...}").
        *   Step 4: Tool Response.
        *   Step 5: Final LLM Markdown Response.
*   **Tab 5: Developer Billing & Credits (Segment 08)**
    *   **Current Balance Card:** Shows "Available Platform Credits" (e.g., "4,500 Credits").
    *   **Auto-Reload Setting:** Shadcn Switch. Label "Auto-reload credits when balance falls below 1,000".
    *   **Refill Button:** "Buy More Credits" (opens a modal to purchase $10, $50, or $100 packages via Stripe).
    *   **Credit Usage Graph:** A bar chart showing credits burned per day on this Weblet (separated by model costs vs tool costs).

**Logic / State:**
*   Approving an RSIL suggestion immediately places it in a loading state while the prompt builds in the backend, then moving the card to a "Completed" state.
*   The Execution Logs timeline should visually nest tool calls inside the main LLM generation block.
