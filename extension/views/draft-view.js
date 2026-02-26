/**
 * draft-view.js
 * Combines all draft-related components into a single cohesive interface.
 *
 * Load order — all of the following must be <script>-loaded before this file:
 *   utils/role-detector.js
 *   utils/saved-templates.js
 *   templates/recruiter-templates.js
 *   components/contact-card.js
 *   components/email-type-selector.js
 *   components/generate-draft-button.js
 *   components/draft-editor.js
 *   components/gmail-action-button.js
 *
 * Public API:
 *   renderDraftView(contact)           → HTML string
 *   initDraftView(container, contact)  → Promise<{ destroy() }>
 *
 * Events dispatched on the root element (bubble):
 *   "dv-settings-clicked"   — header settings button pressed
 *   "dv-profile-clicked"    — header profile button pressed
 *   "dv-sent"               — detail: { email, subject, sentAt }
 *
 * @typedef {{ name?: string, company?: string, email?: string, role?: string }} DvContact
 */

// ── Style injection ───────────────────────────────────────────────────────────

function _ensureDvStyles() {
  if (document.getElementById("ellyn-dv-styles")) return;

  const style = document.createElement("style");
  style.id = "ellyn-dv-styles";
  style.textContent = `
    /* ── Root layout ───────────────────────────────────────── */
    .dv-root {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      background: #f8fafc;
      font-family: "Inter", "SF Pro Display", "Segoe UI", Arial, sans-serif;
      color: #0f172a;
    }

    /* ── Header ────────────────────────────────────────────── */
    .dv-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .dv-header-left {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .dv-brand {
      display: inline-flex;
      align-items: center;
      line-height: 1;
      user-select: none;
    }

    .dv-brand-logo {
      height: 22px;
      width: auto;
      display: block;
      object-fit: contain;
    }

    .dv-brand-fallback {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: none;
    }

    .dv-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dv-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      background: #ffffff;
      color: #64748b;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }

    .dv-icon-btn:hover {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }

    .dv-icon-btn:focus-visible {
      outline: 2px solid #667eea;
      outline-offset: 2px;
    }

    .dv-icon-btn svg {
      width: 15px;
      height: 15px;
      pointer-events: none;
    }

    /* ── Main scroll area ──────────────────────────────────── */
    .dv-main {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* ── Section label ─────────────────────────────────────── */
    .dv-section-label {
      margin: 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
      padding: 0 2px;
    }

    /* ── Card wrapper (shared surface for components) ──────── */
    .dv-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }

    /* ── Empty hint ────────────────────────────────────────── */
    .dv-empty-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px 16px;
      border: 1.5px dashed #e2e8f0;
      border-radius: 12px;
      text-align: center;
      transition: opacity 0.2s ease;
    }

    .dv-empty-hint-icon {
      font-size: 28px;
      line-height: 1;
    }

    .dv-empty-hint p {
      margin: 0;
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
    }

    .dv-empty-hint--hidden {
      display: none;
    }

    /* ── Editor section (slides in on first draft) ─────────── */
    .dv-editor-section {
      display: none;                /* removed from layout when hidden */
      flex-direction: column;
      gap: 12px;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    .dv-editor-section--visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Thin divider ──────────────────────────────────────── */
    .dv-divider {
      height: 1px;
      background: #f1f5f9;
      border-radius: 1px;
    }

    .dv-ai-disclosure {
      margin: -4px 2px 0;
      font-size: 10px;
      line-height: 1.4;
      color: #94a3b8;
      text-align: center;
      letter-spacing: 0.01em;
      display: none;
    }

    .dv-ai-disclosure--visible {
      display: block;
    }

    .dv-ai-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .dv-ai-actions--two {
      grid-template-columns: 1fr auto;
      align-items: stretch;
    }

    .dv-ai-scratch-btn {
      display: none;
      align-items: center;
      justify-content: center;
      border: 1px solid #dbe2ee;
      border-radius: 10px;
      background: #ffffff;
      color: #334155;
      font-size: 12px;
      font-weight: 600;
      padding: 0 12px;
      min-height: 44px;
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .dv-ai-scratch-btn:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .dv-ai-scratch-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .dv-ai-scratch-btn--visible {
      display: inline-flex;
    }

    .dv-ai-goal {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
    }

    .dv-ai-goal--visible {
      display: flex;
    }

    .dv-ai-goal-input {
      flex: 1;
      border: 1px solid #dbe2ee;
      border-radius: 8px;
      height: 34px;
      padding: 0 10px;
      font-size: 12px;
      color: #0f172a;
      background: #ffffff;
      outline: none;
    }

    .dv-ai-goal-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
    }

    .dv-ai-goal-generate-btn {
      height: 34px;
      border: 1px solid #667eea;
      border-radius: 8px;
      background: #ffffff;
      color: #4f46e5;
      font-size: 12px;
      font-weight: 600;
      padding: 0 10px;
      cursor: pointer;
    }

    .dv-ai-goal-generate-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .dv-tmpl-section {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      overflow: hidden;
    }

    .dv-tmpl-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border: none;
      background: #ffffff;
      color: #0f172a;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
    }

    .dv-tmpl-toggle:hover {
      background: #f8fafc;
    }

    .dv-tmpl-toggle-left {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .dv-tmpl-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      border-radius: 999px;
      padding: 0 6px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
    }

    .dv-tmpl-chevron {
      color: #64748b;
      font-size: 11px;
      transition: transform 0.2s ease;
    }

    .dv-tmpl-section--expanded .dv-tmpl-chevron {
      transform: rotate(180deg);
    }

    .dv-tmpl-body {
      display: none;
      padding: 0 14px 14px;
      border-top: 1px solid #f1f5f9;
      gap: 10px;
      flex-direction: column;
    }

    .dv-tmpl-section--expanded .dv-tmpl-body {
      display: flex;
    }

    .dv-tmpl-search {
      width: 100%;
      border: 1px solid #dbe2ee;
      border-radius: 8px;
      height: 34px;
      padding: 0 10px;
      font-size: 12px;
      color: #0f172a;
      background: #ffffff;
      outline: none;
    }

    .dv-tmpl-search:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
    }

    .dv-tmpl-list {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
    }

    .dv-tmpl-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px;
      align-items: start;
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
    }

    .dv-tmpl-row:last-child {
      border-bottom: none;
    }

    .dv-tmpl-row:hover {
      background: #f8fafc;
    }

    .dv-tmpl-row input[type="radio"] {
      margin-top: 3px;
    }

    .dv-tmpl-name {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.35;
    }

    .dv-tmpl-meta {
      margin-top: 4px;
      display: inline-flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      font-size: 10px;
      color: #64748b;
    }

    .dv-tmpl-badge {
      display: inline-flex;
      align-items: center;
      border: 1px solid #dbe2ee;
      border-radius: 999px;
      padding: 2px 6px;
      background: #f8fafc;
      font-size: 10px;
      color: #475569;
      font-weight: 600;
    }

    .dv-tmpl-empty {
      margin: 0;
      font-size: 12px;
      line-height: 1.45;
      color: #64748b;
      padding: 10px 12px;
      border: 1px dashed #dbe2ee;
      border-radius: 10px;
      background: #f8fafc;
    }

    .dv-tmpl-empty-link {
      border: none;
      background: none;
      padding: 0;
      color: #4f46e5;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .dv-tmpl-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .dv-tmpl-apply-btn {
      width: 100%;
      border: 1px solid #667eea;
      border-radius: 8px;
      background: #667eea;
      color: #ffffff;
      height: 36px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .dv-tmpl-apply-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .dv-tmpl-manage-btn {
      width: 100%;
      border: 1px solid #dbe2ee;
      border-radius: 8px;
      background: #ffffff;
      color: #334155;
      height: 34px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .dv-tmpl-manage-btn:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    /* ── Error banner ──────────────────────────────────────── */
    .dv-error-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      font-size: 12px;
      color: #b91c1c;
      line-height: 1.45;
      /* Hidden by default */
      display: none;
    }

    .dv-error-banner--visible {
      display: flex;
    }

    .dv-error-banner svg {
      width: 15px;
      height: 15px;
      flex-shrink: 0;
      margin-top: 1px;
      color: #ef4444;
    }

    /* ── Sent overlay badge on the editor section ──────────── */
    .dv-sent-badge {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      color: #166534;
    }

    .dv-sent-badge--visible {
      display: flex;
    }
  `;
  document.head.appendChild(style);
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function _dvStorageGet(key) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime?.lastError) { resolve(null); return; }
          resolve(result?.[key] ?? null);
        });
      } else {
        resolve(null);
      }
    } catch { resolve(null); }
  });
}

