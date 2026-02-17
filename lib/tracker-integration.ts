import { isNeedsFollowUp } from "@/lib/tracker-v2";
import type { TrackerContact, TrackerContactStatus } from "@/lib/types/tracker";

const TRACKER_ENTRY_ROUTE = "/dashboard/contacts";
const TRACKER_DEEPLINK_CONTACT_KEY = "ellyn:tracker:deeplink-contact";

export interface ContactLikeForTracker {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  role?: string | null;
  confirmed_email?: string | null;
  inferred_email?: string | null;
  status?: string | null;
  outreach_status?: string | null;
  linkedin_url?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_contacted_at?: string | null;
}

function normalizeTrackerStatus(value?: string | null): TrackerContactStatus {
  switch ((value || "").toLowerCase()) {
    case "contacted":
      return "contacted";
    case "replied":
    case "responded":
    case "interested":
      return "replied";
    case "no_response":
    case "not_interested":
      return "no_response";
    case "new":
    default:
      return "new";
  }
}

/**
 * Converts a generic contact shape into the Tracker model so shared Tracker logic
 * (follow-up detection, search/filtering, analytics) can be reused across pages.
 */
export function toTrackerContact(contact: ContactLikeForTracker): TrackerContact {
  const nowIso = new Date().toISOString();
  const normalizedStatus = normalizeTrackerStatus(contact.status);

  return {
    id: contact.id,
    full_name: contact.full_name || null,
    first_name: contact.first_name || null,
    last_name: contact.last_name || null,
    company: contact.company || null,
    role: contact.role || null,
    confirmed_email: contact.confirmed_email || null,
    inferred_email: contact.inferred_email || null,
    status: normalizedStatus,
    outreach_status: contact.outreach_status || null,
    linkedin_url: contact.linkedin_url || null,
    notes: contact.notes || null,
    tags: Array.isArray(contact.tags) ? contact.tags : [],
    last_contacted_at: contact.last_contacted_at || null,
    timeline: [],
    created_at: contact.created_at || nowIso,
    updated_at: contact.updated_at || contact.created_at || nowIso,
  };
}

/**
 * Build tracker contact href.
 * @param {string} contactId - Contact id input.
 * @param {{ source?: string }} options - Options input.
 * @returns {string} Computed string.
 * @example
 * buildTrackerContactHref('contactId', 'options')
 */
export function buildTrackerContactHref(
  contactId: string,
  options: { source?: string } = {}
): string {
  const params = new URLSearchParams();
  params.set("contactId", contactId);
  if (options.source) {
    params.set("source", options.source);
  }
  return `${TRACKER_ENTRY_ROUTE}?${params.toString()}`;
}

/**
 * Get tracker contact id from params.
 * @param {Pick<URLSearchParams, "get">} params - Params input.
 * @returns {string | null} Computed string | null.
 * @example
 * getTrackerContactIdFromParams({})
 */
export function getTrackerContactIdFromParams(params: Pick<URLSearchParams, "get">): string | null {
  const value = params.get("contactId");
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Count contacts needing follow up.
 * @param {ContactLikeForTracker[]} contacts - Contacts input.
 * @param {Date} nowDate - Now date input.
 * @returns {number} Computed number.
 * @example
 * countContactsNeedingFollowUp([], new Date())
 */
export function countContactsNeedingFollowUp(
  contacts: ContactLikeForTracker[],
  nowDate: Date = new Date()
): number {
  return contacts.reduce((count, contact) => {
    const trackerContact = toTrackerContact(contact);
    return isNeedsFollowUp(trackerContact, nowDate) ? count + 1 : count;
  }, 0);
}

/**
 * Map sequence action to tracker contact patch.
 * @param {string} action - Action input.
 * @param {string} nowIso - Now iso input.
 * @returns {{ status: TrackerContactStatus; last_contacted_at?: string; updated_at: string } | null} Computed { status: TrackerContactStatus; last_contacted_at?: string; updated_at: string } | null.
 * @example
 * mapSequenceActionToTrackerContactPatch('action', 'nowIso')
 */
export function mapSequenceActionToTrackerContactPatch(
  action: string,
  nowIso: string = new Date().toISOString()
): { status: TrackerContactStatus; last_contacted_at?: string; updated_at: string } | null {
  if (action === "mark_sent") {
    return {
      status: "contacted",
      last_contacted_at: nowIso,
      updated_at: nowIso,
    };
  }

  if (action === "mark_replied") {
    return {
      status: "replied",
      updated_at: nowIso,
    };
  }

  return null;
}

/**
 * Save tracker deep link contact.
 * @param {ContactLikeForTracker} contact - Contact input.
 * @returns {unknown} Computed unknown.
 * @example
 * saveTrackerDeepLinkContact({})
 */
export function saveTrackerDeepLinkContact(contact: ContactLikeForTracker) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRACKER_DEEPLINK_CONTACT_KEY, JSON.stringify(contact));
  } catch {
    // Best effort.
  }
}

/**
 * Consume tracker deep link contact.
 * @param {string} contactId - Contact id input.
 * @returns {ContactLikeForTracker | null} Computed ContactLikeForTracker | null.
 * @example
 * consumeTrackerDeepLinkContact('contactId')
 */
export function consumeTrackerDeepLinkContact(contactId: string): ContactLikeForTracker | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TRACKER_DEEPLINK_CONTACT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ContactLikeForTracker | null;
    window.localStorage.removeItem(TRACKER_DEEPLINK_CONTACT_KEY);
    if (!parsed || parsed.id !== contactId) return null;
    return parsed;
  } catch {
    return null;
  }
}
