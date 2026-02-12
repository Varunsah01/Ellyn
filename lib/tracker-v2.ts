import type {
  TrackerContact,
  TrackerContactStatus,
  TrackerTimelineEvent,
  TrackerTimelineEventType,
} from "@/lib/types/tracker";

export type TrackerSortPreset =
  | "most_recent"
  | "oldest_first"
  | "name_az"
  | "company_az"
  | "reply_rate"
  | "no_response";

export type TrackerDatePreset =
  | "all"
  | "today"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_30_days";

export type TrackerStatusFilterValue = TrackerContactStatus | "needs_follow_up";
export type TrackerBoardLane = "drafted" | "sent" | "replied" | "no_response";

export type TrackerExportColumn =
  | "name"
  | "designation"
  | "company"
  | "email"
  | "status"
  | "outreach_status"
  | "created_at"
  | "last_contacted_at"
  | "reminder_at"
  | "notes";

export interface TrackerFilterState {
  statuses: TrackerStatusFilterValue[];
  companies: string[];
  companySearch: string;
  groupByCompany: boolean;
  createdPreset: TrackerDatePreset;
  createdFrom: string;
  createdTo: string;
  contactedPreset: TrackerDatePreset;
  contactedFrom: string;
  contactedTo: string;
  contactedMoreThanDays: string;
}

export interface TrackerPreferences {
  sortPreset: TrackerSortPreset;
  filters: TrackerFilterState;
  exportColumns: TrackerExportColumn[];
  viewMode?: "kanban" | "table";
  condensed?: boolean;
  showAnalytics?: boolean;
}

export interface TrackerAnalyticsData {
  replyRate: number;
  averageResponseHours: number | null;
  bestCompanies: Array<{ company: string; replyRate: number; replied: number; sent: number }>;
  bestOutreachWindows: Array<{ label: string; replyRate: number; replied: number; sent: number }>;
  funnel: {
    drafted: number;
    sent: number;
    replied: number;
  };
  replyTrend: Array<{ label: string; sent: number; replied: number; replyRate: number }>;
}

export const TRACKER_SORT_PRESET_LABELS: Record<TrackerSortPreset, string> = {
  most_recent: "Most recent",
  oldest_first: "Oldest first",
  name_az: "Name A-Z",
  company_az: "Company A-Z",
  reply_rate: "Reply rate",
  no_response: "No response",
};

export const TRACKER_DATE_PRESET_LABELS: Record<TrackerDatePreset, string> = {
  all: "All time",
  today: "Today",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_30_days: "Last 30 days",
};

export const TRACKER_STATUS_LABELS: Record<TrackerStatusFilterValue, string> = {
  new: "Draft",
  contacted: "Sent",
  no_response: "Opened/No response",
  replied: "Replied",
  needs_follow_up: "Needs follow-up",
};

export const TRACKER_STATUS_COLORS: Record<
  TrackerContactStatus,
  {
    dot: string;
    badge: string;
    badgeText: string;
    softColumn: string;
    softColumnDark: string;
  }
> = {
  new: {
    dot: "#3B82F6",
    badge: "bg-[#DBEAFE] border-[#BFDBFE]",
    badgeText: "text-[#1E40AF]",
    softColumn: "bg-[#EFF6FF]",
    softColumnDark: "dark:bg-[#0B1A33]",
  },
  contacted: {
    dot: "#F59E0B",
    badge: "bg-[#FEF3C7] border-[#FDE68A]",
    badgeText: "text-[#92400E]",
    softColumn: "bg-[#FFFBEB]",
    softColumnDark: "dark:bg-[#2A1F08]",
  },
  replied: {
    dot: "#10B981",
    badge: "bg-[#D1FAE5] border-[#A7F3D0]",
    badgeText: "text-[#065F46]",
    softColumn: "bg-[#ECFDF5]",
    softColumnDark: "dark:bg-[#0A241A]",
  },
  no_response: {
    dot: "#EF4444",
    badge: "bg-[#FEE2E2] border-[#FECACA]",
    badgeText: "text-[#991B1B]",
    softColumn: "bg-[#FEF2F2]",
    softColumnDark: "dark:bg-[#2C1010]",
  },
};

