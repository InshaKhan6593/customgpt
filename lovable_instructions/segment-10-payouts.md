# Lovable Prompt: Segment 10 - Developer Payouts

**Context:** Developers who charge for their Weblets need a way to withdraw their earnings to their PayPal accounts. 

**Design Guidance:** Financial, secure, and straightforward. Shadcn cards and clear data tables.

## Core Directives (CRITICAL)
1. **NO EXTRA ROUTES:** Only build the `/dashboard/payouts` route (this is a sub-page of the Developer Dashboard).
2. **NO EXTRA FIELDS:** We only use PayPal email for payouts. Do not add bank routing numbers or Stripe connect fields.

---

## 1. Route: `/dashboard/payouts`

**Purpose:** Developers can view their available balance and request a withdrawal.

**Required UI Elements:**
*   **Top Section (Balance Card):**
    *   Large Text: "Available Balance: $xxx.xx".
    *   Subtext: "Minimum payout is $50.00."
    *   Input: "PayPal Email Address" (Required if requesting payout).
    *   Button: "Request Payout" (Primary). Should be disabled if balance < $50.
*   **Bottom Section (History Table):**
    *   A table showing past withdrawal requests.
    *   Columns: Date, Amount, Status (Pending, Processing, Completed, Failed), PayPal Email used.
    *   Status badges should be color-coded (Yellow for Pending, Green for Completed, Red for Failed).

**Logic / State:**
*   Clicking "Request Payout" opens a confirmation dialog: "Are you sure you want to withdraw $xxx.xx to [email]? Transfers take 3-5 business days." -> [Confirm] [Cancel].
