# Sequences

Last updated: 2026-03-02

## Implementation Status

### API Routes

| Route | Status | Notes |
| --- | --- | --- |
| `GET /api/v1/sequences` | ✅ | Returns user-owned sequences with step/enrollment counts. |
| `POST /api/v1/sequences` | ✅ | Creates sequence + bulk inserts steps. |
| `GET /api/v1/sequences/[id]` | ✅ | Returns `sequence`, `steps`, `enrollments`, and aggregate stats. |
| `PATCH /api/v1/sequences/[id]` | ✅ | Updates metadata/status and can replace all steps. |
| `DELETE /api/v1/sequences/[id]` | ✅ | Ownership-checked delete, cascades via FK. |
| `POST /api/v1/sequences/[id]/enroll` | ✅ | Enrolls contacts, skips duplicates, creates enrollment steps. |
| `POST /api/v1/sequences/execute` | ✅ | Handles `send`, `skip`, and `pause` actions. |
| `PATCH /api/v1/sequences/[id]/enrollments/[enrollmentId]` | ✅ | Pause/resume individual enrollment actions. |
| `DELETE /api/v1/sequences/[id]/enrollments/[enrollmentId]` | ✅ | Removes enrollment record. |

### Pages

| Route | Status | Notes |
| --- | --- | --- |
| `/dashboard/sequences` | ✅ | Grid of sequences with status badges, counts, edit/delete actions. |
| `/dashboard/sequences/new` | ✅ | Template gallery + visual builder flow. |
| `/dashboard/sequences/[id]` | ✅ | Overview and Contacts tabs with stats and management actions. |
| `/dashboard/sequences/[id]/enroll` | ✅ | 3-step enrollment wizard. |

### Components

| Component | Status | Notes |
| --- | --- | --- |
| `VisualSequenceBuilder` | ✅ | Reorderable step pipeline + add/edit/delete flow. |
| `StepConfigPanel` | ✅ | Right-side sheet editor for Email/Wait/Condition/Task steps. |
| `SequenceTemplateGallery` | ✅ | Persona-aware built-in templates and preview modal. |
| `SequenceTracker` | ✅ | Kanban/list enrollment tracker with periodic refresh. |

## Canonical Sequence Types (`lib/types/sequence.ts`)

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
```

## Data Model

Primary tables used:

- `sequences`
- `sequence_steps`
- `sequence_enrollments`
- `sequence_enrollment_steps`

These are created in `lib/db/migrations/000_ensure_complete_foundation.sql` and extended by later sequence-focused migrations.