export const TRACKER_STATUS_LABEL_BY_CONTACT_STATUS: Record<TrackerContactStatus, string> = {
  new: "Drafted",
  contacted: "Sent",
  replied: "Replied",
  no_response: "No Response",
};

export const TRACKER_EXPORT_COLUMN_LABELS: Record<TrackerExportColumn, string> = {
  name: "Name",
  designation: "Designation",
  company: "Company",
  email: "Email",
  status: "Status",
  outreach_status: "Mail Status",
  created_at: "Created At",
  last_contacted_at: "Last Contacted At",
  reminder_at: "Reminder At",
  notes: "Notes",
};

export const DEFAULT_EXPORT_COLUMNS: TrackerExportColumn[] = [
  "name",
  "designation",
  "company",
  "email",
  "status",
  "outreach_status",
  "created_at",
  "last_contacted_at",
  "notes",
];

export const DEFAULT_TRACKER_FILTERS: TrackerFilterState = {
  statuses: [],
  companies: [],
  companySearch: "",
  groupByCompany: false,
  createdPreset: "all",
  createdFrom: "",
  createdTo: "",
  contactedPreset: "all",
  contactedFrom: "",
  contactedTo: "",
  contactedMoreThanDays: "",
};

export const DEFAULT_TRACKER_PREFERENCES: TrackerPreferences = {
  sortPreset: "most_recent",
  filters: DEFAULT_TRACKER_FILTERS,
  exportColumns: DEFAULT_EXPORT_COLUMNS,
  viewMode: "table",
  condensed: false,
  showAnalytics: false,
};

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function getDisplayName(contact: TrackerContact): string {
  const fromFullName = contact.full_name?.trim();
  if (fromFullName) return fromFullName;

  const composed = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  return composed || "Unknown";
}

export function getDisplayEmail(contact: TrackerContact): string {
  return contact.confirmed_email || contact.inferred_email || "";
}

export function deriveOutreachStage(contact: TrackerContact): "draft" | "sent" | "opened" | "replied" {
  const raw = contact.outreach_status?.toLowerCase();
  if (raw === "sent") return "sent";
  if (raw === "opened") return "opened";
  if (raw === "replied") return "replied";
  if (raw === "draft" || raw === "drafted") return "draft";

  if (contact.status === "contacted") return "sent";
  if (contact.status === "no_response") return "opened";
  if (contact.status === "replied") return "replied";
  return "draft";
}

export function getBoardLaneFromContact(contact: TrackerContact): TrackerBoardLane {
  switch (contact.status) {
    case "contacted":
      return "sent";
    case "replied":
      return "replied";
    case "no_response":
      return "no_response";
    case "new":
    default:
      return "drafted";
  }
}

