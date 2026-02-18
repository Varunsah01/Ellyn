/**
 * draft-editor.js
 * Inline email draft editor — subject input + auto-resizing message textarea.
 *
 * Load order: no dependencies — can be loaded standalone.
 *
 * Public API:
 *   renderDraftEditor(draft?)                → HTML string
 *   initDraftEditorListeners(container, options?)
 *                                            → { getValue(), setValue(draft), destroy() }
 *   getDraftEditorValue(container)           → { subject, message }
 *
 * Custom event dispatched on the root element (bubbles):
 *   "draft-updated"  detail: { subject, message, wordCount, charCount }
 *
 * @typedef {{ subject?: string, message?: string }} DraftEditorValue
 *
 * @typedef {Object} DraftEditorOptions
 * @property {string}   [storageKey]   chrome.storage.local key (default: "ellyn_draft_editor")
 * @property {function({ subject: string, message: string, wordCount: number, charCount: number }): void} [onUpdate]
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const _DE_SUBJECT_MAX   = 120;  // soft char limit — counter turns red at cap
const _DE_SUBJECT_WARN  = 100;  // counter turns amber here
const _DE_TEXTAREA_ROWS = 5;    // minimum visible rows
const _DE_ROW_HEIGHT_PX = 22;   // approximate line-height in pixels
const _DE_DEBOUNCE_MS   = 500;  // auto-save delay
const _DE_STORAGE_KEY   = "ellyn_draft_editor";

// ── Style injection ───────────────────────────────────────────────────────────

function _ensureDraftEditorStyles() {
  if (document.getElementById("ellyn-de-styles")) return;

  const style = document.createElement("style");
  style.id = "ellyn-de-styles";
  style.textContent = `
    /* ── Root ──────────────────────────────────────────────── */
    .de-root {
      display: grid;
      gap: 16px;
    }

    /* ── Field groups ───────────────────────────────────────── */
    .de-field {
      display: grid;
      gap: 6px;
    }

    /* ── Label row (label + counter) ────────────────────────── */
    .de-label-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .de-label {
      font-size: 13px;
      font-weight: 500;
      /* slate-700 */
      color: #334155;
    }

    .de-counter {
      font-size: 11px;
      font-weight: 500;
      /* slate-400 */
      color: #94a3b8;
      transition: color 0.15s ease;
      font-variant-numeric: tabular-nums;
    }

    .de-counter[data-level="warn"] {
      /* amber-600 */
      color: #d97706;
    }

    .de-counter[data-level="over"] {
      /* rose-600 */
      color: #e11d48;
    }

    /* ── Shared input/textarea style — mirrors ui-input from sidepanel.html ── */
    .de-input {
      width: 100%;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;   /* slate-200 */
      border-radius: 10px;
      padding: 10px 12px;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.55;
      color: #0f172a;                /* slate-900 */
      box-sizing: border-box;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
      outline: none;
    }

    .de-input::placeholder {
      color: #94a3b8;                /* slate-400 */
    }

    /* Focus ring matches focus:border-blue-500 focus:ring-2 focus:ring-blue-100 */
    .de-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px #dbeafe;
    }

    /* Over-limit highlight on subject */
    .de-input--overlimit {
      border-color: #fda4af;
      box-shadow: 0 0 0 3px #ffe4e6;
    }

    .de-input--overlimit:focus {
      border-color: #e11d48;
      box-shadow: 0 0 0 3px #fecdd3;
    }

    /* ── Subject (single line) ──────────────────────────────── */
    .de-subject {
      height: 42px;
    }

    /* ── Textarea ───────────────────────────────────────────── */
    .de-message {
      resize: none;       /* JS handles sizing */
      overflow: hidden;   /* hide scrollbar during resize */
      display: block;
    }

    /* ── Footer stats row ───────────────────────────────────── */
    .de-stats {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #94a3b8;    /* slate-400 */
      padding: 0 2px;
      user-select: none;
    }

    .de-stats-sep {
      color: #cbd5e1;    /* slate-300 */
    }

    /* Unsaved indicator */
    .de-unsaved-dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #f59e0b;   /* amber-400 */
      flex-shrink: 0;
      /* Hidden by default — shown when there are unsaved changes */
      opacity: 0;
      transform: scale(0);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .de-unsaved-dot.de-unsaved-dot--visible {
      opacity: 1;
      transform: scale(1);
    }
  `;
  document.head.appendChild(style);
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Counts whitespace-delimited words in a string. Returns 0 for blank input. */
function _wordCount(str) {
  return str.trim() === "" ? 0 : str.trim().split(/\s+/).length;
}

/**
 * Simple debounce — returns a function that delays invoking `fn` until
 * `waitMs` ms after the last call.
 * @template {function} T
 * @param {T} fn
 * @param {number} waitMs
 * @returns {T}
 */
function _debounce(fn, waitMs) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), waitMs);
  };
}

/** Saves a value to chrome.storage.local, silently no-ops if API unavailable. */
function _storageSave(key, value) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [key]: value });
    }
  } catch {
    // Extension API not available (e.g., unit-test environment) — ignore
  }
}

/** Loads a value from chrome.storage.local. Returns null if unavailable. */
function _storageLoad(key) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get([key], (result) => {
          resolve(result?.[key] ?? null);
        });
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
}

// ── HTML rendering ────────────────────────────────────────────────────────────

/**
 * Renders the draft editor and returns an HTML string.
 * Inject with innerHTML, then call initDraftEditorListeners().
 *
 * @param {DraftEditorValue} [draft]
 * @returns {string}
 */
function renderDraftEditor(draft) {
  _ensureDraftEditorStyles();

  const subject = String(draft?.subject ?? "").replace(/"/g, "&quot;");
  const message = draft?.message ?? "";

  // Initial counter values
  const subjectLen    = subject.replace(/&quot;/g, '"').length;
  const counterLevel  = subjectLen >= _DE_SUBJECT_MAX ? "over"
                      : subjectLen >= _DE_SUBJECT_WARN ? "warn"
                      : "normal";
  const counterAttr   = counterLevel !== "normal" ? ` data-level="${counterLevel}"` : "";

  const words = _wordCount(message);
  const chars = message.length;

  return `
