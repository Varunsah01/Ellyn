# Sequences

Last updated: 2026-03-05

## Purpose

Outreach sequences are multi-step automated email campaigns. A user creates a sequence of steps (emails, waits, conditions, tasks), enrolls contacts, and the system executes each step on schedule. This is the core outreach automation feature for both job seekers (follow-up sequences) and SMB sales (drip campaigns).

---

## Architecture Overview

```
User creates sequence (template gallery or manual)
  │
  ▼
┌──────────────────────────────────────────────┐
│ Sequence Builder                              │
│  VisualSequenceBuilder (drag-reorder steps)   │
│  StepConfigPanel (configure each step)        │
│  Saves via POST /api/v1/sequences             │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ Enrollment Wizard                             │
│  Select contacts → Preview/Customize → Confirm│
│  POST /api/v1/sequences/[id]/enroll           │
│  Creates enrollment + enrollment_step rows    │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ Sequence Engine (lib/sequence-engine.ts)      │
│  POST /api/v1/sequences/execute               │
│  Actions: send, skip, pause                   │
│  Uses Gmail/Outlook API for actual sending    │
│  Tracks: opened, replied, bounced, skipped    │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ Tracking & Replies                            │
│  POST /api/v1/sequences/reply (inbound reply) │
│  Cron: /api/cron/check-replies (polling)      │
│  SequenceTracker (kanban/list view)           │
└──────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Template-first creation**: Users start from a gallery of pre-built templates (persona-aware: job seeker vs. SMB sales), then customize. This lowers the barrier to creating effective sequences.

2. **Visual builder with drag-reorder**: Steps are presented as a visual pipeline that can be reordered via drag-and-drop (framer-motion Reorder). This makes the sequence flow intuitive.

3. **Per-contact customization**: The enrollment wizard allows overriding subject/body per contact per step. This enables mass outreach that still feels personalized.

4. **Gmail/Outlook integration for sending**: The sequence engine calls the existing send routes (`/api/gmail/send` or `/api/outlook/send`) rather than implementing its own SMTP client. This reuses the token refresh, encryption, and logging infrastructure.

5. **Cron-based reply detection**: `POST /api/cron/check-replies` polls for replies to sequence emails. This is a pragmatic approach — real-time reply detection would require webhook integration with Gmail/Outlook which is more complex.

---

## What Is Accomplished

### API Routes — All Complete

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/sequences` | GET | Returns user-owned sequences with step/enrollment counts |
| `/api/v1/sequences` | POST | Creates sequence + bulk inserts steps |
| `/api/v1/sequences/[id]` | GET | Returns `sequence`, `steps`, `enrollments`, `enrollmentSteps`, and aggregate stats |
| `/api/v1/sequences/[id]` | PATCH | Updates metadata/status; can replace all steps |
| `/api/v1/sequences/[id]` | DELETE | Ownership-checked delete, cascades via FK |
| `/api/v1/sequences/[id]/enroll` | POST | Enrolls contacts (skips duplicates), creates enrollment steps. Body: `{ contactIds, startDate, overrides, metadata? }` |
| `/api/v1/sequences/[id]/stats` | GET | Aggregate performance stats (opens, replies, bounces) |
| `/api/v1/sequences/execute` | POST | Handles `send`, `skip`, and `pause` actions |
| `/api/v1/sequences/reply` | POST | Handles inbound reply events for sequence enrollments |
| `/api/v1/sequences/[id]/enrollments/[enrollmentId]` | PATCH | Pause/resume individual enrollment |
| `/api/v1/sequences/[id]/enrollments/[enrollmentId]/remove` | DELETE | Removes enrollment record |

### Pages — All Complete

| Route | Description |
|-------|-------------|
| `/dashboard/sequences` | Grid of sequences with status badges, enrollment counts, edit/delete with confirmation |
| `/dashboard/sequences/new` | Template gallery → visual builder flow (two-state machine) |
| `/dashboard/sequences/create` | Alternate direct sequence creation route |
| `/dashboard/sequences/[id]` | Detail view: Overview tab (stats, step preview) + Contacts tab (enrollment management) |
| `/dashboard/sequences/[id]/edit` | Edit existing sequence: modify steps, metadata, reorder |
| `/dashboard/sequences/[id]/enroll` | 3-step enrollment wizard: Select contacts → Preview/Customize → Confirm |

### Components — All Complete

| Component | File | Purpose |
|-----------|------|---------|
| `VisualSequenceBuilder` | `components/sequences/VisualSequenceBuilder.tsx` | Reorderable step pipeline with framer-motion, add/edit/delete, condition chips, step type palette |
| `StepConfigPanel` | `components/sequences/StepConfigPanel.tsx` | Zapier-style Sheet drawer with 6 sections: name, type, content (rich editor), schedule (send days/hours), conditions, attachments (Supabase storage upload). Includes variable picker and AI enhance button |
| `SequenceTemplateGallery` | `components/sequences/SequenceTemplateGallery.tsx` | 6 hardcoded templates, persona-aware tab filtering, preview modal |
| `SequenceTracker` | `components/sequences/SequenceTracker.tsx` | Kanban + list view for enrollment status tracking with 30s polling refresh, stats bar |
| `ContactSelector` | `components/sequences/ContactSelector.tsx` | Contact selection for enrollment |
| `EmailEditor` | `components/sequences/EmailEditor.tsx` | Rich email editor for step content |
| `EnrollContactsModal` | `components/sequences/EnrollContactsModal.tsx` | Legacy enrollment modal (replaced by wizard page) |
| `SequenceCard` | `components/sequences/SequenceCard.tsx` | Card component for sequence list |
| `StepBuilder` | `components/sequences/StepBuilder.tsx` | Step builder component |
| `TemplatePicker` | `components/sequences/TemplatePicker.tsx` | Pick existing email templates for steps |

