# Segment 18: Admin & Platform Defense

## Goal
To implement critical administrative controls, platform defense mechanisms, and missing developer features required for a secure, production-ready SaaS application.

## Core Problem
While prior segments build out the full user and developer experience, the platform lacks a backend interface for administrators to govern the ecosystem. It also lacks defense mechanisms against abusive users (large file uploads, TOS violations) and edge-case financial scenarios (refunds/chargebacks).

## Files to Create
- `app/(admin)/admin/page.tsx` (Admin overview dashboard)
- `app/(admin)/admin/users/page.tsx` (User management table)
- `app/(admin)/admin/weblets/page.tsx` (Weblet moderation table)
- `app/(admin)/admin/payouts/page.tsx` (Manual payout review)
- `app/(dashboard)/dashboard/api-keys/page.tsx` (Developer API key generation)
- `components/report-dialog.tsx` (Report abuse modal for users)
- `lib/billing/refund-logic.ts` (Chargeback reconciliation script)

## Implementation Details

### 1. Admin Control Panel
- Build a dedicated `/admin` route group protected by the `ADMIN` role.
- **User Management**: View all users, impersonate testing accounts, and ban/suspend abusive users.
- **Weblet Moderation**: View all published Weblets (sorted by most reported). Administrators can force a Weblet back to "Draft" status or delete it entirely for TOS violations.
- **Global Metrics**: High-level platform stats (Total MRR, Total Platform Credit consumption, new users today).

### 2. Developer API Key Management
- Add an "API Keys" page to the Developer Dashboard.
- Allow developers to generate up to 5 API keys (e.g., `sk_weblet_live_...`).
- Keys are hashed in the database using bcrypt/argon2; only shown once upon creation.
- Used to authenticate external REST requests to specific Weblets.

### 3. File Storage Limits & RAG Quotas
- Implement strict validation in the Weblet Builder file upload endpoint (Phase 04).
- Free users: Max 5MB per file, Max 3 files per Weblet.
- Paid/Subscribed developers: Max 50MB per file, Max 20 files per Weblet.
- Integrate pdf-parse or similar library *before* sending to LlamaParse to reject files with >1,000 pages to prevent massive indexing bills.

### 4. Refund & Chargeback Reconciliation
- When Stripe fires a `charge.refunded` or `charge.dispute.created` webhook, log a `REFUND` transaction in Prisma.
- Logic: Deduct the creator's share from their `pendingBalance`. If `pendingBalance` < 0, subtract from `availableBalance`. Overdrawn accounts are flagged in the Admin Panel for review before any future payouts.

### 5. Manual Versioning & Rollbacks (Builder History)
- Add a "Revision History" tab or modal to the Weblet Builder.
- Allow developers to view the last 10 saved iterations of their Weblet (System Prompt + Tools).
- "Restore this version" button safely overrides the draft config with the historical config.

### 6. User Reporting Workflows
- Add a "Report Weblet" flag/icon in the `/marketplace/weblet/[slug]` page and the `/chat/[id]` interface.
- Opens a dialog: "Why are you reporting this Weblet?" (Options: Inappropriate Content, Spam, Broken/Non-functional).
- Submitting writes to a new `Report` table linked to the Weblet and flags it in the Admin Dashboard.

### 7. GDPR Cascading Deletion
- In the `/settings` page, add a highly destructive "Delete Account" button.
- For `USER` roles: instantly delete all data and PII.
- For `DEVELOPER` roles: Do not instantly delete. Mark as `PENDING_DELETION`. 
- Sunset Logic: Cancel all active Stripe subscriptions connected to their Weblets so no future renewals occur. Keep the Weblet active until the end of the current billing cycle so paid users aren't abruptly cut off, then purge data.

## Acceptance Criteria
- [ ] Admin dashboard is accessible only to users with `role === "ADMIN"`.
- [ ] Admins can ban a user, immediately terminating their login session.
- [ ] Developers can generate, view, and revoke API keys.
- [ ] Uploading a >5MB file as a free user returns a 413 Payload Too Large error.
- [ ] Stripe refund webhooks successfully reduce creator balances.
- [ ] Users can report a Weblet; reports appear in the Admin Panel.
- [ ] Account deletion initiates proper sunsetting for creators.

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Admin Panel security breach | Implement multi-factor authentication (MFA) requirement for ADMIN role logins. Hardcode initial admin emails in env vars. |
| API Key scraping | Ensure API keys are fully hashed in the database and rate-limited. |
