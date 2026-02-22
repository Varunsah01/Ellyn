/**
 * draft-stats-panel.js
 * In-extension analytics dashboard for draft behaviour.
 * All data comes from draft-analytics.js (local chrome.storage only).
 *
 * Load order: utils/draft-analytics.js must be loaded before this file.
 *
 * Public API (globals):
 *   renderDraftStatsPanel()                    → HTML string
 *   initDraftStatsPanelListeners(container)    → Promise<{ refresh(), destroy() }>
 *
 * Events dispatched on the container (bubble):
 *   "dsp-close"    — user clicked the close button
 */

// ── Style injection ───────────────────────────────────────────────────────────

function _ensureDspStyles() {
  if (document.getElementById("ellyn-dsp-styles")) return;

  const style = document.createElement("style");
  style.id = "ellyn-dsp-styles";
  style.textContent = `
    /* ── Root ─────────────────────────────────────────────── */
    .dsp-root {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      background: #f8fafc;
      font-family: "Inter", "SF Pro Display", "Segoe UI", Arial, sans-serif;
      color: #0f172a;
    }

    /* ── Header ────────────────────────────────────────────── */
    .dsp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .dsp-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .dsp-title-icon {
      font-size: 16px;
      line-height: 1;
    }

    .dsp-close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      color: #64748b;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .dsp-close-btn:hover {
      background: #f1f5f9;
      color: #334155;
    }

    /* ── Period tabs ───────────────────────────────────────── */
    .dsp-period-row {
      display: flex;
      gap: 4px;
      padding: 10px 16px 0;
    }

    .dsp-period-btn {
      flex: 1;
      height: 28px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #ffffff;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }

    .dsp-period-btn:hover {
      background: #f1f5f9;
      color: #334155;
    }

    .dsp-period-btn.is-active {
      background: #eef2ff;
      border-color: #c7d2fe;
      color: #4338ca;
    }

    /* ── Main scroll ───────────────────────────────────────── */
    .dsp-main {
      flex: 1;
      overflow-y: auto;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* ── Section label ─────────────────────────────────────── */
    .dsp-section-label {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    /* ── 2-column stat grid ────────────────────────────────── */
    .dsp-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    /* ── Individual stat card ──────────────────────────────── */
    .dsp-stat-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .dsp-stat-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      line-height: 1.3;
    }

    .dsp-stat-value {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }

    .dsp-stat-value.small {
      font-size: 14px;
      font-weight: 700;
      word-break: break-word;
    }

    .dsp-stat-sub {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 1px;
    }

    /* ── AI vs Template bar ────────────────────────────────── */
    .dsp-ratio-bar-track {
      height: 6px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 6px;
    }

    .dsp-ratio-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 999px;
      transition: width 0.3s ease;
      min-width: 0;
    }

    .dsp-ratio-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
      margin-top: 3px;
    }

    /* ── Breakdown table ───────────────────────────────────── */
    .dsp-breakdown-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .dsp-breakdown-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 5px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .dsp-breakdown-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .dsp-breakdown-row:first-child {
      padding-top: 0;
    }

    .dsp-breakdown-key {
      font-size: 12px;
      color: #334155;
      flex: 1;
    }

    .dsp-breakdown-count {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      min-width: 24px;
      text-align: right;
    }

    .dsp-breakdown-bar {
      width: 60px;
      height: 5px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .dsp-breakdown-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 999px;
    }

    .dsp-breakdown-empty {
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      padding: 12px 0 6px;
    }

    /* ── Secondary row of counters ─────────────────────────── */
    .dsp-secondary-row {
      display: flex;
      gap: 8px;
    }

    .dsp-secondary-card {
      flex: 1;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .dsp-secondary-value {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }

    .dsp-secondary-label {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
    }

    /* ── Loading overlay ───────────────────────────────────── */
    .dsp-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 40px 20px;
      color: #94a3b8;
      font-size: 13px;
    }

    .dsp-loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #e2e8f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: dsp-spin 0.8s linear infinite;
      margin-right: 8px;
      flex-shrink: 0;
    }

    @keyframes dsp-spin {
      to { transform: rotate(360deg); }
    }

    /* ── Empty state ────────────────────────────────────────── */
    .dsp-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 20px;
      text-align: center;
    }

    .dsp-empty-icon {
      font-size: 32px;
      line-height: 1;
    }

    .dsp-empty-text {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
      margin: 0;
    }

    .dsp-empty-action {
      height: 32px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .dsp-empty-action:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    /* ── Footer ─────────────────────────────────────────────── */
    .dsp-footer {
      display: flex;
      gap: 8px;
      padding: 10px 16px 14px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      flex-shrink: 0;
    }

    .dsp-footer-btn {
      flex: 1;
      height: 32px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .dsp-footer-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .dsp-footer-btn.danger:hover {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #b91c1c;
    }

    .dsp-privacy-note {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      padding: 0 16px 10px;
      line-height: 1.4;
    }
  `;
  document.head.appendChild(style);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const _DSP_TYPE_LABELS = {
  referral_request: "Referral Request",
  to_recruiter:     "To Recruiter",
  seeking_advice:   "Seeking Advice",
  ai_generated:     "AI Generated",
};

function _dspTypeLabel(type) {
  return _DSP_TYPE_LABELS[type] || String(type).replace(/_/g, " ");
}

function _dspEscape(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Converts a period tab value to a getAnalytics() options object.
 * @param {"7d"|"30d"|"all"} period
 * @returns {{ days?: number }}
 */
function _dspPeriodOptions(period) {
  if (period === "7d")  return { days: 7  };
  if (period === "30d") return { days: 30 };
  return { days: 365 }; // "all" — large window
}

// ── Render ────────────────────────────────────────────────────────────────────

/**
 * Returns the full HTML string for the stats panel root.
 * Call initDraftStatsPanelListeners() after injecting into the DOM.
 *
 * @returns {string}
 */
function renderDraftStatsPanel() {
  _ensureDspStyles();

  return `
<div class="dsp-root" role="main" aria-label="Draft analytics">

  <!-- ── Header ─────────────────────────────────────────── -->
  <header class="dsp-header">
    <span class="dsp-title">
      <span class="dsp-title-icon" aria-hidden="true">📊</span>
      Draft Analytics
    </span>
    <button type="button" class="dsp-close-btn" aria-label="Close analytics" title="Close">✕</button>
  </header>

  <!-- ── Period tabs ────────────────────────────────────── -->
  <div class="dsp-period-row" role="group" aria-label="Time period">
    <button type="button" class="dsp-period-btn is-active" data-period="7d">Last 7 days</button>
    <button type="button" class="dsp-period-btn" data-period="30d">Last 30 days</button>
    <button type="button" class="dsp-period-btn" data-period="all">All time</button>
  </div>

  <!-- ── Content (swapped by JS) ────────────────────────── -->
  <div class="dsp-main" id="dspMainContent">
    <!-- Filled by _dspRenderContent() -->
    <div class="dsp-loading">
      <div class="dsp-loading-spinner"></div>
      Loading…
    </div>
  </div>

  <!-- ── Footer ─────────────────────────────────────────── -->
  <footer class="dsp-footer">
    <button type="button" class="dsp-footer-btn" data-action="refresh">↻ Refresh</button>
    <button type="button" class="dsp-footer-btn danger" data-action="clear">Clear Data</button>
  </footer>
  <p class="dsp-privacy-note">🔒 All data stored locally — never sent to external servers.</p>

</div>`.trim();
}

// ── Content rendering ─────────────────────────────────────────────────────────

/**
 * Builds the inner HTML for the stats content area.
 * @param {import("./draft-analytics.js").DraftAnalyticsResult} stats
 * @returns {string}
 */
function _dspBuildContent(stats) {
  const {
    totalDraftsGenerated,
    mostUsedEmailType,
    draftsBySource,
    avgEditsPerDraft,
    totalGmailOpened,
    totalDraftSent,
    emailTypeBreakdown,
  } = stats;

  const hasAnyData = totalDraftsGenerated > 0 || totalGmailOpened > 0;

  if (!hasAnyData) {
    return `
      <div class="dsp-empty">
        <span class="dsp-empty-icon" aria-hidden="true">✉️</span>
        <p class="dsp-empty-text">No drafts generated in this period yet.<br>Open the Draft Generator and get started!</p>
        <button type="button" class="dsp-empty-action" data-action="open-draft">
          Back to Draft Generator
        </button>
      </div>`;
  }

  // ── AI vs Template ratio ─────────────────────────────────────
  const tpl        = draftsBySource.template;
  const ai         = draftsBySource.ai;
  const totalSrc   = tpl + ai;
  const tplPct     = totalSrc > 0 ? Math.round((tpl / totalSrc) * 100) : 0;
  const aiPct      = totalSrc > 0 ? 100 - tplPct : 0;
  const ratioLabel = totalSrc > 0 ? `${tpl} template · ${ai} AI` : "—";

  // ── Email type breakdown ─────────────────────────────────────
  const typeEntries = Object.entries(emailTypeBreakdown)
    .sort(([, a], [, b]) => b - a);
  const maxTypeCount = typeEntries.length > 0 ? typeEntries[0][1] : 1;

  const typeRowsHtml = typeEntries.length === 0
    ? `<p class="dsp-breakdown-empty">No type data yet.</p>`
    : typeEntries
        .map(([type, count]) => {
          const barWidth = Math.round((count / maxTypeCount) * 100);
          return `
            <div class="dsp-breakdown-row">
              <span class="dsp-breakdown-key">${_dspEscape(_dspTypeLabel(type))}</span>
              <div class="dsp-breakdown-bar" title="${count} selection${count !== 1 ? "s" : ""}">
                <div class="dsp-breakdown-bar-fill" style="width:${barWidth}%"></div>
              </div>
              <span class="dsp-breakdown-count">${count}</span>
            </div>`;
        })
        .join("");

  const topTypeLabel =
    mostUsedEmailType ? _dspTypeLabel(mostUsedEmailType) : "—";

  return `
    <!-- ── Primary 4 stats ─────────────────────────────── -->
    <div>
      <p class="dsp-section-label">Key Metrics</p>
      <div class="dsp-grid">

        <!-- Total drafts generated -->
        <div class="dsp-stat-card">
          <span class="dsp-stat-label">Drafts Generated</span>
          <span class="dsp-stat-value">${totalDraftsGenerated}</span>
        </div>

        <!-- Most used email type -->
        <div class="dsp-stat-card">
          <span class="dsp-stat-label">Top Email Type</span>
          <span class="dsp-stat-value small">${_dspEscape(topTypeLabel)}</span>
        </div>

        <!-- AI vs Template -->
        <div class="dsp-stat-card">
          <span class="dsp-stat-label">Template vs AI</span>
          <span class="dsp-stat-value" style="font-size:15px;font-weight:700">${tplPct}% / ${aiPct}%</span>
          <div class="dsp-ratio-bar-track" title="Template ${tplPct}% · AI ${aiPct}%">
            <div class="dsp-ratio-bar-fill" style="width:${tplPct}%"></div>
          </div>
          <div class="dsp-ratio-labels">
            <span>Template</span>
            <span>${ratioLabel}</span>
            <span>AI</span>
          </div>
        </div>

        <!-- Avg edits per draft -->
        <div class="dsp-stat-card">
          <span class="dsp-stat-label">Avg Edits / Draft</span>
          <span class="dsp-stat-value">${avgEditsPerDraft}</span>
          <span class="dsp-stat-sub">edit events per draft</span>
        </div>

      </div>
    </div>

    <!-- ── Secondary counters ──────────────────────────── -->
    <div class="dsp-secondary-row">
      <div class="dsp-secondary-card">
        <span class="dsp-secondary-value">${totalGmailOpened}</span>
        <span class="dsp-secondary-label">Gmail Opened</span>
      </div>
      <div class="dsp-secondary-card">
        <span class="dsp-secondary-value">${totalDraftSent}</span>
        <span class="dsp-secondary-label">Emails Sent</span>
      </div>
    </div>

    <!-- ── Type breakdown ──────────────────────────────── -->
    <div>
      <p class="dsp-section-label">Email Type Usage</p>
      <div class="dsp-breakdown-card">
        ${typeRowsHtml}
      </div>
    </div>
  `;
}

// ── Listener wiring ───────────────────────────────────────────────────────────

/**
 * Wires all interactive behaviour on the stats panel after its HTML has been
 * injected into the DOM.
 *
 * @param {HTMLElement} container  The element containing `.dsp-root`.
 * @returns {Promise<{ refresh(): Promise<void>, destroy(): void }>}
 */
async function initDraftStatsPanelListeners(container) {
  _ensureDspStyles();

  const root = container?.querySelector(".dsp-root") ?? container;
  if (!root) return { refresh: async () => {}, destroy: () => {} };

  const mainContent = root.querySelector("#dspMainContent");
  if (!mainContent) return { refresh: async () => {}, destroy: () => {} };

  let currentPeriod = "7d";
  const abortCtrl = { destroyed: false };

  function emitClose() {
    container.dispatchEvent(new CustomEvent("dsp-close", { bubbles: true }));
  }

  // ── Load and render stats ────────────────────────────────────────────────
  async function loadStats(period) {
    if (abortCtrl.destroyed) return;

    // Show spinner
    mainContent.innerHTML = `
      <div class="dsp-loading">
        <div class="dsp-loading-spinner"></div>
        Loading…
      </div>`;

    try {
      if (typeof getAnalytics !== "function") {
        throw new Error("draft-analytics.js not loaded");
      }
      const stats = await getAnalytics(_dspPeriodOptions(period));
      if (abortCtrl.destroyed) return;
      mainContent.innerHTML = _dspBuildContent(stats);
    } catch (err) {
      if (abortCtrl.destroyed) return;
      mainContent.innerHTML = `
        <div class="dsp-empty">
          <span class="dsp-empty-icon" aria-hidden="true">⚠️</span>
          <p class="dsp-empty-text">Could not load analytics.<br>Please try again.</p>
        </div>`;
      console.error("[DraftStatsPanel] loadStats failed:", err);
    }
  }

  // ── Period tab clicks ────────────────────────────────────────────────────
  const periodBtns = root.querySelectorAll(".dsp-period-btn");

  function handlePeriodClick(e) {
    const btn = e.currentTarget;
    const period = btn.dataset.period;
    if (period === currentPeriod) return;

    periodBtns.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    currentPeriod = period;
    void loadStats(currentPeriod);
  }

  periodBtns.forEach((btn) => btn.addEventListener("click", handlePeriodClick));

  // ── Close button ─────────────────────────────────────────────────────────
  const closeBtn = root.querySelector(".dsp-close-btn");

  function handleClose() {
    emitClose();
  }

  closeBtn?.addEventListener("click", handleClose);

  function handleMainAction(e) {
    const btn = e.target.closest("[data-action='open-draft']");
    if (!btn) return;
    emitClose();
  }

  mainContent.addEventListener("click", handleMainAction);

  // ── Footer buttons (refresh + clear) ─────────────────────────────────────
  async function handleFooterAction(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    if (btn.dataset.action === "refresh") {
      await loadStats(currentPeriod);
    } else if (btn.dataset.action === "clear") {
      if (typeof clearAnalytics !== "function") return;
      btn.textContent = "Clearing…";
      btn.disabled = true;
      try {
        await clearAnalytics();
        await loadStats(currentPeriod);
      } finally {
        btn.textContent = "Clear Data";
        btn.disabled = false;
      }
    }
  }

  root.querySelector(".dsp-footer")?.addEventListener("click", handleFooterAction);

  // ── Initial load ─────────────────────────────────────────────────────────
  await loadStats(currentPeriod);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  function destroy() {
    abortCtrl.destroyed = true;
    periodBtns.forEach((btn) => btn.removeEventListener("click", handlePeriodClick));
    closeBtn?.removeEventListener("click", handleClose);
    mainContent.removeEventListener("click", handleMainAction);
  }

  return {
    refresh: () => loadStats(currentPeriod),
    destroy,
  };
}

// ── Global exports ────────────────────────────────────────────────────────────

if (typeof globalThis !== "undefined") {
  globalThis.renderDraftStatsPanel             = renderDraftStatsPanel;
  globalThis.initDraftStatsPanelListeners      = initDraftStatsPanelListeners;
}
