# Lovable Prompt: Segments 16 & 17 - The Weblet Marketplace

**Context:** The Marketplace is the public-facing directory where users discover and subscribe to AI agents built by developers. It acts like an App Store for custom GPTs.

**Design Guidance:** Visually engaging, grid-based layouts. Excellent use of whitespace, category badges, and search functionality. Look at the ChatGPT Store or standard SaaS directories for inspiration.

## Core Directives (CRITICAL)
1. **NO EXTRA ROUTES:** Only build `/marketplace`, `/marketplace/weblet/[slug]`, `/competition`, and `/docs`.
2. **USE SHADCN:** Cards for the grid, Input for search, Select for category filtering.

---

## 1. Route: `/marketplace` (Discovery Feed)

**Purpose:** The main hub to browse all active AI agents.

**Required UI Elements:**
*   **Hero Section:** "Discover the best AI Agents tailored for you." Search bar prominently displayed.
*   **Featured Section (Horizontal Scroll):** "Trending Weblets this Week". 3-4 large highlight cards.
*   **Leaderboard Section:** "Top Agents by Category". A widget showing #1, #2, #3 ranked agents in the currently selected category.
*   **Sidebar (Filters):**
    *   "Categories" (A list of checkboxes or links: WRITING, CODE, DATA_ANALYSIS, MARKETING, EDUCATION, CUSTOMER_SUPPORT, RESEARCH, CREATIVE, PRODUCTIVITY, FINANCE, HEALTH, LEGAL, OTHER).
    *   "Pricing" (Checkboxes: Free, Paid).
*   **Main Grid (Weblet Cards):**
    *   A responsive grid of Shadcn Cards.
    *   **Card Contents:**
        *   Weblet Icon (Avatar) & Name.
        *   Developer Name (e.g., "by Alex").
        *   Rating Badge (e.g., "★ 4.8").
        *   Category Badge (e.g., "Marketing").
        *   Short description (truncated to 2 lines).
        *   Price tag (e.g., "Free" or "$5/mo").

**Logic / State:**
*   Typing in the search bar should visually filter the grid (assume we handle the API logic, just build the loading state and empty state: "No Weblets found for 'xyz'").

---

## 2. Route: `/marketplace/weblet/[slug]` (Agent Landing Page)

**Purpose:** A dedicated sales/information page for a specific Weblet before the user decides to start chatting with it.

**Required UI Elements:**
*   **Left Column (Details):**
    *   Large Weblet Icon & Name.
    *   Developer Name.
    *   Full Description (Markdown rendered).
    *   "Categories" badges.
    *   "Capabilities" badges (Icons showing if it has Web Search, Code Interpreter, Image Generation).
    *   "Metrics" (Total Chats, Average Rating).
*   **Right Column (Action/Pricing Card):**
    *   If Free: A large "Start Chatting Now" primary button.
    *   If Paid: The Payment Pricing Card component (from Segment 06 instructions) with the price, feature list, and "Subscribe to Chat" button.

**Logic / State:**
*   Clicking "Start Chatting Now" routes the user directly to `/chat/[id]`.

---

## 3. Route: `/competition` (Permanent Route)

**Purpose:** A dedicated static page outlining the WebletGPT developer competition.

**Required UI Elements:**
*   A long-form, visually engaging landing page layout.
*   **Hero:** "The WebletGPT $100k Developer Hackathon".
*   **Content:** Prize pools, rules, submission deadlines, and a "Register Now" CTA.

---

## 4. Route: `/docs` (Documentation Hub)

**Purpose:** Static markdown-style content for users and creators.

**Required UI Elements:**
*   Left sidebar with documentation sections: "User Guide", "Creator Guide", "API Reference", "MCP Integration Guidelines".
*   Main content area rendering markdown content.
