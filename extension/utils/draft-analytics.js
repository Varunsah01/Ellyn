/**
 * draft-analytics.js
 * Local-only draft analytics tracker.
 *
 * All data is stored exclusively in chrome.storage.local under the key
 * 'ellyn_draft_analytics'. Nothing is ever sent to external servers.
 *
 * Storage schema:
 *   ellyn_draft_analytics: {
 *     [YYYY-MM-DD]: {
 *       draft_view_opened:  number,
 *       draft_edited:       number,
 *       gmail_opened:       number,
 *       draft_sent:         number,
 *       email_type_selected: { [type: string]: number },
 *       draft_generated:    { template: number, ai: number }
 *     }
 *   }
 *
 * Public API (globals):
 *   trackEvent(eventName, metadata)  — fire-and-forget
 *   getAnalytics(options)            — Promise<DraftAnalyticsResult>
 *   clearAnalytics()                 — Promise<void>
 */

/* eslint-disable no-console */

const _DA_STORAGE_KEY = "ellyn_draft_analytics";

// ── Storage helpers ───────────────────────────────────────────────────────────

/** @returns {Promise<Record<string, object>>} */
function _daLoad() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get([_DA_STORAGE_KEY], (result) => {
          if (chrome.runtime?.lastError) { resolve({}); return; }
          resolve(result?.[_DA_STORAGE_KEY] ?? {});
        });
      } else {
        resolve({});
      }
    } catch {
      resolve({});
    }
  });
}

/** @param {Record<string, object>} data */
function _daSave(data) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [_DA_STORAGE_KEY]: data });
    }
  } catch { /* extension API unavailable */ }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** @returns {string} YYYY-MM-DD for today (local time) */
function _daToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns an array of YYYY-MM-DD strings, sorted ascending,
 * covering the last `n` days inclusive of today.
 * @param {number} n
 * @returns {string[]}
 */
