# Lovable Prompt: Segment 08 - Monetization & Cost Architecture

**Context:** WebletGPT is transitioning to a **credit-based usage model**. Instead of flat limits, users consume credits based on the complexity of their chats (e.g., simple chat = 1 credit, image gen = 5 credits). We need frontend UI components to show users their credit usage, warn them when they run out, and manage developer auto-reload settings.

**Design Guidance:** Information regarding limits and pricing should be incredibly clear and non-intrusive until necessary. Use clean Shadcn UI components (Progress, AlertDialog, Card).

## Core Directives (CRITICAL)
1. **NO BACKEND LOGIC:** Focus purely on the UI components and dummy state. The backend middleware will manage actual quota math.
2. **COMPONENTS FIRST:** Build modular components that can be placed in headers, sidebars, or over chat windows.

---

## 1. Global Component: User Credit Progress Bar

**Purpose:** A visual indicator of the user's monthly credit usage, visible persistently (likely in the top navigation bar or sidebar).

**Required UI Elements:**
*   A Shadcn `Tooltip` wrapping the entire component.
*   **Visual:** A small Shadcn `Progress` bar.
*   **Text:** `[Used Credits] / [Total Credits] used` (e.g., "147 / 1,000 used").
*   **Hover State (Tooltip Content):**
    *   "Resets in [X] days"
    *   A breakdown (optional for now, but good to design for): "Today: 12 credits", "This Week: 47 credits".

## 2. Global Component: "Out of Credits" Upgrade Modal

**Purpose:** An interceptor dialog that pops up when a free user tries to send a message but has 0 credits remaining.

**Required UI Elements:**
*   A Shadcn `AlertDialog` that cannot be dismissed by clicking outside (they must acknowledge it).
*   **Title:** "You've used all your free credits this month."
*   **Description:** "Upgrade to the Plus plan for 1,000 credits/month at just $9.99/mo to continue chatting with advanced Weblets."
*   **Actions:**
    *   `Cancel` / `Maybe Later` (Secondary button, closes dialog)
    *   `Upgrade to Plus` (Primary button, distinct color)
*   **Behavior:** Clicking "Upgrade" should show a loading state while redirecting to the Stripe checkout flow.

## 3. Global Component: Developer Quota Exceeded Alert

**Purpose:** A graceful error state shown to a *User* when the *Developer* whose Weblet they are using has run out of credits (and auto-reload failed).

**Required UI Elements:**
*   This can be a special system message rendered in the chat stream, OR a Shadcn `Alert` banner at the top of the chat area.
*   **Style:** Destructive / Warning.
*   **Text:** "This Weblet is temporarily unavailable (creator quota exceeded)."
*   **Note:** The user should still be able to read their chat history, but the input box should be disabled.

## 4. Route Update: `/billing` (Developer Settings Addition)

**Purpose:** Adding Developer-specific settings to the existing billing page.

**Required UI Elements:**
*   Below the "Active Subscriptions" table, add a new section: **Developer Settings**.
*   **Top Card:** Current Developer Plan (e.g., "Pro Tier - 10,000 credits/mo").
*   **Section: Auto-Reload Configuration**
    *   **Toggle Switch:** "Enable Auto-Reload"
    *   **Description:** "Automatically purchase additional credits when your balance hits 0 to prevent your Weblets from going offline."
    *   **Input (if toggled ON):** A select or number input for the reload amount: "Reload $10 (2,000 credits) at a time."
    *   **Save Button.**

## 5. Route Update: `/marketplace` (Basic Launch)

**Purpose:** To fetch and display all public, active Weblets.

**Required UI Elements:**
*   **Header:** "Marketplace" and a subtitle like "Discover AI agents built by the community."
*   **Search Bar:** A Shadcn `Input` for searching Weblets by name.
*   **Filters:** A Shadcn `Select` dropdown to filter by Category (e.g., PRODUCTIVITY, EDUCATION).
*   **Grid Layout:** Use CSS Grid (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
*   **Weblet Cards:** Each card should show:
    *   Icon/Avatar
    *   Name
    *   Creator Name
    *   Category Badge
    *   Price Badge (e.g., "Free" or "$5/mo")
*   **Interaction:** Clicking a card routes to `/c/[webletId]` (the chat interface). If it's a paid Weblet, the existing Paywall component will trigger.
