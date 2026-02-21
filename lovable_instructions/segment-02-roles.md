# Lovable Prompt: Segment 02 - Roles & Account Settings

**Context:** WebletGPT supports three user roles: `USER` (people who chat with AI), `DEVELOPER` (people who build AI), and `ADMIN` (platform managers). We need a settings page, a role-aware navigation header, and a developer dashboard sidebar layout. Every new account starts as USER. Developers upgrade from USER — there is no separate developer signup.

**Design Guidance:** Use Shadcn form components, tabs, modals, and sidebar. Clean, minimal, dashboard-style aesthetic. Use `lucide-react` icons throughout.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Only use the exact fields listed. Do not add fields like "Bio", "Company Name", or "Avatar Upload" right now. Our database only stores `name`, `email`, and `role`.
2. **ONLY BUILD THESE ROUTES:** `/settings`, `/dashboard` (layout only — page already exists), `/profile`, `/become-developer`.
3. **ROLE PROP:** All role-aware components accept a `role` prop of type `"USER" | "DEVELOPER" | "ADMIN"`. We will wire this to real session data in the backend.

---

## 1. Route: `/settings` (Account Settings Page)

**Purpose:** Allows users to update their name and upgrade their role.

**Required UI Elements:**
*   **Page Layout:** A standard settings page layout (sidebar nav on the left, content on the right).
    *   Sidebar Links: "General", "Billing" (disabled/grayed out for now), "Developer Options", "Danger Zone".
*   **Content Area (General Tab):**
    *   **Header:** "General Settings"
    *   **Form Field:** "Display Name"
        *   Type: Text input
        *   Placeholder: "e.g., Jane Doe"
        *   Validation: Max 50 characters.
    *   **Form Field:** "Email Address"
        *   Type: Text input
        *   State: Read-only / Disabled (users cannot change their login email).
        *   Value: `user@example.com`
    *   **Submit Button:** "Save Changes" (shows loading state).

*   **Content Area (Danger Zone Tab):**
    *   **Header:** "Danger Zone"
    *   **Action:** "Delete Account"
        *   Warning Text: "Once you delete your account, there is no going back. Please be certain."
        *   **Button:** "Delete Account" (Destructive styling).
        *   **Interaction:** Clicking it opens a confirmation modal where they must type "DELETE" to confirm.

*   **Content Area (Developer Options Tab):**
    *   **Header:** "Developer Settings"
    *   **State 1 (If user is currently Role = USER):**
        *   Show an upgrade banner/card: "Unlock Developer Mode"
        *   Text: "Create your own Weblets, access the API, and monetize your AI creations."
        *   **Button:** "Become a Developer" (Primary color).
        *   **Logic:** When clicked, it should open a confirmation modal. "Are you sure you want to upgrade your account? This will give you access to the Weblet Builder and Marketplace publishing tools." -> [Confirm Upgrade] [Cancel].
    *   **State 2 (If user is currently Role = DEVELOPER):**
        *   Show a success/status card: "You are a registered Developer."
        *   **Button:** "Go to Developer Dashboard" (Routes to `/dashboard`).
        *   *Note to Lovable:* Create both states so we can toggle them via props in the backend.

---

## 2. Component: NavHeader (Role-Aware Navigation)

**Purpose:** The main navigation header adapts its links based on the user's role. Reuse the existing `NavHeader` component — update it to show different navigation items per role.

**Required Behavior:**

*   **When USER:**
    *   Left nav links: "Marketplace" (`/marketplace`), "My Chats" (`/chats`), "My Flows" (`/flows`)
    *   User dropdown menu items: "Profile" (`/profile`), "Settings" (`/settings`), "Become a Developer" (`/become-developer`), "Sign Out"

*   **When DEVELOPER:**
    *   Left nav links: "Dashboard" (`/dashboard`), "Marketplace" (`/marketplace`), "My Chats" (`/chats`), "My Flows" (`/flows`)
    *   User dropdown menu items: "Profile" (`/profile`), "Settings" (`/settings`), "Sign Out"

