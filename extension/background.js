// Service Worker for email finding orchestration + auth bridge
console.log('[Extension] Service worker loaded');

try {
  importScripts('utils/quota.js');
} catch (error) {
  console.warn('[Extension] Failed to load quota utility script:', error);
}

try {
  importScripts('utils/analytics.js');
} catch (error) {
  console.warn('[Extension] Failed to load analytics utility script:', error);
}

try {
  importScripts('background/email-predictor.js');
} catch (error) {
  console.warn('[Extension] Failed to load AI email predictor utility script:', error);
}

try {
  importScripts('utils/safety.js');
} catch (e) {
  console.warn('[Extension] safety.js load failed:', e);
}

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://www.useellyn.com',
  CACHE_DURATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  COST_WINDOW_MS: 30 * 24 * 60 * 60 * 1000, // 30 days rolling cost window
  DISABLE_CREDIT_LIMITS: true,
  HEURISTIC_FALLBACK: {
    enabled: true,
    allowOnNoMx: false,
  },
  PIPELINE_TIMEOUT_MINUTES: 2,
  STAGE_TIMEOUT_MS: {
    extractProfile: 10000,
    resolveDomain: 3000,
    predictPatterns: 8000,
    mxCheck: 2500,
    verifyEmail: 15000,
  },
  COSTS: {
    predictPatternsFallback: 0.0002,
    verifyEmail: 0.001,
  },
};

const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_REFRESH_PATH = '/api/v1';
const CSRF_TOKEN_TTL_MS = 5 * 60 * 1000;

const AUTH_SOURCE_ORIGIN_KEY = 'ellyn_auth_origin';
const AUTH_STORAGE_KEYS = ['isAuthenticated', 'user', 'auth_token', AUTH_SOURCE_ORIGIN_KEY];
const COST_STORAGE_KEY = 'api_cost_tracker';
const OPERATION_STORAGE_PREFIX = 'find_email_op_';
const OPERATION_ALARM_PREFIX = 'find-email-timeout-';
const DOMAIN_CACHE_PREFIX = 'company_domain_';
const PATTERN_CACHE_PREFIX = 'pattern_';
const CONTENT_SCRIPT_FILE = 'content/linkedin-extractor.js';
const quotaManager = globalThis?.quotaManager || null;
const analyticsClient = globalThis?.analytics || null;
let csrfTokenCache = '';
let csrfTokenFetchedAt = 0;
let csrfRefreshPromise = null;

/**
 * Report a critical extension error to our backend for monitoring.
 * Fires-and-forgets - never blocks the main pipeline.
 */
