# Dashboard Web App

Last updated: 2026-03-04

This document tracks the current implementation status of the main Next.js dashboard experience.

## Page Status

| Route | Status | Notes |
| --- | --- | --- |
| `/dashboard` | ✅ | Home dashboard with stats, email finder, recent contacts, next steps, extension banner, onboarding modal hook. |
| `/dashboard/discovery` | ✅ | Email discovery tool — main email lookup UI for finding professional emails. |
| `/dashboard/contacts` | ✅ | Full contact management: search, filters, pagination, add/edit/delete, CSV export/import, bulk actions, realtime refresh, lead scoring, tags. |
| `/dashboard/contacts/[id]` | ✅ | Contact detail view with full history, notes, sequences, and email actions. |
| `/dashboard/leads` | ✅ | Leads list (legacy/SMB flow): CRUD, table view. |
| `/dashboard/leads/[id]` | ✅ | Lead detail view. |
| `/dashboard/pipeline` | ✅ | Deal Pipeline (SMB sales): Kanban + table view, drag-to-advance stages, won/lost dialogs, revenue panel, realtime updates. |
| `/dashboard/tracker` | ✅ | Job application tracker: Kanban (Saved, Applied, Interviewing, Offered, Rejected), analytics panel, stage management, keyboard shortcuts. |
| `/dashboard/sequences` | ✅ | Sequence list cards, status badges, delete confirmation. |
| `/dashboard/sequences/new` | ✅ | Two-state flow: template gallery + visual builder. |
| `/dashboard/sequences/create` | ✅ | Alternate direct creation route for sequences. |
| `/dashboard/sequences/[id]` | ✅ | Detail view with Overview and Contacts tabs, inline name/status updates. |
| `/dashboard/sequences/[id]/edit` | ✅ | Edit existing sequence steps and metadata. |
| `/dashboard/sequences/[id]/enroll` | ✅ | 3-step enrollment wizard (select, preview, done). |
| `/dashboard/templates` | ✅ | Template grid, create/edit/delete, AI generate/enhance/tone actions, free-plan upgrade gating. |
| `/dashboard/templates/new` | ✅ | Create new email template. |
| `/dashboard/analytics` | ✅ | Overview cards + charts + sequence performance table with period filter. |
| `/dashboard/performance` | ✅ | Performance metrics dashboard (separate from analytics). |
| `/dashboard/sent` | ✅ | Sent emails tracking log. |
| `/dashboard/notifications` | ✅ | Notifications center. |
| `/dashboard/settings` | ✅ | Account and Billing tabs, profile update, password change, Gmail/Outlook integrations, suppression list, invoice table. |
| `/dashboard/settings/billing` | ✅ | Billing-specific sub-page. |
| `/dashboard/upgrade` | ✅ | Plan comparison, billing-cycle toggle, checkout handoff, `?upgraded=true` success state. |
| `/dashboard/billing/upgrade` | ✅ | Alternate upgrade entry point. |

## Shared Dashboard UX

| Feature | Status | Notes |
| --- | --- | --- |
| Dashboard shell + sidebar | ✅ | Persona-aware nav, user section, plan badge, sign-out. |
| Persona context | ✅ | LocalStorage bootstrap + server sync via `/api/v1/user/persona`. |
| Subscription context | ✅ | Reads `/api/v1/subscription/status`, exposes usage + refresh. |
| Quota warning banner | ✅ | Shows near 80% usage with dismiss persistence. |
| Empty state component | ✅ | Shared `components/dashboard/EmptyState.tsx`. |
| Dashboard route error boundary | ✅ | `app/dashboard/error.tsx`. |
| Dashboard route loading state | ✅ | `app/dashboard/loading.tsx`. |
| Global toaster integration | ✅ | Root layout renders Toaster. |

## Core API Coverage (Dashboard-facing)

| Route | Status |
| --- | --- |
| `GET /api/v1/analytics/user` | ✅ |
| `GET /api/v1/analytics/performance` | ✅ |
| `GET /api/v1/contacts` | ✅ |
| `POST /api/v1/contacts` | ✅ |
| `GET/PATCH/DELETE /api/v1/contacts/[id]` | ✅ |
| `POST /api/v1/contacts/batch` | ✅ |
| `POST /api/v1/contacts/import` | ✅ (CSV import) |
| `GET /api/v1/contacts/export` | ✅ |
| `GET/POST /api/v1/contacts/tags` | ✅ |
| `POST /api/v1/contacts/lead-scores` | ✅ (bulk recalculate) |
| `GET/PATCH /api/v1/contacts/[id]/stage` | ✅ |
| `GET/POST /api/v1/leads` | ✅ |
| `GET/PATCH/DELETE /api/v1/leads/[id]` | ✅ |
| `GET/POST /api/v1/deals` | ✅ |
| `PATCH/DELETE /api/v1/deals/[id]` | ✅ |
| `POST /api/v1/deals/[id]/won` | ✅ |
| `POST /api/v1/deals/[id]/lost` | ✅ |
| `GET /api/v1/deals/stats` | ✅ |
| `GET/POST /api/v1/tracker` | ✅ |
| `GET/PATCH/DELETE /api/v1/tracker/[id]` | ✅ |
| `GET /api/v1/tracker/stats` | ✅ |
| `GET/POST /api/v1/stages` | ✅ |
| `PATCH/DELETE /api/v1/stages/[id]` | ✅ |
| `POST /api/v1/stages/reorder` | ✅ |
| `GET/POST /api/v1/suppression` | ✅ |
| `DELETE /api/v1/suppression/[email]` | ✅ |
| `GET/PATCH /api/v1/user/persona` | ✅ |
| `GET/PATCH /api/v1/user/profile` | ✅ |
| `GET/PATCH /api/v1/user/onboarding` | ✅ |
| `GET /api/v1/subscription/status` | ✅ |
| `GET /api/v1/subscription/invoices` | ✅ (returns empty list gracefully when no customer) |
| `GET /api/v1/quota/status` | ✅ |
| `GET /api/gmail/status` | ✅ |
| `POST /api/gmail/disconnect` | ✅ |
| `POST /api/gmail/send` | ✅ |
| `GET /api/v1/auth/gmail` | ✅ (initiates OAuth) |
| `GET /api/outlook/status` | ✅ |
| `POST /api/outlook/disconnect` | ✅ |
| `POST /api/outlook/send` | ✅ |
| `GET /api/v1/auth/outlook` | ✅ (initiates OAuth) |
| `GET/POST /api/v1/email-templates` | ✅ |
| `GET/PATCH/DELETE /api/v1/email-templates/[id]` | ✅ |
| `POST /api/v1/email-templates/[id]/duplicate` | ✅ |
| `POST /api/v1/email-templates/[id]/use` | ✅ |

## Notes

- Styling follows the Ellyn brand system: off-white background (`#FAFAFA`), deep purple text (`#2D2B55`), Fraunces headings, DM Sans body.
- All major dashboard actions use loading states and toast-based feedback.
- Sequence-specific architecture and contracts are documented in `docs/sequences.md`.