*   **When ADMIN:**
    *   Left nav links: "Dashboard" (`/dashboard`), "Admin Panel" (`/admin`), "Marketplace" (`/marketplace`), "My Chats" (`/chats`), "My Flows" (`/flows`)
    *   User dropdown menu items: "Profile" (`/profile`), "Settings" (`/settings`), "Sign Out"

*   **When not logged in:**
    *   Left nav links: "Marketplace" (`/marketplace`)
    *   Right side: "Sign In" button (`/login`)

*   **User Avatar:** Show initials derived from user name (or first letter of email if no name). Clicking opens the dropdown menu.

---

## 3. Layout: `/dashboard` (Developer Dashboard Sidebar)

**Purpose:** The developer dashboard uses a sidebar layout. This is a layout wrapper — do NOT recreate the dashboard page content itself (it already exists).

**Required UI Elements:**
*   **Sidebar (left, collapsible on mobile):**
    *   **Section: "Developer Tools"**
        *   "Dashboard" (`/dashboard`) — icon: `LayoutDashboard`
        *   "Builder" (`/dashboard/builder`) — icon: `Hammer`
        *   "My Weblets" (`/dashboard/weblets`) — icon: `Bot`
        *   "Analytics" (`/dashboard/analytics`) — icon: `BarChart3`
        *   "RSIL" (`/dashboard/rsil`) — icon: `Sparkles`
        *   "API Keys" (`/dashboard/api-keys`) — icon: `Key`
    *   **Section: "Account"**
        *   "Payouts" (`/dashboard/payouts`) — icon: `Wallet` (disabled/grayed out, tooltip: "Coming soon")
        *   "Settings" (`/settings`) — icon: `Settings`
    *   **Active state:** Highlight the current page link based on the URL pathname.
    *   **Collapse behavior:** On mobile, sidebar collapses into a hamburger menu.
*   **Main content area:** Renders children (the actual page content).
*   **Note to Lovable:** Use Shadcn `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` components. The sidebar layout should be in `app/dashboard/layout.tsx`.

---

## 4. Route: `/profile` (User Profile Page)

**Purpose:** Shows the current user's profile information and provides a CTA to upgrade if they are a USER.

**Required UI Elements:**
*   **Header:** "My Profile"
*   **Info Card:**
    *   Display Name (or "No name set")
    *   Email address
    *   Role badge: shows "User", "Developer", or "Admin" with appropriate color (muted for User, primary for Developer, destructive for Admin)
    *   Member since date (placeholder: "January 2025")
*   **CTA Card (only if Role = USER):**
    *   Title: "Ready to build?"
    *   Text: "Upgrade to Developer to create your own Weblets, access the builder, and publish to the marketplace."
    *   **Button:** "Become a Developer" (routes to `/become-developer`)
*   **CTA Card (if Role = DEVELOPER):**
    *   Title: "Developer Account Active"
    *   Text: "You have full access to the builder, dashboard, and marketplace publishing tools."
    *   **Button:** "Go to Dashboard" (routes to `/dashboard`)

---

## 5. Route: `/become-developer` (Role Upgrade Page)

**Purpose:** A dedicated page where users can upgrade from USER to DEVELOPER.

**Required UI Elements:**
*   **Header:** "Become a Developer"
*   **Benefits List (Card):**
    *   "Build custom AI agents (Weblets) with our visual builder"
    *   "Publish to the marketplace and reach thousands of users"
    *   "Access detailed analytics and performance metrics"
    *   "Configure RSIL for real-time prompt optimization"
    *   "Monetize your creations (coming soon)"
*   **Terms Section:**
    *   Checkbox: "I agree to the Developer Terms of Service" (must be checked to proceed)
    *   Link: "Read Developer Terms" (opens `/terms/developer` in new tab — just link it, page not needed yet)
*   **Button:** "Upgrade to Developer" (Primary, disabled until checkbox is checked, shows loading state on click)
*   **If user is already DEVELOPER:**
    *   Show a card: "You're already a Developer!" with a "Go to Dashboard" button.
*   **Note to Lovable:** The actual role upgrade API call (`POST /api/upgrade-role`) will be wired in the backend. For now, the button should call a placeholder async function and show a success toast + redirect to `/dashboard`.