function reportExtensionError(error, context = {}) {
  const payload = {
    source: 'chrome-extension',
    message: error?.message || String(error),
    stack: error?.stack || null,
    context: {
      ...context,
      extensionVersion: chrome.runtime.getManifest?.()?.version || 'unknown',
      timestamp: new Date().toISOString(),
    },
  };

  // Use the existing API base URL from config
  const apiBase = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : '';
  if (!apiBase) return;

  fetch(`${apiBase}/api/extension-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {}); // always silent fail
}

async function configureSidePanelBehavior() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true,
    });
    console.log('[Extension] Side panel action-click behavior enabled');
  } catch (error) {
    console.warn('[Extension] Failed to configure side panel behavior:', error);
  }
}

if (quotaManager?.config) {
  quotaManager.config.apiBaseUrl = CONFIG.API_BASE_URL;
}

if (analyticsClient?.config) {
  analyticsClient.config.apiBaseUrl = CONFIG.API_BASE_URL;
}

void configureSidePanelBehavior();

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanelBehavior();
});

// ============================================================================
// AUTH STATE HELPERS
// ============================================================================

function extractAuthToken(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.auth_token === 'string') return payload.auth_token;
  if (typeof payload.access_token === 'string') return payload.access_token;
  return null;
}

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function setAuthenticatedState(payload, sendResponse, context = {}) {
  const token = extractAuthToken(payload);
  const nextState = {
    isAuthenticated: true,
    user: payload || null,
  };

  if (token) {
    nextState.auth_token = token;
  }

  const sourceOrigin = normalizeOrigin(context?.sourceOrigin);
  if (sourceOrigin) {
    nextState[AUTH_SOURCE_ORIGIN_KEY] = sourceOrigin;
  }

  chrome.storage.local.set(nextState, () => {
    if (chrome.runtime.lastError) {
      sendResponse?.({
        ok: false,
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS', payload }, () => {
      void chrome.runtime.lastError;
    });

    sendResponse?.({ ok: true });
  });
}

function clearAuthenticatedState(sendResponse) {
  chrome.storage.local.remove(AUTH_STORAGE_KEYS, () => {
    if (chrome.runtime.lastError) {
      sendResponse?.({
        ok: false,
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' }, () => {
      void chrome.runtime.lastError;
    });

    sendResponse?.({ ok: true });
  });
}

async function getAuthContext() {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEYS);
  return {
    isAuthenticated: result?.isAuthenticated === true,
    user: result?.user || null,
    authToken: typeof result?.auth_token === 'string' ? result.auth_token : null,
  };
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  console.log('[Extension] Received message:', message.type);

  if (message.type === 'FIND_EMAIL') {
    handleFindEmail(message.data, sender, sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'EXTRACT_PROFILE_FROM_TAB') {
    const payload = message.data && typeof message.data === 'object' ? message.data : message;
    handleExtractProfileFromTabMessage(payload, sender, sendResponse);
    return true;
  }

  if (message.type === 'EXTRACT_AND_ENRICH_ENHANCED') {
    const requestedTabId = Number.isFinite(message?.tabId)
      ? message.tabId
      : Number.isFinite(sender?.tab?.id)
      ? sender.tab.id
      : null;

    (async () => {
      try {
        if (!Number.isFinite(requestedTabId)) {
          throw new Error('Missing tab id for enhanced extraction');
        }

        const profileData = await extractProfileWithCompany(requestedTabId);
        const companyName = String(profileData?.company?.name || '').trim();
        if (!companyName) {
          throw new Error('Company name not available from profile extraction');
        }

        const authToken = await getAuthToken();
        const domainResult = await resolveDomainEnhanced(
          companyName,
          typeof profileData?.company?.pageUrl === 'string' ? profileData.company.pageUrl : '',
          authToken || ''
        );

        sendResponse({
          success: true,
          data: {
            profile: profileData,
            domain: domainResult,
          },
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error?.message || 'Enhanced extraction failed',
        });
      }
    })();

    return true;
  }

  if (message.type === 'GET_AUTH_TOKEN') {
    getAuthToken()
      .then((token) => sendResponse(token))
      .catch((error) => {
        console.error('[Extension] GET_AUTH_TOKEN failed:', error);
        sendResponse('');
      });
    return true;
  }

  if (message.type === 'CHECK_QUOTA') {
    checkQuota()
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error('[Extension] CHECK_QUOTA failed:', error);
        sendResponse({
          allowed: false,
          error: error?.message || 'Failed to fetch quota',
        });
      });
    return true;
  }

  if (message.type === 'AUTH_LOGOUT_LOCAL') {
    clearAuthenticatedState(sendResponse);
    return true;
  }

  if (message.type === 'AUTH_SUCCESS') {
    setAuthenticatedState(message.payload || null, sendResponse);
    return true;
  }

  if (message.type === 'AUTH_LOGOUT') {
    clearAuthenticatedState(sendResponse);
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  const senderOrigin = normalizeOrigin(_sender?.url || _sender?.origin || '');

  if (message.type === 'WEBAPP_AUTH_SYNC') {
    setAuthenticatedState(message.payload || null, sendResponse, {
      sourceOrigin: senderOrigin,
    });
    return true;
  }

  if (message.type === 'AUTH_SUCCESS') {
    setAuthenticatedState(message.payload || null, sendResponse, {
      sourceOrigin: senderOrigin,
    });
    return true;
  }

  if (message.type === 'AUTH_LOGOUT') {
    clearAuthenticatedState(sendResponse);
    return true;
  }
});

if (chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm?.name || !alarm.name.startsWith(OPERATION_ALARM_PREFIX)) {
      return;
    }

    const operationId = alarm.name.replace(OPERATION_ALARM_PREFIX, '');
    if (!operationId) {
      return;
    }

    const stateKey = `${OPERATION_STORAGE_PREFIX}${operationId}`;
    const stored = await chrome.storage.local.get([stateKey]);
    const state = stored?.[stateKey];

    if (state?.status === 'running') {
      await chrome.storage.local.set({
        [stateKey]: {
          ...state,
          status: 'timed_out',
          completedAt: Date.now(),
          error: 'Operation timed out before completion',
        },
      });
      console.warn('[Extension] FIND_EMAIL operation timed out via alarm', { operationId });
    }
  });
} else {
  console.warn('[Extension] chrome.alarms API unavailable. Operation timeout alarms disabled.');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAuthToken() {
  try {
    const { authToken } = await getAuthContext();
    return authToken || '';
  } catch (error) {
    console.error('[Extension] Error getting auth token:', error);
    return '';
  }
}

async function checkQuota() {
  if (!quotaManager) {
    return {
      allowed: true,
      used: null,
      limit: null,
      remaining: null,
      resetDate: null,
      planType: null,
      warning: 'Quota manager unavailable',
    };
  }
  const status = await quotaManager.getStatus();
  if (!CONFIG.DISABLE_CREDIT_LIMITS) {
    return status;
  }
  return {
    ...status,
    allowed: true,
    warning: status?.warning || 'Credit limits disabled',
  };
}

async function canPerformLookup() {
  if (!quotaManager) {
    return {
      allowed: true,
      remaining: null,
      resetDate: null,
      warning: 'Quota manager unavailable',
    };
  }
  const quotaCheck = await quotaManager.canPerformLookup();
  if (!CONFIG.DISABLE_CREDIT_LIMITS) {
    return quotaCheck;
  }
  return {
    ...quotaCheck,
    allowed: true,
    warning: quotaCheck?.warning || 'Credit limits disabled',
  };
}

function isLinkedInProfileUrl(url) {
  return /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/in\/[^/?#]+/i.test(String(url || ''));
}

function splitHumanName(value) {
  const raw = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!raw) {
    return {
      firstName: '',
      lastName: '',
      fullName: '',
    };
  }

  const parts = raw.split(' ').filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
      fullName: parts[0],
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    fullName: raw,
  };
}

function normalizeExtractorPayload(extracted) {
  console.log('[Background] Raw extractor payload:', extracted);

  const fullName = String(
    extracted?.name?.fullName || `${extracted?.name?.firstName || ''} ${extracted?.name?.lastName || ''}`
  )
    .trim()
    .replace(/\s+/g, ' ');

  const split = splitHumanName(fullName);
  const firstName = String(extracted?.name?.firstName || split.firstName || '').trim();
  const lastName = String(extracted?.name?.lastName || split.lastName || '').trim();
  const company = String(extracted?.company?.name || '').trim();
  const companyPageUrl = String(extracted?.company?.pageUrl || extracted?.companyPageUrl || '').trim();
  const role = String(extracted?.role?.title || '').trim();
  const profileUrl = String(extracted?.profileUrl || '').trim();

  const education = extracted?.education || null;
  const profileType = extracted?.profileType || null;

  const normalized = {
    firstName,
    lastName,
    fullName: String(`${firstName} ${lastName}`).trim() || fullName,
    company,
    companyPageUrl,
    role,
    profileUrl,
    education,
    profileType,
  };

  console.log('[Background] Normalized payload:', normalized);
  return normalized;
}

function hasEssentialIdentity(payload) {
  const hasName = Boolean(String(payload?.fullName || '').trim());
  const hasCompany = Boolean(String(payload?.company || '').trim());
  const isStudent = payload?.profileType?.type === 'STUDENT';
  const hasEducation = Boolean(payload?.education?.institution);
  return hasName && (hasCompany || (isStudent && hasEducation));
}

function isMissingReceiverError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('receiving end does not exist') ||
    msg.includes('could not establish connection') ||
    msg.includes('message port closed')
  );
}

async function ensureContentScriptInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE],
  });
}

async function extractProfileReadOnlyFromPage(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const profileUrl = window.location.href;
      const isProfile = /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/in\/[^/?#]+/i.test(profileUrl);

      const clean = (value) =>
        String(value || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\u200B/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const splitName = (value) => {
        const raw = clean(value);
        if (!raw) {
          return { firstName: '', lastName: '', fullName: '' };
        }
        const parts = raw.split(' ').filter(Boolean);
        if (parts.length === 1) {
          return { firstName: parts[0], lastName: '', fullName: parts[0] };
        }
        return {
          firstName: parts[0],
          lastName: parts.slice(1).join(' '),
          fullName: raw,
        };
      };

      const pickText = (selectors) => {
        for (const selector of selectors) {
          try {
            const el = document.querySelector(selector);
            const text = clean(el?.textContent || '');
            if (text) {
              return text;
            }
          } catch {
            // Ignore selector failures and keep falling back.
          }
        }
        return '';
      };

      const looksLikeRole = (value) => {
        const text = clean(value);
        if (!text) return false;
        if (looksLikeRoleNoiseLine(text)) return false;

        const roleKeywords =
          /\b(co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|designer|analyst|consultant|specialist|coordinator|lead|senior|junior|intern|associate|executive|administrator|officer|head of|chief|owner|entrepreneur|advisor|researcher|professor)\b/i;
        if (!roleKeywords.test(text)) return false;
        if (/\b(?:at|@)\b/i.test(text)) return false;

        const companyIndicators =
          /\b(inc|inc\.|ltd|ltd\.|llc|plc|corp|corp\.|co|co\.|company|group|holdings|technologies|technology|systems|solutions|services|bank|insurance|life|limited)\b/i;
        if (companyIndicators.test(text)) return false;

        return text.split(/\s+/).length <= 8;
      };

      const looksLikeRoleNoiseLine = (value) => {
        const text = clean(value);
        if (!text) return true;
        if (/^\.\.\.$/.test(text)) return true;
        if (/^see more$/i.test(text)) return true;
        if (/\+\s*\d+\s*skills?\b/i.test(text)) return true;
        if (/^\d+\s*skills?\b/i.test(text)) return true;
        if (/\bendorsement(?:s)?\b/i.test(text)) return true;
        if (/\b(?:followers|connections|contact info)\b/i.test(text)) return true;
        return false;
      };

      const isExperienceMetaLine = (value) => {
        const text = clean(value);
        if (!text) return true;
        if (looksLikeRoleNoiseLine(text)) return true;
        if (/\b(full[- ]?time|part[- ]?time|contract|freelance|self[- ]?employed|internship)\b/i.test(text)) return true;
        if (/\b(current|present)\b/i.test(text) && /\b\d+\s*(?:yr|yrs|year|years|mo|mos|month|months)\b/i.test(text)) return true;
        if (/\b\d+\s*(?:yr|yrs|year|years|mo|mos|month|months)\b/i.test(text)) return true;
        if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text) && /\b\d{4}\b/.test(text)) return true;
        if (/\b\d{4}\s*-\s*(?:present|current|\d{4})\b/i.test(text)) return true;
        if (/\b(on-site|onsite|hybrid|remote)\b/i.test(text)) return true;
        if (/^\([^)]{2,80}\)$/.test(text)) return true;
        return false;
      };

      const isLikelyCompany = (value) => {
        const text = clean(value);
        if (!text || text.length < 2 || text.length > 100) return false;
        if (looksLikeRole(text)) return false;
        if (/linkedin|followers|connections|yrs|mos|contact info/i.test(text)) return false;
        if (/^[0-9]+$/.test(text)) return false;
        if (/[@|]/.test(text)) return false;

        const suspiciousPatterns = [
          /^(full-time|part-time|contract|freelance|self-employed)$/i,
          /^\d{4}\s*-\s*(present|current|\d{4})$/i,
          /^(he\/him|she\/her|they\/them)$/i,
          /^[\u00B7\u2022]\s/i,
        ];
        if (suspiciousPatterns.some((pattern) => pattern.test(text))) return false;
        if (/^(building|helping|working|creating|driving|leading|enabling|empowering)\b/i.test(text)) {
          return false;
        }

        const genericSingleWord = new Set([
          'investments',
          'operations',
          'consulting',
          'marketing',
          'sales',
          'finance',
          'platform',
          'logistics',
          'analytics',
          'engineering',
          'support',
        ]);
        const tokens = text.split(/\s+/).filter(Boolean);
        if (tokens.length === 1 && genericSingleWord.has(tokens[0].toLowerCase())) {
          return false;
        }

        return true;
      };

      const parseCompanyFromHeadline = (headline) => {
        const text = clean(headline);
        if (!text) return '';

        const patterns = [
          /\b(?:at|@)\s+([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||,|\u00B7|\u2022|$))/i,
          /^(?:co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|consultant)\s*,\s*([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||\u00B7|\u2022|$))/i,
          /^[^|,\n\u00B7\u2022]+,\s*([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||\u00B7|\u2022|$))/i,
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (!match?.[1]) continue;
          const candidate = clean(match[1]);
          if (candidate && isLikelyCompany(candidate)) return candidate;
        }

        const segments = text
          .split(/[\|\u00B7\u2022]/)
          .map((segment) => clean(segment))
          .filter(Boolean);
        if (segments.length > 1) {
          for (let i = 1; i < segments.length; i += 1) {
            const candidate = clean(segments[i].replace(/\([^)]*\)/g, ' '));
            if (candidate && isLikelyCompany(candidate)) {
              return candidate;
            }
          }
        }

        return '';
      };

      const parseRoleFromHeadline = (headline) => {
        const text = clean(headline);
        if (!text) return '';
        const match = text.match(/^(.+?)(?:\s+(?:at|@)\s+|\s*,\s*[^,|]+|\s*\||$)/i);
        return clean(match?.[1] || '');
      };

      const parseRoleFromExperience = () => {
        const experienceSection = document.querySelector('section#experience, section[id*="experience"]');
        if (!experienceSection) return '';

        const rows = experienceSection.querySelectorAll('li, div[class*="pvs-list__item"]');
        let fallbackRole = '';

        const pickBestRoleFromLines = (lines, companyCandidate = '') => {
          let bestRole = '';
          let bestScore = Number.NEGATIVE_INFINITY;

          for (let idx = 0; idx < lines.length; idx += 1) {
            const line = clean(lines[idx]);
            if (!line) continue;
            if (companyCandidate && line.toLowerCase() === companyCandidate.toLowerCase()) continue;
            if (isExperienceMetaLine(line)) continue;
            if (isLikelyCompany(line)) continue;
            if (!looksLikeRole(line) && !/[,/&-]/.test(line)) continue;

            let score = 0;
            if (idx === 0) score += 4;
            else if (idx === 1) score += 2;
            if (looksLikeRole(line)) score += 3;
            if (/[,&/]/.test(line)) score += 1;
            if (/\+\s*\d+\s*skills?\b/i.test(line)) score -= 8;
            if (/\bskills?\b/i.test(line)) score -= 4;

            if (score > bestScore) {
              bestScore = score;
              bestRole = line;
            }
          }

          return bestRole;
        };

        for (const row of rows) {
          const rowText = clean(row?.innerText || '');
          if (!rowText) continue;

          const isCurrent = /\b(current|present|now)\b/i.test(rowText);
          if (!isCurrent) continue;

          const lines = rowText
            .split('\n')
            .map((line) => clean(line))
            .filter(Boolean);
          if (lines.length === 0) continue;

          const companyLink = row.querySelector('a[href*="/company/"], a[data-field="experience_company_logo"]');
          const companyCandidate = clean(companyLink?.textContent || '');

          const roleSelectors = [
            'span[aria-hidden="true"].mr1.t-bold',
            'span.mr1.t-bold span[aria-hidden="true"]',
            'div.t-bold span[aria-hidden="true"]',
            'div[class*="display-flex"][class*="align-items-center"] span[aria-hidden="true"]',
          ];

          for (const selector of roleSelectors) {
            let nodes = [];
            try {
              nodes = row.querySelectorAll(selector);
            } catch {
              continue;
            }

            for (const node of nodes) {
              const roleText = clean(node?.textContent || '');
              if (!roleText) continue;
              if (companyCandidate && roleText.toLowerCase() === companyCandidate.toLowerCase()) continue;
              if (isExperienceMetaLine(roleText)) continue;
              if (looksLikeRole(roleText)) {
                return roleText;
              }
            }
          }

          const bestFromLines = pickBestRoleFromLines(lines, companyCandidate);
          if (bestFromLines) {
            return bestFromLines;
          }

          if (!fallbackRole) {
            fallbackRole = pickBestRoleFromLines(lines, '');
          }
        }

        return fallbackRole;
      };

      const parseCompanyFromUrl = (href) => {
        const match = String(href || '').match(/\/company\/([^/?#]+)/i);
        if (!match?.[1]) return '';
        return clean(decodeURIComponent(match[1]).replace(/-/g, ' '));
      };

      const parseNameFromUrl = () => {
        const match = window.location.pathname.match(/\/in\/([^/?#]+)/i);
        if (!match?.[1]) return '';
        const slug = decodeURIComponent(match[1]);
        return clean(
          slug
            .replace(/[-_]+/g, ' ')
            .replace(/\d+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        );
      };

      const parseVoyagerPayload = (payload) => {
        const out = {
          fullName: '',
          company: '',
          role: '',
        };

        const candidates = [];
        const push = (obj) => {
          if (obj && typeof obj === 'object') {
            candidates.push(obj);
          }
        };

        push(payload);
        push(payload?.data);
        if (Array.isArray(payload?.elements)) {
          payload.elements.forEach(push);
        }
        if (Array.isArray(payload?.included)) {
          payload.included.forEach(push);
        }

        for (const obj of candidates) {
          if (!out.fullName) {
            const full = clean(obj?.name || `${clean(obj?.firstName)} ${clean(obj?.lastName)}`);
            if (full) out.fullName = full;
          }
          if (!out.role) {
            const role = clean(obj?.headline || obj?.occupation || obj?.title);
            if (role) out.role = role;
          }
          if (!out.company) {
            const company = clean(obj?.companyName || obj?.company?.name || obj?.organizationName);
            if (company) out.company = company;
          }
        }

        if (!out.company && out.role) {
          out.company = parseCompanyFromHeadline(out.role);
        }

        return out;
      };

      const fetchVoyagerProfile = async () => {
        const identityMatch = window.location.pathname.match(/\/in\/([^/?#]+)/i);
        if (!identityMatch?.[1]) return null;

        const memberIdentity = decodeURIComponent(identityMatch[1]);
        const tokenMatch = document.cookie.match(/(?:^|;\s*)JSESSIONID="?([^\";]+)"?/);
        const csrfToken = tokenMatch?.[1] ? tokenMatch[1].replace(/^"|"$/g, '') : '';

        const headers = {
          accept: 'application/json',
          'x-restli-protocol-version': '2.0.0',
        };
        if (csrfToken) {
          headers['csrf-token'] = csrfToken;
        }

        const endpoints = [
          `https://www.linkedin.com/voyager/api/identity/profileView/${encodeURIComponent(memberIdentity)}`,
          `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(memberIdentity)}`,
        ];

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, {
              method: 'GET',
              credentials: 'include',
              headers,
            });
            if (!response.ok) continue;
            const payload = await response.json();
            const parsed = parseVoyagerPayload(payload);
            if (parsed.fullName || parsed.company || parsed.role) {
              return parsed;
            }
          } catch {
            // Keep trying alternative endpoints.
          }
        }

        return null;
      };

      if (!isProfile) {
        return {
          success: false,
          error: 'Not on a LinkedIn profile page',
          data: {
            name: { firstName: null, lastName: null, fullName: null, source: 'readonly-dom', confidence: 0 },
            company: { name: null, source: 'readonly-dom', confidence: 0 },
            role: { title: null, source: 'readonly-dom', confidence: 0 },
            profileUrl,
          },
        };
      }

      let fullName = pickText([
        'h1.text-heading-xlarge',
        'main section:first-of-type h1',
        'main h1',
        'h1',
      ]);

      const ogTitle = clean(document.querySelector('meta[property="og:title"]')?.content || '');
      const titleName = clean(document.title.split('|')[0]?.split(' - ')[0] || '');
      if (!fullName && ogTitle) {
        fullName = clean(ogTitle.split(' - ')[0]?.split('|')[0] || '');
      }
      if (!fullName && titleName) {
        fullName = titleName;
      }
      if (!fullName) {
        fullName = parseNameFromUrl();
      }

      let headline = pickText([
        'main section:first-of-type div.text-body-medium.break-words',
        'div[class*="pv-text-details__left-panel"] div.text-body-medium.break-words',
        'div.text-body-medium.break-words',
      ]);
      if (!headline) {
        headline = clean(document.querySelector('meta[property="og:description"]')?.content || '');
      }

      let company = parseCompanyFromHeadline(headline);
      let role = parseRoleFromExperience() || parseRoleFromHeadline(headline);

      if (!company) {
        const experienceSection = document.querySelector('section#experience, section[id*="experience"]');
        const firstExperienceRow = experienceSection?.querySelector('li, div[class*="pvs-list__item"]');
        const rowText = clean(firstExperienceRow?.innerText || '');
        if (rowText) {
          const lines = rowText
            .split('\n')
            .map((line) => clean(line))
            .filter(Boolean);
          for (const line of lines) {
            if (
              /\b(university|college|school|institute|education|followers|connections|present)\b/i.test(line)
            ) {
              continue;
            }
            if (
              line.length > 1 &&
              line.length <= 100 &&
              !/\b(full[- ]?time|part[- ]?time|self[- ]?employed)\b/i.test(line) &&
              !looksLikeRole(line) &&
              isLikelyCompany(line)
            ) {
              company = line;
              break;
            }
          }
        }
      }

      if (!company) {
        const companyLink = document.querySelector(
          [
            'main section:first-of-type a[href*="/company/"]',
            'main a[href*="/company/"]',
          ].join(', ')
        );
        const fromText = clean(companyLink?.textContent || '');
        const fromUrl = parseCompanyFromUrl(companyLink?.href || '');
        company = isLikelyCompany(fromText) ? fromText : isLikelyCompany(fromUrl) ? fromUrl : '';
      }

      if (!fullName || !company) {
        const voyager = await fetchVoyagerProfile();
        if (voyager?.fullName && !fullName) fullName = voyager.fullName;
        if (voyager?.company && !company) company = voyager.company;
        if (voyager?.role && !role) role = voyager.role;
      }

      const split = splitName(fullName);
      const hasUsefulData = Boolean(split.fullName || company);
      return {
        success: hasUsefulData,
        data: {
          name: {
            firstName: split.firstName || null,
            lastName: split.lastName || null,
            fullName: split.fullName || null,
            source: 'readonly-dom',
            confidence: split.fullName ? 0.86 : 0,
          },
          company: {
            name: company || null,
            source: 'readonly-dom',
            confidence: company ? 0.78 : 0,
          },
          role: {
            title: role || null,
            source: 'readonly-dom',
            confidence: role ? 0.7 : 0,
          },
          profileUrl,
          extractionTimestamp: new Date().toISOString(),
        },
        error: hasUsefulData ? null : 'Could not extract profile data from read-only DOM fallback',
      };
    },
  });

  return injection?.result || null;
}

