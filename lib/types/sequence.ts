export type SequenceStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type StepType = "email" | "wait" | "condition" | "task";
export type ConditionType = "opened" | "replied" | "clicked" | "bounced" | "no_response";

export interface StepAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

export type EnrollmentStatus =
  | "active"
  | "not_started"
  | "in_progress"
  | "completed"
  | "replied"
  | "bounced"
  | "paused"
  | "unsubscribed"
  | "removed";

export type EnrollmentStepStatus = "pending" | "sent" | "skipped" | "bounced" | "replied";

export type SequenceEventType =
  | "sent"
  | "opened"
  | "replied"
  | "bounced"
  | "skipped"
  | "paused"
  | "resumed"
  | "removed";

export interface SequenceStep {
  id: string;
  sequence_id?: string;
  step_order?: number;
  order: number;
  step_name?: string;
  step_type?: StepType;
  stepType?: StepType;
  type?: StepType | "linkedin";
  conditionType?: ConditionType | "always" | "no_reply";
  condition_type?: ConditionType | "always" | "no_reply" | null;
  subject: string;
  body: string;
  delay_days: number;
  delayDays?: number;
  send_on_days?: Array<number | string>;
  send_from_hour?: number;
  send_to_hour?: number;
  attachments?: StepAttachment[];
  status: "draft" | "active";
  stop_on_reply?: boolean;
  stop_on_bounce?: boolean;
  template_id?: string | null;
  templateId?: string | null;
}

export interface SequenceStats {
  totalContacts: number;
  emailsSent: number;
  opened: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  inProgress: number;
  completionRate?: number;
}

export interface Sequence {
  id: string;
  user_id?: string | null;
  name: string;
  description?: string | null;
  goal?: string | null;
  status: SequenceStatus;
  steps: SequenceStep[];
  stats: SequenceStats;
  contacts?: string[];
  step_count?: number;
  enrollment_count?: number;
  created_at?: string;
  updated_at?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: EnrollmentStatus;
  current_step_index?: number;
  next_step_at?: string | null;
  started_at?: string;
  completed_at?: string | null;
  start_date?: string;
  enrolled_at?: string;
  current_step?: number;
  created_at?: string;
  updated_at?: string;
  contact?: {
    id: string;
    full_name: string;
    company?: string | null;
    role?: string | null;
    confirmed_email?: string | null;
    inferred_email?: string | null;
  };
}

export interface SequenceEnrollmentStep {
  id: string;
  enrollment_id: string;
  step_id: string;
  status: EnrollmentStepStatus;
  sent_at?: string | null;
  opened_at?: string | null;
  replied_at?: string | null;
  skipped_at?: string | null;
  step_order: number;
  scheduled_for: string;
  subject_override?: string | null;
  body_override?: string | null;
}

export interface SequenceEvent {
  id: string;
  enrollment_id?: string | null;
  step_id?: string | null;
  event_type: SequenceEventType;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ContactSequenceStatus {
  contactId: string;
  currentStep: number;
  status: EnrollmentStatus;
  lastActivity: string;
}

export interface TimelineEvent {
  id: string;
  type: SequenceEventType;
  contactName: string;
  stepNumber: number;
  timestamp: string;
  details?: string;
}
