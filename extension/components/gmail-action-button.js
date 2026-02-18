/**
 * gmail-action-button.js
 * Opens Gmail compose with pre-filled recipient, subject, and body.
 *
 * Load order: no dependencies — can be loaded standalone.
 * Bridges to the global `showToast` from sidepanel.js when available;
 * uses a self-contained fallback otherwise.
 *
 * Public API:
 *   renderGmailButton(email, subject, message)  → HTML string
 *   initGmailButtonListeners(container, options?)
 *       options: { email?, subject?, message?, onSent?, storageKey? }
 *       → { updateContent(email, subject, message), destroy() }
 *
 * Chrome storage written on click:
 *   "ellyn_sent_actions"     — append { email, subject, sentAt }
 *   "saved_contact_results"  — patch matching entry's status to "sent"
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const _GAB_SENT_ACTIONS_KEY  = "ellyn_sent_actions";
const _GAB_CONTACTS_KEY      = "saved_contact_results";
const _GAB_SENT_LABEL_MS     = 2200;   // how long "✓ Sent!" label shows

// ── Style injection ───────────────────────────────────────────────────────────

function _ensureGabStyles() {
  if (document.getElementById("ellyn-gab-styles")) return;

  const style = document.createElement("style");
  style.id = "ellyn-gab-styles";
  style.textContent = `
    /* ── Button shell ────────────────────────────────────────── */
    .gab-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      min-height: 44px;
      padding: 12px 24px;
      border: none;
      border-radius: 10px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      cursor: pointer;
      overflow: hidden;
      /* Prominent blue gradient — distinct from the purple gdb-btn */
      background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.30);
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.25s ease;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    /* Hover lift */
    .gab-btn:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.40);
    }

    /* Press feedback */
    .gab-btn:not(:disabled):active {
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(37, 99, 235, 0.25);
    }

    .gab-btn:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 3px;
    }

    .gab-btn:disabled {
      cursor: not-allowed;
      opacity: 0.65;
      transform: none;
      box-shadow: none;
    }

    /* "✓ Sent!" flash — brief green confirmation */
    .gab-btn[data-state="sent"] {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.30);
    }

    /* ── Ripple ──────────────────────────────────────────────── */
    .gab-ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.28);
      transform: scale(0);
      animation: gabRippleAnim 0.55s ease-out forwards;
      pointer-events: none;
    }

    @keyframes gabRippleAnim {
      to { transform: scale(4); opacity: 0; }
    }

    /* ── Fallback toast container (used when sidepanel's is absent) ── */
    .gab-toast-container {
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 24px);
      max-width: 360px;
      z-index: 9999;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* Reuse the existing .toast class tokens where present;
       the rules below only apply if sidepanel.css hasn't defined them. */
    .gab-toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
      animation: gabToastIn 0.22s ease both;
    }

    .gab-toast--success { background: #0f766e; }
    .gab-toast--error   { background: #b91c1c; }
    .gab-toast--info    { background: #334155; }

    @keyframes gabToastIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
  `;
  document.head.appendChild(style);
}

// ── Gmail URL builder ─────────────────────────────────────────────────────────

/**
 * Builds a Gmail compose URL with pre-filled fields.
 * Body line-breaks are encoded as %0A so Gmail renders them correctly.
 *
 * @param {string} email
 * @param {string} subject
 * @param {string} message
 * @returns {string}
 */
function _buildGmailUrl(email, subject, message) {
  // Gmail needs \n encoded as %0A, not %0D%0A, for reliable line-breaks
  const encodedBody = encodeURIComponent(message).replace(/%0D%0A/g, "%0A").replace(/%0D/g, "%0A");
  const params = [
    "view=cm",
    "fs=1",
    `to=${encodeURIComponent(email)}`,
    `su=${encodeURIComponent(subject)}`,
    `body=${encodedBody}`,
  ].join("&");

  return `https://mail.google.com/mail/?${params}`;
}

// ── Chrome storage helpers ────────────────────────────────────────────────────

function _gabStorageGet(key) {
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

function _gabStorageSet(payload) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set(payload);
    }
  } catch { /* extension API unavailable */ }
}

/**
 * Records the send action and patches the contact's status to "sent".
 * Both writes are fire-and-forget — never block the tab open.
 *
 * @param {string} email
 * @param {string} subject
 */
