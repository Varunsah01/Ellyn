/**
 * generate-draft-button.js
 * Interactive "Generate Draft" button with idle / loading / success states.
 *
 * Load order: no dependencies — can be loaded standalone.
 *
 * Public API:
 *   renderGenerateDraftButton(options?)         → HTML string
 *   initGenerateDraftButtonListeners(container, onRequest?)
 *                                               → { setState(state), destroy() }
 *   setGenerateDraftButtonState(container, state)
 *                                               → standalone state setter
 *
 * Custom event dispatched on the button element:
 *   "draft-generate-requested"  { bubbles: true, detail: { setState } }
 *   The detail.setState callback lets the event handler drive state transitions.
 *
 * @typedef {"idle" | "loading" | "success"} GdbState
 */

// ── Style injection ───────────────────────────────────────────────────────────

function _ensureGdbStyles() {
  if (document.getElementById("ellyn-gdb-styles")) return;

  const style = document.createElement("style");
  style.id = "ellyn-gdb-styles";
  style.textContent = `
    /* ── Button shell ─────────────────────────────────────── */
    .gdb-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
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
      /* Gradient matches .finder-primary-btn in sidepanel.css */
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      /* Pseudo-layer for the hover shimmer — brightened gradient */
      background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    /* Hover lift — mirrors .finder-primary-btn:hover */
    .gdb-btn:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.40);
    }

    .gdb-btn:not(:disabled):active {
      transform: translateY(0);
      box-shadow: none;
    }

    .gdb-btn:focus-visible {
      outline: 2px solid #667eea;
      outline-offset: 3px;
    }

    /* Disabled — matches .finder-primary-btn:disabled */
    .gdb-btn:disabled {
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
      opacity: 0.6;
    }

    /* Success state — green flash */
    .gdb-btn[data-state="success"] {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      transform: none;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.30);
    }

    /* ── Content slots ────────────────────────────────────── */
    .gdb-slot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      /* All slots start hidden; active state reveals one */
      position: absolute;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
      white-space: nowrap;
    }

    .gdb-slot--visible {
      position: relative;
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    /* ── Inline spinner ───────────────────────────────────── */
    .gdb-spinner {
      display: inline-block;
      width: 15px;
      height: 15px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: gdbSpin 0.75s linear infinite;
      flex-shrink: 0;
    }

    @keyframes gdbSpin {
      to { transform: rotate(360deg); }
    }

    /* ── Ripple on click ──────────────────────────────────── */
    .gdb-ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      transform: scale(0);
      animation: gdbRippleAnim 0.55s ease-out forwards;
      pointer-events: none;
    }

    @keyframes gdbRippleAnim {
      to { transform: scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ── HTML rendering ────────────────────────────────────────────────────────────

/**
 * Renders the generate-draft button and returns an HTML string.
 * Inject with innerHTML, then call initGenerateDraftButtonListeners().
 *
 * @param {{ id?: string, label?: string }} [options]
 * @returns {string}
 */
function renderGenerateDraftButton(options) {
  _ensureGdbStyles();

  const id    = options?.id    ?? "gdb-btn";
  const label = options?.label ?? "Generate Draft";

  return `
<button
  type="button"
  id="${id}"
  class="gdb-btn"
  data-state="idle"
  aria-label="${label}"
  aria-live="polite"
>
  <!-- Idle -->
  <span class="gdb-slot gdb-slot--idle gdb-slot--visible" aria-hidden="false">
    <span aria-hidden="true">⚡</span>
    ${label}
  </span>

  <!-- Loading -->
  <span class="gdb-slot gdb-slot--loading" aria-hidden="true">
    <span class="gdb-spinner"></span>
    Generating...
  </span>

  <!-- Success -->
  <span class="gdb-slot gdb-slot--success" aria-hidden="true">
    <span aria-hidden="true">✓</span>
    Generated!
  </span>
</button>`.trim();
}

// ── State management ──────────────────────────────────────────────────────────

/**
 * Applies a state to a mounted generate-draft button.
 * Safe to call at any time; no-ops if the button isn't found.
 *
 * @param {HTMLElement} container
 * @param {GdbState} state
 */
function setGenerateDraftButtonState(container, state) {
  const btn = _findBtn(container);
  if (!btn) return;

  const validStates = ["idle", "loading", "success"];
  const next = validStates.includes(state) ? state : "idle";

  btn.dataset.state = next;
  btn.disabled = next === "loading";
  btn.setAttribute("aria-label", _ariaLabel(next, btn.dataset.label));

  // Swap visible slot
  btn.querySelectorAll(".gdb-slot").forEach((slot) => {
    const isActive = slot.classList.contains(`gdb-slot--${next}`);
    slot.classList.toggle("gdb-slot--visible", isActive);
    slot.setAttribute("aria-hidden", isActive ? "false" : "true");
  });
}

// ── Listener wiring ───────────────────────────────────────────────────────────

/**
 * Wires all interactivity for a rendered generate-draft button.
 * Must be called after injecting renderGenerateDraftButton() HTML into the DOM.
 *
 * On click:
 *   1. Transitions to "loading" state automatically.
 *   2. Dispatches "draft-generate-requested" CustomEvent (bubbles).
 *      event.detail = { setState(state) } — caller uses this to signal completion.
 *   3. Calls optional onRequest(setState) callback.
 *
 * If the caller never calls setState('success') or setState('idle'), the button
 * automatically returns to 'idle' after LOADING_TIMEOUT_MS to prevent lockout.
 *
 * @param {HTMLElement} container
 * @param {function(function(GdbState): void): void} [onRequest]
 *   Called with `setState`; caller drives state transitions.
 * @returns {{ setState: function(GdbState): void, destroy: function(): void }}
 */
function initGenerateDraftButtonListeners(container, onRequest) {
  const btn = _findBtn(container);
  if (!btn) return { setState: () => {}, destroy: () => {} };

  // Stash base label for aria updates
  btn.dataset.label = btn.querySelector(".gdb-slot--idle")?.textContent?.trim() ?? "Generate Draft";

  const LOADING_TIMEOUT_MS  = 30_000; // max time in loading before forced reset
  const SUCCESS_DURATION_MS =  2_000; // how long success state is shown

  let safetyTimer  = null;
  let successTimer = null;

  function setState(state) {
    clearTimeout(safetyTimer);
    clearTimeout(successTimer);
    setGenerateDraftButtonState(container, state);

    if (state === "loading") {
      // Safety net — revert to idle if caller forgets to resolve
      safetyTimer = setTimeout(() => setState("idle"), LOADING_TIMEOUT_MS);
    }

    if (state === "success") {
      // Auto-return to idle after SUCCESS_DURATION_MS
      successTimer = setTimeout(() => setState("idle"), SUCCESS_DURATION_MS);
    }
  }

  function handleClick(e) {
    if (btn.disabled || btn.dataset.state === "loading") return;

    // Ripple effect
    _spawnRipple(btn, e);

    setState("loading");

    btn.dispatchEvent(
      new CustomEvent("draft-generate-requested", {
        bubbles: true,
        detail: { setState },
      })
    );

    if (typeof onRequest === "function") onRequest(setState);
  }

  btn.addEventListener("click", handleClick);

  function destroy() {
    clearTimeout(safetyTimer);
    clearTimeout(successTimer);
    btn.removeEventListener("click", handleClick);
  }

  return { setState, destroy };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** @param {HTMLElement} container */
function _findBtn(container) {
  if (!container) return null;
  // The container might be the button itself or a wrapper
  if (container.classList?.contains("gdb-btn")) return container;
  return container.querySelector(".gdb-btn");
}

/** @param {GdbState} state @param {string} [baseLabel] */
function _ariaLabel(state, baseLabel) {
  const base = baseLabel ?? "Generate Draft";
  if (state === "loading") return "Generating draft, please wait…";
  if (state === "success") return "Draft generated successfully";
  return base;
}

/**
 * Spawns a CSS ripple at the click coordinates relative to the button.
 * @param {HTMLButtonElement} btn
 * @param {MouseEvent} e
 */
function _spawnRipple(btn, e) {
  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const x      = e.clientX - rect.left - size / 2;
  const y      = e.clientY - rect.top  - size / 2;
  const ripple = document.createElement("span");

  ripple.className = "gdb-ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}
