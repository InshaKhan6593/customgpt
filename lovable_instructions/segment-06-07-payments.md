# Lovable Prompt: Segments 06 & 07 - Payment Infrastructure

**Context:** WebletGPT allows Developers to charge Users a monthly subscription fee to use their premium Weblets. We need UI for Users to manage their subscriptions, and a Pricing component for the Weblet Marketplace.

**Design Guidance:** Clean, trustworthy financial UI. Use Shadcn simple tables and clear call-to-action buttons. Look at Stripe's customer portal for inspiration.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Stick exactly to the subscription data displayed below. Do not add "Credit Card Number" inputs (Stripe handles checkout on their own hosted domain).
2. **NO EXTRA ROUTES:** Only build the `/pricing` and `/billing` routes.

---

## 1. Route: `/billing` (User Subscription Management)

**Purpose:** Where users see their active subscriptions and can cancel them.

**Required UI Elements:**
*   **Header:** "Billing & Subscriptions"
*   **State 1: No Subscriptions (Empty State)**
    *   Card: "You don't have any active Weblet subscriptions."
    *   Button: "Explore the Marketplace" (routes to `/marketplace`).
*   **State 2: Active Subscriptions Table/List**
    *   **Columns/Fields Required:**
        *   **Weblet Name:** Name and icon of the subscribed Weblet.
        *   **Price:** E.g., "$10.00 / month".
        *   **Status:** Badge (Active, Past Due, Canceled).
        *   **Next Billing Date:** E.g., "Renews on Oct 14".
        *   **Action:** A dropdown menu icon or button offering "Cancel Subscription".
*   **Logic:** When "Cancel Subscription" is clicked, open a Shadcn Alert Dialog warning: "Are you sure? You will lose access at the end of your billing cycle."

## 2. Global Component: Weblet Pricing Card (For Marketplace)

**Purpose:** Displayed on a Weblet's landing page in the marketplace when a user wants to use a paid Weblet.

**Required UI Elements:**
*   A clean Pricing Card component.
*   **Tier Name:** "Premium Access to [Weblet Name]"
*   **Price:** Large text (e.g., "$15" with smaller "/mo" next to it).
*   **Features List:** (Checkmarks)
    *   "Unlimited Chats"
    *   "Priority access to standard models"
    *   "Support the Creator"
*   **Button:** "Subscribe Now" (Primary style). Or "Manage" (Secondary style) if they are already subscribed.

**Logic / State:**
*   Do not build a checkout form! Clicking "Subscribe Now" just triggers a backend redirect to Stripe Checkout. The button must show a loading spinner while waiting for the redirect.