function _daLastNDays(n) {
  const days = [];
  const now  = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d   = new Date(now);
    d.setDate(d.getDate() - i);
    const y   = d.getFullYear();
    const mo  = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${mo}-${day}`);
  }
  return days;
}

/**
 * Generates all YYYY-MM-DD dates between `from` and `to` (inclusive, ascending).
 * @param {string} from YYYY-MM-DD
 * @param {string} to   YYYY-MM-DD
 * @returns {string[]}
 */
function _daDateRange(from, to) {
  const result = [];
  const cur    = new Date(from);
  const end    = new Date(to);
  while (cur <= end) {
    const y   = cur.getFullYear();
    const m   = String(cur.getMonth() + 1).padStart(2, "0");
    const day = String(cur.getDate()).padStart(2, "0");
    result.push(`${y}-${m}-${day}`);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ── trackEvent ────────────────────────────────────────────────────────────────

/** Set of recognised event names. */
const _DA_EVENTS = new Set([
  "draft_view_opened",
  "email_type_selected",
  "draft_generated",
  "draft_edited",
  "gmail_opened",
  "draft_sent",
]);

/**
 * Records a single analytics event, aggregated into today's bucket.
 * Fire-and-forget: errors are silently swallowed so the UI is never blocked.
 *
 * @param {string} eventName
 * @param {{ type?: string, source?: string } | undefined} [metadata]
 */
function trackEvent(eventName, metadata) {
  if (!_DA_EVENTS.has(eventName)) return;

  void _daLoad()
    .then((data) => {
      const today = _daToday();
      if (!data[today]) data[today] = {};
      const bucket = data[today];

      switch (eventName) {
        case "email_type_selected": {
          const type = String(metadata?.type ?? "unknown");
          if (!bucket.email_type_selected) bucket.email_type_selected = {};
          bucket.email_type_selected[type] =
            (bucket.email_type_selected[type] ?? 0) + 1;
          break;
        }
        case "draft_generated": {
          const src = metadata?.source === "ai" ? "ai" : "template";
          if (!bucket.draft_generated) bucket.draft_generated = { template: 0, ai: 0 };
          bucket.draft_generated[src] = (bucket.draft_generated[src] ?? 0) + 1;
          break;
        }
        default:
          // Simple integer counter
          bucket[eventName] = (bucket[eventName] ?? 0) + 1;
      }

      _daSave(data);
    })
    .catch((err) => console.error("[DraftAnalytics] trackEvent failed:", err));
}

// ── getAnalytics ──────────────────────────────────────────────────────────────

/**
 * Returns aggregated analytics for a date window.
 *
 * @param {{ days?: number, from?: string, to?: string } | undefined} [options]
 *   days — last N days inclusive (default 30).
 *   from / to — explicit YYYY-MM-DD range (overrides `days`).
 *
 * @returns {Promise<DraftAnalyticsResult>}
 *
 * @typedef {Object} DraftAnalyticsResult
 * @property {number}                  totalDraftsGenerated
 * @property {string|null}             mostUsedEmailType
 * @property {{ template: number, ai: number }} draftsBySource
 * @property {number}                  avgEditsPerDraft
 * @property {number}                  totalGmailOpened
 * @property {number}                  totalDraftSent
 * @property {number}                  totalViewOpened
 * @property {number}                  totalEdits
 * @property {Record<string, number>}  emailTypeBreakdown
 * @property {DayEntry[]}              dailySeries
 *
 * @typedef {{ date: string, draft_view_opened: number, drafts_generated: number, gmail_opened: number, draft_sent: number }} DayEntry
 */
async function getAnalytics(options) {
  const data  = await _daLoad();
  let   dates;

  if (options?.from && options?.to) {
    dates = _daDateRange(options.from, options.to);
  } else {
    dates = _daLastNDays(options?.days ?? 30);
  }

  // Accumulators
  let totalGenerated = 0;
  let totalTemplate  = 0;
  let totalAi        = 0;
  let totalEdits     = 0;
  let totalGmail     = 0;
  let totalSent      = 0;
  let totalOpened    = 0;
  const typeBreakdown = {};
  const dailySeries   = [];

  for (const date of dates) {
    const bucket = data[date] || {};

    const tpl  = bucket.draft_generated?.template ?? 0;
    const ai   = bucket.draft_generated?.ai       ?? 0;
    const gen  = tpl + ai;
    const edit = bucket.draft_edited      ?? 0;
    const gml  = bucket.gmail_opened      ?? 0;
    const snt  = bucket.draft_sent        ?? 0;
    const opn  = bucket.draft_view_opened ?? 0;

    totalGenerated += gen;
    totalTemplate  += tpl;
    totalAi        += ai;
    totalEdits     += edit;
    totalGmail     += gml;
    totalSent      += snt;
    totalOpened    += opn;

    const dayTypes = bucket.email_type_selected ?? {};
    for (const [type, count] of Object.entries(dayTypes)) {
      typeBreakdown[type] = (typeBreakdown[type] ?? 0) + count;
    }

    dailySeries.push({
      date,
      draft_view_opened: opn,
      drafts_generated:  gen,
      gmail_opened:      gml,
      draft_sent:        snt,
    });
  }

  // Derived values
  const mostUsedEmailType =
    Object.keys(typeBreakdown).length > 0
      ? Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a)[0][0]
      : null;

  const avgEditsPerDraft =
    totalGenerated > 0
      ? Math.round((totalEdits / totalGenerated) * 10) / 10
      : 0;

  return {
    totalDraftsGenerated: totalGenerated,
    mostUsedEmailType,
    draftsBySource: { template: totalTemplate, ai: totalAi },
    avgEditsPerDraft,
    totalGmailOpened: totalGmail,
    totalDraftSent:   totalSent,
    totalViewOpened:  totalOpened,
    totalEdits,
    emailTypeBreakdown: typeBreakdown,
    dailySeries,
  };
}

// ── clearAnalytics ────────────────────────────────────────────────────────────

/**
 * Removes all stored draft analytics data from chrome.storage.local.
 * @returns {Promise<void>}
 */
function clearAnalytics() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.remove([_DA_STORAGE_KEY], () => {
          if (chrome.runtime?.lastError) {
            console.warn("[DraftAnalytics] clearAnalytics error:", chrome.runtime.lastError);
          }
          resolve();
        });
      } else {
        resolve();
      }
    } catch {
      resolve();
    }
  });
}

// ── Global exports ────────────────────────────────────────────────────────────

if (typeof globalThis !== "undefined") {
  globalThis.trackEvent     = trackEvent;
  globalThis.getAnalytics   = getAnalytics;
  globalThis.clearAnalytics = clearAnalytics;
}