<div class="de-root" role="group" aria-label="Email draft editor">

  <!-- Subject ─────────────────────────────────────────── -->
  <div class="de-field">
    <div class="de-label-row">
      <label for="de-subject" class="de-label">Subject</label>
      <span
        id="de-subject-counter"
        class="de-counter"
        ${counterAttr}
        aria-live="polite"
        aria-label="${subjectLen} of ${_DE_SUBJECT_MAX} characters"
      >${subjectLen}/${_DE_SUBJECT_MAX}</span>
    </div>
    <input
      id="de-subject"
      type="text"
      class="de-input de-subject${subjectLen >= _DE_SUBJECT_MAX ? " de-input--overlimit" : ""}"
      placeholder="Enter email subject…"
      value="${subject}"
      maxlength="${_DE_SUBJECT_MAX + 20}"
      aria-describedby="de-subject-counter"
      autocomplete="off"
      spellcheck="true"
    />
  </div>

  <!-- Message ─────────────────────────────────────────── -->
  <div class="de-field">
    <div class="de-label-row">
      <label for="de-message" class="de-label">Message</label>
    </div>
    <textarea
      id="de-message"
      class="de-input de-message"
      placeholder="Write your message here…"
      aria-describedby="de-stats"
      spellcheck="true"
    >${message}</textarea>

    <!-- Stats footer -->
    <div id="de-stats" class="de-stats" aria-live="polite" aria-atomic="true">
      <span class="de-unsaved-dot" aria-hidden="true" title="Unsaved changes"></span>
      <span id="de-word-count">${words}</span>
      <span aria-hidden="true">${words === 1 ? "word" : "words"}</span>
      <span class="de-stats-sep" aria-hidden="true">•</span>
      <span id="de-char-count">${chars}</span>
      <span aria-hidden="true">${chars === 1 ? "character" : "characters"}</span>
    </div>
  </div>