async function requestProfileExtraction(tabId, options = {}) {
  const includeDebug = options?.debug === true;

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'EXTRACT_PROFILE',
      debug: includeDebug,
    });
    if (response) {
      return response;
    }
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }
    console.warn('[Extension] EXTRACT_PROFILE receiver missing. Injecting content script and retrying.', {
      tabId,
      error: error?.message || String(error),
    });
  }

  await ensureContentScriptInjected(tabId);

  return chrome.tabs.sendMessage(tabId, {
    type: 'EXTRACT_PROFILE',
    debug: includeDebug,
  });
}

async function requestCompanyPageUrlExtraction(tabId, companyName) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'EXTRACT_COMPANY_PAGE_URL',
      companyName,
    });
    if (response) {
      return response;
    }
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }
    console.warn('[Extension] EXTRACT_COMPANY_PAGE_URL receiver missing. Injecting content script and retrying.', {
      tabId,
      error: error?.message || String(error),
    });
  }

  await ensureContentScriptInjected(tabId);

  return chrome.tabs.sendMessage(tabId, {
    type: 'EXTRACT_COMPANY_PAGE_URL',
    companyName,
  });
}

async function extractProfileWithCompany(tabId) {
  const profileResponse = await withTimeout(
    requestProfileExtraction(tabId, { debug: true }),
    CONFIG.STAGE_TIMEOUT_MS.extractProfile,
    'Profile extraction with company URL'
  );

  if (profileResponse?.success === false) {
    throw new Error(profileResponse?.error || 'Profile extraction failed');
  }

  const profileData =
    profileResponse?.data && typeof profileResponse.data === 'object'
      ? profileResponse.data
      : profileResponse && typeof profileResponse === 'object'
      ? profileResponse
      : null;

  if (!profileData || typeof profileData !== 'object') {
    throw new Error('Profile extraction returned invalid payload');
  }

  const companyName = String(profileData?.company?.name || '').trim();
  if (!companyName) {
    return profileData;
  }

  try {
    const companyData = await requestCompanyPageUrlExtraction(tabId, companyName);
    if (companyData?.companyPageUrl) {
      profileData.company = {
        ...(profileData.company || {}),
        pageUrl: companyData.companyPageUrl,
        extractionMethod: companyData.extractionMethod || '',
      };
      console.log('[Extension] Company page URL extracted', {
        companyName,
        companyPageUrl: companyData.companyPageUrl,
        extractionMethod: companyData.extractionMethod || '',
      });
    }
  } catch (error) {
    console.warn('[Extension] Failed extracting company page URL. Continuing with profile payload.', {
      error: error?.message || String(error),
      companyName,
    });
  }

  return profileData;
}

async function resolveDomainEnhanced(companyName, companyPageUrl, authToken = '') {
  const payload = await callBackendPost(
    '/api/v1/resolve-domain-v2',
    {
      companyName,
      companyPageUrl: companyPageUrl || undefined,
    },
    authToken,
    Math.max(CONFIG.STAGE_TIMEOUT_MS.resolveDomain, 5000)
  );

  const success = payload?.success === true || payload?.data?.success === true;
  const result = payload?.result || payload?.data?.result || null;
  if (!success || !result) {
    throw new Error(getApiErrorMessage(payload) || 'Invalid response from /api/v1/resolve-domain-v2');
  }

  console.log('[Domain] Resolved:', result);
  return result;
}

async function handleExtractProfileFromTabMessage(data, sender, sendResponse) {
  try {
    const tabId = Number.isFinite(data?.tabId)
      ? data.tabId
      : Number.isFinite(sender?.tab?.id)
      ? sender.tab.id
      : null;

    if (!Number.isFinite(tabId)) {
      sendResponse({
        success: false,
        error: 'Missing tab id for profile extraction',
      });
      return;
    }

    const tab = await chrome.tabs.get(tabId);
    if (!isLinkedInProfileUrl(tab?.url)) {
      sendResponse({
        success: false,
        error: 'Not on a LinkedIn profile page',
      });
      return;
    }

    let response = null;
    let primaryError = null;
    try {
      response = await withTimeout(
        requestProfileExtraction(tabId, { debug: data?.debug === true }),
        CONFIG.STAGE_TIMEOUT_MS.extractProfile,
        'Profile extraction'
      );
    } catch (error) {
      primaryError = error;
      console.warn('[Extension] Primary profile extraction failed. Falling back to read-only extraction.', {
        tabId,
        error: error?.message || String(error),
      });
    }

    const normalizedPrimary = normalizeExtractorPayload(response?.data || {});
    if (primaryError || !response?.success || !hasEssentialIdentity(normalizedPrimary)) {
      const readOnly = await withTimeout(
        extractProfileReadOnlyFromPage(tabId),
        CONFIG.STAGE_TIMEOUT_MS.extractProfile,
        'Read-only profile extraction'
      );

      if (readOnly?.success && readOnly?.data) {
        response = readOnly;
      } else if (primaryError && !response) {
        response = {
          success: false,
          error: primaryError?.message || 'Failed to extract profile data',
          data: readOnly?.data || null,
        };
      }
    }

    if (!response?.data) {
      sendResponse({
        success: false,
        error: response?.error || 'No response from LinkedIn extractor',
      });
      return;
    }

    const normalized = normalizeExtractorPayload(response.data);
    sendResponse({
      ...response,
      normalized,
    });
  } catch (error) {
    console.error('[Extension] Failed EXTRACT_PROFILE_FROM_TAB:', error);
    reportExtensionError(error, {
      pipeline: 'extract-profile-from-tab',
      tabId: Number.isFinite(payload?.tabId) ? payload.tabId : null,
    });
    sendResponse({
      success: false,
      error: error?.message || 'Failed to extract profile from tab',
    });
  }
}