/** @param {string} key @param {*} value */
function _dvStorageSet(key, value) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [key]: value });
    }
  } catch { /* extension API unavailable */ }
}

/** Derives a safe storage key from a contact email. */
function _dvStorageKey(contact) {
  const email = String(contact?.email ?? "").trim().toLowerCase();
  const safe  = email.replace(/[^a-z0-9@._-]/g, "_") || "unknown";
  return `dv_draft_${safe}`;
}

const _DV_DEFAULT_WEBAPP_ORIGIN = "https://www.useellyn.com";
const _DV_AUTH_SOURCE_ORIGIN_KEY = "ellyn_auth_origin";
const _DV_TEMPLATES_MANAGE_PATH = "/dashboard/templates";

function _dvNormalizeHttpOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!["https:", "http:"].includes(parsed.protocol)) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function _dvSendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Runtime message failed"));
          return;
        }
        resolve(response ?? null);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function _dvResolveWebappOrigin() {
  const originFromStorage = _dvNormalizeHttpOrigin(await _dvStorageGet(_DV_AUTH_SOURCE_ORIGIN_KEY));
  if (originFromStorage) return originFromStorage;
  return _DV_DEFAULT_WEBAPP_ORIGIN;
}

function _dvOpenWebappPath(pathname) {
  const safePath = String(pathname || "").startsWith("/")
    ? String(pathname || "")
    : `/${String(pathname || "").trim()}`;

  void (async () => {
    const origin = await _dvResolveWebappOrigin();
    const url = `${origin}${safePath}`;

    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  })();
}

function _dvSplitName(value) {
  const fullName = String(value || "").trim().replace(/\s+/g, " ");
  if (!fullName) {
    return { firstName: "", lastName: "", fullName: "" };
  }

  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
      fullName: parts[0],
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName,
  };
}

