# Lovable Prompt: Segment 02 - Roles & Account Settings

**Context:** WebletGPT supports two user roles: `USER` (people who chat with AI) and `DEVELOPER` (people who build AI). We need a settings page where users can manage their profile and upgrade their account to become a Developer.

**Design Guidance:** Use Shadcn form components, tabs, and modals. Clean, minimal, dashboard-style aesthetic.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Only use the exact fields listed. Do not add fields like "Bio", "Company Name", or "Avatar Upload" right now. Our database only stores `name`, `email`, and `role`.
2. **NO EXTRA ROUTES:** Only build the `/settings` route.

---

## 1. Route: `/settings` (Account Settings Page)

**Purpose:** Allows users to update their name and upgrade their role.

**Required UI Elements:**
*   **Page Layout:** A standard settings page layout (sidebar nav on the left, content on the right).
    *   Sidebar Links: "General", "Billing" (disabled/grayed out for now), "Developer Options".
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