async function trackApiCost(cost) {
  try {
    const safeCost = Number(cost);
    if (!Number.isFinite(safeCost) || safeCost <= 0) {
      return;
    }

    const now = Date.now();
    const stored = await chrome.storage.local.get([COST_STORAGE_KEY]);
    const current = stored?.[COST_STORAGE_KEY] || {};

    const totalUsd = toRoundedMoney(Number(current.totalUsd || 0) + safeCost);
    const monthStart = current.monthStart && Number.isFinite(current.monthStart) ? current.monthStart : now;
    const isMonthExpired = now - monthStart >= CONFIG.COST_WINDOW_MS;
    const monthUsd = toRoundedMoney((isMonthExpired ? 0 : Number(current.monthUsd || 0)) + safeCost);

    await chrome.storage.local.set({
      [COST_STORAGE_KEY]: {
        totalUsd,
        monthUsd,
        monthStart: isMonthExpired ? now : monthStart,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.warn('[Extension] Failed to track API cost:', error);
  }
}

async function trackLookupAnalytics(payload) {
  if (!analyticsClient) {
    return;
  }

  try {
    const result = await analyticsClient.trackLookup(payload);
    if (!result?.success) {
      console.warn('[Extension] Analytics trackLookup failed:', result?.error || 'Unknown error');
    }
  } catch (error) {
    console.warn('[Extension] Analytics trackLookup exception:', error);
  }
}

function generateEmailFromPattern(firstName, lastName, pattern, domain) {
  const first = sanitizeNamePart(firstName);
  const last = sanitizeNamePart(lastName);
  const d = normalizeDomain(domain);

  if (!first || !d) {
    return '';
  }

  const firstInitial = first[0] || '';
  const lastInitial = last[0] || '';
  const normalizedPattern = String(pattern || '')
    .trim()
    .toLowerCase();

  let localPart = '';

  switch (normalizedPattern) {
    case 'first.last':
      localPart = `${first}.${last}`;
      break;
    case 'first_last':
      localPart = `${first}_${last}`;
      break;
    case 'first-last':
      localPart = `${first}-${last}`;
      break;
    case 'firstlast':
      localPart = `${first}${last}`;
      break;
    case 'flast':
      localPart = `${firstInitial}${last}`;
      break;
    case 'f.last':
      localPart = `${firstInitial}.${last}`;
      break;
    case 'first':
      localPart = first;
      break;
    case 'last':
      localPart = last;
      break;
    case 'last.first':
      localPart = `${last}.${first}`;
      break;
    case 'firstl':
      localPart = `${first}${lastInitial}`;
      break;
    case 'lastf':
      localPart = `${last}${firstInitial}`;
      break;
    default:
      localPart = applyTemplatePattern(normalizedPattern, {
        first,
        last,
        f: firstInitial,
        l: lastInitial,
      });
      break;
  }

  localPart = sanitizeLocalPart(localPart);
  if (!localPart) return '';

  return `${localPart}@${d}`;
}

function applyTemplatePattern(template, tokens) {
  if (!template) return '';

  return template
    .replace(/first/g, tokens.first)
    .replace(/last/g, tokens.last)
    .replace(/fi/g, tokens.f)
    .replace(/li/g, tokens.l)
    .replace(/\bf\b/g, tokens.f)
    .replace(/\bl\b/g, tokens.l);
}

function sanitizeNamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function sanitizeLocalPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/[._-]{2,}/g, '.');
}

function normalizeDomain(value) {
  if (!value || typeof value !== 'string') return '';

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0];
}

function normalizeCompanyKey(companyName) {
  return String(companyName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getRegistrableDomainLabel(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return '';

  const parts = normalized.split('.').filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const secondLevelSuffixes = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);
  if (parts.length >= 3) {
    const secondLast = parts[parts.length - 2];
    if (secondLevelSuffixes.has(secondLast)) {
      return parts[parts.length - 3] || '';
    }
  }

  return parts[parts.length - 2] || parts[0] || '';
}

function extractLinkedInCompanySlug(companyPageUrl) {
  const value = String(companyPageUrl || '').trim();
  if (!value) return '';

  const match = value.match(/\/company\/([^/?#]+)/i);
  if (!match?.[1]) return '';

  return String(match[1] || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .trim();
}

function tokenizeCompanyName(companyName) {
  const stopwords = new Set([
    'inc',
    'incorporated',
    'llc',
    'ltd',
    'limited',
    'corp',
    'corporation',
    'company',
    'co',
    'plc',
    'gmbh',
    'ag',
    'sa',
    'bv',
    'pty',
    'private',
    'pvt',
    'holdings',
    'group',
    'technologies',
    'technology',
    'solutions',
    'services',
  ]);

  return String(companyName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token && token.length >= 2 && !stopwords.has(token));
}

function domainMatchesCompany(domain, companyName, companyPageUrl = '') {
  const label = getRegistrableDomainLabel(domain);
  if (!label) return false;

  const companyKey = normalizeCompanyKey(companyName);
  if (!companyKey) return true;

  if (label.includes(companyKey) || companyKey.includes(label)) {
    return true;
  }

  const companyTokens = tokenizeCompanyName(companyName);
  let tokenHits = 0;
  for (const token of companyTokens) {
    if (token.length >= 3 && (label.includes(token) || token.includes(label))) {
      tokenHits += 1;
    }
  }
  if (companyTokens.length >= 2 && tokenHits >= 2) {
    return true;
  }
  if (companyTokens.length === 1 && tokenHits >= 1) {
    return true;
  }

  const slug = extractLinkedInCompanySlug(companyPageUrl);
  if (slug) {
    const slugCompact = slug.replace(/-/g, '');
    if (slugCompact && (label.includes(slugCompact) || slugCompact.includes(label))) {
      return true;
    }

    for (const token of slug.split('-').filter(Boolean)) {
      if (token.length >= 3 && label.includes(token)) {
        return true;
      }
    }
  }

  return false;
}

function generateDomainGuessCandidates(companyName, companyPageUrl = '') {
  const out = new Set();
  const add = (value) => {
    const normalized = normalizeDomain(value);
    if (normalized && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(normalized)) {
      out.add(normalized);
    }
  };

  const slug = extractLinkedInCompanySlug(companyPageUrl);
  if (slug) {
    add(`${slug}.com`);
    add(`${slug}.in`);
    add(`${slug.replace(/-/g, '')}.com`);
    add(`${slug.replace(/-/g, '')}.in`);
  }

  const primaryGuess = guessDomainFromCompanyName(companyName);
  add(primaryGuess);

  const tokens = tokenizeCompanyName(companyName);
  if (tokens.length > 0) {
    const compact = tokens.join('');
    add(`${compact}.com`);
    add(`${compact}.in`);
    add(`${tokens[0]}.com`);
    add(`${tokens[0]}.in`);
  }

  return Array.from(out);
}

async function recoverDomainForMismatch(companyName, resolvedDomain, companyPageUrl = '') {
  const candidates = generateDomainGuessCandidates(companyName, companyPageUrl).filter(
    (candidate) => candidate && candidate !== resolvedDomain && domainMatchesCompany(candidate, companyName, companyPageUrl)
  );
  const limitedCandidates = candidates.slice(0, 6);

  for (const candidate of limitedCandidates) {
    try {
      const mx = await verifyDomainMx(candidate);
      if (mx?.hasMx) {
        return candidate;
      }
    } catch {
      // Continue trying candidates.
    }
  }

  return '';
}

function extractDomainFromEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || !value.includes('@')) return '';
  const parts = value.split('@');
  return normalizeDomain(parts[parts.length - 1] || '');
}

function mergeMxMaps(target, source) {
  if (!(target instanceof Map) || !(source instanceof Map)) return target;
  for (const [domain, hasMx] of source.entries()) {
    target.set(domain, hasMx === true);
  }
  return target;
}

async function selectMxBackedCandidate(candidates, preferredDomain = '', maxCandidates = 8, checkAll = false) {
  const safeCandidates = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (safeCandidates.length === 0) {
    return {
      candidate: null,
      domain: '',
      mxByDomain: new Map(),
    };
  }

  const max = Math.max(1, Math.min(Number(maxCandidates) || 8, safeCandidates.length));
  const searchPool = safeCandidates.slice(0, max);
  const mxByDomain = new Map();

  const hasMxForDomain = async (domain) => {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) return false;

    if (mxByDomain.has(normalizedDomain)) {
      return mxByDomain.get(normalizedDomain) === true;
    }

    try {
      const mx = await verifyDomainMx(normalizedDomain);
      const hasMx = mx?.hasMx === true;
      mxByDomain.set(normalizedDomain, hasMx);
      return hasMx;
    } catch {
      mxByDomain.set(normalizedDomain, false);
      return false;
    }
  };

  const normalizedPreferred = normalizeDomain(preferredDomain);
  if (normalizedPreferred) {
    await hasMxForDomain(normalizedPreferred);
  }

  let selected = null;
  for (const candidate of searchPool) {
    const domain = extractDomainFromEmail(candidate?.email);
    if (!domain) continue;

    const hasMx = await hasMxForDomain(domain);
    if (hasMx) {
      if (!selected) {
        selected = { candidate, domain };
      }
      if (checkAll !== true) {
        return {
          candidate,
          domain,
          mxByDomain,
        };
      }
    }
  }

  return {
    candidate: selected?.candidate || null,
    domain: selected?.domain || '',
    mxByDomain,
  };
}

function toRoundedMoney(value) {
  return Math.round(value * 10000) / 10000;
}

function createOperationId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getOperationStorageKey(operationId) {
  return `${OPERATION_STORAGE_PREFIX}${operationId}`;
}

function getOperationAlarmName(operationId) {
  return `${OPERATION_ALARM_PREFIX}${operationId}`;
}

async function startOperation(operationId, context) {
  const key = getOperationStorageKey(operationId);
  const now = Date.now();

  await chrome.storage.local.set({
    [key]: {
      status: 'running',
      stage: 'init',
      createdAt: now,
      updatedAt: now,
      context,
    },
  });

  if (chrome.alarms?.create) {
    chrome.alarms.create(getOperationAlarmName(operationId), {
      delayInMinutes: CONFIG.PIPELINE_TIMEOUT_MINUTES,
    });
  }
}

async function updateOperation(operationId, patch) {
  const key = getOperationStorageKey(operationId);
  const stored = await chrome.storage.local.get([key]);
  const current = stored?.[key] || {};
  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [key]: next });
}

async function completeOperation(operationId, status, patch) {
  const key = getOperationStorageKey(operationId);
  const stored = await chrome.storage.local.get([key]);
  const current = stored?.[key] || {};

  await chrome.storage.local.set({
    [key]: {
      ...current,
      ...patch,
      status,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    },
  });

  if (chrome.alarms?.clear) {
    try {
      await chrome.alarms.clear(getOperationAlarmName(operationId));
    } catch (error) {
      console.warn('[Extension] Failed clearing operation alarm:', error);
    }
  }
}

function timeoutError(label, timeoutMs) {
  return new Error(`${label} timed out after ${timeoutMs}ms`);
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
    }),
  ]);
}

function createPolyfillSignal(ms) {
  const timeoutMs = Number.isFinite(Number(ms)) && Number(ms) > 0 ? Number(ms) : 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timer);
    },
    { once: true }
  );
  return controller.signal;
}

function createTimeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return createPolyfillSignal(ms);
}