function _dvBuildTemplateContact(contact) {
  const split = _dvSplitName(contact?.fullName || contact?.name);
  const firstName = String(contact?.firstName || split.firstName || "").trim();
  const lastName = String(contact?.lastName || split.lastName || "").trim();
  const fullName = String(contact?.fullName || split.fullName || [firstName, lastName].filter(Boolean).join(" ")).trim();

  return {
    firstName,
    lastName,
    fullName,
    company: String(contact?.company || contact?.companyName || "").trim(),
    role: String(contact?.role || contact?.designation || "").trim(),
    email: String(contact?.email || "").trim(),
  };
}

function _dvNormalizeUseCase(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "job_seeker" || normalized === "smb_sales" || normalized === "general") {
    return normalized;
  }
  return "";
}

function _dvLooksLikeSales(text) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("sales") ||
    normalized.includes("account executive") ||
    normalized.includes("account manager") ||
    normalized.includes("sdr") ||
    normalized.includes("bdr") ||
    normalized.includes("business development") ||
    normalized.includes("revenue")
  );
}

async function _dvResolvePersonaUseCase(contact) {
  try {
    const stored = await _dvStorageGet("user");
    const user = stored && typeof stored === "object" ? stored : {};
    const meta = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};

    const fromMeta = _dvNormalizeUseCase(
      meta?.use_case || meta?.persona || meta?.persona_type || meta?.audience
    );
    if (fromMeta) return fromMeta;
  } catch {
    // Ignore storage errors and continue fallback logic.
  }

  const roleHint = String(contact?.role || contact?.designation || "").trim();
  if (_dvLooksLikeSales(roleHint)) {
    return "smb_sales";
  }

  return "job_seeker";
}

function _dvDefaultGoalForUseCase(useCase) {
  if (useCase === "smb_sales") {
    return "Book a demo call";
  }
  if (useCase === "job_seeker") {
    return "Get a job interview";
  }
  return "Start a useful conversation";
}

// ── Toast bridge ──────────────────────────────────────────────────────────────

function _dvToast(message, tone = "info") {
  if (typeof showToast === "function") {
    showToast(message, tone);
    return;
  }
  // Minimal fallback (the gmail-action-button's fallback covers extended use)
  if (typeof _gabShowToast === "function") {
    _gabShowToast(message, tone);
  }
}

// ── Section transition helpers ────────────────────────────────────────────────

/**
 * Reveals the editor section with a slide-in transition.
 * @param {HTMLElement} root
 */
function _dvShowEditorSection(root) {
  const section = root.querySelector(".dv-editor-section");
  const hint    = root.querySelector(".dv-empty-hint");

  if (!section) return;

  hint?.classList.add("dv-empty-hint--hidden");

  // Flip display from none → flex, then trigger CSS transition on next frame
  section.style.display = "flex";
  // eslint-disable-next-line no-unused-expressions
  section.offsetHeight; // force reflow so the transition fires
  section.classList.add("dv-editor-section--visible");
}

/**
 * Shows the error banner with a message, auto-hides after `durationMs`.
 * @param {HTMLElement} root
 * @param {string} message
 * @param {number} [durationMs]
 */
function _dvShowError(root, message, durationMs = 5000) {
  const banner = root.querySelector(".dv-error-banner");
  const text   = root.querySelector(".dv-error-banner-text");
  if (!banner) return;

  if (text) text.textContent = message;
  banner.classList.add("dv-error-banner--visible");

  if (durationMs > 0) {
    setTimeout(() => banner.classList.remove("dv-error-banner--visible"), durationMs);
  }
}

// ── HTML rendering ────────────────────────────────────────────────────────────

/**
 * Renders the full draft view and returns an HTML string.
 * Inject with innerHTML, then call initDraftView(container, contact).
 *
 * @param {DvContact} contact
 * @returns {string}
 */
