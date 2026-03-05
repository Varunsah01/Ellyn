# Dashboard Web App

Last updated: 2026-03-05

## Purpose

The dashboard is the primary user interface of Ellyn. It provides email discovery, contact management, outreach sequences, templates, analytics, and billing — all wrapped in a persona-aware shell that adapts for job seekers vs. SMB sales professionals.

---

## Architecture Overview

```
app/dashboard/layout.tsx
  │
  ├── SubscriptionProvider (context/SubscriptionContext.tsx)
  │     └── Fetches /api/v1/subscription/status → plan, quota, usage
  │
  ├── PersonaProvider (context/PersonaContext.tsx)
  │     └── LocalStorage bootstrap + server sync via /api/v1/user/persona
  │
  └── DashboardShell (components/dashboard/DashboardShell.tsx)
        ├── Sidebar — persona-aware navigation, plan badge, user profile
        ├── QuotaWarningBanner — shows near 80% usage
        └── Main content area → {children} (page-specific content)
```

### Key Design Decisions

1. **Persona system**: Two distinct user types (`job_seeker` | `smb_sales`) see different navigation items and feature sets. Job seekers get the Application Tracker; SMB sales gets Pipeline/Deals. Shared features: Contacts, Sequences, Templates, Analytics.

2. **Server-side auth gating**: `middleware.ts` blocks unauthenticated access to `/dashboard/**`. The layout also performs a redundant server-side session check as a defense-in-depth measure.

3. **Context-driven state**: Subscription and persona state are lifted to React context providers so all child pages can access plan limits, quota usage, and persona without prop drilling.

4. **Page-level data fetching**: Each page fetches its own data client-side (via hooks or direct fetch). There is no global data store — each page is self-contained.

---

## What Is Accomplished

### All Dashboard Pages — Complete

| Route | Status | Description |
|-------|--------|-------------|
| `/dashboard` | ✅ | Home: stats cards, email finder widget, recent contacts, next steps checklist, extension install banner, onboarding modal |
| `/dashboard/discovery` | ✅ | Email Discovery tool — the main email lookup UI. Name + company input → pipeline → results with confidence badge |
| `/dashboard/contacts` | ✅ | Full contact management: search, multi-field filters, pagination, add/edit/delete, CSV import/export, bulk actions, realtime refresh via Supabase, lead scoring, tag management |
| `/dashboard/contacts/[id]` | ✅ | Contact detail: full profile, email history, sequence enrollments, notes, outreach actions |
| `/dashboard/leads` | ✅ | Legacy leads list (SMB flow): CRUD, table view with sorting/filtering |
| `/dashboard/leads/[id]` | ✅ | Lead detail view with full history |
| `/dashboard/pipeline` | ✅ | Deal Pipeline (SMB persona): Kanban board with drag-to-advance stages, table view toggle, won/lost dialogs, revenue summary panel, realtime updates |
| `/dashboard/tracker` | ✅ | Job Application Tracker (job seeker persona): Kanban with 5 stages (Saved, Applied, Interviewing, Offered, Rejected), analytics panel, stage management, keyboard shortcuts, bulk actions |
| `/dashboard/sequences` | ✅ | Sequence list: card grid with status badges, enrollment counts, edit/delete with confirmation |
| `/dashboard/sequences/new` | ✅ | Two-state flow: template gallery (persona-aware) → visual sequence builder |
| `/dashboard/sequences/create` | ✅ | Alternate direct creation route |
| `/dashboard/sequences/[id]` | ✅ | Sequence detail: Overview tab (stats, step preview) + Contacts tab (enrollment management) |
| `/dashboard/sequences/[id]/edit` | ✅ | Edit existing sequence: modify steps, metadata, reorder |
| `/dashboard/sequences/[id]/enroll` | ✅ | 3-step enrollment wizard: Select contacts → Preview/Customize per-contact → Confirm |
| `/dashboard/templates` | ✅ | Template grid: create/edit/delete, AI generate/enhance/tone adjustment, free-plan upgrade gating |
| `/dashboard/templates/new` | ✅ | Create new email template with AI assistance |
| `/dashboard/analytics` | ✅ | Analytics dashboard: overview metric cards, time-series charts, sequence performance table, period filter (7d/30d/90d) |
| `/dashboard/performance` | ✅ | Performance metrics: email discovery success rates, response rates, engagement trends |
| `/dashboard/sent` | ✅ | Sent emails log: history of all emails sent via Gmail/Outlook with status tracking |
| `/dashboard/notifications` | ✅ | Notifications center: system notifications and activity alerts |
| `/dashboard/settings` | ✅ | Settings: Account tab (profile, password, Gmail/Outlook integration, suppression list) + Billing tab (plan info, invoices, upgrade CTA) |
| `/dashboard/settings/billing` | ✅ | Billing-specific sub-page |
| `/dashboard/upgrade` | ✅ | Plan comparison: monthly/quarterly/yearly toggle, feature matrix, checkout handoff to DodoPayments, `?upgraded=true` success state |
| `/dashboard/billing/upgrade` | ✅ | Alternate upgrade entry point |

