export interface Sequence {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "completed";
  steps: SequenceStep[];
  contacts: string[];
  stats: SequenceStats;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  order: number;
  delay_days: number;
  template_id?: string;
  subject: string;
  body: string;
  status: "draft" | "active";
}

export interface SequenceStats {
  totalContacts: number;
  emailsSent: number;
  opened: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  inProgress: number;
}

export interface ContactSequenceStatus {
  contactId: string;
  currentStep: number;
  status: "in_progress" | "completed" | "stopped" | "bounced";
  lastActivity: string;
}

export interface TimelineEvent {
  id: string;
  type: "sent" | "opened" | "replied" | "bounced" | "unsubscribed";
  contactName: string;
  stepNumber: number;
  timestamp: string;
  details?: string;
}