</div>`.trim();
}

// ── Listener wiring ───────────────────────────────────────────────────────────

/**
 * Wires all interactivity for a rendered draft editor.
 * Must be called after injecting renderDraftEditor() HTML into the DOM.
 *
 * Also attempts to restore a previously saved draft from chrome.storage
 * (unless the rendered draft had non-empty content).
 *
 * @param {HTMLElement} container
 * @param {DraftEditorOptions} [options]
 * @returns {{ getValue(): DraftEditorValue, setValue(draft: DraftEditorValue): void, destroy(): void }}
 */
function initDraftEditorListeners(container, options) {
  const storageKey = options?.storageKey ?? _DE_STORAGE_KEY;
  const onUpdate   = options?.onUpdate ?? null;

  const root        = container?.querySelector(".de-root");
  const subjectEl   = container?.querySelector("#de-subject");
  const messageEl   = container?.querySelector("#de-message");
  const counterEl   = container?.querySelector("#de-subject-counter");
  const wordCountEl = container?.querySelector("#de-word-count");
  const charCountEl = container?.querySelector("#de-char-count");
  const statsEl     = container?.querySelector("#de-stats");
  const unsavedDot  = container?.querySelector(".de-unsaved-dot");

  if (!root || !subjectEl || !messageEl) {
    return { getValue: () => ({ subject: "", message: "" }), setValue: () => {}, destroy: () => {} };
  }

  // ── Textarea auto-resize ────────────────────────────────────────────────

  const minHeight = _DE_TEXTAREA_ROWS * _DE_ROW_HEIGHT_PX;

  function autoResize() {
    messageEl.style.height = "auto";
    messageEl.style.height = Math.max(messageEl.scrollHeight, minHeight) + "px";
  }

  // ── Counter update ──────────────────────────────────────────────────────

  function updateSubjectCounter() {
    const len   = subjectEl.value.length;
    const level = len >= _DE_SUBJECT_MAX ? "over"
                : len >= _DE_SUBJECT_WARN ? "warn"
                : "normal";

    if (counterEl) {
      counterEl.textContent = `${len}/${_DE_SUBJECT_MAX}`;
      counterEl.setAttribute("aria-label", `${len} of ${_DE_SUBJECT_MAX} characters`);
      if (level === "normal") {
        delete counterEl.dataset.level;
      } else {
        counterEl.dataset.level = level;
      }
    }

    subjectEl.classList.toggle("de-input--overlimit", len >= _DE_SUBJECT_MAX);
  }

  // ── Word / char count update ────────────────────────────────────────────

  function updateStats() {
    const words = _wordCount(messageEl.value);
    const chars = messageEl.value.length;

    if (wordCountEl) wordCountEl.textContent = String(words);
    if (charCountEl) charCountEl.textContent = String(chars);

    // Update the pluralised labels in-place via nextSibling text nodes
    _updateStatLabel(wordCountEl, words === 1 ? "word" : "words");
    _updateStatLabel(charCountEl, chars === 1 ? "character" : "characters");

    if (statsEl) {
      statsEl.setAttribute(
        "aria-label",
        `${words} ${words === 1 ? "word" : "words"}, ${chars} ${chars === 1 ? "character" : "characters"}`
      );
    }
  }

  // ── Unsaved-changes indicator ───────────────────────────────────────────

  function showUnsaved(visible) {
    unsavedDot?.classList.toggle("de-unsaved-dot--visible", visible);
  }

  // ── Save helpers ────────────────────────────────────────────────────────

  function buildPayload() {
    return {
      subject: subjectEl.value,
      message: messageEl.value,
    };
  }

  function dispatchUpdate() {
    const payload = buildPayload();
    const words   = _wordCount(payload.message);
    const chars   = payload.message.length;
    const detail  = { ...payload, wordCount: words, charCount: chars };

    root.dispatchEvent(new CustomEvent("draft-updated", { bubbles: true, detail }));
    if (typeof onUpdate === "function") onUpdate(detail);
  }

  function saveNow() {
    _storageSave(storageKey, buildPayload());
    showUnsaved(false);
  }

  const debouncedSave = _debounce(saveNow, _DE_DEBOUNCE_MS);

  // ── Input handlers ──────────────────────────────────────────────────────

  function handleSubjectInput() {
    updateSubjectCounter();
    showUnsaved(true);
    dispatchUpdate();
    debouncedSave();
  }

  function handleMessageInput() {
    autoResize();
    updateStats();
    showUnsaved(true);
    dispatchUpdate();
    debouncedSave();
  }

  function handleBlur() {
    saveNow();          // immediate save on any field blur
  }

  subjectEl.addEventListener("input", handleSubjectInput);
  messageEl.addEventListener("input", handleMessageInput);
  subjectEl.addEventListener("blur", handleBlur);
  messageEl.addEventListener("blur", handleBlur);

  // ── Initial setup ───────────────────────────────────────────────────────

  // Size the textarea immediately for pre-filled content
  autoResize();
  updateSubjectCounter();
  updateStats();

  // Restore from storage only if both fields are empty on first render
  const isEmpty = subjectEl.value === "" && messageEl.value === "";
  if (isEmpty) {
    _storageLoad(storageKey).then((saved) => {
      if (!saved) return;
      const restoredSubject = String(saved.subject ?? "");
      const restoredMessage = String(saved.message ?? "");
      // Only restore if the fields are still empty (nothing injected since)
      if (subjectEl.value === "" && messageEl.value === "") {
        subjectEl.value = restoredSubject;
        messageEl.value = restoredMessage;
        autoResize();
        updateSubjectCounter();
        updateStats();
        // Don't mark unsaved — this is a restoration, not a new edit
      }
    });
  }

  // ── Public control handle ───────────────────────────────────────────────

  function getValue() {
    return buildPayload();
  }

  function setValue(draft) {
    if (typeof draft?.subject === "string") subjectEl.value = draft.subject;
    if (typeof draft?.message === "string") messageEl.value = draft.message;
    autoResize();
    updateSubjectCounter();
    updateStats();
    showUnsaved(true);
    dispatchUpdate();
    debouncedSave();
  }

  function destroy() {
    subjectEl.removeEventListener("input", handleSubjectInput);
    messageEl.removeEventListener("input", handleMessageInput);
    subjectEl.removeEventListener("blur", handleBlur);
    messageEl.removeEventListener("blur", handleBlur);
  }

  return { getValue, setValue, destroy };
}

// ── Standalone getter ─────────────────────────────────────────────────────────

/**
 * Returns the current draft value from a mounted editor without needing
 * the handle returned by initDraftEditorListeners.
 *
 * @param {HTMLElement} container
 * @returns {DraftEditorValue}
 */
function getDraftEditorValue(container) {
  return {
    subject: container?.querySelector("#de-subject")?.value ?? "",
    message: container?.querySelector("#de-message")?.value ?? "",
  };
}

// ── Internal DOM helper ───────────────────────────────────────────────────────

/**
 * Updates the text of the `nextSibling` text node of a count `<span>`.
 * The stats footer is:  <span id="de-word-count">N</span> words • ...
 * The sibling `<span>` holds the label ("word" / "words").
 *
 * @param {Element|null} countEl
 * @param {string} label
 */
function _updateStatLabel(countEl, label) {
  if (!countEl) return;
  const sibling = countEl.nextElementSibling;
  if (sibling && sibling.getAttribute("aria-hidden") === "true") {
    sibling.textContent = label;
  }
}
