/**
 * email-type-selector.js
 * Enhanced dropdown for selecting the outreach email type.
 *
 * Dependencies (must be loaded via <script> before this file):
 *   utils/role-detector.js      → detectContactType(contact)
 *   templates/recruiter-templates.js → generateDraft(contact, templateType)
 *
 * Equivalents of the requested module imports:
 *   import { detectContactType } from '../utils/role-detector.js'
 *   import { generateDraft }     from '../templates/recruiter-templates.js'
 *
 * Public API:
 *   renderEmailTypeSelector(contact)            → HTML string
 *   initEmailTypeSelectorListeners(root, cb?)   → wires events; dispatches "email-type-changed"
 *   getEmailTypeSelectorValue(root)             → currently selected EmailTemplateType
 */

// ── Option definitions ────────────────────────────────────────────────────────

/**
 * @typedef {"referral_request" | "to_recruiter" | "seeking_advice" | "ai_generated"} EmailTemplateType
 *
 * @typedef {Object} EmailTypeOption
 * @property {EmailTemplateType} value
 * @property {string}            label
 * @property {string}            description   Short helper text shown in the menu
 * @property {boolean}           isPro         Requires Pro plan
 */

/** @type {EmailTypeOption[]} */
const EMAIL_TYPE_OPTIONS = [
  {
    value: "referral_request",
    label: "Referral Request",
    description: "Ask someone to refer you internally",
    isPro: false,
  },
  {
    value: "to_recruiter",
    label: "To Recruiter",
    description: "Reach out about open positions",
    isPro: false,
  },
  {
    value: "seeking_advice",
    label: "Seeking Advice",
    description: "Request an informational chat",
    isPro: false,
  },
  {
    value: "ai_generated",
    label: "AI Generated",
    description: "Personalised draft via AI",
    isPro: true,
  },
];

/**
 * Which template type is recommended for each detected contact role.
 * @type {Record<import('../utils/role-detector.js').ContactType, EmailTemplateType>}
 */
const RECOMMENDED_BY_ROLE = {
  recruiter:       "to_recruiter",
  hiring_manager:  "referral_request",
  executive:       "seeking_advice",
  general:         "referral_request",
};

// ── Style injection ───────────────────────────────────────────────────────────

