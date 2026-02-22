/**
 * draft-view.js
 * Combines all draft-related components into a single cohesive interface.
 *
 * Load order — all of the following must be <script>-loaded before this file:
 *   utils/role-detector.js
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

    .dv-brand {
      display: inline-flex;
      align-items: center;
      line-height: 1;
      user-select: none;
    }

    .dv-brand-logo {
      height: 18px;
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
    <span class="dv-brand" aria-label="Ellyn">
      <img
        src="assets/icons/logo.svg"
        alt="Ellyn"
        class="dv-brand-logo"
        onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"
      />
      <span class="dv-brand-fallback">ELLYN</span>
    </span>
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

    <!-- Generate draft button -->
    <div class="dv-generate-btn-slot">
      ${generateBtnHtml}
    </div>

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
  const editorSlot       = root.querySelector(".dv-editor-slot");
  const gmailBtnSlot     = root.querySelector(".dv-gmail-btn-slot");
  const sentBadge        = root.querySelector(".dv-sent-badge");

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
    // Analytics: track the selected email type
    if (typeof trackEvent === "function") {
      trackEvent("email_type_selected", { type: value });
    }

    // The email-type-selector already called generateDraft() and passes
    // the result in detail.draft — use it directly to avoid a second call.
    if (draft) {
      _applyDraft(draft.subject, draft.body ?? draft.message ?? "");
      _dvToast(`Template changed to "${label}"`, "info");
    } else {
      // Fallback: generate ourselves (ai_generated returns a placeholder)
      _generateAndApply(value);
    }
  }

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
    setTimeout(() => {
      const ok = _generateAndApply(typeValue);
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
   * @returns {boolean}
   */
  function _generateAndApply(typeValue) {
    try {
      if (typeof generateDraft !== "function") {
        throw new Error("generateDraft is not available.");
      }
      const draft = generateDraft(contact, typeValue);
      _applyDraft(draft.subject, draft.body ?? draft.message ?? "");

      // Analytics: track whether this was an AI or template generation
      if (typeof trackEvent === "function") {
        const source = typeValue === "ai_generated" ? "ai" : "template";
        trackEvent("draft_generated", { source });
      }

      return true;
    } catch (err) {
      console.error("[DraftView] generateDraft failed:", err);
      _dvShowError(root, "Could not generate draft. Please try again.");
      _dvToast("Draft generation failed.", "error");
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
  function _applyDraft(subject, body) {
    const message = body ?? "";

    // Push content into editor
    if (editorHandle) {
      editorHandle.setValue({ subject, message });
    }

    // Sync Gmail button
    if (gmailHandle) {
      gmailHandle.updateContent(contact?.email ?? "", subject, message);
    }

    // Persist so it survives a panel close
    _dvStorageSet(storageKey, { subject, message });

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