function renderDraftView(contact) {
  _ensureDvStyles();

  // ── Sub-component HTML ────────────────────────────────────────────────────
  const contactCardHtml  =
    typeof renderContactCard  === "function" ? renderContactCard(contact)          : "";
  const typeSelectorHtml =
    typeof renderEmailTypeSelector === "function" ? renderEmailTypeSelector(contact) : "";
  const generateBtnHtml  =
    typeof renderGenerateDraftButton === "function" ? renderGenerateDraftButton()   : "";
  const draftEditorHtml  =
    typeof renderDraftEditor === "function" ? renderDraftEditor()                   : "";
  const gmailBtnHtml     =
    typeof renderGmailButton === "function"
      ? renderGmailButton(contact?.email ?? "", "", "")
      : "";

  return `
<div class="dv-root" role="main" aria-label="Draft workspace">

  <!-- ── Header ─────────────────────────────────────────── -->
  <header class="dv-header">
    <div class="dv-header-left">
      <button
        type="button"
        class="dv-icon-btn dv-back-btn"
        aria-label="Back to finder"
        title="Back"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 19-7-7 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span class="dv-brand" aria-label="Ellyn">
        <img
          src="assets/icons/Ellynlogo.png"
          alt="Ellyn"
          class="dv-brand-logo"
          onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"
        />
        <span class="dv-brand-fallback">ELLYN</span>
      </span>
    </div>
    <div class="dv-header-actions" role="toolbar" aria-label="Header actions">
      <button
        type="button"
        class="dv-icon-btn dv-settings-btn"
        aria-label="Open settings"
        title="Settings"
      >
        <!-- gear icon matching sidepanel.html -->
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.34 3.3a1 1 0 0 1 1.32 0l.9.75a1 1 0 0 0 .95.2l1.15-.33a1 1 0 0 1 1.22.7l.3 1.15a1 1 0 0 0 .73.73l1.15.3a1 1 0 0 1 .7 1.22l-.33 1.15a1 1 0 0 0 .2.95l.75.9a1 1 0 0 1 0 1.32l-.75.9a1 1 0 0 0-.2.95l.33 1.15a1 1 0 0 1-.7 1.22l-1.15.3a1 1 0 0 0-.73.73l-.3 1.15a1 1 0 0 1-1.22.7l-1.15-.33a1 1 0 0 0-.95.2l-.9.75a1 1 0 0 1-1.32 0l-.9-.75a1 1 0 0 0-.95-.2l-1.15.33a1 1 0 0 1-1.22-.7l-.3-1.15a1 1 0 0 0-.73-.73l-1.15-.3a1 1 0 0 1-.7-1.22l.33-1.15a1 1 0 0 0-.2-.95l-.75-.9a1 1 0 0 1 0-1.32l.75-.9a1 1 0 0 0 .2-.95l-.33-1.15a1 1 0 0 1 .7-1.22l1.15-.3a1 1 0 0 0 .73-.73l.3-1.15a1 1 0 0 1 1.22-.7l1.15.33a1 1 0 0 0 .95-.2l.9-.75Z"
                stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
      <button
        type="button"
        class="dv-icon-btn dv-profile-btn"
        aria-label="View profile"
        title="Profile"
      >
        <!-- person icon matching sidepanel.html -->
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.25" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 19c1-3.05 3.6-4.75 7-4.75s6 1.7 7 4.75"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- ── Main content ──────────────────────────────────── -->
  <main class="dv-main">

    <!-- Contact card -->
    <div class="dv-contact-card-slot">
      ${contactCardHtml}
    </div>

    <!-- Email type selector -->
    <div>
      <p class="dv-section-label" style="margin-bottom:8px">Email Type</p>
      <div class="dv-type-selector-slot">
        ${typeSelectorHtml}
      </div>
    </div>

    <!-- Saved templates -->
    <section class="dv-tmpl-section" aria-label="Saved templates">
      <button
        type="button"
        class="dv-tmpl-toggle"
        aria-expanded="false"
        aria-controls="dv-tmpl-body"
      >
        <span class="dv-tmpl-toggle-left">
          <span aria-hidden="true">📋</span>
          <span>Saved Templates</span>
          <span class="dv-tmpl-count" id="dv-tmpl-count">0</span>
        </span>
        <span class="dv-tmpl-chevron" aria-hidden="true">▼</span>
      </button>

      <div class="dv-tmpl-body" id="dv-tmpl-body">
        <input
          type="search"
          class="dv-tmpl-search"
          placeholder="Search templates..."
          aria-label="Search saved templates"
        />

        <div class="dv-tmpl-list" role="radiogroup" aria-label="Saved templates list"></div>

        <p class="dv-tmpl-empty">
          No saved templates yet.
          <button type="button" class="dv-tmpl-empty-link">Save templates from the webapp →</button>
        </p>

        <div class="dv-tmpl-actions">
          <button type="button" class="dv-tmpl-apply-btn" disabled>Apply Selected Template</button>
          <button type="button" class="dv-tmpl-manage-btn">Manage Templates →</button>
        </div>
      </div>
    </section>

    <!-- AI draft actions -->
    <div class="dv-ai-actions">
      <div class="dv-generate-btn-slot">
        ${generateBtnHtml}
      </div>
      <button type="button" class="dv-ai-scratch-btn">Draft from Scratch</button>
    </div>
    <div class="dv-ai-goal">
      <input
        type="text"
        class="dv-ai-goal-input"
        placeholder="What's your goal for this email?"
        aria-label="AI draft goal"
      />
      <button type="button" class="dv-ai-goal-generate-btn">Generate</button>
    </div>
    <p class="dv-ai-disclosure" aria-live="polite">
      Email drafts are AI-generated
    </p>

    <!-- Error banner (hidden by default) -->
    <div class="dv-error-banner" role="alert" aria-live="assertive">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 8v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="12" cy="16.5" r="0.75" fill="currentColor"/>
      </svg>
      <span class="dv-error-banner-text">An error occurred.</span>
    </div>

    <!-- Empty hint — visible until first draft is generated -->
    <div class="dv-empty-hint" aria-live="polite">
      <div class="dv-empty-hint-icon" aria-hidden="true">✉️</div>
      <p>Select an email type above and click<br><strong>⚡ Generate Draft</strong> to create your personalised outreach.</p>
    </div>

    <!-- Editor section — hidden until first draft, then slides in -->
    <div class="dv-editor-section" aria-label="Draft editor">

      <!-- Sent badge (hidden until Gmail is opened) -->
      <div class="dv-sent-badge" role="status" aria-live="polite">
        <span aria-hidden="true">✅</span>
        Gmail opened — email is on its way!
      </div>

      <!-- Draft editor -->
      <div class="dv-card">
        <p class="dv-section-label" style="margin-bottom:12px">Draft</p>
        <div class="dv-editor-slot">
          ${draftEditorHtml}
        </div>
      </div>

      <div class="dv-divider"></div>

      <!-- Gmail action button -->
      <div class="dv-gmail-btn-slot">
        ${gmailBtnHtml}
      </div>

    </div>

  </main>
</div>`.trim();
}