function buildPipelineError(code, message, options = {}) {
  const error = new Error(message || 'Pipeline error');
  error.code = String(code || 'UNKNOWN_FAILURE').toUpperCase();
  if (Number.isFinite(Number(options.status))) {
    error.status = Number(options.status);
  }
  error.isRecoverable = options.isRecoverable === true;
  return error;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response body; leave payload as null.
  }
  return { response, payload };
}

function getApiErrorCode(payload) {
  const directCode = String(payload?.code || '').trim();
  if (directCode) return directCode;
  const nestedCode = String(payload?.data?.code || '').trim();
  if (nestedCode) return nestedCode;
  return '';
}

function getApiErrorMessage(payload) {
  const directMessage = String(payload?.error || '').trim();
  if (directMessage) return directMessage;
  const nestedMessage = String(payload?.data?.error || '').trim();
  if (nestedMessage) return nestedMessage;
  return '';
}

function isCsrfInvalidPayload(payload) {
  const code = getApiErrorCode(payload).toUpperCase();
  if (code === 'CSRF_INVALID') return true;

  const message = getApiErrorMessage(payload).toLowerCase();
  return message.includes('csrf');
}

function updateCsrfTokenFromResponse(response) {
  const token = response?.headers?.get?.(CSRF_HEADER_NAME) || response?.headers?.get?.('x-csrf-token') || '';
  if (!token) return;
  csrfTokenCache = token;
  csrfTokenFetchedAt = Date.now();
}

async function refreshCsrfToken(force = false) {
  const cacheAgeMs = Date.now() - csrfTokenFetchedAt;
  if (!force && csrfTokenCache && cacheAgeMs < CSRF_TOKEN_TTL_MS) {
    return csrfTokenCache;
  }

  if (!force && csrfRefreshPromise) {
    return csrfRefreshPromise;
  }

  csrfRefreshPromise = (async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}${CSRF_REFRESH_PATH}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: createTimeoutSignal(5000),
      });
      updateCsrfTokenFromResponse(response);
      return csrfTokenCache;
    } catch (error) {
      console.warn('[Extension] Failed to refresh CSRF token:', error?.message || String(error));
      return '';
    } finally {
      csrfRefreshPromise = null;
    }
  })();

  return csrfRefreshPromise;
}

async function executeBackendPost(url, body, authToken, timeoutMs, forceCsrfRefresh = false) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const csrfToken = await refreshCsrfToken(forceCsrfRefresh);
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  const { response, payload } = await fetchJson(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
    signal: createTimeoutSignal(timeoutMs),
    cache: 'no-store',
  });
  updateCsrfTokenFromResponse(response);

  return { response, payload };
}

async function callBackendPost(path, body, authToken, timeoutMs) {
  const url = `${CONFIG.API_BASE_URL}${path}`;
  let { response, payload } = await executeBackendPost(url, body, authToken, timeoutMs, false);

  if (response.status === 403 && isCsrfInvalidPayload(payload)) {
    ({ response, payload } = await executeBackendPost(url, body, authToken, timeoutMs, true));
  }

  if (!response.ok) {
    const apiCode = getApiErrorCode(payload);
    const apiErrorMessage = getApiErrorMessage(payload);
    const normalizedApiCode = String(apiCode || '').toUpperCase();
    const normalizedMessage =
      normalizedApiCode === 'CSRF_INVALID'
        ? 'Session verification failed. Please retry or sign in again.'
        : apiErrorMessage || `Request failed: ${response.status} ${response.statusText}`;
    const error = buildPipelineError(
      normalizedApiCode || (response.status === 405 ? 'METHOD_NOT_ALLOWED' : 'NETWORK_FAILURE'),
      normalizedMessage,
      {
        status: response.status,
        isRecoverable: [404, 405, 408, 429, 500, 502, 503, 504].includes(response.status),
      }
    );
    error.payload = payload;
    throw error;
  }

  return payload || {};
}

function isMethodNotAllowedError(error) {
  return Number(error?.status) === 405;
}

function classifyApiError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || '').trim().toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const isNoMx =
    code === 'NO_MX_RECORDS' ||
    message.includes('no mx') ||
    message.includes('no mail exchange') ||
    message.includes('cannot receive email');

  if (isNoMx) {
    return {
      isRecoverable: CONFIG.HEURISTIC_FALLBACK.allowOnNoMx === true,
      code: 'NO_MX_RECORDS',
      message: error?.message || 'Domain has no mail exchange (MX) records.',
    };
  }

  if (code === 'DOMAIN_COMPANY_MISMATCH') {
    return {
      isRecoverable: false,
      code: 'DOMAIN_COMPANY_MISMATCH',
      message: 'Resolved domain does not match the detected company. Refresh profile and retry.',
    };
  }

  const isCsrf = code === 'CSRF_INVALID' || message.includes('csrf');
  if (isCsrf) {
    return {
      isRecoverable: false,
      code: 'CSRF_INVALID',
      message: 'Session verification failed. Please retry or sign in again.',
    };
  }

  const isTimeout =
    code === 'DNS_TIMEOUT' ||
    code === 'ABORT_ERR' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('abort');

  if (isTimeout) {
    return {
      isRecoverable: true,
      code: 'DNS_TIMEOUT',
      message: 'Request timed out. Please retry.',
    };
  }

  if ([404, 405, 408, 429, 500, 502, 503, 504].includes(status)) {
    return {
      isRecoverable: true,
      code: status === 405 ? 'METHOD_NOT_ALLOWED' : 'NETWORK_FAILURE',
      message: error?.message || 'Temporary API failure.',
    };
  }

  if (message.includes('request failed') || message.includes('failed to fetch') || message.includes('network')) {
    return {
      isRecoverable: true,
      code: 'NETWORK_FAILURE',
      message: error?.message || 'Network request failed.',
    };
  }

  return {
    isRecoverable: error?.isRecoverable === true,
    code: code || 'UNKNOWN_FAILURE',
    message: error?.message || 'Unexpected failure.',
  };
}

function normalizeConfidenceToUnit(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(0, Math.min(1, Number(fallback) || 0.5));
  }
  if (numeric > 1) {
    return Math.max(0, Math.min(1, numeric / 100));
  }
  return Math.max(0, Math.min(1, numeric));
}

