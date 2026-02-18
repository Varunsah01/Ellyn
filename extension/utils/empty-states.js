/**
 * Empty-state DOM builders for the Ellyn extension sidepanel.
 * Loaded before scripts/sidepanel.js so these functions are available globally.
 */

/**
 * Builds and returns the "No contacts in queue" empty-state node.
 * @returns {HTMLElement}
 */
function createQueueEmptyState() {
  const wrapper = document.createElement("div");
  wrapper.className = "queue-empty-state";

  const icon = document.createElement("div");
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", "Empty mailbox");
  icon.textContent = "📭";

  const heading = document.createElement("p");
  heading.className = "queue-empty-heading";
  heading.textContent = "No contacts in queue";

  const sub = document.createElement("p");
  sub.className = "queue-empty-sub";
  sub.textContent = "Save email results to build your outreach list.";

  const cta = document.createElement("a");
  cta.href = "https://www.linkedin.com/search/results/people/";
  cta.target = "_blank";
  cta.rel = "noopener noreferrer";
  cta.className = "linkedin-cta-btn";
  cta.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;flex-shrink:0" aria-hidden="true">' +
    '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="2" y="9" width="4" height="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="4" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/>' +
    "</svg>Find People on LinkedIn";

  wrapper.appendChild(icon);
  wrapper.appendChild(heading);
  wrapper.appendChild(sub);
  wrapper.appendChild(cta);

  return wrapper;
}