function _ensureEmailTypeSelectorStyles() {
  if (document.getElementById("ellyn-ets-styles")) return;
  const style = document.createElement("style");
  style.id = "ellyn-ets-styles";
  style.textContent = `
    /* Wrapper */
    .ets-root {
      position: relative;
    }

    /* Trigger button */
    .ets-toggle {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      color: #0f172a;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      user-select: none;
    }

    .ets-toggle:hover {
      border-color: #94a3b8;
    }

    .ets-toggle[aria-expanded="true"] {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
    }

    .ets-toggle:focus-visible {
      outline: 2px solid #667eea;
      outline-offset: 2px;
    }

    /* Left side of trigger: label + star */
    .ets-toggle-left {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }

    .ets-toggle-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ets-recommended-star {
      font-size: 11px;
      line-height: 1;
      flex-shrink: 0;
    }

    /* Chevron */
    .ets-chevron {
      flex-shrink: 0;
      width: 15px;
      height: 15px;
      color: #94a3b8;
      transition: transform 0.2s ease;
    }

    .ets-toggle[aria-expanded="true"] .ets-chevron {
      transform: rotate(180deg);
    }

    /* Dropdown menu */
    .ets-menu {
      position: absolute;
      z-index: 30;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.10);
      /* Animation start state */
      opacity: 0;
      transform: translateY(-6px);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }

    .ets-menu.ets-menu--open {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    /* Individual option */
    .ets-option {
      display: flex;
      width: 100%;
      align-items: flex-start;
      gap: 10px;
      padding: 9px 10px;
      border: none;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.12s ease;
    }

    .ets-option:hover,
    .ets-option:focus-visible {
      background: #f8fafc;
      outline: none;
    }

    .ets-option[aria-selected="true"] {
      background: #eef2ff;
    }

    .ets-option[aria-selected="true"] .ets-option-label {
      color: #4338ca;
    }

    .ets-option-body {
      flex: 1;
      min-width: 0;
    }

    .ets-option-header {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .ets-option-label {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
    }

    .ets-option-star {
      font-size: 11px;
      line-height: 1;
    }

    .ets-option-pro {
      flex-shrink: 0;
      padding: 1px 5px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .ets-option-desc {
      margin-top: 1px;
      font-size: 11px;
      color: #64748b;
    }
  `;
  document.head.appendChild(style);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Determines the recommended template for a given contact.
 *
 * @param {{ role?: string } | null | undefined} contact
 * @returns {EmailTemplateType}
 */
function _recommendedTemplate(contact) {
  const contactType =
    typeof detectContactType === "function"
      ? detectContactType(contact)
      : "general";
  return RECOMMENDED_BY_ROLE[contactType] ?? "referral_request";
}

/**
 * Renders an email-type option row as an HTML string.
 *
 * @param {EmailTypeOption} option
 * @param {boolean} isSelected
 * @param {boolean} isRecommended
 * @returns {string}
 */
function _renderOption(option, isSelected, isRecommended) {
  const selectedAttr = isSelected ? 'aria-selected="true"' : 'aria-selected="false"';
  const starHtml = isRecommended
    ? '<span class="ets-option-star" title="Recommended for this contact">⭐</span>'
    : "";
  const proHtml = option.isPro
    ? '<span class="ets-option-pro">Pro</span>'
    : "";

  return `
<button
  type="button"
  role="option"
  class="ets-option"
  data-value="${option.value}"
  ${selectedAttr}
>
  <div class="ets-option-body">
    <div class="ets-option-header">
      <span class="ets-option-label">${option.label}</span>
      ${starHtml}
      ${proHtml}
    </div>
    <p class="ets-option-desc">${option.description}</p>
  </div>
</button>`.trim();
}

/**
 * Renders the email type selector and returns an HTML string.
 * Inject this with innerHTML, then call initEmailTypeSelectorListeners().
 *
 * Fires "email-type-changed" CustomEvent on the root element when selection changes.
 *
 * @param {{ name?: string, company?: string, role?: string, email?: string } | null} contact
 * @param {EmailTemplateType} [initialValue]  Override the default selection
 * @returns {string}
 */
function renderEmailTypeSelector(contact, initialValue) {
  _ensureEmailTypeSelectorStyles();

  const recommended = _recommendedTemplate(contact);
  const selected = initialValue ?? recommended;
  const selectedOption =
    EMAIL_TYPE_OPTIONS.find((o) => o.value === selected) ?? EMAIL_TYPE_OPTIONS[0];
  const isSelectedRecommended = selectedOption.value === recommended;

  const triggerStarHtml = isSelectedRecommended
    ? '<span class="ets-recommended-star" title="Recommended for this contact">⭐</span>'
    : "";

  const optionsHtml = EMAIL_TYPE_OPTIONS.map((opt) =>
    _renderOption(opt, opt.value === selected, opt.value === recommended)
  ).join("\n");

  return `
<div
  class="ets-root"
  data-selected="${selected}"
  data-recommended="${recommended}"
  aria-label="Email type selector"
>
  <button
    type="button"
    class="ets-toggle"
    aria-haspopup="listbox"
    aria-expanded="false"
    aria-controls="ets-menu"
    title="Select email type"
  >
    <span class="ets-toggle-left">
      <span class="ets-toggle-label">${selectedOption.label}</span>
      ${triggerStarHtml}
    </span>
    <svg class="ets-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.6"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <div
    id="ets-menu"
    class="ets-menu"
    role="listbox"
    aria-label="Email type options"
  >
    ${optionsHtml}
  </div>
</div>`.trim();
}

// ── Event wiring ──────────────────────────────────────────────────────────────

/**
 * Wires up all interactivity for a rendered email-type selector.
 * Must be called after injecting renderEmailTypeSelector() HTML into the DOM.
 *
 * Dispatches a "email-type-changed" CustomEvent on the root element:
 *   event.detail = { value: EmailTemplateType, label: string,
 *                    isRecommended: boolean, draft?: DraftResult }
 *
 * @param {HTMLElement} container  The element that received the innerHTML
 * @param {function({value: EmailTemplateType, label: string, isRecommended: boolean, draft?: object}): void} [onChange]
 *   Optional callback fired alongside the custom event
 * @param {{ name?: string, company?: string, role?: string, email?: string } | null} [contact]
 *   Passing the contact allows draft pre-generation on selection
 */
function initEmailTypeSelectorListeners(container, onChange, contact) {
  const root = container?.querySelector(".ets-root");
  if (!root) return;

  const toggle = root.querySelector(".ets-toggle");
  const menu   = root.querySelector(".ets-menu");
  if (!toggle || !menu) return;

  // ── Open / close helpers ────────────────────────────────────────────────

  function openMenu() {
    menu.classList.add("ets-menu--open");
    toggle.setAttribute("aria-expanded", "true");
    // Focus first selected option or first option
    const focused =
      menu.querySelector('[aria-selected="true"]') ??
      menu.querySelector(".ets-option");
    focused?.focus();
  }

  function closeMenu() {
    menu.classList.remove("ets-menu--open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  function isOpen() {
    return menu.classList.contains("ets-menu--open");
  }

  // ── Selection ───────────────────────────────────────────────────────────

  function selectOption(value) {
    const option = EMAIL_TYPE_OPTIONS.find((o) => o.value === value);
    if (!option) return;

    const recommended = root.dataset.recommended ?? "referral_request";
    const isRecommended = value === recommended;

    // Update root data attribute
    root.dataset.selected = value;

    // Update trigger label + star
    const labelEl = toggle.querySelector(".ets-toggle-label");
    const starEl  = toggle.querySelector(".ets-recommended-star");
    if (labelEl) labelEl.textContent = option.label;
    if (starEl) {
      starEl.style.display = isRecommended ? "" : "none";
    }

    // Update aria-selected on options
    menu.querySelectorAll(".ets-option").forEach((btn) => {
      btn.setAttribute(
        "aria-selected",
        btn.dataset.value === value ? "true" : "false"
      );
    });

    // Build draft if templates helper is available
    const draft =
      contact && typeof generateDraft === "function"
        ? generateDraft(contact, /** @type {EmailTemplateType} */ (value))
        : undefined;

    const detail = { value, label: option.label, isRecommended, draft };

    // Dispatch custom event
    root.dispatchEvent(new CustomEvent("email-type-changed", { bubbles: true, detail }));

    // Call optional callback
    if (typeof onChange === "function") onChange(detail);

    closeMenu();
  }

  // ── Toggle click ────────────────────────────────────────────────────────

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    isOpen() ? closeMenu() : openMenu();
  });

  // ── Option click ────────────────────────────────────────────────────────

  menu.addEventListener("click", (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest(".ets-option");
    if (!btn) return;
    selectOption(btn.dataset.value ?? "referral_request");
  });

  // ── Keyboard navigation ─────────────────────────────────────────────────

  menu.addEventListener("keydown", (e) => {
    const options = Array.from(menu.querySelectorAll(".ets-option"));
    const focused = document.activeElement;
    const idx = options.indexOf(/** @type {HTMLElement} */ (focused));

    if (e.key === "ArrowDown") {
      e.preventDefault();
      options[(idx + 1) % options.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      options[(idx - 1 + options.length) % options.length]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const btn = /** @type {HTMLElement} */ (focused);
      if (btn?.dataset.value) selectOption(btn.dataset.value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeMenu();
    }
  });

  toggle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen()) openMenu();
    } else if (e.key === "Escape") {
      closeMenu();
    }
  });

  // ── Close on outside click ──────────────────────────────────────────────

  function handleOutsideClick(e) {
    if (!root.contains(/** @type {Node} */ (e.target))) {
      closeMenu();
    }
  }

  document.addEventListener("click", handleOutsideClick);

  // ── Close on scroll (matches existing sidepanel behaviour) ──────────────

  document.querySelector("main")?.addEventListener(
    "scroll",
    () => { if (isOpen()) closeMenu(); },
    { passive: true }
  );

  // Return cleanup in case the component is unmounted
  return function destroy() {
    document.removeEventListener("click", handleOutsideClick);
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Returns the currently selected EmailTemplateType from a mounted selector.
 *
 * @param {HTMLElement} container
 * @returns {EmailTemplateType | null}
 */
function getEmailTypeSelectorValue(container) {
  const root = container?.querySelector(".ets-root");
  return /** @type {EmailTemplateType | null} */ (root?.dataset.selected ?? null);
}
