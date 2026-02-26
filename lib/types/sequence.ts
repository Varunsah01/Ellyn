export type SequenceStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type StepType = "email" | "wait" | "task" | "linkedin";

export type ConditionType = "always" | "no_reply" | "opened" | "clicked";

export interface StepAttachment {
  id: string;
  name: string;
  size: number;
  type: "resume" | "portfolio" | "case_study" | "other";
  url?: string;
  localFile?: Blob;
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

export type EnrollmentStepStatus =
  | "pending"
  | "sent"
  | "skipped"
  | "bounced"
  | "replied";

export type SequenceEventType =
  | "sent"
  | "opened"
  | "replied"
  | "bounced"
  | "skipped"
  | "paused"
  | "resumed"
  | "removed";

export interface Sequence {
  id: string;
  user_id?: string | null;
  name: string;
  description?: string | null;
  goal?: string | null;
  status: SequenceStatus;
  steps: SequenceStep[];
  contacts?: string[];
  stats: SequenceStats;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  sequence_id?: string;
  order: number;
  type?: string;
  stepType?: StepType;
  conditionType?: ConditionType;
  step_name?: string;
  delay_days: number;
  delayDays?: number;
  send_on_days?: string[];
  send_from_hour?: number;
  send_to_hour?: number;
  template_id?: string | null;
  templateId?: string | null;
  subject: string;
  body: string;
  status: "draft" | "active";
  stop_on_reply?: boolean;
  stop_on_bounce?: boolean;
  attachments?: StepAttachment[];
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

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: EnrollmentStatus;
  start_date?: string;
  enrolled_at?: string;
  current_step?: number;
  current_step_index?: number;
  next_step_at?: string | null;
  completed_at?: string | null;
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
  step_order: number;
  scheduled_for: string;
  status: EnrollmentStepStatus;
  subject_override?: string | null;
  body_override?: string | null;
  sent_at?: string | null;
}

export interface SequenceEvent {
  id: string;
  enrollment_id?: string | null;
  step_id?: string | null;
  event_type: SequenceEventType;
  metadata?: Record<string, any>;
  created_at: string;
}