// ── Listener wiring ───────────────────────────────────────────────────────────

/**
 * Mounts all component listeners and wires inter-component events.
 * Must be called after injecting renderDraftView() HTML into the DOM.
 *
 * Loads any persisted draft for this contact from chrome.storage and
 * pre-populates the editor if found.
 *
 * @param {HTMLElement} container
 * @param {DvContact} contact
 * @returns {Promise<{ destroy(): void }>}
 */
async function initDraftView(container, contact) {
  const root = container?.querySelector(".dv-root") ?? container;
  if (!root) return { destroy: () => {} };

  // ── Analytics: record that the draft view was opened ──────────────────────
  if (typeof trackEvent === "function") {
    trackEvent("draft_view_opened");
  }

  // Slot references
  const contactCardSlot  = root.querySelector(".dv-contact-card-slot");
  const typeSelectorSlot = root.querySelector(".dv-type-selector-slot");
  const generateBtnSlot  = root.querySelector(".dv-generate-btn-slot");
  const templateSection  = root.querySelector(".dv-tmpl-section");
  const templateToggle   = root.querySelector(".dv-tmpl-toggle");
  const templateCount    = root.querySelector("#dv-tmpl-count");
  const templateSearch   = root.querySelector(".dv-tmpl-search");
  const templateList     = root.querySelector(".dv-tmpl-list");
  const templateApplyBtn = root.querySelector(".dv-tmpl-apply-btn");
  const templateManageBtn = root.querySelector(".dv-tmpl-manage-btn");
  const templateEmpty    = root.querySelector(".dv-tmpl-empty");
  const templateEmptyLink = root.querySelector(".dv-tmpl-empty-link");
  const aiActionsWrap    = root.querySelector(".dv-ai-actions");
  const aiScratchBtn     = root.querySelector(".dv-ai-scratch-btn");
  const aiGoalWrap       = root.querySelector(".dv-ai-goal");
  const aiGoalInput      = root.querySelector(".dv-ai-goal-input");
  const aiGoalGenerateBtn = root.querySelector(".dv-ai-goal-generate-btn");
  const editorSlot       = root.querySelector(".dv-editor-slot");
  const gmailBtnSlot     = root.querySelector(".dv-gmail-btn-slot");
  const sentBadge        = root.querySelector(".dv-sent-badge");
  const aiDisclosure     = root.querySelector(".dv-ai-disclosure");

  // Per-contact storage key so drafts don't bleed across contacts
  const storageKey = _dvStorageKey(contact);

  // ── Tracks whether the editor section is showing ──────────────────────────
  let editorVisible = false;

  function showEditor() {
    if (!editorVisible) {
      _dvShowEditorSection(root);
      editorVisible = true;
    }
  }

  const templateState = {
    expanded: false,
    loaded: false,
    loading: false,
    templates: [],
    filtered: [],
    selectedId: "",
  };

  let isGeminiGenerating = false;
  const personaUseCasePromise = _dvResolvePersonaUseCase(contact);

  function _setTemplateCount(value) {
    if (!templateCount) return;
    const safeCount = Number.isFinite(Number(value)) ? Number(value) : 0;
    templateCount.textContent = String(Math.max(0, safeCount));
  }

  function _setTemplateActionsState() {
    if (!templateApplyBtn) return;
    templateApplyBtn.disabled =
      !templateState.selectedId || templateState.filtered.length === 0;
  }

  function _renderTemplateList() {
    if (!templateList) return;

    templateList.innerHTML = "";
    const list = templateState.filtered;

    if (list.length === 0) {
      templateList.style.display = "none";
      if (templateEmpty) templateEmpty.style.display = "block";
      _setTemplateActionsState();
      return;
    }

    templateList.style.display = "block";
    if (templateEmpty) templateEmpty.style.display = "none";

    for (const template of list) {
      const row = document.createElement("label");
      row.className = "dv-tmpl-row";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "dv-template-choice";
      radio.value = String(template.id || "");
      radio.checked = templateState.selectedId === radio.value;
      radio.addEventListener("change", () => {
        templateState.selectedId = radio.value;
        _setTemplateActionsState();
      });

      const content = document.createElement("div");
      const name = document.createElement("div");
      name.className = "dv-tmpl-name";
      name.textContent = String(template.name || "Untitled template");

      const meta = document.createElement("div");
      meta.className = "dv-tmpl-meta";

      const categoryBadge = document.createElement("span");
      categoryBadge.className = "dv-tmpl-badge";
      categoryBadge.textContent = String(template.category || template.use_case || "general");

      const toneBadge = document.createElement("span");
      toneBadge.className = "dv-tmpl-badge";
      toneBadge.textContent = String(template.tone || "professional");

      meta.appendChild(categoryBadge);
      meta.appendChild(toneBadge);
      content.appendChild(name);
      content.appendChild(meta);

      row.appendChild(radio);
      row.appendChild(content);
      templateList.appendChild(row);
    }

    _setTemplateActionsState();
  }

  function _filterTemplates(query) {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) {
      templateState.filtered = [...templateState.templates];
      if (!templateState.selectedId && templateState.filtered[0]?.id) {
        templateState.selectedId = String(templateState.filtered[0].id);
      }
      _renderTemplateList();
      return;
    }

    templateState.filtered = templateState.templates.filter((template) => {
      const haystack = [
        template?.name,
        template?.subject,
        template?.body,
        template?.category,
        template?.tone,
        template?.use_case,
      ]
        .map((item) => String(item || "").toLowerCase())
        .join(" ");
      return haystack.includes(normalized);
    });

    const selectedStillVisible = templateState.filtered.some(
      (template) => String(template?.id || "") === templateState.selectedId
    );
    if (!selectedStillVisible) {
      templateState.selectedId = templateState.filtered[0]?.id
        ? String(templateState.filtered[0].id)
        : "";
    }

    _renderTemplateList();
  }

  async function _loadSavedTemplates() {
    if (templateState.loading) return;

    templateState.loading = true;
    try {
      const response = await _dvSendRuntimeMessage({ type: "ELLYN_GET_TEMPLATES" });
      if (!response?.success) {
        throw new Error(String(response?.error || "Failed to load templates"));
      }

      const rows = Array.isArray(response.templates) ? response.templates : [];
      templateState.templates = rows;
      templateState.loaded = true;
      _setTemplateCount(rows.length);
      templateState.selectedId = rows[0]?.id ? String(rows[0].id) : "";
      _filterTemplates(templateSearch?.value || "");
    } catch (error) {
      templateState.templates = [];
      templateState.filtered = [];
      templateState.selectedId = "";
      _setTemplateCount(0);
      _renderTemplateList();
      _dvShowError(root, error?.message || "Failed to load saved templates");
    } finally {
      templateState.loading = false;
    }
  }

  async function _toggleTemplateSection() {
    templateState.expanded = !templateState.expanded;
    templateSection?.classList.toggle("dv-tmpl-section--expanded", templateState.expanded);
    if (templateToggle) {
      templateToggle.setAttribute("aria-expanded", templateState.expanded ? "true" : "false");
    }

    if (templateState.expanded && !templateState.loaded) {
      await _loadSavedTemplates();
    }
  }

  function _applySelectedSavedTemplate() {
    const selected = templateState.templates.find(
      (template) => String(template?.id || "") === templateState.selectedId
    );
    if (!selected) {
      _dvToast("Select a template first", "info");
      return;
    }

    if (typeof savedTemplatesApply !== "function") {
      _dvShowError(root, "Template utility is not available in this view");
      return;
    }

    const applied = savedTemplatesApply(selected, _dvBuildTemplateContact(contact));
    _applyDraft(applied.subject || "", applied.body || "");
    _dvToast("Template applied", "success");
  }

  function _setGeminiLoadingState(loading) {
    isGeminiGenerating = loading === true;

    if (aiScratchBtn) {
      aiScratchBtn.disabled = isGeminiGenerating;
      aiScratchBtn.textContent = isGeminiGenerating
        ? "Generating..."
        : "Draft from Scratch";
    }

    if (aiGoalGenerateBtn) {
      aiGoalGenerateBtn.disabled = isGeminiGenerating;
      aiGoalGenerateBtn.textContent = isGeminiGenerating
        ? "Generating..."
        : "Generate";
    }
  }

  function _setAiScratchVisibility(visible) {
    const show = visible === true;
    aiScratchBtn?.classList.toggle("dv-ai-scratch-btn--visible", show);
    aiActionsWrap?.classList.toggle("dv-ai-actions--two", show);

    if (!show) {
      aiGoalWrap?.classList.remove("dv-ai-goal--visible");
    }
  }

  async function _generateGeminiDraft(goalValue) {
    const goal = String(goalValue || "").trim();
    if (!goal) {
      _dvToast("Please enter a goal", "info");
      return;
    }

    _setGeminiLoadingState(true);
    try {
      const response = await _dvSendRuntimeMessage({
        type: "GENERATE_AI_DRAFT_GEMINI",
        contactData: _dvBuildTemplateContact(contact),
        useGemini: true,
        goal,
      });

      if (!response?.success) {
        if (response?.quotaExceeded) {
          _dvShowError(root, "AI quota exceeded. Upgrade your plan to continue.");
          _dvToast("AI quota exceeded", "error");
          return;
        }

        throw new Error(String(response?.error || "Gemini draft generation failed"));
      }

      _applyDraft(String(response.subject || ""), String(response.body || ""));
      _dvToast("Gemini draft generated", "success");
      if (typeof trackEvent === "function") {
        trackEvent("draft_generated", { source: "gemini" });
      }
    } catch (error) {
      _dvShowError(root, error?.message || "Gemini draft generation failed");
      _dvToast("Gemini draft generation failed.", "error");
    } finally {
      _setGeminiLoadingState(false);
    }
  }

  // ── 1. Contact card ───────────────────────────────────────────────────────
  if (contactCardSlot && typeof initContactCardListeners === "function") {
    initContactCardListeners(contactCardSlot, (email) => {
      _dvToast(`Copied ${email}`, "success");
    });
  }

  // ── 2. Email type selector ────────────────────────────────────────────────
  let typeSelectorCleanup = null;

  if (typeSelectorSlot && typeof initEmailTypeSelectorListeners === "function") {
    typeSelectorCleanup = initEmailTypeSelectorListeners(
      typeSelectorSlot,
      handleTypeChange,
      contact
    );
  }

  /** Called whenever the user picks a different email type. */
  function handleTypeChange({ value, draft, label }) {
    _setAiDisclosureVisible(value === "ai_generated");
    _setAiScratchVisibility(value === "ai_generated");

    // Analytics: track the selected email type
    if (typeof trackEvent === "function") {
      trackEvent("email_type_selected", { type: value });
    }

    // For non-AI templates the selector prebuilds a draft and passes it in detail.draft.
    if (value !== "ai_generated" && draft) {
      _applyDraft(draft.subject, draft.body ?? draft.message ?? "");
      _dvToast(`Template changed to "${label}"`, "info");
      return;
    }

    if (value === "ai_generated") {
      void personaUseCasePromise.then((useCase) => {
        if (aiGoalInput && !String(aiGoalInput.value || "").trim()) {
          aiGoalInput.value = _dvDefaultGoalForUseCase(useCase);
        }
      });
      _dvToast("AI mode selected. Use Generate or Draft from Scratch.", "info");
      return;
    }

    // Fallback for non-AI templates if prebuild was unavailable.
    void _generateAndApply(value);
  }

  function _setAiDisclosureVisible(visible) {
    aiDisclosure?.classList.toggle("dv-ai-disclosure--visible", visible === true);
  }

  const initialTypeValue =
    (typeof getEmailTypeSelectorValue === "function" &&
      getEmailTypeSelectorValue(typeSelectorSlot)) ??
    "referral_request";
  _setAiDisclosureVisible(initialTypeValue === "ai_generated");
  _setAiScratchVisibility(initialTypeValue === "ai_generated");

  if (templateToggle) {
    templateToggle.addEventListener("click", () => {
      void _toggleTemplateSection();
    });
  }

  templateSearch?.addEventListener("input", () => {
    _filterTemplates(templateSearch.value);
  });

  templateApplyBtn?.addEventListener("click", () => {
    _applySelectedSavedTemplate();
  });

  templateManageBtn?.addEventListener("click", () => {
    _dvOpenWebappPath(_DV_TEMPLATES_MANAGE_PATH);
  });

  templateEmptyLink?.addEventListener("click", () => {
    _dvOpenWebappPath(_DV_TEMPLATES_MANAGE_PATH);
  });

  aiScratchBtn?.addEventListener("click", () => {
    if (isGeminiGenerating) return;

    const goalVisible = aiGoalWrap?.classList.contains("dv-ai-goal--visible");
    if (!goalVisible) {
      void personaUseCasePromise.then((useCase) => {
        if (aiGoalInput) {
          aiGoalInput.value = aiGoalInput.value || _dvDefaultGoalForUseCase(useCase);
          aiGoalInput.focus();
          aiGoalInput.select();
        }
      });
      aiGoalWrap?.classList.add("dv-ai-goal--visible");
      return;
    }

    void _generateGeminiDraft(aiGoalInput?.value || "");
  });

  aiGoalGenerateBtn?.addEventListener("click", () => {
    if (isGeminiGenerating) return;
    void _generateGeminiDraft(aiGoalInput?.value || "");
  });

  aiGoalInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (isGeminiGenerating) return;
    void _generateGeminiDraft(aiGoalInput.value || "");
  });

  // ── 3. Generate draft button ──────────────────────────────────────────────
  let gdbHandle = null;

  if (generateBtnSlot && typeof initGenerateDraftButtonListeners === "function") {
    gdbHandle = initGenerateDraftButtonListeners(generateBtnSlot, handleGenerateRequest);
  }

  /** Called when the user explicitly clicks ⚡ Generate Draft. */
  function handleGenerateRequest(setState) {
    // Read currently selected type
    const typeValue =
      (typeof getEmailTypeSelectorValue === "function" &&
        getEmailTypeSelectorValue(typeSelectorSlot)) ??
      "referral_request";

    // Small pause so the loading spinner has time to render
    setTimeout(async () => {
      const ok = await _generateAndApply(typeValue);
      setState(ok ? "success" : "idle");
    }, 380);
  }

  // ── 4. Draft editor ───────────────────────────────────────────────────────
  let editorHandle = null;

  if (editorSlot && typeof initDraftEditorListeners === "function") {
    editorHandle = initDraftEditorListeners(editorSlot, {
      storageKey,
      onUpdate: handleDraftUpdate,
    });
  }

  /** Fires whenever the user types in subject or message (debounced by the editor). */
  function handleDraftUpdate({ subject, message }) {
    // Analytics: each debounced save event counts as one edit interaction
    if (typeof trackEvent === "function") {
      trackEvent("draft_edited");
    }

    // Keep Gmail button URL in sync with the latest editor content
    if (gmailHandle) {
      gmailHandle.updateContent(contact?.email ?? "", subject, message);
    }
  }

  // ── 5. Gmail action button ────────────────────────────────────────────────
  let gmailHandle = null;

  if (gmailBtnSlot && typeof initGmailButtonListeners === "function") {
    gmailHandle = initGmailButtonListeners(gmailBtnSlot, {
      email: contact?.email ?? "",
      onSent: handleSent,
    });
  }

  /** Called after the Gmail tab is opened. */
  function handleSent({ email, subject, sentAt }) {
    // Analytics: gmail was opened and email is considered sent
    if (typeof trackEvent === "function") {
      trackEvent("gmail_opened");
      trackEvent("draft_sent");
    }

    // Show the green "sent" badge inside the editor section
    sentBadge?.classList.add("dv-sent-badge--visible");

    // Dispatch upward so the parent (e.g. sidepanel) can react
    root.dispatchEvent(
      new CustomEvent("dv-sent", { bubbles: true, detail: { email, subject, sentAt } })
    );
  }

  // ── 6. Header buttons ─────────────────────────────────────────────────────
  root.querySelector(".dv-back-btn")?.addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("dv-back-clicked", { bubbles: true }));
  });

  root.querySelector(".dv-settings-btn")?.addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("dv-settings-clicked", { bubbles: true }));
  });

  root.querySelector(".dv-profile-btn")?.addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("dv-profile-clicked", { bubbles: true }));
  });

  // ── 7. draft-updated from editor (event delegation fallback) ─────────────
  // The draft editor dispatches "draft-updated" on its root which bubbles here.
  root.addEventListener("draft-updated", (e) => {
    if (gmailHandle) {
      const { subject, message } = e.detail;
      gmailHandle.updateContent(contact?.email ?? "", subject, message);
    }
  });

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Generates a draft for the given type and pushes it into the editor + gmail button.
   * Returns true on success, false on failure.
   *
   * @param {string} typeValue
   * @returns {Promise<boolean>}
   */
  async function _generateAndApply(typeValue) {
    try {
      let draft = null;

      if (typeValue === "ai_generated") {
        if (typeof generateAIDraft !== "function") {
          throw new Error("generateAIDraft is not available.");
        }
        draft = await generateAIDraft(contact);
      } else {
        if (typeof generateDraft !== "function") {
          throw new Error("generateDraft is not available.");
        }
        draft = generateDraft(contact, typeValue);
      }

      if (!draft || typeof draft.subject !== "string") {
        throw new Error("Draft payload is invalid.");
      }

      _applyDraft(draft.subject, draft.body ?? draft.message ?? "");

      // Analytics: track whether this was an AI or template generation
      if (typeof trackEvent === "function") {
        const source = typeValue === "ai_generated" ? "ai" : "template";
        trackEvent("draft_generated", { source });
      }

      return true;
    } catch (err) {
      console.error("[DraftView] draft generation failed:", err);
      if (typeValue === "ai_generated") {
        _dvShowError(root, "AI draft generation failed. Please try again.");
        _dvToast("AI draft generation failed.", "error");
      } else {
        _dvShowError(root, "Could not generate draft. Please try again.");
        _dvToast("Draft generation failed.", "error");
      }
      return false;
    }
  }

  /**
   * Pushes subject + body into the editor, updates the Gmail button,
   * persists to storage, and reveals the editor section.
   *
   * @param {string} subject
   * @param {string} body
   */
  function _dvGetSubject() {
    if (editorHandle && typeof editorHandle.getValue === "function") {
      return String(editorHandle.getValue()?.subject ?? "");
    }
    return "";
  }

  function _dvGetMessage() {
    if (editorHandle && typeof editorHandle.getValue === "function") {
      return String(editorHandle.getValue()?.message ?? "");
    }
    return "";
  }

  function _dvSetSubject(subject) {
    const currentMessage = _dvGetMessage();
    if (editorHandle && typeof editorHandle.setValue === "function") {
      editorHandle.setValue({
        subject: String(subject ?? ""),
        message: currentMessage,
      });
    }
  }

  function _dvSetMessage(message) {
    const currentSubject = _dvGetSubject();
    if (editorHandle && typeof editorHandle.setValue === "function") {
      editorHandle.setValue({
        subject: currentSubject,
        message: String(message ?? ""),
      });
    }
  }

  function _applyDraft(subject, body) {
    const message = body ?? "";

    _dvSetSubject(subject);
    _dvSetMessage(message);

    // Sync Gmail button
    if (gmailHandle) {
      gmailHandle.updateContent(contact?.email ?? "", _dvGetSubject(), _dvGetMessage());
    }

    // Persist so it survives a panel close
    _dvStorageSet(storageKey, { subject: _dvGetSubject(), message: _dvGetMessage() });

    // Reveal the editor section (idempotent after first call)
    showEditor();

    // Hide the sent badge when a new draft is applied
    sentBadge?.classList.remove("dv-sent-badge--visible");
  }

  // ── 8. Restore persisted draft ────────────────────────────────────────────
  // Load after all listeners are wired so setValue triggers correct updates.
  const saved = await _dvStorageGet(storageKey);

  if (saved && (saved.subject || saved.message)) {
    _applyDraft(saved.subject ?? "", saved.message ?? "");
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  function destroy() {
    if (typeof typeSelectorCleanup === "function") typeSelectorCleanup();
    gdbHandle?.destroy();
    editorHandle?.destroy();
    gmailHandle?.destroy();
  }

  return { destroy };
}
