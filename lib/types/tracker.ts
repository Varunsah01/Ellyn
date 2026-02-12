export type TrackerContactStatus = "new" | "contacted" | "replied" | "no_response";

export type TrackerTimelineEventType =
  | "draft_created"
  | "email_sent"
  | "status_changed"
  | "replied"
  | "note_added"
  | "reminder_set";

export interface TrackerTimelineEvent {
  id: string;
  type: TrackerTimelineEventType;
  title: string;
  description?: string;
  created_at: string;
}

export interface TrackerContact {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  role?: string | null;
  confirmed_email?: string | null;
  inferred_email?: string | null;
  status: TrackerContactStatus;
  linkedin_url?: string | null;
  notes?: string | null;
  tags?: string[];
  outreach_status?: string | null;
  last_contacted_at?: string | null;
  reminder_at?: string | null;
  timeline?: TrackerTimelineEvent[];
  created_at: string;
  updated_at: string;
}