### Database — Complete

- `sequences` — sequence definitions (name, description, status, user_id)
- `sequence_steps` — individual steps with step_type, delay_days, subject, body, conditions
- `sequence_enrollments` — contacts enrolled in sequences with status tracking
- `sequence_enrollment_steps` — per-step execution tracking with opened_at, replied_at, skipped_at (migration 023)
- `sequence_events` — execution event log
- Performance stat columns/functions (migration 030)

### Sequence Engine — Complete

`lib/sequence-engine.ts` handles:
- Step execution scheduling
- Email sending via Gmail API integration (`sendViaGmailApi()` → internal fetch to `/api/gmail/send`)
- Status transitions: active → in_progress → completed/replied/bounced
- Stop-on-reply and stop-on-bounce logic

---

## What Is Not Yet Accomplished

| Feature | Status | Notes |
|---------|--------|-------|
| Outlook sending from sequences | ⚠️ Partial | Engine currently calls Gmail only. Outlook integration exists but not wired into sequence engine |
| A/B testing for email steps | ❌ Not started | No variant support for testing different subject lines/bodies |
| Advanced conditions (link clicked, specific page visited) | ❌ Not started | Current conditions: opened, replied, clicked, bounced, no_response |
| Sequence analytics dashboard | ⚠️ Partial | Basic stats available via `/api/v1/sequences/[id]/stats`, but no dedicated analytics page for sequences |
| Auto-pause on bounce threshold | ❌ Not started | Sequences don't auto-pause if too many bounces are detected |
| Time zone-aware scheduling | ❌ Not started | `send_from_hour`/`send_to_hour` exist but timezone handling is not implemented |
| Attachment sending | ⚠️ Partial | `StepAttachment` type and Supabase storage upload exist in StepConfigPanel, but attachment sending via Gmail/Outlook API is not fully wired |
| Real-time reply detection | ❌ Not started | Currently uses cron polling (`/api/cron/check-replies`). Gmail push notifications or MS Graph webhooks not implemented |
| Sequence cloning | ❌ Not started | No "duplicate sequence" functionality |
| Sequence sharing / team sequences | ❌ Not started | Sequences are user-scoped only |

---

## Canonical Types (`lib/types/sequence.ts`)

```ts
export type StepType = 'email' | 'wait' | 'condition' | 'task'
export type ConditionType = 'opened' | 'replied' | 'clicked' | 'bounced' | 'no_response'

export interface StepAttachment {
  name: string
  url: string
  size: number
  type: string
}

export interface SequenceStep {
  id: string
  sequence_id?: string
  step_order?: number
  order: number
  step_name?: string
  step_type?: StepType
  stepType?: StepType
  conditionType?: ConditionType | 'always' | 'no_reply'
  condition_type?: ConditionType | 'always' | 'no_reply' | null
  subject: string
  body: string
  delay_days: number
  send_on_days?: Array<number | string>
  send_from_hour?: number
  send_to_hour?: number
  attachments?: StepAttachment[]
}

export interface Sequence {
  id: string
  user_id?: string | null
  name: string
  description?: string | null
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  steps: SequenceStep[]
}

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id: string
  status: 'active' | 'not_started' | 'in_progress' | 'completed' | 'replied' | 'bounced' | 'paused' | 'unsubscribed' | 'removed'
  current_step_index?: number
  next_step_at?: string | null
}

// Enrollment overrides allow per-contact customization
export type EnrollmentOverrides = Record<string, Record<string, { subject?: string; body?: string }>>
// Usage: EnrollmentOverrides[contactId][stepId] = { subject, body }
```

---

## Data Model

```
sequences (1)
  └── sequence_steps (N) — ordered steps with content and scheduling
  └── sequence_enrollments (N) — contacts enrolled
        └── sequence_enrollment_steps (N) — per-step execution tracking
              ├── opened_at
              ├── replied_at
              └── skipped_at
  └── sequence_events (N) — execution event audit log
```

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `000_ensure_complete_foundation.sql` | Creates base `sequences` and `sequence_enrollments` tables |
| `004_sequences.sql` | Adds `sequence_steps`, `sequence_enrollment_steps`, `sequence_events` |
| `019_sequences_complete.sql` | Ensures complete sequence schema with all columns |
| `023_sequence_tracker_columns.sql` | Adds `opened_at`, `replied_at`, `skipped_at` to enrollment steps; `attachments JSONB` to steps |
| `030_sequence_performance_stats.sql` | Performance stat columns and stored functions |
| `033_email_tracking_enhancements.sql` | Adds `sequence_enrollment_id` to `email_history` for reply tracking |

---

## Integration Points

| System | How Sequences Uses It |
|--------|----------------------|
| Gmail API | Sends emails via `/api/gmail/send` (internal fetch from sequence engine) |
| Outlook API | Routes exist but not yet wired into sequence engine |
| Email Templates | Steps can reference template IDs; templates provide reusable content |
| Contacts | Enrollment links sequences to contacts; contact data used for variable substitution |
| Email History | Sent sequence emails logged in `email_history` with `sequence_enrollment_id` |
| Email Tracking | Opens/clicks tracked via `/api/track/open` and `/api/track/click` |
| Analytics | Sequence performance feeds into analytics dashboards |
| Quota | Sequence sends count against email quota |