async function _recordSentAction(email, subject) {
  const sentAt = new Date().toISOString();

  // 1. Append to sent-actions log
  const existing = await _gabStorageGet(_GAB_SENT_ACTIONS_KEY);
  const log = Array.isArray(existing) ? existing : [];
  log.unshift({ email, subject, sentAt });
  _gabStorageSet({ [_GAB_SENT_ACTIONS_KEY]: log.slice(0, 500) });

  // 2. Patch matching contact entry to status="sent"
  const contactsRaw = await _gabStorageGet(_GAB_CONTACTS_KEY);
  const contacts = Array.isArray(contactsRaw) ? contactsRaw : [];
  let patched = false;
  const updated = contacts.map((c) => {
    if (String(c.email ?? "") === email && c.status !== "sent") {
      patched = true;
      return { ...c, status: "sent", sentAt };
    }
    return c;
  });
  if (patched) {
    _gabStorageSet({ [_GAB_CONTACTS_KEY]: updated });
  }
}

// ── Toast helper ──────────────────────────────────────────────────────────────

/**
 * Shows a toast using the sidepanel's global `showToast` if available,
 * otherwise falls back to a self-contained implementation.
 *
 * @param {string} message
 * @param {"success" | "error" | "info"} tone
 */
function _gabShowToast(message, tone = "info") {
  // Bridge to sidepanel's existing toast system
  if (typeof showToast === "function") {
    showToast(message, tone);
    return;
  }

  // Fallback — find the sidepanel toast container first
  let container =
    document.getElementById("toastContainer") ??
    document.querySelector(".toast-container") ??
    document.querySelector(".gab-toast-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "gab-toast-container";
    document.body.appendChild(container);
  }

  // Build the toast element. Use existing `.toast .{tone}` classes if
  // sidepanel.css is loaded; otherwise use our `.gab-toast--*` classes.
  const toast = document.createElement("div");
  toast.setAttribute("role", "status");

  const hasExistingToastCss =
    document.querySelector('link[href*="sidepanel.css"]') !== null ||
    document.getElementById("ellyn-gab-styles") !== null;   // we injected our own

  if (hasExistingToastCss && document.querySelector(".toast")) {
    // Sidepanel CSS is almost certainly loaded — use its class tokens
    toast.className = `toast ${tone}`;
  } else {
    toast.className = `gab-toast gab-toast--${tone}`;
  }

  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

// ── Ripple helper ─────────────────────────────────────────────────────────────

function _gabSpawnRipple(btn, e) {
  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const x      = e.clientX - rect.left - size / 2;
  const y      = e.clientY - rect.top  - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "gab-ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

// ── HTML rendering ────────────────────────────────────────────────────────────

/**
 * Renders the Gmail action button and returns an HTML string.
 * Inject with innerHTML, then call initGmailButtonListeners().
 *
 * @param {string} email    Recipient email address
 * @param {string} subject  Pre-filled subject line
 * @param {string} message  Pre-filled message body
 * @returns {string}
 */
function renderGmailButton(email, subject, message) {
  _ensureGabStyles();

  // Escape values destined for HTML attributes
  const safeEmail   = String(email   ?? "").replace(/"/g, "&quot;");
  const safeSubject = String(subject ?? "").replace(/"/g, "&quot;");
  // message can be long and contain special chars — store escaped
  const safeMessage = String(message ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const hasEmail = Boolean(email?.trim());

  return `
<button
  type="button"
  class="gab-btn"
  data-state="idle"
  data-email="${safeEmail}"
  data-subject="${safeSubject}"
  data-message="${safeMessage}"
  ${hasEmail ? "" : 'disabled aria-disabled="true"'}
  aria-label="Open email compose in Gmail"
  title="${hasEmail ? "Open Gmail compose window" : "No recipient email — run Find Email first"}"
>
  <span aria-hidden="true">🚀</span>
  <span class="gab-btn-label">Open in Gmail</span>
</button>`.trim();
}

// ── Listener wiring ───────────────────────────────────────────────────────────

/**
 * Wires all interactivity for a rendered Gmail action button.
 * Must be called after injecting renderGmailButton() HTML into the DOM.
 *
 * On click:
 *   1. Opens Gmail compose in a new tab
 *   2. Records the action in chrome.storage (fire-and-forget)
 *   3. Shows a toast notification
 *   4. Briefly shows "✓ Sent!" on the button before reverting
 *
 * @param {HTMLElement} container
 * @param {{
 *   email?:     string,
 *   subject?:   string,
 *   message?:   string,
 *   onSent?:    function({ email: string, subject: string, sentAt: string }): void,
 *   storageKey?: string,
 * }} [options]  Override button data and provide callbacks.
 * @returns {{
 *   updateContent(email: string, subject: string, message: string): void,
 *   destroy(): void,
 * }}
 */
function initGmailButtonListeners(container, options) {
  const btn = _gabFindBtn(container);
  const noop = { updateContent: () => {}, destroy: () => {} };
  if (!btn) return noop;

  // Apply option overrides to data attributes if provided
  if (options?.email   != null) btn.dataset.email   = options.email;
  if (options?.subject != null) btn.dataset.subject = options.subject;
  if (options?.message != null) btn.dataset.message = options.message;

  // ── State helpers ───────────────────────────────────────────────────────

  let sentTimer = null;

  function flashSent() {
    const labelEl = btn.querySelector(".gab-btn-label");

    btn.dataset.state = "sent";
    btn.disabled      = true;
    if (labelEl) labelEl.textContent = "✓ Sent!";
    btn.setAttribute("aria-label", "Email opened in Gmail");

    clearTimeout(sentTimer);
    sentTimer = setTimeout(() => {
      btn.dataset.state = "idle";
      btn.disabled      = Boolean(!btn.dataset.email?.trim());
      if (labelEl) labelEl.textContent = "Open in Gmail";
      btn.setAttribute("aria-label", "Open email compose in Gmail");
    }, _GAB_SENT_LABEL_MS);
  }

  // ── Click handler ───────────────────────────────────────────────────────

  async function handleClick(e) {
    if (btn.disabled || btn.dataset.state === "sent") return;

    const email   = String(btn.dataset.email   ?? "").trim();
    const subject = String(btn.dataset.subject ?? "").trim();
    // message stored HTML-escaped — unescape before building the URL
    const message = _gabUnescapeHtml(btn.dataset.message ?? "");

    if (!email) {
      _gabShowToast("No recipient email. Run Find Email first.", "error");
      return;
    }

    // Ripple feedback
    _gabSpawnRipple(btn, e);

    // Open Gmail compose
    const gmailUrl = _buildGmailUrl(email, subject, message);
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url: gmailUrl });
    } else {
      window.open(gmailUrl, "_blank", "noopener,noreferrer");
    }

    // Toast
    _gabShowToast("Gmail compose opened!", "success");

    // Flash "✓ Sent!" on the button
    flashSent();

    // Storage + callback (fire-and-forget)
    const sentAt = new Date().toISOString();
    void _recordSentAction(email, subject);
    if (typeof options?.onSent === "function") {
      options.onSent({ email, subject, sentAt });
    }
  }

  btn.addEventListener("click", handleClick);

  // ── Public control handle ───────────────────────────────────────────────

  /**
   * Updates the email/subject/message stored on the button.
   * Call this whenever the draft editor content changes.
   *
   * @param {string} email
   * @param {string} subject
   * @param {string} message
   */
  function updateContent(email, subject, message) {
    btn.dataset.email   = String(email   ?? "");
    btn.dataset.subject = String(subject ?? "");
    // HTML-escape before storing in the attribute
    btn.dataset.message = String(message ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");

    const hasEmail = Boolean(email?.trim());
    if (btn.dataset.state !== "sent") {
      btn.disabled = !hasEmail;
      btn.setAttribute("aria-disabled", String(!hasEmail));
      btn.title = hasEmail
        ? "Open Gmail compose window"
        : "No recipient email — run Find Email first";
    }
  }

  function destroy() {
    clearTimeout(sentTimer);
    btn.removeEventListener("click", handleClick);
  }

  return { updateContent, destroy };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** @param {HTMLElement} container */
function _gabFindBtn(container) {
  if (!container) return null;
  if (container.classList?.contains("gab-btn")) return container;
  return container.querySelector(".gab-btn");
}

/**
 * Reverses basic HTML-entity escaping stored in data attributes.
 * Only handles the five entities written by this module.
 * @param {string} str
 * @returns {string}
 */
function _gabUnescapeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&#39;/g,  "'");
}