function guessDomainFromCompanyName(companyName) {
  const normalized = String(companyName || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(
      /\b(inc|incorporated|llc|ltd|limited|corp|corporation|company|co|plc|gmbh|ag|sa|bv|pty|private|pvt|holdings|group)\b/g,
      ' '
    )
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  return `${normalized}.com`;
}

async function runLegacyGenerateEmailsPipeline(input, authToken) {
  const legacyResponse = await callBackendPost(
    '/api/v1/generate-emails',
    {
      firstName: input.firstName,
      lastName: input.lastName,
      companyName: input.company,
      role: input.role || undefined,
    },
    authToken,
    CONFIG.STAGE_TIMEOUT_MS.predictPatterns
  );

  const rawEmails = Array.isArray(legacyResponse?.emails) ? legacyResponse.emails : [];
  const candidates = rawEmails
    .map((item) => {
      const email = String(item?.email || '')
        .trim()
        .toLowerCase();
      if (!email || !email.includes('@')) return null;

      return {
        email,
        pattern: String(item?.pattern || 'unknown')
          .trim()
          .toLowerCase(),
        confidence: normalizeConfidenceToUnit(item?.confidence, 0.6),
      };
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    throw new Error('Legacy /api/v1/generate-emails did not return any email candidates.');
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  const initialTopCandidate = candidates[0];
  const domainFromPayload = normalizeDomain(legacyResponse?.domain);
  const initialTopDomain = extractDomainFromEmail(initialTopCandidate?.email || '');
  const hintedDomain = domainFromPayload || initialTopDomain;
  if (!hintedDomain) {
    throw buildPipelineError(
      'INVALID_DOMAIN',
      'Legacy /api/v1/generate-emails response did not include a valid domain.',
      { isRecoverable: false }
    );
  }

  const mxSelection = await selectMxBackedCandidate(candidates, hintedDomain, 10, true);
  if (!mxSelection?.candidate) {
    throw buildPipelineError(
      'NO_MX_RECORDS',
      'None of the legacy email candidate domains has mail exchange (MX) records.',
      { isRecoverable: CONFIG.HEURISTIC_FALLBACK.allowOnNoMx === true }
    );
  }

  const topCandidate = mxSelection.candidate;
  const domain = mxSelection.domain || extractDomainFromEmail(topCandidate.email) || hintedDomain;
  const mxByDomain = mxSelection.mxByDomain instanceof Map ? mxSelection.mxByDomain : new Map();

  const warnings = ['Legacy fallback used. MX records were revalidated client-side.'];
  if (domainFromPayload && initialTopDomain && domainFromPayload !== initialTopDomain) {
    warnings.push(
      `Legacy response domain mismatch detected: payload=${domainFromPayload}, email=${initialTopDomain}.`
    );
  }
  if (topCandidate.email !== initialTopCandidate.email) {
    warnings.push(
      `Primary legacy candidate domain ${initialTopDomain || 'unknown'} failed MX. Switched to alternative ${domain}.`
    );
  } else if (domainFromPayload && domainFromPayload !== domain) {
    warnings.push(`Legacy payload domain ${domainFromPayload} failed MX. Switched to ${domain}.`);
  }

  const primaryConfidenceFloor = 0.72;

  return {
    email: topCandidate.email,
    pattern: topCandidate.pattern || 'unknown',
    confidence: Math.max(topCandidate.confidence, primaryConfidenceFloor),
    source: 'legacy_mx_reverified',
    mxChecked: true,
    mxSelectedHasMx: mxByDomain.get(domain) === true,
    mxSelectedFromAlternative: topCandidate.email !== initialTopCandidate.email,
    alternativeEmails: candidates
      .filter((candidate) => candidate.email !== topCandidate.email)
      .slice(0, 4)
      .map((candidate) => ({
        email: candidate.email,
        pattern: candidate.pattern || 'unknown',
        confidence: candidate.confidence,
        hasMx: mxByDomain.get(extractDomainFromEmail(candidate.email)),
      })),
    cost: toRoundedMoney(0),
    domain,
    verificationResults: [],
    profileUrl: input.profileUrl || '',
    warnings,
  };
}

async function extractProfileFromTab(tabId) {
  if (!Number.isFinite(tabId)) {
    throw new Error('Missing tab id for profile extraction');
  }

  const tab = await chrome.tabs.get(tabId);
  if (!isLinkedInProfileUrl(tab?.url)) {
    throw new Error('Not on a LinkedIn profile page');
  }

  let extractorResponse = null;
  let primaryError = null;
  try {
    extractorResponse = await withTimeout(
      requestProfileExtraction(tabId, { debug: false }),
      CONFIG.STAGE_TIMEOUT_MS.extractProfile,
      'Profile extraction'
    );
  } catch (error) {
    primaryError = error;
  }

  let normalized = normalizeExtractorPayload(extractorResponse?.data || {});
  if (primaryError || !extractorResponse?.success || !hasEssentialIdentity(normalized)) {
    const readOnly = await withTimeout(
      extractProfileReadOnlyFromPage(tabId),
      CONFIG.STAGE_TIMEOUT_MS.extractProfile,
      'Read-only profile extraction'
    );
    if (readOnly?.data) {
      extractorResponse = readOnly;
      normalized = normalizeExtractorPayload(readOnly.data);
    } else if (primaryError && !extractorResponse) {
      throw new Error(primaryError?.message || 'Failed to extract LinkedIn profile data');
    }
  }

  if (!extractorResponse?.success || !extractorResponse?.data) {
    throw new Error(extractorResponse?.error || 'Failed to extract LinkedIn profile data');
  }

  // Scan for public emails in profile text (via email-scanner.js content script)
  let scannedEmails = [];
  try {
    const scanResult = await chrome.tabs.sendMessage(tabId, { type: 'SCAN_EMAILS' });
    if (Array.isArray(scanResult?.emails)) {
      scannedEmails = scanResult.emails;
    }
  } catch (_) {
    // email-scanner may not respond; non-critical
  }

  return {
    firstName: normalized.firstName || '',
    lastName: normalized.lastName || '',
    company: normalized.company || '',
    companyPageUrl: normalized.companyPageUrl || '',
    role: normalized.role || '',
    profileUrl: normalized.profileUrl || '',
    education: normalized.education || null,
    profileType: normalized.profileType || null,
    scannedEmails,
  };
}

async function normalizePipelineInput(data, senderTabId) {
  const tabId = Number.isFinite(data?.tabId) ? data.tabId : senderTabId;
  if (!Number.isFinite(tabId)) {
    throw new Error('Missing active LinkedIn tab id');
  }

  let firstName = String(data?.firstName || '').trim();
  let lastName = String(data?.lastName || '').trim();
  let company = String(data?.company || '').trim();
  let role = typeof data?.role === 'string' ? data.role.trim() : '';
  let profileUrl = typeof data?.profileUrl === 'string' ? data.profileUrl.trim() : '';
  let companyPageUrl = typeof data?.companyPageUrl === 'string' ? data.companyPageUrl.trim() : '';
  let profileType = data?.profileType || null;
  let education = data?.education || null;
  let scannedEmails = Array.isArray(data?.scannedEmails) ? data.scannedEmails : [];

  // If profile fields are missing (e.g. popup sends only tabId), extract from the tab
  if (!firstName) {
    const extracted = await extractProfileFromTab(tabId);
    firstName = extracted.firstName || firstName;
    lastName = extracted.lastName || lastName;
    company = extracted.company || company;
    companyPageUrl = extracted.companyPageUrl || companyPageUrl;
    role = extracted.role || role;
    profileUrl = extracted.profileUrl || profileUrl;
    profileType = extracted.profileType || profileType;
    education = extracted.education || education;
    scannedEmails = extracted.scannedEmails?.length ? extracted.scannedEmails : scannedEmails;
  }

  const isStudent = profileType?.type === 'STUDENT';
  const hasEducation = Boolean(education?.institution);

  if (!firstName || (!company && !(isStudent && hasEducation))) {
    throw new Error('Profile context incomplete. Refresh and confirm name + company before finding email.');
  }

  return {
    firstName,
    lastName,
    company,
    role,
    profileUrl,
    companyPageUrl,
    tabId,
    profileType,
    education,
    scannedEmails,
  };
}

async function lookupUniversityDomain(institution) {
  try {
    const url = chrome.runtime.getURL('data/university-domains.json');
    const res = await fetch(url);
    const db = await res.json();
    const key = institution.toLowerCase().trim();
    if (db[key]) return db[key];
    for (const [name, domain] of Object.entries(db)) {
      if (key.includes(name) || name.includes(key)) return domain;
    }
  } catch (e) {
    console.warn('[Extension] University domain lookup failed:', e);
  }
  return null;
}

function generateStudentEmailCandidates(firstName, lastName, domain) {
  const f = (firstName || '').toLowerCase().replace(/[^a-z]/g, '');
  const l = (lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  return [
    l ? `${f}.${l}@${domain}` : null,
    l ? `${f}${l}@${domain}` : null,
    `${f}@${domain}`,
    l ? `${f[0]}${l}@${domain}` : null,
  ].filter(Boolean);
}

async function resolveDomain(companyName, authToken, companyPageUrl = '') {
  // Prefer enhanced resolver when available.
  try {
    const enhanced = await resolveDomainEnhanced(companyName, companyPageUrl, authToken);
    if (enhanced?.domain) {
      return {
        domain: enhanced.domain,
        source: enhanced.source || 'resolve-domain-v2',
        confidence: Number(enhanced.confidence || 0.75),
      };
    }
  } catch (error) {
    if (!isMethodNotAllowedError(error) && Number(error?.status) !== 404) {
      console.warn('[Extension] /api/v1/resolve-domain-v2 failed. Falling back to /api/v1/resolve-domain.', error);
    }
  }

  return callBackendPost(
    '/api/v1/resolve-domain',
    { companyName },
    authToken,
    CONFIG.STAGE_TIMEOUT_MS.resolveDomain
  );
}

async function predictPatterns(input, authToken) {
  // Prefer richer person-level prediction API.
  if (input.firstName && input.domain) {
    try {
      const predicted = await callBackendPost(
        '/api/v1/predict-email',
        {
          firstName: input.firstName,
          lastName: input.lastName || '',
          companyName: input.company,
          companyDomain: input.domain,
          role: input.role || undefined,
          linkedinUrl: input.profileUrl || undefined,
        },
        authToken,
        CONFIG.STAGE_TIMEOUT_MS.predictPatterns
      );

      const apiPatterns = Array.isArray(predicted?.prediction?.patterns)
        ? predicted.prediction.patterns
        : [];

      const normalizedPatterns = apiPatterns
        .map((item) => ({
          template: String(item?.pattern || '').trim().toLowerCase(),
          confidence: normalizeConfidenceToUnit(item?.confidence, 0.5),
        }))
        .filter((item) => Boolean(item.template));

      if (normalizedPatterns.length > 0) {
        return {
          patterns: normalizedPatterns,
          reasoning: String(predicted?.prediction?.recommendationReasoning || ''),
          source: 'predict-email',
          costUsd: Number(predicted?.debug?.estimatedCost || 0),
        };
      }
    } catch (error) {
      if (!isMethodNotAllowedError(error) && Number(error?.status) !== 404) {
        console.warn('[Extension] /api/v1/predict-email failed. Falling back to /api/v1/predict-patterns.', error);
      }
    }
  }

  return callBackendPost(
    '/api/v1/predict-patterns',
    {
      domain: input.domain,
      company: input.company,
      role: input.role || undefined,
    },
    authToken,
    CONFIG.STAGE_TIMEOUT_MS.predictPatterns
  );
}

async function verifyEmailCandidate(email, authToken) {
  return callBackendPost(
    '/api/v1/verify-email',
    { email },
    authToken,
    CONFIG.STAGE_TIMEOUT_MS.verifyEmail
  );
}

async function verifyDomainMx(domain) {
  console.log('[MX Debug] Checking MX for domain:', domain);
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
  const { response, payload } = await fetchJson(url, {
    method: 'GET',
    signal: createTimeoutSignal(CONFIG.STAGE_TIMEOUT_MS.mxCheck),
    cache: 'no-store',
  });

  console.log('[MX Debug] DNS response status:', payload?.Status);
  console.log('[MX Debug] Answers:', JSON.stringify(payload?.Answer));

  if (!response.ok) {
    const err = buildPipelineError('NETWORK_FAILURE', `MX verification failed: ${response.status}`, {
      status: response.status,
      isRecoverable: response.status >= 500 || response.status === 408 || response.status === 429,
    });
    throw err;
  }

  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  const hasMx = answers.some((answer) => Number(answer?.type) === 15);

  console.log('[MX Debug] hasMx result:', hasMx);

  return {
    hasMx,
    answers,
    status: payload?.Status,
  };
}

function getFallbackPatterns() {
  return [
    { template: 'first.last', confidence: 0.7 },
    { template: 'flast', confidence: 0.2 },
    { template: 'first', confidence: 0.1 },
  ];
}

async function buildOfflineFallbackPayload(input, triggerMessage = '', context = {}) {
  const guessedDomain = normalizeDomain(guessDomainFromCompanyName(input.company));
  if (!guessedDomain) {
    throw new Error(triggerMessage || 'Could not infer company domain.');
  }

  const resolvedDomain = normalizeDomain(context?.resolvedDomain);
  const fallbackPatterns = getFallbackPatterns();
  const candidates = buildCandidates(
    input.firstName,
    input.lastName,
    guessedDomain,
    fallbackPatterns
  );

  if (candidates.length === 0) {
    throw new Error(triggerMessage || 'Could not generate heuristic email candidates.');
  }

  let hasMx = false;
  try {
    const mx = await verifyDomainMx(guessedDomain);
    hasMx = mx?.hasMx === true;
  } catch {
    hasMx = false;
  }

  const top = candidates[0];
  const baseConfidence = hasMx ? 0.58 : 0.38;
  const effectiveConfidence = Math.max(baseConfidence, Number(top.confidence || 0.35));
  const mismatchWarning =
    resolvedDomain && resolvedDomain !== guessedDomain
      ? ` Heuristic fallback domain ${guessedDomain} differs from resolved domain ${resolvedDomain}.`
      : '';

  return {
    email: top.email,
    pattern: top.pattern || 'first.last',
    confidence: effectiveConfidence,
    source: hasMx ? 'offline_heuristic_mx' : 'offline_heuristic',
    mxChecked: true,
    mxSelectedHasMx: hasMx,
    mxSelectedFromAlternative: false,
    alternativeEmails: candidates.slice(1, 5).map((candidate) => ({
      email: candidate.email,
      pattern: candidate.pattern || 'unknown',
      confidence: candidate.confidence,
      hasMx,
    })),
    cost: 0,
    domain: guessedDomain,
    verificationResults: [],
    profileUrl: input.profileUrl || '',
    warning:
      `Some APIs are unavailable right now. Returned heuristic candidates so you can continue outreach.${mismatchWarning}`.trim(),
  };
}

function buildCandidates(firstName, lastName, domain, patterns) {
  const candidates = [];
  const seen = new Set();

  const safePatterns = Array.isArray(patterns) ? patterns : [];
  for (const item of safePatterns) {
    const template = String(item?.template || '').trim().toLowerCase();
    if (!template) continue;

    const confidence = Number.isFinite(Number(item?.confidence))
      ? Number(item.confidence)
      : 0;

    const email = generateEmailFromPattern(firstName, lastName, template, domain);
    if (!email || seen.has(email)) continue;
    seen.add(email);

    candidates.push({
      email,
      pattern: template,
      confidence: Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence)),
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

async function getCachedPatternHit(companyName, firstName, lastName) {
  const companyKey = normalizeCompanyKey(companyName);
  if (!companyKey) return null;

  const domainCacheKey = `${DOMAIN_CACHE_PREFIX}${companyKey}`;
  const domainCacheResult = await chrome.storage.local.get([domainCacheKey]);
  const domainCacheValue = domainCacheResult?.[domainCacheKey];

  const domain = normalizeDomain(
    typeof domainCacheValue === 'string' ? domainCacheValue : domainCacheValue?.domain
  );
  if (!domain) return null;

  const patternCacheKey = `${PATTERN_CACHE_PREFIX}${domain}`;
  const patternCacheResult = await chrome.storage.local.get([patternCacheKey]);
  const patternCache = patternCacheResult?.[patternCacheKey];
  if (!patternCache) return null;

  const confidence = Number(patternCache.confidence);
  const timestamp = Number(patternCache.timestamp || 0);
  const isFresh = Number.isFinite(timestamp) && Date.now() - timestamp <= CONFIG.CACHE_DURATION_MS;

  if (!(confidence > 0.9) || !isFresh) return null;

  const email = generateEmailFromPattern(firstName, lastName, patternCache.pattern, domain);
  if (!email) return null;

  await chrome.storage.local.set({
    [patternCacheKey]: {
      ...patternCache,
      successCount: Math.max(0, Number(patternCache.successCount || 0)) + 1,
      timestamp: Date.now(),
    },
  });

  return {
    domain,
    pattern: patternCache.pattern,
    confidence: confidence,
    email,
    cacheKey: patternCacheKey,
  };
}

async function cacheResolvedDomain(companyName, domain, source, confidence) {
  const companyKey = normalizeCompanyKey(companyName);
  if (!companyKey) return;

  const key = `${DOMAIN_CACHE_PREFIX}${companyKey}`;
  await chrome.storage.local.set({
    [key]: {
      domain,
      source,
      confidence,
      timestamp: Date.now(),
    },
  });
}

async function cacheVerifiedPattern(domain, pattern, confidence) {
  const key = `${PATTERN_CACHE_PREFIX}${normalizeDomain(domain)}`;
  await chrome.storage.local.set({
    [key]: {
      pattern,
      confidence,
      verified: true,
      verifiedBy: 'abstract_api',
      successCount: 1,
      timestamp: Date.now(),
    },
  });
}

async function notifyEmailFound(tabId, resultPayload) {
  if (!Number.isFinite(tabId)) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'EMAIL_FOUND',
      data: resultPayload,
    });
  } catch (error) {
    console.warn('[Extension] Could not notify content script with EMAIL_FOUND:', error);
  }
}

async function notifyEmailFailed(tabId, errorMessage) {
  if (!Number.isFinite(tabId)) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'EMAIL_FIND_FAILED',
      error: errorMessage,
    });
  } catch (error) {
    console.warn('[Extension] Could not notify content script with EMAIL_FIND_FAILED:', error);
  }
}

