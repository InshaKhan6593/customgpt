# Segment 014: Categories & Discovery

**Type:** Cross-cutting concern (marketplace, builder, dashboard)
**Depends on:** Segment 03 (WebletCategory enum), Segment 04 (Builder UI), Segment 17 (Marketplace)
**Referenced by:** Segment 04, Segment 09, Segment 17

---

## What This Module Is

Every weblet belongs to a category. Developers choose a category when building their weblet, and users browse the marketplace by category. This module defines the category taxonomy, how weblets are ranked and discovered, and how the marketplace search and filtering works.

Without categories, the marketplace would be a flat list of hundreds of weblets with no organization. With categories, a user looking for a coding assistant can immediately filter to "Code" and find what they need.

> **Example:** Developer Priya builds a weblet called "Essay Editor" that helps students improve their writing. She selects the WRITING category in the builder. When user Tom opens the marketplace and clicks the "Writing" tab, Essay Editor appears alongside other writing-focused weblets, ranked by popularity and rating. Tom can also search "essay" and find it directly.

---

## How It Will Be Done

### Step 1 — Define the Category Taxonomy

The platform uses 13 fixed categories. These are defined as a Prisma enum (in Segment 03) and cannot be created by users — this prevents tag proliferation and keeps the marketplace organized.

| Category | Icon (lucide-react) | Description | Example Weblets |
|----------|-------------------|-------------|-----------------|
| **WRITING** | PenTool | Content creation, copywriting, editing, blogging | Blog Writer, Email Composer, Story Editor |
| **CODE** | Code | Programming, debugging, code review, documentation | Python Tutor, Code Reviewer, API Helper |
| **DATA_ANALYSIS** | BarChart3 | Data analysis, visualization, spreadsheets, SQL | CSV Analyzer, SQL Helper, Chart Generator |
| **MARKETING** | Megaphone | Marketing strategy, SEO, social media, ads | SEO Optimizer, Ad Copywriter, Social Planner |
| **EDUCATION** | GraduationCap | Teaching, tutoring, learning, course content | Math Tutor, Language Coach, Quiz Maker |
| **CUSTOMER_SUPPORT** | Headphones | Support automation, FAQ bots, ticket handling | Ticket Classifier, FAQ Bot, Feedback Analyzer |
| **RESEARCH** | Search | Research assistance, literature review, fact-checking | Paper Summarizer, Fact Checker, Source Finder |
| **CREATIVE** | Palette | Art direction, design feedback, creative writing, brainstorming | Story Writer, Design Critic, Brainstorm Partner |
| **PRODUCTIVITY** | Zap | Task management, scheduling, meeting notes, automation | Meeting Summarizer, Task Planner, Email Sorter |
| **FINANCE** | DollarSign | Financial analysis, accounting, budgeting, investing | Budget Analyzer, Tax Helper, Invoice Generator |
| **HEALTH** | Heart | Health information, wellness, fitness, nutrition | Symptom Explainer, Diet Planner, Workout Coach |
| **LEGAL** | Scale | Legal research, contract review, compliance | Contract Reviewer, Legal Q&A, Privacy Checker |
| **OTHER** | MoreHorizontal | Anything that doesn't fit the above categories | Custom tools, niche assistants |

> **Why fixed categories instead of free-form tags?** Platforms like the App Store and GPT Store use curated categories because they prevent fragmentation. "code" vs "coding" vs "programming" vs "dev" would all be different tags but mean the same thing. Fixed categories keep the marketplace clean.

### Step 2 — Developer Picks a Category in the Builder

In the Weblet Builder (Segment 04), the Configure tab includes a category selector:

1. The selector appears as the second field, right after the weblet name
2. It is a searchable dropdown — the developer can type to filter (e.g., typing "code" shows CODE)
3. Each option shows the icon, category name, and a short description
4. Category is **required before publishing** to the marketplace — but optional for drafts
5. The developer can change the category at any time after publishing (the weblet moves in the marketplace)

> **Example:** Developer Alex is building a weblet that helps with SQL queries. He starts typing "data" in the category dropdown and sees "Data Analysis" with the BarChart3 icon. He selects it. Later, he realizes it's more of a "Code" tool and switches the category — the weblet immediately appears under Code in the marketplace.

### Step 3 — Marketplace Category Navigation

The marketplace uses a horizontal scrollable tab bar at the top:

```
[All (247)] [Writing (42)] [Code (38)] [Data Analysis (31)] [Marketing (28)] [Education (25)] ...
```