### Shared Dashboard Features — Complete

| Feature | Status | Details |
|---------|--------|---------|
| Dashboard shell + sidebar | ✅ | Persona-aware nav items, collapsible on mobile, user section with plan badge and sign-out |
| Persona context | ✅ | LocalStorage bootstrap + server sync, exposes `{ persona, setPersona, isJobSeeker, isSalesRep }` |
| Subscription context | ✅ | Reads `/api/v1/subscription/status`, exposes plan, usage, limits, `refresh()` |
| Quota warning banner | ✅ | Shows when usage > 80%, dismissible with persistence |
| Empty state component | ✅ | Shared reusable empty state with icon, title, description, CTA |
| Error boundary | ✅ | `app/dashboard/error.tsx` with retry button |
| Loading state | ✅ | `app/dashboard/loading.tsx` with skeleton UI |
| Global toaster | ✅ | Root layout renders react-hot-toast Toaster |
| Global search / command palette | ✅ | `components/CommandPalette.tsx` (cmdk-powered) |
| Keyboard shortcuts | ✅ | `hooks/useKeyboardShortcuts.ts` for navigation and actions |
| Onboarding checklist | ✅ | `components/dashboard/OnboardingChecklist.tsx` surfaces next steps |
| Persona onboarding gate | ✅ | Blocks access until persona selection is made |
| Theme toggle (dark/light) | ✅ | `next-themes` integration via `components/dashboard/ThemeToggle.tsx` |
| Realtime contact updates | ✅ | Supabase realtime subscription via `hooks/useRealtimeContacts.ts` |

---

## What Is Not Yet Accomplished

| Feature | Status | Notes |
|---------|--------|-------|
| Collaborative workspace / team features | ❌ Not started | Currently single-user only. No team/org support. |
| Dashboard tour / walkthrough | ⚠️ Partial | `DashboardTour.tsx` and `OnboardingTour.tsx` exist but may not be fully wired up |
| Advanced analytics (funnel visualization) | ⚠️ Partial | `FunnelChart.tsx` and `OutreachFunnel.tsx` exist as components but may not be fully integrated |
| Activity heatmap | ⚠️ Partial | `ActivityHeatmap.tsx` and `HeatMap.tsx` exist but integration status unclear |
| Scheduled report delivery | ⚠️ Partial | `POST /api/v1/analytics/schedule-report` route exists, but no UI for managing schedules |
| Contact merge / deduplication | ❌ Not started | No UI or API for merging duplicate contacts |
| Advanced filter saved views | ❌ Not started | Contacts/leads filters are session-only; no saved filter presets |
| Mobile-optimized dashboard | ⚠️ Partial | Sidebar collapses on mobile, but some complex pages (pipeline Kanban, analytics charts) may not be fully responsive |
| Notification preferences | ❌ Not started | Notifications page exists but no user preference controls |
| Data export (PDF reports) | ⚠️ Partial | jsPDF is a dependency; `ExportMenu.tsx` exists but limited to CSV |
| Webhook integrations (Zapier, etc.) | ❌ Not started | No outbound webhook system for external integrations |

---

## Core API Coverage (Dashboard-facing)

All routes listed below are implemented and functional.

### Contacts & Leads
| Route | Method |
|-------|--------|
| `/api/v1/contacts` | GET, POST |
| `/api/v1/contacts/[id]` | GET, PATCH, DELETE |
| `/api/v1/contacts/batch` | POST |
| `/api/v1/contacts/import` | POST (CSV) |
| `/api/v1/contacts/export` | GET |
| `/api/v1/contacts/tags` | GET, POST |
| `/api/v1/contacts/lead-scores` | POST (bulk recalculate) |
| `/api/v1/contacts/[id]/stage` | GET, PATCH |
| `/api/v1/contacts/[id]/lead-score` | GET |
| `/api/v1/contacts/[id]/application` | GET, POST |
| `/api/v1/leads` | GET, POST |
| `/api/v1/leads/[id]` | GET, PATCH, DELETE |

### Pipeline / Deals
| Route | Method |
|-------|--------|
| `/api/v1/deals` | GET, POST |
| `/api/v1/deals/[id]` | PATCH, DELETE |
| `/api/v1/deals/[id]/won` | POST |
| `/api/v1/deals/[id]/lost` | POST |
| `/api/v1/deals/stats` | GET |
| `/api/v1/stages` | GET, POST |
| `/api/v1/stages/[id]` | PATCH, DELETE |
| `/api/v1/stages/reorder` | POST |

### Tracker
| Route | Method |
|-------|--------|
| `/api/v1/tracker` | GET, POST |
| `/api/v1/tracker/[id]` | GET, PATCH, DELETE |
| `/api/v1/tracker/stats` | GET |

### Templates
| Route | Method |
|-------|--------|
| `/api/v1/email-templates` | GET, POST |
| `/api/v1/email-templates/[id]` | GET, PATCH, DELETE |
| `/api/v1/email-templates/[id]/duplicate` | POST |
| `/api/v1/email-templates/[id]/use` | POST |

