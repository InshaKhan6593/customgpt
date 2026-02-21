# Lovable Prompt: Segment 01 - Foundation & Authentication

**Context:** WebletGPT is a Next.js 15 SaaS platform where developers build and monetize AI agents (Weblets) and users chat with them. We are building the authentication flow using Auth.js (NextAuth v5) with Passwordless Email OTP (6-digit code).

**Design Guidance:** Do not invent your own branding. Use standard `shadcn/ui` components (Cards, Inputs, Buttons) and Tailwind CSS. The design should look clean, professional, and trustworthy.

## Core Directives (CRITICAL)
1. **NO EXTRA FIELDS:** Only include the exact input fields listed below. Our database schema is strict. Do not add "First Name", "Last Name", "Phone Number", "Password", or "Confirm Password".
2. **NO EXTRA ROUTES:** Only build the exact routes specified.
3. **USE SHADCN:** Use standard Shadcn form components with validation states.

---

## 1. Route: `/login` (Login Page)

**Purpose:** The main entry point for users to request an Email Verification Code.

**Required UI Elements:**
*   A centered Authentication Card.
*   **Header:** "Welcome to WebletGPT"
*   **Subtext:** "Sign in to your account or create a new one."
*   **Input Field:** 
    *   Type: `email`
    *   Name: `email`
    *   Placeholder: `name@example.com`
    *   Validation: Must be a valid email format.
*   **Submit Button:**
    *   Text: "Sign in with Email"
    *   State: Must show a loading spinner when clicked.
*   **Divider:** "OR"
*   **Social Buttons:**
    *   "Continue with Google" (Google icon)
    *   "Continue with GitHub" (GitHub icon)

**Logic / State:** 
*   When the email form is submitted, the UI should swap to a 6-digit OTP input state within the same card (do not route to a new page). 
*   The success state should say: "A 6-digit verification code has been sent to [email]. Enter the code below to securely sign in."
*   Include a 6-digit OTP input field (e.g., Shadcn `InputOTP` component).
*   Add a "Verify Code" submit button and a "Back to login" text button.

---

## 2. Route: `/auth/error` (Error Page)

**Purpose:** If the verification code expires or Auth.js throws an error, they land here.

**Required UI Elements:**
*   A centered Error Card (Use destructive/red styling cues).
*   **Header:** "Authentication Error"
*   **Subtext:** Display a dynamic error message (e.g., "This verification code has expired or is invalid.")
*   **Button:** "Back to Login" (routes back to `/login`).

---

## 3. Global UI: Navigation Header (Logged In vs Logged Out)

**Purpose:** The top navigation bar present across the marketing site.

**Required UI Elements (Logged Out State):**
*   Logo (left aligned): "WebletGPT" text.
*   Links (center): "Marketplace", "Pricing", "For Developers".
*   Buttons (right): "Sign In" (routes to `/login`) and "Get Started" (routes to `/login`, primary style).

**Required UI Elements (Logged In State):**
*   Logo (left).
*   Links (center): "Marketplace", "My Chats".
*   User Dropdown (right): A Shadcn Avatar component. Clicking opens a dropdown menu:
    *   Menu Item: "Dashboard" (Routes to `/dashboard`)
    *   Menu Item: "Settings" (Routes to `/settings`)
    *   Divider.
    *   Menu Item: "Sign Out" (Triggers logout action).