- "All" is selected by default and shows all weblets
- Each tab shows the count of active weblets in that category
- Clicking a tab filters the grid to show only that category's weblets
- On mobile, the tabs are horizontally scrollable

Below the category tabs, additional filters are available:
- **Rating**: 4+ stars, 3+ stars, All
- **Capabilities**: Has web search, Has code interpreter, Has image generation, Has knowledge base
- **Sort**: Popular (default), Newest, Top Rated, Most Active (last 7 days)

### Step 4 — Search Implementation

The marketplace search bar searches across:
- Weblet name (highest weight)
- Weblet description (medium weight)
- Category name (medium weight)
- Conversation starters (lower weight)

The search uses PostgreSQL full-text search with weighted vectors for ranking. Results are instant (debounced 300ms input).

> **Example:** User searches "help me write emails." The search finds weblets with "write" and "email" in their name or description. "Email Composer" (WRITING category) ranks highest because both terms appear in the name. "Business Writer" ranks second because "email" appears in its description.

### Step 5 — Ranking Algorithm

Weblets are ranked within each category using a score that combines four factors:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| **Chat Volume** | 35% | Total number of chat sessions — indicates popularity |
| **Average Rating** | 30% | Mean of all 1-5 star ratings — indicates quality |
| **Recency** | 20% | Ratio of chats in last 7 days vs total chats — indicates current relevance |
| **Completion Rate** | 15% | Non-abandoned sessions / total sessions — indicates user satisfaction |

**How ranking works:**
1. A Vercel Cron job runs every hour
2. It calculates the rank score for every active weblet
3. Scores are stored in a cached field (or Redis) for fast marketplace queries
4. The marketplace API sorts by this cached score when "Popular" sort is selected

**New weblet boost:** Weblets published in the last 7 days get a temporary 1.5x multiplier to their rank score so they have a chance to appear before accumulating ratings. The boost decays linearly over the 7 days.

> **Example:** "Code Reviewer" has 500 chats, 4.2 avg rating, 80 chats this week, and 90% completion rate. Its score: (0.35 × 0.5) + (0.30 × 0.84) + (0.20 × 0.16) + (0.15 × 0.90) = 0.175 + 0.252 + 0.032 + 0.135 = 0.594. A newer weblet with 50 chats but 4.8 rating might score lower overall but appear in "Newest" and "Top Rated" sorts.

### Step 6 — Category-Specific Leaderboard

Each category has its own leaderboard that is visible:
- **To users** — "Top in Writing" section on the category page
- **To developers** — "Your rank in [Category]: #N" on the developer dashboard

The leaderboard shows the top 10 weblets per category with their rank score, chat count, and rating.

### Step 7 — Featured Sections on Marketplace Home

The marketplace home page (before any category is selected) shows curated sections:

| Section | Logic | Display |
|---------|-------|---------|
| **Trending This Week** | Highest week-over-week growth in chat sessions | Horizontal scroll of 8 weblet cards |
| **New Arrivals** | Most recently published weblets (last 14 days) | Horizontal scroll of 8 weblet cards |
| **Top Rated** | Highest average rating with minimum 10 ratings | Horizontal scroll of 8 weblet cards |
| **Popular in [Category]** | Top 4 weblets per category (rotated daily) | Grid of category cards, each showing 4 weblets |

### Step 8 — Database Indexes for Performance

Add these indexes to ensure marketplace queries remain fast as the platform scales:

- Composite index on `(category, isActive)` — for category filtering
- Composite index on `(category, rankScore DESC)` where `isActive = true` — for sorted category pages
- Full-text search index on `(name, description)` — for search queries
- Index on `createdAt DESC` where `isActive = true` — for "Newest" sort

---

## After Completion, the User Will Be Able To

1. **Developers** can select a category when creating/editing a weblet in the builder
2. **Developers** can see their weblet's rank within its category on the dashboard
3. **Users** can browse the marketplace by category using tabs
4. **Users** can search for weblets and get ranked results
5. **Users** can sort by Popular, Newest, Top Rated, or Most Active
6. **Users** can filter by rating and capabilities
7. **Everyone** sees curated featured sections (Trending, New Arrivals, Top Rated)

---

## Connections to Other Segments

- **Segment 03** defines the WebletCategory enum and the category field on the Weblet model
- **Segment 04** (Builder) adds the category selector to the Configure tab
- **Segment 09** (Developer Dashboard) shows category breakdown chart and category rank metric
- **Segment 17** (Marketplace) implements the category navigation, search, and ranking display
- **MODULE-orchestration-workflows** — flow builder lets users filter weblets by category when adding to a flow
