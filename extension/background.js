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
  API_BASE_URL: 'http://localhost:3000', // Change to production URL later
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
const quotaManager = globalThis?.quotaManager || null;
const analyticsClient = globalThis?.analytics || null;

if (quotaManager?.config) {
  quotaManager.config.apiBaseUrl = CONFIG.API_BASE_URL;
}

if (analyticsClient?.config) {
  analyticsClient.config.apiBaseUrl = CONFIG.API_BASE_URL;
}

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  console.log('[Extension] Received message:', message.type);

  if (message.type === 'FIND_EMAIL') {
    handleFindEmail(message.data, _sender, sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_AUTH_TOKEN') {
    getAuthToken().then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_QUOTA') {
    checkQuota().then(sendResponse);
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

  chrome.alarms.create(getOperationAlarmName(operationId), {
    delayInMinutes: CONFIG.PIPELINE_TIMEOUT_MINUTES,
  });
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

  try {
    await chrome.alarms.clear(getOperationAlarmName(operationId));
  } catch (error) {
    console.warn('[Extension] Failed clearing operation alarm:', error);
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

async function extractProfileFromTab(tabId) {
  if (!Number.isFinite(tabId)) {
    throw new Error('Missing tab id for profile extraction');
  }

  const extractorResponse = await withTimeout(
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PROFILE' }),
    CONFIG.STAGE_TIMEOUT_MS.extractProfile,
    'Profile extraction'
  );

  if (!extractorResponse?.success || !extractorResponse?.data) {
    throw new Error(extractorResponse?.error || 'Failed to extract LinkedIn profile data');
  }

  const extracted = extractorResponse.data;

  return {
    firstName: extracted?.name?.firstName || '',
    lastName: extracted?.name?.lastName || '',
    company: extracted?.company?.name || '',
    role: extracted?.role?.title || '',
    profileUrl: extracted?.profileUrl || '',
  };
}

async function normalizePipelineInput(data, senderTabId) {
  const hasDirectData =
    data &&
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    typeof data.company === 'string';

  if (hasDirectData) {
    return {
      firstName: String(data.firstName).trim(),
      lastName: String(data.lastName).trim(),
      company: String(data.company).trim(),
      role: typeof data.role === 'string' ? data.role.trim() : '',
      profileUrl: typeof data.profileUrl === 'string' ? data.profileUrl.trim() : '',
      tabId: Number.isFinite(senderTabId) ? senderTabId : Number.isFinite(data.tabId) ? data.tabId : null,
    };
  }

  const tabId = Number.isFinite(data?.tabId) ? data.tabId : senderTabId;
  if (!Number.isFinite(tabId)) {
    throw new Error('Missing profile data and active LinkedIn tab id');
  }

  const extracted = await extractProfileFromTab(tabId);
  return {
    ...extracted,
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
    if (!input.firstName || !input.lastName || !input.company) {
      throw new Error('Insufficient profile data. Missing first name, last name, or company.');
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

    const domainResult = await resolveDomain(input.company, authToken);
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
