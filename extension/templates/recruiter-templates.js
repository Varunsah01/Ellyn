/**
 * recruiter-templates.js
 * Draft generation for email types supported by the extension.
 *
 * Load order: no dependencies - load before email-type-selector.js and draft-view.js.
 */

/** @typedef {"referral_request" | "to_recruiter" | "seeking_advice" | "ai_generated"} EmailTemplateType */

/**
 * @typedef {Object} DraftResult
 * @property {string} subject
 * @property {string} body
 */

const AI_API_ENDPOINTS = ["/api/v1/ai/generate-template", "/api/ai/generate-template"];
const DEFAULT_AI_API_ORIGIN = "https://www.useellyn.com";
const TEMPLATE_BASE_URL_OVERRIDE_KEY = "ellyn_base_url_override";
const TEMPLATE_AUTH_SOURCE_ORIGIN_KEY = "ellyn_auth_origin";

/**
 * Generates a draft subject + body for the given contact and template type.
 * For ai_generated, use generateAIDraft(contact) instead.
 *
 * @param {{ name?: string, company?: string, role?: string, email?: string }} contact
 * @param {EmailTemplateType} templateType
 * @returns {DraftResult}
 */
function generateDraft(contact, templateType) {
  const firstName = _firstName(contact?.name);
  const company = String(contact?.company || "your company").trim();

  switch (templateType) {
    case "referral_request":
      return _referralRequest(firstName, company);
    case "to_recruiter":
      return _toRecruiter(firstName, company);
    case "seeking_advice":
      return _seekingAdvice(firstName, company);
    case "ai_generated":
      return _aiGeneratedFallback(firstName, company);
    default:
      return _referralRequest(firstName, company);
  }
}

/**
 * Generates an AI draft by calling the web app API.
 *
 * @param {{ name?: string, company?: string, role?: string, email?: string }} contact
 * @returns {Promise<DraftResult>}
 */
