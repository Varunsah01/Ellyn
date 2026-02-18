/**
 * role-detector.js
 * Classifies a contact's type from their role string.
 *
 * Load order: no dependencies — load before email-type-selector.js
 */

/** @typedef {"recruiter" | "hiring_manager" | "executive" | "general"} ContactType */

const _ROLE_PATTERNS = {
  recruiter: [
    /recruit/i,
    /\btalent\b/i,
    /\bhr\b/i,
    /human.?resource/i,
    /staffing/i,
    /\bsourc/i,
    /headhunt/i,
    /acquisition/i,
    /people.?ops/i,
    /people.?partner/i,
  ],
  hiring_manager: [
    /hiring.?manager/i,
    /engineering.?manager/i,
    /product.?manager/i,
    /team.?lead/i,
    /tech.?lead/i,
    /\bdirector\b/i,
    /\bvp\b/i,
    /vice.?president/i,
    /head.?of/i,
    /department.?head/i,
  ],
  executive: [
    /\bceo\b/i,
    /\bcto\b/i,
    /\bcoo\b/i,
    /\bcfo\b/i,
    /\bcpo\b/i,
    /\bciso\b/i,
    /\bfounder\b/i,
    /co.?founder/i,
    /\bpresident\b/i,
    /managing.?director/i,
    /\bpartner\b/i,
    /\bprincipal\b/i,
  ],
};

/**
 * Classifies a contact based on their role title.
 *
 * @param {{ role?: string } | string | null | undefined} contactOrRole
 * @returns {ContactType}
 */
function detectContactType(contactOrRole) {
  const roleStr =
    typeof contactOrRole === "string"
      ? contactOrRole
      : String(contactOrRole?.role || "");

  if (!roleStr.trim()) return "general";

  for (const [type, patterns] of Object.entries(_ROLE_PATTERNS)) {
    if (patterns.some((re) => re.test(roleStr))) {
      return /** @type {ContactType} */ (type);
    }
  }

  return "general";
}

/**
 * Returns a human-readable label for a detected contact type.
 *
 * @param {ContactType} type
 * @returns {string}
 */
function getContactTypeLabel(type) {
  const labels = {
    recruiter: "Recruiter",
    hiring_manager: "Hiring Manager",
    executive: "Executive",
    general: "Professional",
  };
  return labels[type] ?? "Professional";
}
