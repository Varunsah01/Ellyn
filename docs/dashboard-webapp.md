# Dashboard Web App

Last updated: 2026-03-02

This document tracks the current implementation status of the main Next.js dashboard experience.

## Page Status

| Route | Status | Notes |
| --- | --- | --- |
| `/dashboard` | ✅ | Home dashboard with stats, email finder, recent contacts, next steps, extension banner, onboarding modal hook. |
| `/tracker` | ✅ | Job seeker-only application tracker Kanban (Saved, Applied, Interviewing, Offered, Rejected) with add/edit/delete and status move actions. |
| `/dashboard/pipeline` | ✅ | Deal Pipeline (SMB sales): Kanban + table view, drag-to-advance stages, won/lost dialogs, revenue panel, realtime updates. |
| `/dashboard/contacts` | ✅ | Full contact management: search, filters, pagination, add/edit/delete, CSV export, realtime refresh. |
| `/dashboard/templates` | ✅ | Template grid, create/edit/delete, AI generate/enhance/tone actions, free-plan upgrade gating. |
| `/dashboard/sequences` | ✅ | Sequence list cards, status badges, delete confirmation. |
| `/dashboard/sequences/new` | ✅ | Two-state flow: template gallery + visual builder. |
| `/dashboard/sequences/[id]` | ✅ | Detail view with Overview and Contacts tabs, inline name/status updates. |
| `/dashboard/sequences/[id]/enroll` | ✅ | 3-step enrollment wizard (select, preview, done). |
| `/dashboard/analytics` | ✅ | Overview cards + charts + sequence performance table with period filter. |
| `/dashboard/settings` | ✅ | Account and Billing tabs, profile update, password change, integrations, invoice table placeholder. |
| `/dashboard/upgrade` | ✅ | Plan comparison, billing-cycle toggle, checkout handoff, `?upgraded=true` success state. |

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
| `GET /api/v1/contacts` | ✅ |
| `POST /api/v1/contacts` | ✅ |
| `GET/PATCH/DELETE /api/v1/contacts/[id]` | ✅ |
| `GET /api/v1/contacts/export` | ✅ |
| `GET/PATCH /api/v1/user/persona` | ✅ |
| `GET /api/v1/subscription/status` | ✅ |
| `PATCH /api/v1/user/profile` | ✅ |
| `GET /api/v1/subscription/invoices` | ✅ (returns empty list gracefully when no customer) |

## Notes

- Styling follows the Ellyn brand system: off-white background (`#FAFAFA`), deep purple text (`#2D2B55`), Fraunces headings, DM Sans body.
- All major dashboard actions use loading states and toast-based feedback.
- Sequence-specific architecture and contracts are documented in `docs/sequences.md`.