### User & Settings
| Route | Method |
|-------|--------|
| `/api/v1/user/persona` | GET, PATCH |
| `/api/v1/user/profile` | GET, PATCH |
| `/api/v1/user/onboarding` | GET, PATCH |
| `/api/v1/subscription/status` | GET |
| `/api/v1/subscription/invoices` | GET |
| `/api/v1/quota/status` | GET |
| `/api/v1/suppression` | GET, POST |
| `/api/v1/suppression/[email]` | DELETE |
| `/api/v1/account/api-key` | GET, POST |
| `/api/v1/account/delete` | DELETE |

### Email Integration
| Route | Method |
|-------|--------|
| `/api/v1/auth/gmail` | GET (initiates OAuth) |
| `/api/gmail/status` | GET |
| `/api/gmail/send` | POST |
| `/api/gmail/disconnect` | POST |
| `/api/v1/auth/outlook` | GET (initiates OAuth) |
| `/api/outlook/status` | GET |
| `/api/outlook/send` | POST |
| `/api/outlook/disconnect` | DELETE |

### Analytics
| Route | Method |
|-------|--------|
| `/api/v1/analytics/user` | GET |
| `/api/v1/analytics/performance` | GET |
| `/api/v1/analytics` | GET |
| `/api/v1/analytics/track-email` | POST |
| `/api/v1/analytics/track-lookup` | POST |
| `/api/v1/analytics/schedule-report` | POST |

### AI
| Route | Method |
|-------|--------|
| `/api/v1/ai/draft-email` | POST |
| `/api/v1/ai/enhance-draft` | POST |
| `/api/v1/ai/customize-tone` | POST |
| `/api/v1/ai/adjust-tone` | POST |
| `/api/v1/ai/generate-template` | POST |
| `/api/v1/ai/enhance-template` | POST |
| `/api/v1/ai/company-brief` | POST |
| `/api/v1/ai/infer-domain` | POST |

---

## Component Architecture

### Major Component Groups

| Directory | Count | Purpose |
|-----------|-------|---------|
| `components/dashboard/` | 20 | Shell, sidebar, header, stats, onboarding, persona, search |
| `components/contacts/` | 10 | Table, filters, CSV import, bulk actions, lead scoring |
| `components/sequences/` | 11 | Visual builder, step config, template gallery, tracker |
| `components/templates/` | 8 | Editor, gallery, AI draft panel, extension sync |
| `components/analytics/` | 15+ | Charts, metrics, heatmaps, funnels, filters |
| `components/tracker/` | 16 | Kanban, application cards, analytics, stage management |
| `components/pipeline/` | 4 | Deal cards, deal form, won/lost dialogs |
| `components/settings/` | 3 | Email integration card, suppression list, admin access |
| `components/subscription/` | 3 | Plan badge, quota warning banner, upgrade prompt |
| `components/landing/` | 12 | Hero, features, pricing, testimonials, FAQ, footer |
| `components/ui/` | 30+ | shadcn/ui primitives (Button, Card, Dialog, Sheet, etc.) |

### Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useContacts` | `lib/hooks/useContacts.ts` | Contact CRUD, filtering, pagination state |
| `useSequences` | `lib/hooks/useSequences.ts` | Sequence CRUD and state management |
| `useTracker` | `lib/hooks/useTracker.ts` | Job application tracker state |
| `useDashboardMetrics` | `lib/hooks/useDashboardMetrics.ts` | Dashboard home stats fetching |
| `useAnalytics` | `lib/hooks/useAnalytics.ts` | Analytics data fetching |
| `useAllUserTags` | `lib/hooks/useAllUserTags.ts` | Tag management for contacts |
| `useEmailIntegrations` | `hooks/useEmailIntegrations.ts` | Gmail + Outlook status, connect/disconnect |
| `useQuotaGate` | `hooks/useQuotaGate.ts` | Pre-action quota checking |
| `useRealtimeContacts` | `hooks/useRealtimeContacts.ts` | Supabase realtime subscription |
| `useKeyboardShortcuts` | `hooks/useKeyboardShortcuts.ts` | Keyboard shortcut registration |

---

## Styling

- **Brand system**: Off-white background (`#FAFAFA` / `canvas-white`), deep purple text (`#2D2B55` / `midnight-violet`), coral accents (`#FF6B6B` / `sunset-coral`)
- **Typography**: Fraunces (serif) for headings, DM Sans for body text
- **Component library**: shadcn/ui (Radix primitives) with Tailwind CSS
- **Animations**: Framer Motion for transitions, reordering, and micro-interactions
- **Icons**: lucide-react ^0.563.0
- **Theme**: Dark/light mode via next-themes

---

## Notes

- All dashboard actions use loading states and toast-based feedback (`showToast` from `lib/toast`)
- Plain button-based tabs preferred over shadcn Tabs (avoids `bg-midnight-violet` conflicts)
- Sequence-specific architecture documented in `docs/sequences.md`
- Email integration details in `docs/email-sending.md`
- Billing and subscription flow in `docs/billing-auth.md`
