/**
 * saved-templates.js
 * Global storage helpers for extension-saved templates.
 *
 * Storage key:
 *   ellyn_saved_templates
 *
 * Schema:
 *   Array<{
 *     id: string,
 *     name: string,
 *     subject: string,
 *     body: string,
 *     tone: string,
 *     category: string,
 *     use_case: string,
 *     variables: string[],
 *     savedAt: string
 *   }>
 */

const SAVED_TEMPLATES_STORAGE_KEY = "ellyn_saved_templates";

function _stStorageGet(key) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) {
        resolve(null);
        return;
      }

      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(result?.[key] ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function _stStorageSet(key, value) {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome?.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Storage write failed"));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function _stToInlineString(value, maxLength = 300) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}

function _stNormalizeVariables(value) {
  if (!Array.isArray(value)) return [];

  const deduped = new Set();
  for (const item of value) {
    const normalized = _stToInlineString(item, 120);
    if (!normalized) continue;
    deduped.add(normalized);
  }

  return Array.from(deduped);
}

function _stNormalizeTemplate(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid template payload");
  }

  const id = _stToInlineString(input.id, 160);
  const name = _stToInlineString(input.name, 220);
  const subject = _stToInlineString(input.subject, 500);
  const body = String(input.body || "").trim();

  if (!id || !name || !subject || !body) {
    throw new Error("Template is missing required fields: id, name, subject, body");
  }

  return {
    id,
    name,
    subject,
    body,
    tone: _stToInlineString(input.tone || "professional", 80) || "professional",
    category: _stToInlineString(input.category || "general", 120) || "general",
    use_case: _stToInlineString(input.use_case || "general", 120) || "general",
    variables: _stNormalizeVariables(input.variables),
    savedAt: _stToInlineString(input.savedAt, 80) || new Date().toISOString(),
  };
}

function _stNormalizeCollection(value) {
  if (!Array.isArray(value)) return [];

  const output = [];
  const seenIds = new Set();
  for (const item of value) {
    try {
      const normalized = _stNormalizeTemplate(item);
      if (seenIds.has(normalized.id)) continue;
      seenIds.add(normalized.id);
      output.push(normalized);
    } catch {
      // Ignore malformed template rows.
    }
  }
  return output;
}

async function savedTemplatesGet() {
  const raw = await _stStorageGet(SAVED_TEMPLATES_STORAGE_KEY);
  const normalized = _stNormalizeCollection(raw);
  return normalized;
}

async function savedTemplatesSave(template) {
  const normalized = _stNormalizeTemplate(template);
  const current = await savedTemplatesGet();
  const index = current.findIndex((item) => item.id === normalized.id);

  if (index >= 0) {
    current[index] = {
      ...current[index],
      ...normalized,
      savedAt: normalized.savedAt || current[index].savedAt || new Date().toISOString(),
    };
  } else {
    current.unshift(normalized);
  }

  await _stStorageSet(SAVED_TEMPLATES_STORAGE_KEY, current);
}

async function savedTemplatesDelete(id) {
  const normalizedId = _stToInlineString(id, 160);
  if (!normalizedId) return;

  const current = await savedTemplatesGet();
  const next = current.filter((item) => item.id !== normalizedId);
  await _stStorageSet(SAVED_TEMPLATES_STORAGE_KEY, next);
}

async function savedTemplatesClear() {
  await _stStorageSet(SAVED_TEMPLATES_STORAGE_KEY, []);
}

function _stBuildContactTokens(contact) {
  const source = contact && typeof contact === "object" ? contact : {};
  const fullNameRaw = _stToInlineString(source.fullName || source.name, 220);
  const fullNameParts = fullNameRaw.split(/\s+/).filter(Boolean);

  const firstName =
    _stToInlineString(source.firstName, 120) ||
    (fullNameParts.length > 0 ? fullNameParts[0] : "");
  const lastName =
    _stToInlineString(source.lastName, 120) ||
    (fullNameParts.length > 1 ? fullNameParts.slice(1).join(" ") : "");
  const fullName =
    _stToInlineString(source.fullName, 220) ||
    [firstName, lastName].filter(Boolean).join(" ");

  const tokens = {
    firstName: firstName || "",
    lastname: lastName || "",
    lastName: lastName || "",
    fullname: fullName || "",
    fullName: fullName || "",
    company: _stToInlineString(source.company || source.companyName, 180),
    role: _stToInlineString(source.role || source.designation, 160),
    email: _stToInlineString(source.email, 240),
  };

  return tokens;
}

function _stReplaceTemplateTokens(value, contactTokens) {
  const text = String(value || "");
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (fullMatch, rawKey) => {
    const key = String(rawKey || "").trim();
    if (!key) return fullMatch;

    const exact = contactTokens[key];
    if (typeof exact === "string" && exact.length > 0) return exact;

    const lower = contactTokens[key.toLowerCase()];
    if (typeof lower === "string" && lower.length > 0) return lower;

    return fullMatch;
  });
}

function savedTemplatesApply(template, contact) {
  const normalizedTemplate = _stNormalizeTemplate(template);
  const contactTokens = _stBuildContactTokens(contact);

  return {
    subject: _stReplaceTemplateTokens(normalizedTemplate.subject, contactTokens),
    body: _stReplaceTemplateTokens(normalizedTemplate.body, contactTokens),
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.savedTemplatesGet = savedTemplatesGet;
  globalThis.savedTemplatesSave = savedTemplatesSave;
  globalThis.savedTemplatesDelete = savedTemplatesDelete;
  globalThis.savedTemplatesClear = savedTemplatesClear;
  globalThis.savedTemplatesApply = savedTemplatesApply;
}