async function generateAIDraft(contact) {
  const senderContext = await _resolveSenderContext();
  const payload = _buildAiPayload(contact, senderContext);
  let lastError = null;

  try {
    const runtimeResult = await _generateAIDraftViaBackground(payload);
    if (runtimeResult?.success && runtimeResult?.template) {
      const runtimeSubject = String(runtimeResult.template.subject || "").trim();
      const runtimeBody = String(runtimeResult.template.body || "").trim();
      if (runtimeSubject && runtimeBody) {
        return { subject: runtimeSubject, body: runtimeBody };
      }
    }
    if (runtimeResult?.success === false) {
      lastError = new Error(String(runtimeResult?.error || "AI draft generation failed."));
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error("AI draft runtime bridge failed.");
  }

  const apiOrigin = await _resolveAiApiOrigin();
  const authToken = await _resolveAuthToken();

  for (const endpoint of AI_API_ENDPOINTS) {
    const url = `${apiOrigin}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      let responseJson = null;
      try {
        responseJson = await response.json();
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        const errorMessage = _extractAiApiError(response.status, responseJson);
        lastError = new Error(errorMessage);

        if (response.status === 404 || response.status === 405) {
          continue;
        }
        throw lastError;
      }

      const subject = String(responseJson?.template?.subject || "").trim();
      const body = String(responseJson?.template?.body || "").trim();
      if (!subject || !body) {
        lastError = new Error("AI API returned an invalid template payload.");
        throw lastError;
      }

      return { subject, body };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("AI draft request failed.");
    }
  }

  throw lastError || new Error("AI draft generation failed.");
}

async function _generateAIDraftViaBackground(payload) {
  if (!chrome?.runtime?.sendMessage) return null;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "GENERATE_AI_DRAFT",
        payload,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || null);
      }
    );
  });
}

function _extractAiApiError(status, responseJson) {
  const details = Array.isArray(responseJson?.details) ? responseJson.details : [];
  const detailsMessage = details.length > 0 ? String(details[0]?.message || "").trim() : "";
  const errorMessage = String(responseJson?.error || "").trim();

  if (detailsMessage) return detailsMessage;
  if (errorMessage) return errorMessage;
  return `AI API request failed with status ${Number(status) || 500}.`;
}

function _buildAiPayload(contact, senderContext) {
  const company = _truncate(String(contact?.company || "").trim(), 160);
  const role = _truncate(String(contact?.role || "").trim(), 120);

  return {
    templateType: _mapAiTemplateType(contact),
    instructions: _buildAiInstructions(contact),
    context: {
      userName: _truncate(senderContext.userName || "Candidate", 120),
      ...(senderContext.userSchool ? { userSchool: _truncate(senderContext.userSchool, 120) } : {}),
    },
    ...(role ? { targetRole: role } : {}),
    ...(company ? { targetCompany: company } : {}),
  };
}

function _buildAiInstructions(contact) {
  const role = String(contact?.role || "").trim();
  const company = String(contact?.company || "").trim();
  const pieces = [
    "Write a concise first-touch outreach email with a clear CTA.",
    "Keep it professional and natural.",
    "Do not use placeholders like [Your Name].",
  ];

  if (role) pieces.push(`Recipient role: ${role}.`);
  if (company) pieces.push(`Recipient company: ${company}.`);

  return _truncate(pieces.join(" "), 700);
}

function _mapAiTemplateType(contact) {
  const role = String(contact?.role || "").toLowerCase();

  if (role.includes("recruiter") || role.includes("talent") || role.includes("sourcer")) {
    return "recruiter";
  }
  if (role.includes("hiring manager") || role.includes("engineering manager") || role.includes("manager")) {
    return "referral";
  }
  if (
    role.includes("founder") ||
    role.includes("chief") ||
    role.includes("vp") ||
    role.includes("director") ||
    role.includes("head ")
  ) {
    return "advice";
  }
  return "custom";
}

async function _resolveSenderContext() {
  try {
    const stored = await chrome.storage.local.get(["user"]);
    const user = stored?.user && typeof stored.user === "object" ? stored.user : {};
    const userMeta = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};

    const userName = _pickFirstNonEmpty(
      userMeta?.full_name,
      userMeta?.name,
      typeof user?.email === "string" ? user.email.split("@")[0] : ""
    );
    const userSchool = _pickFirstNonEmpty(
      userMeta?.school,
      userMeta?.university,
      userMeta?.college
    );

    return {
      userName: _truncate(userName || "Candidate", 120),
      userSchool: _truncate(userSchool || "", 120),
    };
  } catch {
    return {
      userName: "Candidate",
      userSchool: "",
    };
  }
}

async function _resolveAuthToken() {
  try {
    if (typeof getAuthToken === "function") {
      const token = await getAuthToken();
      const normalized = String(token || "").trim();
      if (normalized) return normalized;
    }
  } catch {
    // Ignore and continue fallback read.
  }

  try {
    const stored = await chrome.storage.local.get(["auth_token"]);
    return String(stored?.auth_token || "").trim();
  } catch {
    return "";
  }
}

async function _resolveAiApiOrigin() {
  try {
    if (typeof resolveBaseUrls === "function") {
      const resolved = await resolveBaseUrls();
      const fromResolver = _normalizeOrigin(
        resolved?.apiBaseUrl || resolved?.authBaseUrl || resolved?.appBaseUrl
      );
      if (fromResolver) return fromResolver;
    }
  } catch {
    // Ignore and continue fallback origin discovery.
  }

  try {
    const stored = await chrome.storage.local.get([
      TEMPLATE_BASE_URL_OVERRIDE_KEY,
      TEMPLATE_AUTH_SOURCE_ORIGIN_KEY,
    ]);
    const storedOrigin = _normalizeOrigin(
      stored?.[TEMPLATE_BASE_URL_OVERRIDE_KEY] || stored?.[TEMPLATE_AUTH_SOURCE_ORIGIN_KEY]
    );
    if (storedOrigin) return storedOrigin;
  } catch {
    // Ignore and use default.
  }

  return DEFAULT_AI_API_ORIGIN;
}

function _normalizeOrigin(value) {
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

function _pickFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function _truncate(value, maxLength) {
  const normalized = String(value || "").trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength);
}

// Private template builders

function _firstName(fullName) {
  const name = String(fullName || "").trim();
  if (!name) return "there";
  return name.split(/\s+/)[0];
}

function _referralRequest(firstName, company) {
  return {
    subject: `Referral Opportunity at ${company}`,
    body: `Hi ${firstName},

I hope this message finds you well. I came across your profile and noticed your work at ${company} and found it impressive.

I am currently exploring opportunities in [your field] and would love to know if there are any open roles that align with my background. If so, I would greatly appreciate a referral or an introduction to the right person on your team.

Happy to share my resume or chat briefly at your convenience.

Thank you for your time,
[Your Name]`,
  };
}

function _toRecruiter(firstName, company) {
  return {
    subject: `Exploring Opportunities at ${company}`,
    body: `Hi ${firstName},

I came across your profile and saw that you recruit for ${company}. I am actively looking for [role type] positions and think my background in [your skills/industry] could be a strong match.

I would love to connect and learn more about any relevant openings you are currently working on. I have attached my resume for your reference.

Looking forward to hearing from you,
[Your Name]`,
  };
}

function _seekingAdvice(firstName, company) {
  return {
    subject: `Quick Question About Your Experience at ${company}`,
    body: `Hi ${firstName},

I hope this is not too forward. I came across your profile and was really impressed by your career path at ${company}.

I am currently [brief context about yourself] and would love to get 15-20 minutes of your time for an informational chat. I am especially curious about [specific aspect of their role or company].

No agenda other than learning from someone I admire. Happy to work around your schedule.

Thank you for considering it,
[Your Name]`,
  };
}

function _aiGeneratedFallback(firstName, company) {
  return {
    subject: `Connecting with ${company}`,
    body: `Hi ${firstName},

I came across your profile and wanted to connect regarding opportunities at ${company}. I would love to learn more about your team and where my background may fit.

Best regards,
[Your Name]`,
  };
}
