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

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://www.useellyn.com',
  CACHE_DURATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  COST_WINDOW_MS: 30 * 24 * 60 * 60 * 1000, // 30 days rolling cost window
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

const AUTH_STORAGE_KEYS = ['isAuthenticated', 'user', 'auth_token'];
const COST_STORAGE_KEY = 'api_cost_tracker';
const OPERATION_STORAGE_PREFIX = 'find_email_op_';
const OPERATION_ALARM_PREFIX = 'find-email-timeout-';
const DOMAIN_CACHE_PREFIX = 'company_domain_';
const PATTERN_CACHE_PREFIX = 'pattern_';
const CONTENT_SCRIPT_FILE = 'content/linkedin-extractor.js';
const quotaManager = globalThis?.quotaManager || null;
const analyticsClient = globalThis?.analytics || null;

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

function setAuthenticatedState(payload, sendResponse) {
  const token = extractAuthToken(payload);
  const nextState = {
    isAuthenticated: true,
    user: payload || null,
  };

  if (token) {
    nextState.auth_token = token;
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

  if (message.type === 'AUTH_SUCCESS') {
    setAuthenticatedState(message.payload || null, sendResponse);
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

  return quotaManager.getStatus();
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

  return quotaManager.canPerformLookup();
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
  const role = String(extracted?.role?.title || '').trim();
  const profileUrl = String(extracted?.profileUrl || '').trim();

  const normalized = {
    firstName,
    lastName,
    fullName: String(`${firstName} ${lastName}`).trim() || fullName,
    company,
    role,
    profileUrl,
  };

  console.log('[Background] Normalized payload:', normalized);
  return normalized;
}

function hasEssentialIdentity(payload) {
  return Boolean(String(payload?.fullName || '').trim()) && Boolean(String(payload?.company || '').trim());
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

      const parseCompanyFromHeadline = (headline) => {
        const text = clean(headline);
        if (!text) return '';

        const patterns = [
          /\b(?:at|@)\s+([^|,·•]+?)(?:\s*(?:\||,|·|•|$))/i,
          /^(?:co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|consultant)\s*,\s*([^|,·•]+?)(?:\s*(?:\||·|•|$))/i,
          /^[^|,·•]+,\s*([^|,·•]+?)(?:\s*(?:\||·|•|$))/i,
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (!match?.[1]) continue;
          const candidate = clean(match[1]);
          if (candidate) return candidate;
        }

        return '';
      };

      const parseRoleFromHeadline = (headline) => {
        const text = clean(headline);
        if (!text) return '';
        const match = text.match(/^(.+?)(?:\s+(?:at|@)\s+|\s*,\s*[^,|]+|\s*\||$)/i);
        return clean(match?.[1] || '');
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
      let role = parseRoleFromHeadline(headline);

      if (!company) {
        const companyLink = document.querySelector(
          [
            'main section:first-of-type a[href*="/company/"]',
            'section#experience a[href*="/company/"]',
            'section[id*="experience"] a[href*="/company/"]',
          ].join(', ')
        );
        const fromText = clean(companyLink?.textContent || '');
        company = fromText || parseCompanyFromUrl(companyLink?.href || '');
      }

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
            if (line.length > 1 && line.length <= 100 && !/\b(full[- ]?time|part[- ]?time|self[- ]?employed)\b/i.test(line)) {
              company = line;
              break;
            }
          }
        }
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

async function callBackendPost(path, body, authToken, timeoutMs) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const url = `${CONFIG.API_BASE_URL}${path}`;
  const { response, payload } = await fetchJson(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload || {};
}

function isMethodNotAllowedError(error) {
  return Number(error?.status) === 405;
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
    '/api/generate-emails',
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
    throw new Error('Legacy /api/generate-emails did not return any email candidates.');
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  const domainVerified =
    legacyResponse?.verification?.verified === true || legacyResponse?.verification?.hasMxRecords === true;
  const topCandidate = candidates[0];
  const domainFromPayload = normalizeDomain(legacyResponse?.domain);
  const domainFromEmail = normalizeDomain(topCandidate.email.split('@')[1] || '');
  const domain = domainFromPayload || domainFromEmail;
  const primaryConfidenceFloor = domainVerified ? 0.85 : 0.65;

  return {
    email: topCandidate.email,
    pattern: topCandidate.pattern || 'unknown',
    confidence: Math.max(topCandidate.confidence, primaryConfidenceFloor),
    source: domainVerified ? 'legacy_verified' : 'legacy_generate_emails',
    alternativeEmails: candidates.slice(1, 5).map((candidate) => ({
      email: candidate.email,
      pattern: candidate.pattern || 'unknown',
      confidence: candidate.confidence,
    })),
    cost: toRoundedMoney(0),
    domain,
    verificationResults: [],
    profileUrl: input.profileUrl || '',
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

  return {
    firstName: normalized.firstName || '',
    lastName: normalized.lastName || '',
    company: normalized.company || '',
    role: normalized.role || '',
    profileUrl: normalized.profileUrl || '',
  };
}

async function normalizePipelineInput(data, senderTabId) {
  const tabId = Number.isFinite(data?.tabId) ? data.tabId : senderTabId;
  if (!Number.isFinite(tabId)) {
    throw new Error('Missing active LinkedIn tab id');
  }

  const firstName = String(data?.firstName || '').trim();
  const lastName = String(data?.lastName || '').trim();
  const company = String(data?.company || '').trim();
  const role = typeof data?.role === 'string' ? data.role.trim() : '';
  const profileUrl = typeof data?.profileUrl === 'string' ? data.profileUrl.trim() : '';

  if (!firstName || !company) {
    throw new Error('Profile context incomplete. Refresh and confirm name + company before finding email.');
  }

  return {
    firstName,
    lastName,
    company,
    role,
    profileUrl,
    tabId,
  };
}

async function resolveDomain(companyName, authToken) {
  return callBackendPost(
    '/api/resolve-domain',
    { companyName },
    authToken,
    CONFIG.STAGE_TIMEOUT_MS.resolveDomain
  );
}

async function predictPatterns(input, authToken) {
  return callBackendPost(
    '/api/predict-patterns',
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
    '/api/verify-email',
    { email },
    authToken,
    CONFIG.STAGE_TIMEOUT_MS.verifyEmail
  );
}

async function verifyDomainMx(domain) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
  const { response, payload } = await fetchJson(url, {
    method: 'GET',
    signal: AbortSignal.timeout(CONFIG.STAGE_TIMEOUT_MS.mxCheck),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`MX verification failed: ${response.status}`);
  }

  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  const hasMx = answers.some((answer) => Number(answer?.type) === 15);

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
    if (!input.firstName || !input.company) {
      throw new Error('Insufficient profile data. Missing first name or company.');
    }

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

    let totalCost = 0;
    let domain = '';

    // STAGE 0: Cache lookup
    stage = 'cache_lookup';
    await updateOperation(operationId, { stage, profile: input });
    console.log('[Extension] STAGE 0 - Cache lookup');

    const cachedHit = await getCachedPatternHit(input.company, input.firstName, input.lastName);
    if (cachedHit) {
      const resultPayload = {
        email: cachedHit.email,
        pattern: cachedHit.pattern,
        confidence: Math.max(0.9, Number(cachedHit.confidence) || 0.9),
        source: 'cache_verified',
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

    // STAGE 1: Domain resolution
    stage = 'resolve_domain';
    await updateOperation(operationId, { stage });
    console.log('[Extension] STAGE 1 - Domain resolution');

    let domainResult = null;
    try {
      domainResult = await resolveDomain(input.company, authToken);
    } catch (error) {
      if (isMethodNotAllowedError(error)) {
        console.warn('[Extension] /api/resolve-domain returned 405. Falling back to /api/generate-emails.', error);

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
          console.warn(
            '[Extension] Legacy /api/generate-emails fallback failed. Using local heuristic domain fallback.',
            legacyError
          );
        }
      }

      const guessedDomain = guessDomainFromCompanyName(input.company);
      if (!guessedDomain) {
        throw error;
      }

      domainResult = {
        domain: guessedDomain,
        source: 'local_heuristic',
        confidence: 0.4,
      };
    }

    domain = normalizeDomain(domainResult?.domain);

    if (!domain) {
      throw new Error('Domain resolution failed.');
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
          domain,
          company: input.company,
          role: input.role || '',
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

    const candidates = buildCandidates(
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

    const mxResult = await verifyDomainMx(domain);
    if (!mxResult?.hasMx) {
      throw new Error(`Domain ${domain} has no MX records. Cannot receive email.`);
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

    let finalResult = selected;
    if (!finalResult) {
      finalResult = {
        ...candidates[0],
        source: 'llm_best_guess',
      };
    } else {
      await cacheVerifiedPattern(domain, finalResult.pattern, finalResult.confidence);
    }

    const alternativeEmails = candidates
      .filter((c) => c.email !== finalResult.email)
      .map((c) => ({
        email: c.email,
        pattern: c.pattern,
        confidence: c.confidence,
      }));

    const payload = {
      email: finalResult.email,
      pattern: finalResult.pattern,
      confidence: Number(finalResult.confidence || 0),
      source: finalResult.source || 'llm_best_guess',
      alternativeEmails,
      cost: toRoundedMoney(totalCost),
      domain,
      verificationResults,
      profileUrl: input.profileUrl || '',
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
    const message = error?.message || 'Unknown error';
    const errorCode = typeof error?.code === 'string' ? error.code : null;
    const resetDate = typeof error?.resetDate === 'string' ? error.resetDate : null;
    console.error('[Extension] Error in handleFindEmail pipeline:', {
      operationId,
      stage,
      errorCode,
      resetDate,
      message,
      error,
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
