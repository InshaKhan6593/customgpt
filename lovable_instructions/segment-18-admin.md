# Lovable Prompt: Segment 18 - Admin Panel & Platform Defense

**Context:** WebletGPT requires a dedicated Admin Panel for platform operators to manage users, moderate content, and handle system health. This panel is restricted to the `ADMIN` role.

**Design Guidance:** Utilitarian, data-dense, dashboard aesthetic. Use Shadcn Data Tables for lists and Cards for metrics.

## Core Directives (CRITICAL)
1. **NO EXTRA ROUTES:** Only build `/admin`, `/admin/users`, `/admin/weblets`, and `/admin/payouts`.
2. **RESTRICTED ACCESS:** Assume all these routes are protected by a layout that checks for `role === "ADMIN"`.

---

## 1. Route: `/admin` (Admin Overview Dashboard)

**Purpose:** High-level metrics for the platform operator.

**Required UI Elements:**
*   **Top Nav:** A secondary navigation bar specific to admins (Links: Overview, Users, Weblet Moderation, Payouts).
*   **Top Row (Stats Cards):** 
    *   "Total MRR" (Monthly Recurring Revenue).
    *   "Total Platform Credits Burned (30d)".
    *   "Active Subscriptions".
    *   "Pending Payouts" (Dollar amount).
*   **Activity Feed:** A scrolling list of recent critical system events (e.g., "User banned", "Weblet reported", "Stripe Refund processed").

---

## 2. Route: `/admin/users` (User Management)

**Purpose:** Manage the platform's user base and enforce bans.

**Required UI Elements:**
*   **Data Table:**
    *   Columns: Name, Email, Role (Dropdown: USER, DEVELOPER, ADMIN), Status (Active, Banned), action menu (...).
    *   Search bar for email/name.
    *   Filters by Role and Status.
*   **Actions:**
    *   "Impersonate User" (Triggers a session swap).
    *   "Ban User" (Opens a destructive confirmation modal).

---

## 3. Route: `/admin/weblets` (Weblet Moderation)

**Purpose:** Review flagged/reported Weblets and enforce TOS.

**Required UI Elements:**
*   **Data Table:**
    *   Columns: Weblet Name, Creator Email, Report Count (Red badge if > 0), Status (Draft, Published, Suspended), action menu (...).
    *   Search by Weblet Name or ID.
*   **Actions:**
    *   "View Reports" (Opens a modal showing the text provided by users who clicked 'Report Weblet').
    *   "Suspend Weblet" (Forces the Weblet back to Draft status and emails the creator).
    *   "Delete Weblet" (Hard delete for extreme violations).

---

## 4. Route: `/admin/payouts` (Manual Payout Review)

**Purpose:** Approve or deny developer PayPal payout requests.

**Required UI Elements:**
*   **Top Alert:** "Review payouts carefully. Ensure creator balances are positive and not at risk of chargebacks."
*   **Data Table:**
    *   Columns: Date Requested, Developer Email, Amount, PayPal Address, Status (Pending, Completed, Denied), action menu (...).
*   **Actions:**
    *   "Approve Payout" (Primary button, green).
    *   "Deny & Refund" (Secondary button, asks for a reason, restores funds to creator balance).