// Main email finding pipeline
async function handleFindEmail(data, sender, sendResponse) {
  const operationId = createOperationId();
  const senderTabId = Number.isFinite(sender?.tab?.id) ? sender.tab.id : null;
  const lookupStartedAt = Date.now();
  let stage = 'init';
  let normalizedInput = null;

  try {
    await startOperation(operationId, {
      senderTabId,
      requestedAt: Date.now(),
    });

    console.log('[Extension] Starting email finding pipeline...', {
      operationId,
      senderTabId,
      apiBaseUrl: CONFIG.API_BASE_URL,
    });

    const input = await normalizePipelineInput(data || {}, senderTabId);
    normalizedInput = input;

    const authToken = await getAuthToken();
    if (!authToken) {
      console.warn('[Extension] No auth token in storage. Will still attempt with cookie credentials.');
    }

    const quota = await canPerformLookup();
    if (!quota?.allowed) {
      const isUnauthorized = quota?.error === 'Unauthorized';

      if (quotaManager && !isUnauthorized) {
        quotaManager.showUpgradeModal(quota?.resetDate || null);
      }

      const retryError =
        quota?.error === 'Unauthorized'
          ? 'Please sign in to use email lookups.'
          : quota?.error || 'Quota exceeded. Please upgrade your plan or wait for reset.';
      const quotaError = new Error(retryError);
      quotaError.code = isUnauthorized ? 'UNAUTHORIZED' : 'QUOTA_EXCEEDED';
      quotaError.resetDate = quota?.resetDate || null;
      throw quotaError;
    }

    // Rate-limit safety check
    const safetyCheck = globalThis.safetyGuard?.isRateLimited?.() || { limited: false };
    if (safetyCheck.limited) {
      throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMITED', retryAfterMs: safetyCheck.retryAfterMs });
    }

    let totalCost = 0;
    let domain = '';

    // STAGE 0: Cache lookup
    stage = 'cache_lookup';
    await updateOperation(operationId, { stage, profile: input });
    console.log('[Extension] STAGE 0 - Cache lookup');

    const cachedHit = await getCachedPatternHit(input.company, input.firstName, input.lastName);
    const shouldUseCachedHit =
      cachedHit &&
      domainMatchesCompany(cachedHit.domain, input.company, String(input.companyPageUrl || ''));

    if (cachedHit && !shouldUseCachedHit) {
      console.warn('[Extension] Ignoring cached email due domain/company mismatch.', {
        company: input.company,
        cachedDomain: cachedHit.domain,
      });
    }

    if (shouldUseCachedHit) {
      let cachedMxHasMx = false;
      try {
        const cachedMx = await verifyDomainMx(cachedHit.domain);
        cachedMxHasMx = cachedMx?.hasMx === true;
      } catch {
        cachedMxHasMx = false;
      }

      if (!cachedMxHasMx) {
        console.warn('[Extension] Ignoring cached email because cached domain has no MX records.', {
          company: input.company,
          cachedDomain: cachedHit.domain,
        });
      } else {
      const resultPayload = {
        email: cachedHit.email,
        pattern: cachedHit.pattern,
        confidence: Math.max(0.9, Number(cachedHit.confidence) || 0.9),
        source: 'cache_verified',
        mxChecked: true,
        mxSelectedHasMx: true,
        mxSelectedFromAlternative: false,
        alternativeEmails: [],
        cost: toRoundedMoney(totalCost),
      };

      await trackLookupAnalytics({
        profileUrl: input.profileUrl || '',
        domain: cachedHit.domain,
        email: resultPayload.email,
        pattern: resultPayload.pattern,
        confidence: resultPayload.confidence,
        source: resultPayload.source,
        cacheHit: true,
        cost: resultPayload.cost,
        duration: Date.now() - lookupStartedAt,
        success: true,
      });

      await completeOperation(operationId, 'completed', {
        stage: 'done',
        result: resultPayload,
      });

      await notifyEmailFound(input.tabId, resultPayload);

      sendResponse({
        success: true,
        type: 'EMAIL_FOUND',
        data: resultPayload,
      });
      return;
      }
    }

    // STAGE 0.5: Student routing
    if (input.profileType?.type === 'STUDENT') {
      stage = 'student_routing';
      await updateOperation(operationId, { stage });
      console.log('[Extension] STAGE 0.5 - Student routing');

      const institution = input.education?.institution;
      if (institution) {
        const univDomain = await lookupUniversityDomain(institution);
        if (univDomain) {
          const candidates = generateStudentEmailCandidates(input.firstName, input.lastName, univDomain);
          if (candidates.length > 0) {
            const result = {
              email: candidates[0],
              pattern: 'firstname.lastname@university',
              confidence: 0.65,
              source: 'student_university',
              alternativeEmails: candidates.slice(1),
              cost: 0,
              institution,
              universityDomain: univDomain,
            };
            await notifyEmailFound(input.tabId, result);
            sendResponse({ success: true, type: 'EMAIL_FOUND', data: result });
            return;
          }
        }
      }

      // Fallback: scanned public emails from profile text
      if (Array.isArray(input.scannedEmails) && input.scannedEmails.length > 0) {
        const result = {
          email: input.scannedEmails[0],
          confidence: 0.8,
          source: 'profile_scan',
          alternativeEmails: input.scannedEmails.slice(1),
          cost: 0,
        };
        await notifyEmailFound(input.tabId, result);
        sendResponse({ success: true, type: 'EMAIL_FOUND', data: result });
        return;
      }

      // No university domain match — fall through to professional pipeline
      console.log('[Extension] Student routing: no university match, falling through to professional pipeline');
    }

    // STAGE 1: Domain resolution
    stage = 'resolve_domain';
    await updateOperation(operationId, { stage });
    console.log('[Extension] STAGE 1 - Domain resolution');

    let domainResult = null;
    let companyPageUrl = String(input.companyPageUrl || '').trim();
    if (!companyPageUrl) {
      try {
        const companyExtraction = await withTimeout(
          requestCompanyPageUrlExtraction(input.tabId, input.company),
          Math.min(3500, CONFIG.STAGE_TIMEOUT_MS.extractProfile),
          'Company page URL extraction'
        );
        companyPageUrl = String(companyExtraction?.companyPageUrl || '').trim();
      } catch (error) {
        console.warn('[Extension] Company page URL extraction skipped for find-email pipeline.', {
          error: error?.message || String(error),
        });
      }
    }

    try {
      domainResult = await resolveDomain(input.company, authToken, companyPageUrl);
    } catch (error) {
      const resolutionError = classifyApiError(error);
      if (isMethodNotAllowedError(error)) {
        console.warn('[Extension] /api/v1/resolve-domain returned 405. Falling back to /api/v1/generate-emails.', error);

        try {
          stage = 'legacy_generate_emails';
          await updateOperation(operationId, {
            stage,
            warning: 'Modern API unavailable (405). Used legacy generate-emails fallback.',
          });

          const legacyPayload = await runLegacyGenerateEmailsPipeline(input, authToken);

          await trackLookupAnalytics({
            profileUrl: legacyPayload.profileUrl,
            domain: legacyPayload.domain || '',
            email: legacyPayload.email,
            pattern: legacyPayload.pattern,
            confidence: legacyPayload.confidence,
            source: legacyPayload.source,
            cacheHit: false,
            cost: legacyPayload.cost,
            duration: Date.now() - lookupStartedAt,
            success: true,
          });

          await completeOperation(operationId, 'completed', {
            stage: 'done',
            result: legacyPayload,
          });

          await notifyEmailFound(input.tabId, legacyPayload);

          sendResponse({
            success: true,
            type: 'EMAIL_FOUND',
            data: legacyPayload,
          });
          return;
        } catch (legacyError) {
          const legacyClassification = classifyApiError(legacyError);
          if (!legacyClassification.isRecoverable) {
            throw legacyError;
          }
          console.warn(
            '[Extension] Legacy /api/v1/generate-emails fallback failed. Using local heuristic domain fallback.',
            legacyError
          );
        }
      }

      if (!resolutionError.isRecoverable) {
        throw error;
      }

      if (CONFIG.HEURISTIC_FALLBACK.enabled !== true) {
        throw error;
      }

      const guessedDomain = guessDomainFromCompanyName(input.company);
      if (!guessedDomain) {
        throw error;
      }

      domainResult = {
        domain: guessedDomain,
        source: 'local_heuristic',
        confidence: 0.4,
        warnings: [
          'Heuristic fallback enabled due recoverable domain-resolution failure.',
          `Original error: ${resolutionError.code}`,
        ],
      };
    }

    domain = normalizeDomain(domainResult?.domain);
    const domainWarnings = Array.isArray(domainResult?.warnings)
      ? domainResult.warnings.filter((warning) => typeof warning === 'string' && warning.trim().length > 0)
      : [];

    if (!domain) {
      throw new Error('Domain resolution failed.');
    }

    if (!domainMatchesCompany(domain, input.company, companyPageUrl)) {
      const recoveredDomain = await recoverDomainForMismatch(input.company, domain, companyPageUrl);
      if (recoveredDomain) {
        domainWarnings.push(
          `Resolved domain ${domain} mismatched company ${input.company}. Recovered using safer domain ${recoveredDomain}.`
        );
        domain = recoveredDomain;
      } else {
        throw buildPipelineError(
          'DOMAIN_COMPANY_MISMATCH',
          `Resolved domain ${domain} does not match company ${input.company}.`,
          { isRecoverable: false }
        );
      }
    }

    await cacheResolvedDomain(
      input.company,
      domain,
      domainResult?.source || 'unknown',
      Number(domainResult?.confidence || 0)
    );

    // STAGE 2: LLM pattern prediction
    stage = 'predict_patterns';
    await updateOperation(operationId, { stage, domain });
    console.log('[Extension] STAGE 2 - LLM pattern prediction');

    let predictedPatterns = [];
    try {
      const prediction = await predictPatterns(
        {
          firstName: input.firstName,
          lastName: input.lastName,
          domain,
          company: input.company,
          role: input.role || '',
          profileUrl: input.profileUrl || '',
        },
        authToken
      );

      predictedPatterns = Array.isArray(prediction?.patterns) ? prediction.patterns : [];
      const predictionCost = Number(prediction?.costUsd);
      const effectivePredictionCost = Number.isFinite(predictionCost)
        ? predictionCost
        : CONFIG.COSTS.predictPatternsFallback;

      totalCost = toRoundedMoney(totalCost + effectivePredictionCost);
      await trackApiCost(effectivePredictionCost);
    } catch (error) {
      console.warn('[Extension] Pattern prediction failed. Using fallback patterns.', error);
      predictedPatterns = getFallbackPatterns();
      totalCost = toRoundedMoney(totalCost + CONFIG.COSTS.predictPatternsFallback);
      await trackApiCost(CONFIG.COSTS.predictPatternsFallback);
    }

    // STAGE 3: Email generation
    stage = 'generate_candidates';
    await updateOperation(operationId, { stage });
    console.log('[Extension] STAGE 3 - Email generation');

    let candidates = buildCandidates(
      input.firstName,
      input.lastName,
      domain,
      predictedPatterns
    );

    if (candidates.length === 0) {
      throw new Error('Failed to generate email candidates from predicted patterns.');
    }

    // STAGE 4: MX verification
    stage = 'mx_verification';
    await updateOperation(operationId, { stage });
    console.log('[Extension] STAGE 4 - MX verification');

    const mxByDomain = new Map();
    const mxResult = await verifyDomainMx(domain);
    mxByDomain.set(domain, mxResult?.hasMx === true);
    if (!mxResult?.hasMx) {
      const recoveredDomain = await recoverDomainForMismatch(input.company, domain, companyPageUrl);
      if (recoveredDomain) {
        domainWarnings.push(
          `Resolved domain ${domain} has no MX records. Switched to alternative domain ${recoveredDomain}.`
        );
        domain = recoveredDomain;
        mxByDomain.set(recoveredDomain, true);
        candidates = buildCandidates(
          input.firstName,
          input.lastName,
          domain,
          predictedPatterns
        );
        if (candidates.length === 0) {
          throw new Error('Failed to generate email candidates from predicted patterns.');
        }
      } else {
        throw buildPipelineError(
          'NO_MX_RECORDS',
          `Domain ${domain} has no mail exchange (MX) records.`,
          { isRecoverable: CONFIG.HEURISTIC_FALLBACK.allowOnNoMx === true }
        );
      }
    }

    // STAGE 5: Abstract verification
    stage = 'abstract_verification';
    await updateOperation(operationId, { stage });
    console.log('[Extension] STAGE 5 - Abstract verification');

    const verificationOrder = [];
    if (candidates[0]) verificationOrder.push(candidates[0]);
    if (candidates[1]) verificationOrder.push(candidates[1]);
    if (candidates[2]) verificationOrder.push(candidates[2]);

    let selected = null;
    const verificationResults = [];

    for (let i = 0; i < verificationOrder.length; i += 1) {
      const candidate = verificationOrder[i];

      try {
        const verification = await verifyEmailCandidate(candidate.email, authToken);
        verificationResults.push({
          email: candidate.email,
          deliverable: verification?.deliverable === true,
          details: verification,
        });

        totalCost = toRoundedMoney(totalCost + CONFIG.COSTS.verifyEmail);
        await trackApiCost(CONFIG.COSTS.verifyEmail);

        if (verification?.deliverable === true) {
          selected = {
            ...candidate,
            source: 'abstract_verified',
            confidence: Math.max(candidate.confidence || 0, 0.98),
          };
          break;
        }
      } catch (error) {
        console.warn('[Extension] verify-email stage failed for candidate:', candidate.email, error);
      }
    }

    // STAGE 6: Cache result
    stage = 'cache_result';
    await updateOperation(operationId, { stage });
    console.log('[Extension] STAGE 6 - Cache result');

    const mxSelection = await selectMxBackedCandidate(candidates, domain, 8, true);
    mergeMxMaps(mxByDomain, mxSelection.mxByDomain);

    let finalResult = selected;
    if (!finalResult) {
      if (!mxSelection?.candidate) {
        throw buildPipelineError(
          'NO_MX_RECORDS',
          'None of the generated email candidate domains has mail exchange (MX) records.',
          { isRecoverable: CONFIG.HEURISTIC_FALLBACK.allowOnNoMx === true }
        );
      }

      finalResult = {
        ...mxSelection.candidate,
        source: 'llm_best_guess',
      };

      const primaryCandidate = candidates[0];
      if (primaryCandidate && primaryCandidate.email !== finalResult.email) {
        const primaryDomain = extractDomainFromEmail(primaryCandidate.email) || domain;
        const selectedDomain = extractDomainFromEmail(finalResult.email) || domain;
        domainWarnings.push(
          `Primary AI best guess domain ${primaryDomain} failed MX. Switched to alternative ${selectedDomain}.`
        );
      }
    } else {
      const verifiedDomain = extractDomainFromEmail(finalResult.email) || domain;
      await cacheVerifiedPattern(verifiedDomain, finalResult.pattern, finalResult.confidence);
    }

    const finalDomain = extractDomainFromEmail(finalResult.email) || domain;
    if (!mxByDomain.has(finalDomain)) {
      try {
        const finalMx = await verifyDomainMx(finalDomain);
        mxByDomain.set(finalDomain, finalMx?.hasMx === true);
      } catch {
        mxByDomain.set(finalDomain, false);
      }
    }
    const mxSelectedHasMx = mxByDomain.get(finalDomain) === true;

    const alternativeEmails = candidates
      .filter((c) => c.email !== finalResult.email)
      .map((c) => ({
        email: c.email,
        pattern: c.pattern,
        confidence: c.confidence,
        hasMx: mxByDomain.get(extractDomainFromEmail(c.email)),
      }));

    const payload = {
      email: finalResult.email,
      pattern: finalResult.pattern,
      confidence: Number(finalResult.confidence || 0),
      source: finalResult.source || 'llm_best_guess',
      mxChecked: true,
      mxSelectedHasMx,
      mxSelectedFromAlternative:
        finalResult.source === 'llm_best_guess' &&
        Boolean(candidates[0]?.email) &&
        candidates[0].email !== finalResult.email,
      alternativeEmails,
      cost: toRoundedMoney(totalCost),
      domain: finalDomain,
      verificationResults,
      profileUrl: input.profileUrl || '',
      warnings: domainWarnings,
    };

    await trackLookupAnalytics({
      profileUrl: payload.profileUrl,
      domain: payload.domain,
      email: payload.email,
      pattern: payload.pattern,
      confidence: payload.confidence,
      source: payload.source,
      cacheHit: payload.source === 'cache_verified',
      cost: payload.cost,
      duration: Date.now() - lookupStartedAt,
      success: true,
    });

    // STAGE 7: Return result
    stage = 'return_result';
    await updateOperation(operationId, {
      stage,
      result: payload,
    });
    console.log('[Extension] STAGE 7 - Return result');

    await completeOperation(operationId, 'completed', {
      stage: 'done',
      result: payload,
    });

    await notifyEmailFound(input.tabId, payload);

    sendResponse({
      success: true,
      type: 'EMAIL_FOUND',
      data: payload,
    });
  } catch (error) {
    const classified = classifyApiError(error);
    const message = error?.message || classified.message || 'Unknown error';
    const errorCode = typeof error?.code === 'string' ? error.code : classified.code || null;
    const resetDate = typeof error?.resetDate === 'string' ? error.resetDate : null;

    if (
      normalizedInput &&
      errorCode !== 'QUOTA_EXCEEDED' &&
      errorCode !== 'UNAUTHORIZED' &&
      classified.isRecoverable &&
      CONFIG.HEURISTIC_FALLBACK.enabled === true
    ) {
      try {
        const fallbackPayload = await buildOfflineFallbackPayload(normalizedInput, message, {
          resolvedDomain: domain,
        });
        fallbackPayload.cost = toRoundedMoney(Number(fallbackPayload.cost || 0));

        await trackLookupAnalytics({
          profileUrl: fallbackPayload.profileUrl,
          domain: fallbackPayload.domain || '',
          email: fallbackPayload.email,
          pattern: fallbackPayload.pattern,
          confidence: fallbackPayload.confidence,
          source: fallbackPayload.source,
          cacheHit: false,
          cost: fallbackPayload.cost,
          duration: Date.now() - lookupStartedAt,
          success: true,
        });

        await completeOperation(operationId, 'completed', {
          stage: 'offline_fallback',
          warning: fallbackPayload.warning,
          result: fallbackPayload,
        });

        await notifyEmailFound(normalizedInput.tabId, fallbackPayload);

        sendResponse({
          success: true,
          type: 'EMAIL_FOUND',
          data: fallbackPayload,
        });
        return;
      } catch (fallbackError) {
        console.warn('[Extension] Offline heuristic fallback failed:', fallbackError);
      }
    }

    console.error('[Extension] Error in handleFindEmail pipeline:', {
      operationId,
      stage,
      errorCode,
      resetDate,
      message,
      error,
    });
    reportExtensionError(error, {
      pipeline: 'find-email',
      operationId,
      stage,
      errorCode,
      resetDate,
      tabId: Number.isFinite(data?.tabId) ? data.tabId : null,
      profileUrl: normalizedInput?.profileUrl || null,
      company: normalizedInput?.company || null,
    });

    await completeOperation(operationId, 'failed', {
      stage,
      error: message,
    });

    const tabId = Number.isFinite(data?.tabId)
      ? data.tabId
      : Number.isFinite(sender?.tab?.id)
      ? sender.tab.id
      : null;
    await notifyEmailFailed(tabId, message);

    sendResponse({
      success: false,
      error: message,
      stage,
      code: errorCode,
      resetDate,
      type: 'EMAIL_FIND_FAILED',
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('[Extension] Email Finder service worker initialized');
