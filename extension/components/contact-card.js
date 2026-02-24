/**
 * contact-card.js
 * Renders a contact information card as an HTML string.
 *
 * Usage:
 *   const html = renderContactCard({ name, company, email, role });
 *   container.innerHTML = html;
 *   initContactCardListeners(container);
 */

/**
 * Escapes a string for safe insertion into HTML.
 * @param {string} str
 * @returns {string}
 */
function _escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Derives up to two initials from a full name.
 * @param {string} name
 * @returns {string}
 */
function _initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return (first + second).toUpperCase() || "?";
}

/**
 * Injects the contact-card keyframe animation once per document.
 */
function _ensureStyles() {
  if (document.getElementById("ellyn-contact-card-styles")) return;
  const style = document.createElement("style");
  style.id = "ellyn-contact-card-styles";
  style.textContent = `
    @keyframes contactCardFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    .contact-card-root {
      animation: contactCardFadeIn 0.22s ease both;
    }
    .cc-identity {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }
    .cc-avatar {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .cc-avatar-initials {
      width: 100%;
      height: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: #4f46e5;
      user-select: none;
      text-transform: uppercase;
    }
    .cc-name-block {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 1px;
    }
    .cc-name {
      margin: 0;
      font-size: 17px;
      line-height: 1.2;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: none;
    }
    .cc-subtitle {
      margin: 0;
      font-size: 13px;
      line-height: 1.25;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: none;
    }
    .contact-card-copy-btn:active {
      transform: scale(0.93);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Renders a contact card and returns an HTML string.
 *
 * @param {{ name: string, company: string, email: string, role: string }} contact
 * @returns {string} HTML string — inject with innerHTML, then call initContactCardListeners()
 */
function renderContactCard(contact) {
  _ensureStyles();

  const name    = _escHtml(contact?.name)    || "Unknown";
  const company = _escHtml(contact?.company) || "";
  const email   = _escHtml(contact?.email)   || "";
  const role    = _escHtml(contact?.role)    || "";
  const ini     = _initials(contact?.name);

  return `
<article
  class="contact-card-root rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
  aria-label="Contact card for ${name}"
>
  <!-- Avatar + name row -->
  <div class="cc-identity">
    <div aria-hidden="true" class="cc-avatar" title="${name}">
      <span class="cc-avatar-initials">${ini}</span>
    </div>
    <div class="cc-name-block">
      <p class="cc-name" title="${name}">${name}</p>
      ${role ? `<p class="cc-subtitle" title="${role}">${role}</p>` : ""}
    </div>
  </div>

  <!-- Company row -->
  ${company ? `
  <div class="mb-3 flex items-center gap-2 text-sm text-slate-600">
    <span aria-hidden="true" class="text-base leading-none">🏢</span>
    <span class="truncate font-medium">${company}</span>
  </div>
  ` : ""}

  <!-- Email row with copy button -->
  ${email ? `
  <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <span aria-hidden="true" class="flex-shrink-0 text-slate-400">
      <!-- envelope icon -->
      <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4" aria-hidden="true">
        <path d="m3 8 9 6 9-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </span>
    <span
      class="flex-1 truncate text-xs font-medium text-slate-700"
      title="${email}"
    >${email}</span>
    <button
      type="button"
      class="contact-card-copy-btn flex-shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
      aria-label="Copy email address"
      data-copy="${email}"
      title="Copy to clipboard"
    >
      <!-- clipboard icon -->
      <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5" aria-hidden="true">
        <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>
  </div>
  ` : ""}
</article>
`.trim();
}

/**
 * Wires up copy-to-clipboard behaviour for buttons rendered by renderContactCard().
 * Call this once after injecting the HTML string into the DOM.
 *
 * @param {HTMLElement} container  The element that received innerHTML from renderContactCard()
 * @param {function(string):void} [onCopied]  Optional callback — receives the copied text
 */
function initContactCardListeners(container, onCopied) {
  if (!container) return;

  container.querySelectorAll(".contact-card-copy-btn[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.dataset.copy;
      if (!text) return;

      navigator.clipboard.writeText(text).then(() => {
        // Brief visual feedback — swap icon for a checkmark
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5 text-emerald-500" aria-hidden="true">
            <path d="M5 12.5 9 16l10-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
        btn.setAttribute("aria-label", "Copied!");
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.setAttribute("aria-label", "Copy email address");
        }, 1800);

        if (typeof onCopied === "function") onCopied(text);
      }).catch(() => {
        // Fallback for environments where clipboard API is unavailable
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        if (typeof onCopied === "function") onCopied(text);
      });
    });
  });
}