function getPresetRange(preset: TrackerDatePreset, nowDate: Date): { start: Date | null; end: Date | null } {
  const now = new Date(nowDate);
  now.setHours(23, 59, 59, 999);

  switch (preset) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    case "this_week": {
      const end = new Date(now);
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "last_week": {
      const end = new Date(now);
      const day = end.getDay();
      const diff = day === 0 ? 6 : day - 1;
      end.setDate(end.getDate() - diff - 1);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    case "last_30_days": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    default:
      return { start: null, end: null };
  }
}

function inRange(date: Date, start: Date | null, end: Date | null): boolean {
  const ms = date.getTime();
  if (start && ms < start.getTime()) return false;
  if (end && ms > end.getTime()) return false;
  return true;
}

function parseDateInput(value: string, endOfDay: boolean): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

export function isNeedsFollowUp(contact: TrackerContact, nowDate: Date = new Date()): boolean {
  if (contact.status === "replied") return false;
  const outreachStage = deriveOutreachStage(contact);
  if (outreachStage === "draft" || outreachStage === "replied") return false;

  const lastContacted = safeDate(contact.last_contacted_at);
  if (!lastContacted) return false;

  const diffMs = nowDate.getTime() - lastContacted.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

function normalizeForCompare(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

/**
 * Shared text matching used by Tracker and Contacts pages to keep search behavior consistent.
 */
export function matchesTrackerSearch(
  contact: Pick<TrackerContact, "full_name" | "first_name" | "last_name" | "company" | "role">,
  searchQuery: string
): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;

  const name = getDisplayName(contact as TrackerContact).toLowerCase();
  const company = normalizeForCompare(contact.company);
  const role = normalizeForCompare(contact.role);
  return name.includes(query) || company.includes(query) || role.includes(query);
}

export function applyTrackerFilters(
  contacts: TrackerContact[],
  searchQuery: string,
  filters: TrackerFilterState,
  nowDate: Date = new Date()
): TrackerContact[] {
  const statuses = filters.statuses.filter((value) => value !== "needs_follow_up") as TrackerContactStatus[];
  const includeNeedsFollowUp = filters.statuses.includes("needs_follow_up");
  const selectedCompanies = new Set(filters.companies.map((company) => company.toLowerCase()));

  const createdPresetRange = getPresetRange(filters.createdPreset, nowDate);
  const createdStart = filters.createdFrom
    ? parseDateInput(filters.createdFrom, false)
    : createdPresetRange.start;
  const createdEnd = filters.createdTo ? parseDateInput(filters.createdTo, true) : createdPresetRange.end;

  const contactedPresetRange = getPresetRange(filters.contactedPreset, nowDate);
  const contactedStart = filters.contactedFrom
    ? parseDateInput(filters.contactedFrom, false)
    : contactedPresetRange.start;
  const contactedEnd = filters.contactedTo
    ? parseDateInput(filters.contactedTo, true)
    : contactedPresetRange.end;
  const contactedMoreThanDays = Number.parseInt(filters.contactedMoreThanDays || "", 10);

  return contacts.filter((contact) => {
    if (!matchesTrackerSearch(contact, searchQuery)) {
      return false;
    }

    if (filters.statuses.length > 0) {
      const matchesSelectedStatuses = statuses.length > 0 && statuses.includes(contact.status);
      const matchesNeedsFollowUp = includeNeedsFollowUp && isNeedsFollowUp(contact, nowDate);

      if (!matchesSelectedStatuses && !matchesNeedsFollowUp) {
        return false;
      }
    }

    if (selectedCompanies.size > 0) {
      const company = normalizeForCompare(contact.company);
      if (!company || !selectedCompanies.has(company)) {
        return false;
      }
    }

    const createdDate = safeDate(contact.created_at);
    if (createdStart || createdEnd) {
      if (!createdDate || !inRange(createdDate, createdStart, createdEnd)) {
        return false;
      }
    }

    const contactedDate = safeDate(contact.last_contacted_at);
    if (contactedStart || contactedEnd) {
      if (!contactedDate || !inRange(contactedDate, contactedStart, contactedEnd)) {
        return false;
      }
    }

    if (Number.isFinite(contactedMoreThanDays) && contactedMoreThanDays > 0) {
      if (!contactedDate) return false;
      const diffDays = (nowDate.getTime() - contactedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= contactedMoreThanDays) return false;
    }

    return true;
  });
}

function compareDatesDesc(left?: string | null, right?: string | null): number {
  return (safeDate(right)?.getTime() || 0) - (safeDate(left)?.getTime() || 0);
}

export function applySortPreset(contacts: TrackerContact[], sortPreset: TrackerSortPreset): TrackerContact[] {
  const sorted = [...contacts];

  switch (sortPreset) {
    case "oldest_first":
      sorted.sort((a, b) => (safeDate(a.created_at)?.getTime() || 0) - (safeDate(b.created_at)?.getTime() || 0));
      break;
    case "name_az":
      sorted.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
      break;
    case "company_az":
      sorted.sort((a, b) => normalizeForCompare(a.company).localeCompare(normalizeForCompare(b.company)));
      break;
    case "reply_rate":
      sorted.sort((a, b) => {
        const score = (contact: TrackerContact) => {
          if (contact.status === "replied") return 0;
          if (contact.status === "contacted") return 1;
          if (contact.status === "no_response") return 2;
          return 3;
        };
        const diff = score(a) - score(b);
        if (diff !== 0) return diff;
        return compareDatesDesc(a.updated_at, b.updated_at);
      });
      break;
    case "no_response":
      sorted.sort((a, b) => {
        const aNoResponse = a.status === "no_response" ? 0 : 1;
        const bNoResponse = b.status === "no_response" ? 0 : 1;
        const diff = aNoResponse - bNoResponse;
        if (diff !== 0) return diff;
        return compareDatesDesc(a.last_contacted_at || a.updated_at, b.last_contacted_at || b.updated_at);
      });
      break;
    case "most_recent":
    default:
      sorted.sort((a, b) => compareDatesDesc(a.updated_at, b.updated_at));
      break;
  }

  return sorted;
}

export function buildCompanyCounts(contacts: TrackerContact[]) {
  const counts = new Map<string, number>();

  for (const contact of contacts) {
    const company = (contact.company || "").trim();
    if (!company) continue;
    counts.set(company, (counts.get(company) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => a.company.localeCompare(b.company));
}

export function groupContactsByCompany(contacts: TrackerContact[]) {
  const groups = new Map<string, TrackerContact[]>();
  for (const contact of contacts) {
    const key = (contact.company || "Unknown Company").trim() || "Unknown Company";
    const existing = groups.get(key) || [];
    existing.push(contact);
    groups.set(key, existing);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([company, items]) => ({ company, items }));
}

function getLatestEventDate(contact: TrackerContact, type: TrackerTimelineEventType): Date | null {
  const matching = (contact.timeline || []).filter((item) => item.type === type);
  if (matching.length === 0) return null;
  matching.sort((a, b) => compareDatesDesc(a.created_at, b.created_at));
  return safeDate(matching[0]?.created_at);
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getWindowLabel(date: Date): string {
  const day = date.toLocaleDateString(undefined, { weekday: "short" });
  const hour = date.getHours();
  const bucket = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return `${day} ${bucket}`;
}

export function computeTrackerAnalytics(contacts: TrackerContact[]): TrackerAnalyticsData {
  const drafted = contacts.filter((contact) => deriveOutreachStage(contact) === "draft").length;
  const sent = contacts.filter((contact) => {
    const stage = deriveOutreachStage(contact);
    return stage === "sent" || stage === "opened" || stage === "replied";
  }).length;
  const replied = contacts.filter((contact) => contact.status === "replied").length;
  const replyRate = sent > 0 ? Number(((replied / sent) * 100).toFixed(1)) : 0;

  const responseHours: number[] = [];
  for (const contact of contacts) {
    const sentAt = getLatestEventDate(contact, "email_sent");
    const repliedAt = getLatestEventDate(contact, "replied");
    if (!sentAt || !repliedAt) continue;
    const diffHours = (repliedAt.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
    if (diffHours > 0) responseHours.push(diffHours);
  }
  const averageResponseHours =
    responseHours.length > 0
      ? Number((responseHours.reduce((acc, value) => acc + value, 0) / responseHours.length).toFixed(1))
      : null;

  const companyStats = new Map<string, { sent: number; replied: number }>();
  for (const contact of contacts) {
    const company = (contact.company || "Unknown Company").trim() || "Unknown Company";
    const stats = companyStats.get(company) || { sent: 0, replied: 0 };
    const stage = deriveOutreachStage(contact);
    if (stage !== "draft") stats.sent += 1;
    if (contact.status === "replied") stats.replied += 1;
    companyStats.set(company, stats);
  }
  const bestCompanies = [...companyStats.entries()]
    .map(([company, stats]) => ({
      company,
      sent: stats.sent,
      replied: stats.replied,
      replyRate: stats.sent > 0 ? Number(((stats.replied / stats.sent) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.replyRate - a.replyRate || b.replied - a.replied)
    .slice(0, 5);

  const windowStats = new Map<string, { sent: number; replied: number }>();
  for (const contact of contacts) {
    const timeline = contact.timeline || [];
    const replyDates = timeline.reduce<Date[]>((acc, item) => {
      if (item.type !== "replied") return acc;
      const parsed = safeDate(item.created_at);
      if (parsed) acc.push(parsed);
      return acc;
    }, []);

    for (const sentEvent of timeline) {
      if (sentEvent.type !== "email_sent") continue;
      const sentDate = safeDate(sentEvent.created_at);
      if (!sentDate) continue;

      const key = getWindowLabel(sentDate);
      const stats = windowStats.get(key) || { sent: 0, replied: 0 };
      stats.sent += 1;

      const hasReplyAfter = replyDates.some((replyDate) => replyDate.getTime() >= sentDate.getTime());
      if (hasReplyAfter) stats.replied += 1;

      windowStats.set(key, stats);
    }
  }
  const bestOutreachWindows = [...windowStats.entries()]
    .map(([label, stats]) => ({
      label,
      sent: stats.sent,
      replied: stats.replied,
      replyRate: stats.sent > 0 ? Number(((stats.replied / stats.sent) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.replyRate - a.replyRate || b.replied - a.replied)
    .slice(0, 5);

  const trendMap = new Map<string, { sent: number; replied: number }>();
  const now = new Date();
  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - index);
    day.setHours(0, 0, 0, 0);
    trendMap.set(formatDayLabel(day), { sent: 0, replied: 0 });
  }
  for (const contact of contacts) {
    for (const item of contact.timeline || []) {
      const date = safeDate(item.created_at);
      if (!date) continue;
      const label = formatDayLabel(date);
      const bucket = trendMap.get(label);
      if (!bucket) continue;
      if (item.type === "email_sent") bucket.sent += 1;
      if (item.type === "replied") bucket.replied += 1;
      trendMap.set(label, bucket);
    }
  }
  const replyTrend = [...trendMap.entries()].map(([label, stats]) => ({
    label,
    sent: stats.sent,
    replied: stats.replied,
    replyRate: stats.sent > 0 ? Number(((stats.replied / stats.sent) * 100).toFixed(1)) : 0,
  }));

  return {
    replyRate,
    averageResponseHours,
    bestCompanies,
    bestOutreachWindows,
    funnel: {
      drafted,
      sent,
      replied,
    },
    replyTrend,
  };
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function toCsvDate(value?: string | null): string {
  const date = safeDate(value);
  return date ? date.toISOString() : "";
}

export function exportContactsToCsv(contacts: TrackerContact[], columns: TrackerExportColumn[]): string {
  const headers = columns.map((column) => TRACKER_EXPORT_COLUMN_LABELS[column]);
  const rows = contacts.map((contact) =>
    columns.map((column) => {
      switch (column) {
        case "name":
          return csvEscape(getDisplayName(contact));
        case "designation":
          return csvEscape(contact.role || "");
        case "company":
          return csvEscape(contact.company || "");
        case "email":
          return csvEscape(getDisplayEmail(contact));
        case "status":
          return csvEscape(contact.status);
        case "outreach_status":
          return csvEscape(deriveOutreachStage(contact));
        case "created_at":
          return csvEscape(toCsvDate(contact.created_at));
        case "last_contacted_at":
          return csvEscape(toCsvDate(contact.last_contacted_at));
        case "reminder_at":
          return csvEscape(toCsvDate(contact.reminder_at));
        case "notes":
          return csvEscape(contact.notes || "");
        default:
          return "";
      }
    })
  );

  return [headers.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function addTimelineEvent(
  contact: TrackerContact,
  type: TrackerTimelineEventType,
  title: string,
  description?: string
): TrackerTimelineEvent[] {
  const current = Array.isArray(contact.timeline) ? contact.timeline : [];
  const next: TrackerTimelineEvent = {
    id: `${contact.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    description,
    created_at: new Date().toISOString(),
  };

  return [next, ...current].slice(0, 200);
}
