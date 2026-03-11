// Service Worker for email finding orchestration + auth bridge
console.log('[Extension] Service worker loaded');

function loadOptionalScript(path, label) {
  try {
    importScripts(path);
  } catch (error) {
    console.warn(`[Extension] Failed to load ${label}:`, error);
  }
}

loadOptionalScript('lib/vendor/supabase.js', 'Supabase UMD library');
loadOptionalScript('public-config.js', 'extension public config');
loadOptionalScript('lib/supabase.js', 'Supabase extension auth bridge');
loadOptionalScript('lib/sync.js', 'Supabase contact sync bridge');
loadOptionalScript('lib/syncQueue.js', 'Supabase contact sync queue bridge');
loadOptionalScript('utils/quota.js', 'quota utility script');
loadOptionalScript('utils/analytics.js', 'analytics utility script');
loadOptionalScript('utils/saved-templates.js', 'saved templates utility script');
loadOptionalScript('background/email-predictor.js', 'AI email predictor utility script');
loadOptionalScript('utils/safety.js', 'safety utility script');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://www.useellyn.com',
  WEBAPP_URL: 'https://www.useellyn.com',
  CACHE_DURATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  COST_WINDOW_MS: 30 * 24 * 60 * 60 * 1000, // 30 days rolling cost window
  DISABLE_CREDIT_LIMITS: false,
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

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'https://useellyn.com',
  'https://www.useellyn.com',
  'https://ellyn.app',
  'https://www.ellyn.app',
  'https://app.ellyn.app',
  'https://app.ellyn.ai',
  'https://www.app.ellyn.ai',
]);

const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_REFRESH_PATH = '/api/v1';
const CSRF_TOKEN_TTL_MS = 5 * 60 * 1000;
const BACKEND_BASE_URL_CACHE_TTL_MS = 15 * 1000;
const BASE_URL_OVERRIDE_KEY = 'ellyn_base_url_override';
const LOCAL_DEV_ORIGINS = ['http://localhost:3000'];

const SUPABASE_AUTH_BRIDGE_KEY = 'ellynSupabaseAuthBridge';
const CONTACT_SYNC_BRIDGE_KEY = 'ellynContactSync';
const CONTACT_SYNC_QUEUE_BRIDGE_KEY = 'ellynContactSyncQueue';
const AUTH_SOURCE_ORIGIN_KEY = 'ellyn_auth_origin';
const SUPABASE_SESSION_STORAGE_KEY = 'supabase_session';
const AUTH_STORAGE_KEYS = [
  'isAuthenticated',
  'user',
  'auth_token',
  AUTH_SOURCE_ORIGIN_KEY,
  SUPABASE_SESSION_STORAGE_KEY,
];
const COST_STORAGE_KEY = 'api_cost_tracker';
const OPERATION_STORAGE_PREFIX = 'find_email_op_';
const OPERATION_ALARM_PREFIX = 'find-email-timeout-';
const DOMAIN_CACHE_PREFIX = 'company_domain_';
const PATTERN_CACHE_PREFIX = 'pattern_';
const MAX_SMTP_ATTEMPTS_PER_CANDIDATE = 2;
// Allow one pull for domain enrichment + one pull for LLM ranking.
const MAX_EXTERNAL_API_PULLS_PER_LOOKUP = 2;
const MAX_LLM_SHORTLIST_FOR_SMTP = 2;
const CONTENT_SCRIPT_FILE = 'content/linkedin-extractor.js';
const quotaClient = globalThis?.quotaManager || null;
const analyticsClient = globalThis?.analytics || null;
let csrfTokenCache = '';
let csrfTokenFetchedAt = 0;
let csrfRefreshPromise = null;
let csrfTokenBaseUrl = '';
let backendBaseUrlCache = '';
let backendBaseUrlCachedAt = 0;
let abstractPreferredBaseUrl = '';
let smtpProbeHealthChecked = false;
let smtpProbeHealthCheckPromise = null;

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

function getContactSyncBridge() {
  const bridge = globalThis?.[CONTACT_SYNC_BRIDGE_KEY];
  if (!bridge || typeof bridge !== 'object') return null;
  return bridge;
}

function getContactSyncQueueBridge() {
  const bridge = globalThis?.[CONTACT_SYNC_QUEUE_BRIDGE_KEY];
  if (!bridge || typeof bridge !== 'object') return null;
  return bridge;
}

async function triggerExtensionHeartbeat() {
  const syncBridge = getContactSyncBridge();
  if (!syncBridge || typeof syncBridge.sendHeartbeat !== 'function') {
    return;
  }
  try {
    await syncBridge.sendHeartbeat();
  } catch (error) {
    console.warn('[Extension] Failed to record extension heartbeat:', error);
  }
}

async function initializeContactSyncQueue() {
  const queueBridge = getContactSyncQueueBridge();
  if (!queueBridge || typeof queueBridge.initialize !== 'function') {
    return;
  }
  try {
    await queueBridge.initialize();
  } catch (error) {
    console.warn('[Extension] Failed to initialize contact sync queue:', error);
  }
}

async function runSmtpProbeHealthCheck() {
  if (smtpProbeHealthChecked) {
    return null;
  }

  if (smtpProbeHealthCheckPromise) {
    return smtpProbeHealthCheckPromise;
  }

  smtpProbeHealthCheckPromise = (async () => {
    let result = { ok: false, smtpConfigured: false };

    try {
      const authToken = await getAuthToken();
      const probeResponse = await callAbstractVerifyWithFallback(
        'healthcheck@example.com',
        authToken,
        5000,
        { operationId: 'health-check' }
      );
      const payload = probeResponse?.payload || null;
      const reason = String(payload?.reason || '').trim().toLowerCase();
      const configured =
        !!payload &&
        typeof payload === 'object' &&
        reason !== 'not_configured' &&
        payload.error !== 'Unauthorized';
      result = {
        ok: reason !== 'request_failed',
        smtpConfigured: configured,
        baseUsed: probeResponse?.baseUsed || '',
        attemptedBases: Array.isArray(probeResponse?.attempts)
          ? probeResponse.attempts.map((entry) => entry.base).filter(Boolean)
          : [],
      };
    } catch (error) {
      result = {
        ok: false,
        smtpConfigured: false,
        error: error?.message || String(error),
      };
    } finally {
      console.log('[ELLYN] SMTP probe service reachable:', result);
      console.log('[ELLYN] SMTP configured:', result.smtpConfigured);
      smtpProbeHealthChecked = true;
      smtpProbeHealthCheckPromise = null;
    }

    return result;
  })();

  return smtpProbeHealthCheckPromise;
}

if (quotaClient?.config) {
  quotaClient.config.apiBaseUrl = CONFIG.API_BASE_URL;
}

if (analyticsClient?.config) {
  analyticsClient.config.apiBaseUrl = CONFIG.API_BASE_URL;
}

void configureSidePanelBehavior();
void initializeContactSyncQueue();

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanelBehavior();
  void initializeContactSyncQueue();
  void runSmtpProbeHealthCheck();
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

function extractRefreshToken(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.refresh_token === 'string') return payload.refresh_token;
  return null;
}

function getSupabaseAuthBridge() {
  const bridge = globalThis?.[SUPABASE_AUTH_BRIDGE_KEY];
  if (!bridge || typeof bridge !== 'object') {
    return null;
  }
  return bridge;
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

async function findLocalBackendOriginFromOpenTabs() {
  if (!chrome?.tabs?.query) {
    return '';
  }

  try {
    const tabs = await chrome.tabs.query({});
    for (const origin of LOCAL_DEV_ORIGINS) {
      const originWithSlash = `${origin}/`;
      const match = tabs.some((tab) => {
        const tabUrl = String(tab?.url || '');
        return tabUrl === origin || tabUrl.startsWith(originWithSlash);
      });
      if (match) {
        return origin;
      }
    }
  } catch {
    // Ignore tab-query failures and fall back to defaults.
  }

  return '';
}

async function getBackendBaseUrl() {
  const cacheAgeMs = Date.now() - backendBaseUrlCachedAt;
  if (backendBaseUrlCache && cacheAgeMs < BACKEND_BASE_URL_CACHE_TTL_MS) {
    return backendBaseUrlCache;
  }

  let overrideOrigin = '';
  let sourceOrigin = '';
  try {
    const stored = await chrome.storage.local.get([BASE_URL_OVERRIDE_KEY, AUTH_SOURCE_ORIGIN_KEY]);
    overrideOrigin = normalizeOrigin(stored?.[BASE_URL_OVERRIDE_KEY]);
    sourceOrigin = normalizeOrigin(stored?.[AUTH_SOURCE_ORIGIN_KEY]);
  } catch {
    overrideOrigin = '';
    sourceOrigin = '';
  }

  const localOrigin = await findLocalBackendOriginFromOpenTabs();
  const fallback = normalizeOrigin(CONFIG.API_BASE_URL) || String(CONFIG.API_BASE_URL || '').trim();
  // Prefer localhost when available so extension + local backend stay aligned in dev.
  backendBaseUrlCache = String(localOrigin || overrideOrigin || sourceOrigin || fallback || '')
    .trim()
    .replace(/\/+$/, '');
  backendBaseUrlCachedAt = Date.now();

  return backendBaseUrlCache;
}

function extractUserId(user) {
  if (!user || typeof user !== 'object') return '';
  const userId = user.id;
  return typeof userId === 'string' ? userId.trim() : '';
}

async function persistAuthenticatedState({ token, user, sourceOrigin, payload }) {
  const normalizedToken = String(token || '').trim();
  const hasToken = normalizedToken.length > 0;
  const normalizedUser = user && typeof user === 'object' ? user : null;
  const normalizedUserId = extractUserId(normalizedUser);
  const normalizedSourceOrigin = normalizeOrigin(sourceOrigin);

  const currentState = await chrome.storage.local.get(AUTH_STORAGE_KEYS);
  const currentIsAuthenticated = currentState?.isAuthenticated === true;
  const currentToken =
    typeof currentState?.auth_token === 'string' ? currentState.auth_token.trim() : '';
  const currentUserId = extractUserId(currentState?.user);
  const currentSourceOrigin = normalizeOrigin(currentState?.[AUTH_SOURCE_ORIGIN_KEY]);
  const effectiveSourceOrigin = normalizedSourceOrigin || currentSourceOrigin;

  const isNoop =
    currentIsAuthenticated === hasToken &&
    currentToken === normalizedToken &&
    currentUserId === normalizedUserId &&
    currentSourceOrigin === effectiveSourceOrigin;

  if (isNoop) {
    return hasToken;
  }

  const nextState = {
    isAuthenticated: hasToken,
    user: normalizedUser,
    auth_token: normalizedToken,
  };

  if (normalizedSourceOrigin) {
    nextState[AUTH_SOURCE_ORIGIN_KEY] = normalizedSourceOrigin;
  }

  nextState[SUPABASE_SESSION_STORAGE_KEY] = hasToken
    ? {
        access_token: normalizedToken,
        user_id: normalizedUser?.id || null,
        persisted_at: new Date().toISOString(),
      }
    : null;

  await chrome.storage.local.set(nextState);

  chrome.runtime.sendMessage(
    {
      type: hasToken ? 'AUTH_SUCCESS' : 'AUTH_LOGOUT',
      payload:
        payload && typeof payload === 'object'
          ? payload
          : {
              user: normalizedUser,
              auth_token: normalizedToken,
            },
    },
    () => {
      void chrome.runtime.lastError;
    }
  );

  if (hasToken) {
    void triggerExtensionHeartbeat();
  }

  return hasToken;
}

async function clearLocalAuthenticatedState() {
  const currentState = await chrome.storage.local.get(AUTH_STORAGE_KEYS);
  const currentIsAuthenticated = currentState?.isAuthenticated === true;
  const currentToken =
    typeof currentState?.auth_token === 'string' ? currentState.auth_token.trim() : '';
  const currentUserId = extractUserId(currentState?.user);
  const hasSupabaseSession = Boolean(currentState?.[SUPABASE_SESSION_STORAGE_KEY]);
  const hasAnyAuthState =
    currentIsAuthenticated || currentToken.length > 0 || currentUserId.length > 0 || hasSupabaseSession;

  if (!hasAnyAuthState) {
    return false;
  }

  await chrome.storage.local.remove(AUTH_STORAGE_KEYS);
  chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' }, () => {
    void chrome.runtime.lastError;
  });
  return true;
}

async function setAuthenticatedState(payload, sendResponse, context = {}) {
  const normalizedUser =
    payload && typeof payload === 'object'
      ? payload.user && typeof payload.user === 'object'
        ? payload.user
        : payload
      : null;

  let token = String(extractAuthToken(payload) || '').trim();
  const refreshToken = String(extractRefreshToken(payload) || '').trim();
  if (token && refreshToken) {
    const bridge = getSupabaseAuthBridge();
    if (bridge && typeof bridge.setSession === 'function') {
      try {
        const session = await bridge.setSession({
          access_token: token,
          refresh_token: refreshToken,
        });
        if (typeof session?.access_token === 'string' && session.access_token.trim()) {
          token = session.access_token.trim();
        }
      } catch (error) {
        console.warn('[Extension] Failed to hydrate Supabase session from auth payload:', error);
      }
    }
  }

  try {
    const hasToken = await persistAuthenticatedState({
      token,
      user: normalizedUser,
      sourceOrigin: context?.sourceOrigin,
      payload,
    });

    sendResponse?.(
      hasToken
        ? { ok: true }
        : {
            ok: false,
            error: 'Missing access token from auth payload',
          }
    );
  } catch (error) {
    sendResponse?.({
      ok: false,
      error: error?.message || 'Failed to persist auth state',
    });
  }
}

async function setSupabaseSessionFromExternalMessage(message, sendResponse, context = {}) {
  const bridge = getSupabaseAuthBridge();
  if (!bridge || typeof bridge.setSession !== 'function') {
    const hasConfig = typeof globalThis?.ELLYN_PUBLIC_CONFIG === 'object' && globalThis.ELLYN_PUBLIC_CONFIG !== null;
    const errorMsg = hasConfig
      ? 'Supabase client initialization failed in extension'
      : 'Extension Supabase config missing. Run: node scripts/security/generate-extension-public-config.mjs';
    sendResponse?.({
      ok: false,
      error: errorMsg,
    });
    return;
  }

  const accessToken = String(message?.session?.access_token || '').trim();
  const refreshToken = String(message?.session?.refresh_token || '').trim();
  if (!accessToken || !refreshToken) {
    sendResponse?.({
      ok: false,
      error: 'Missing access_token or refresh_token',
    });
    return;
  }

  try {
    const session = await bridge.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    const sessionToken = String(session?.access_token || accessToken).trim();
    const sessionUser = session?.user && typeof session.user === 'object' ? session.user : null;

    await persistAuthenticatedState({
      token: sessionToken,
      user: sessionUser,
      sourceOrigin: context?.sourceOrigin,
      payload: {
        auth_token: sessionToken,
        user: sessionUser,
      },
    });

    sendResponse?.({ ok: true });
  } catch (error) {
    sendResponse?.({
      ok: false,
      error: error?.message || 'Failed to set Supabase session',
    });
  }
}

async function clearAuthenticatedState(sendResponse) {
  try {
    const bridge = getSupabaseAuthBridge();
    if (bridge?.storageKey) {
      await chrome.storage.local.remove([bridge.storageKey]);
    }
    if (bridge && typeof bridge.clearSession === 'function') {
      try {
        await bridge.clearSession();
      } catch (error) {
        console.warn('[Extension] Supabase signOut failed during logout cleanup:', error);
      }
    }

    await clearLocalAuthenticatedState();
    sendResponse?.({ ok: true });
  } catch (error) {
    sendResponse?.({
      ok: false,
      error: error?.message || 'Failed to clear auth state',
    });
  }
}

async function getAuthContext() {
  const bridge = getSupabaseAuthBridge();
  let supabaseSession = null;
  if (bridge && typeof bridge.getSession === 'function') {
    try {
      supabaseSession = await bridge.getSession();
    } catch (error) {
      console.warn('[Extension] Failed reading Supabase session:', error);
    }
  }

  const result = await chrome.storage.local.get(AUTH_STORAGE_KEYS);
  const supabaseToken =
    typeof supabaseSession?.access_token === 'string' ? supabaseSession.access_token.trim() : '';
  const storedToken = typeof result?.auth_token === 'string' ? result.auth_token.trim() : '';
  const token = supabaseToken || storedToken;
  const user = supabaseSession?.user || result?.user || null;

  if (supabaseToken && supabaseToken !== storedToken) {
    await chrome.storage.local.set({
      isAuthenticated: true,
      user,
      auth_token: supabaseToken,
    });
  }

  return {
    isAuthenticated: token.length > 0,
    user,
    authToken: token || null,
  };
}

function bindSupabaseAuthListeners() {
  const bridge = getSupabaseAuthBridge();
  const client = bridge?.client;
  if (!client?.auth?.onAuthStateChange) {
    return;
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session?.access_token) {
      void clearLocalAuthenticatedState().catch((error) => {
        console.warn('[Extension] Failed to clear local auth state after Supabase sign-out:', error);
      });
      return;
    }

    void persistAuthenticatedState({
      token: session.access_token,
      user: session.user || null,
      payload: {
        auth_token: session.access_token,
        user: session.user || null,
      },
    }).catch((error) => {
      console.warn('[Extension] Failed syncing Supabase auth state to extension storage:', error);
    });
  });
}

async function bootstrapAuthStateFromSupabase() {
  const bridge = getSupabaseAuthBridge();
  if (!bridge || typeof bridge.getSession !== 'function') {
    return;
  }

  try {
    const session = await bridge.getSession();
    const token = String(session?.access_token || '').trim();
    if (!token) {
      return;
    }

    await persistAuthenticatedState({
      token,
      user: session?.user || null,
      payload: {
        auth_token: token,
        user: session?.user || null,
      },
    });
  } catch (error) {
    console.warn('[Extension] Failed bootstrapping Supabase auth state:', error);
  }
}

bindSupabaseAuthListeners();
void bootstrapAuthStateFromSupabase();

function normalizeContactSyncInput(value) {
  if (!value || typeof value !== 'object') return null;
  const customFields =
    value.customFields && typeof value.customFields === 'object' && !Array.isArray(value.customFields)
      ? value.customFields
      : {};
  return {
    firstName: String(value.firstName || '').trim(),
    lastName: String(value.lastName || '').trim(),
    company: String(value.company || '').trim(),
    designation: String(value.designation || '').trim(),
    role: String(value.role || '').trim(),
    linkedinUrl: String(value.linkedinUrl || '').trim(),
    headline: String(value.headline || '').trim(),
    photoUrl: String(value.photoUrl || '').trim(),
    email: String(value.email || '').trim(),
    emailConfidence: Number(value.emailConfidence),
    emailVerified: value.emailVerified === true,
    emailSource: String(value.emailSource || '').trim(),
    companyDomain: String(value.companyDomain || '').trim(),
    phone: String(value.phone || value.phoneNumber || '').trim(),
    phoneNumber: String(value.phoneNumber || value.phone || '').trim(),
    customFields,
  };
}

async function handleSaveContactToSupabaseMessage(message, sendResponse) {
  const queueBridge = getContactSyncQueueBridge();
  if (!queueBridge || typeof queueBridge.saveOrQueueContact !== 'function') {
    sendResponse?.({
      ok: false,
      status: 'failed',
      error: 'Contact sync queue bridge unavailable',
    });
    return;
  }

  const normalizedContact = normalizeContactSyncInput(message?.contactData);
  if (!normalizedContact || !normalizedContact.email) {
    sendResponse?.({
      ok: false,
      status: 'failed',
      error: 'Missing contact data for sync',
    });
    return;
  }

  try {
    const result = await queueBridge.saveOrQueueContact(normalizedContact, {
      localId: String(message?.localId || '').trim(),
    });
    sendResponse?.(result || { ok: false, status: 'failed', error: 'Unknown sync failure' });
  } catch (error) {
    sendResponse?.({
      ok: false,
      status: 'failed',
      error: error?.message || 'Failed to save contact',
    });
  }
}

async function handleProcessSyncQueueMessage(sendResponse) {
  const queueBridge = getContactSyncQueueBridge();
  if (!queueBridge || typeof queueBridge.processQueue !== 'function') {
    sendResponse?.({
      ok: false,
      error: 'Contact sync queue bridge unavailable',
    });
    return;
  }

  try {
    const result = await queueBridge.processQueue();
    sendResponse?.(result || { ok: false, error: 'Queue processing failed' });
  } catch (error) {
    sendResponse?.({
      ok: false,
      error: error?.message || 'Queue processing failed',
    });
  }
}

async function handleGetSyncQueueStatusMessage(sendResponse) {
  const queueBridge = getContactSyncQueueBridge();
  if (!queueBridge || typeof queueBridge.getQueueCount !== 'function') {
    sendResponse?.({
      ok: false,
      queueCount: 0,
      error: 'Contact sync queue bridge unavailable',
    });
    return;
  }

  try {
    const queueCount = await queueBridge.getQueueCount();
    sendResponse?.({
      ok: true,
      queueCount,
    });
  } catch (error) {
    sendResponse?.({
      ok: false,
      queueCount: 0,
      error: error?.message || 'Failed reading queue status',
    });
  }
}

function toOptionalInlineString(value, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizeAiTemplateType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set(['recruiter', 'referral', 'advice', 'follow-up', 'thank-you', 'custom']);
  return allowed.has(normalized) ? normalized : 'custom';
}

function buildAiDraftPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') return null;

  const context =
    rawPayload.context && typeof rawPayload.context === 'object'
      ? rawPayload.context
      : {};

  const userName = toOptionalInlineString(context.userName, 120);
  if (!userName) return null;

  return {
    templateType: normalizeAiTemplateType(rawPayload.templateType),
    instructions: toOptionalInlineString(rawPayload.instructions, 700),
    context: {
      userName,
      userSchool: toOptionalInlineString(context.userSchool, 120),
      userMajor: toOptionalInlineString(context.userMajor, 120),
    },
    targetRole: toOptionalInlineString(rawPayload.targetRole, 120),
    targetCompany: toOptionalInlineString(rawPayload.targetCompany, 160),
  };
}

async function handleGenerateAiDraftMessage(message, sendResponse) {
  const payload = buildAiDraftPayload(message?.payload);
  if (!payload) {
    sendResponse?.({
      success: false,
      error: 'Invalid AI draft payload',
    });
    return;
  }

  try {
    const authToken = await getAuthToken();
    let responsePayload = null;

    try {
      responsePayload = await callBackendPost(
        '/api/v1/ai/generate-template',
        payload,
        authToken || '',
        35000
      );
    } catch (error) {
      if (Number(error?.status) === 404 || isMethodNotAllowedError(error)) {
        responsePayload = await callBackendPost(
          '/api/ai/generate-template',
          payload,
          authToken || '',
          35000
        );
      } else {
        throw error;
      }
    }

    const subject = String(responsePayload?.template?.subject || '').trim();
    const body = String(responsePayload?.template?.body || '').trim();
    if (!subject || !body) {
      throw new Error('AI API returned an invalid template payload.');
    }

    sendResponse?.({
      success: true,
      template: { subject, body },
    });
  } catch (error) {
    sendResponse?.({
      success: false,
      error: error?.message || 'AI draft generation failed',
    });
  }
}

function isAllowedExternalOrigin(value) {
  const origin = normalizeOrigin(value);
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

function hasSavedTemplateUtilities() {
  return (
    typeof savedTemplatesSave === 'function' &&
    typeof savedTemplatesGet === 'function' &&
    typeof savedTemplatesDelete === 'function'
  );
}

function normalizeSavedTemplateMessage(template) {
  if (!template || typeof template !== 'object') return null;

  const id = toOptionalInlineString(template.id, 160);
  const name = toOptionalInlineString(template.name, 220);
  const subject = toOptionalInlineString(template.subject, 500);
  const body = String(template.body || '').trim();

  if (!id || !name || !subject || !body) {
    return null;
  }

  const variables = Array.isArray(template.variables)
    ? template.variables
        .map((entry) => toOptionalInlineString(entry, 120))
        .filter(Boolean)
    : [];

  return {
    id,
    name,
    subject,
    body,
    tone: toOptionalInlineString(template.tone, 80) || 'professional',
    category: toOptionalInlineString(template.category, 120) || 'general',
    use_case: toOptionalInlineString(template.use_case, 120) || 'general',
    variables,
    savedAt: toOptionalInlineString(template.savedAt, 80) || new Date().toISOString(),
  };
}

async function handleSaveTemplateMessage(message, sendResponse) {
  try {
    if (!hasSavedTemplateUtilities()) {
      throw new Error('Saved templates utility unavailable');
    }

    const normalizedTemplate = normalizeSavedTemplateMessage(message?.template);
    if (!normalizedTemplate) {
      sendResponse?.({
        success: false,
        error: 'Invalid template payload (id, name, subject, body required)',
      });
      return;
    }

    await savedTemplatesSave(normalizedTemplate);
    sendResponse?.({ success: true });
  } catch (error) {
    sendResponse?.({
      success: false,
      error: error?.message || 'Failed to save template',
    });
  }
}

async function handleGetTemplatesMessage(sendResponse) {
  try {
    if (!hasSavedTemplateUtilities()) {
      throw new Error('Saved templates utility unavailable');
    }

    const templates = await savedTemplatesGet();
    sendResponse?.({
      success: true,
      templates: Array.isArray(templates) ? templates : [],
    });
  } catch (error) {
    sendResponse?.({
      success: false,
      error: error?.message || 'Failed to load templates',
      templates: [],
    });
  }
}

async function handleDeleteTemplateMessage(message, sendResponse) {
  try {
    if (!hasSavedTemplateUtilities()) {
      throw new Error('Saved templates utility unavailable');
    }

    const templateId = toOptionalInlineString(message?.id, 160);
    if (!templateId) {
      sendResponse?.({
        success: false,
        error: 'Template id is required',
      });
      return;
    }

    await savedTemplatesDelete(templateId);
    sendResponse?.({ success: true });
  } catch (error) {
    sendResponse?.({
      success: false,
      error: error?.message || 'Failed to delete template',
    });
  }
}

function normalizeGeminiUseCase(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set(['job_seeker', 'smb_sales', 'general']);
  return allowed.has(normalized) ? normalized : '';
}

function isSalesRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes('sales') ||
    normalized.includes('account executive') ||
    normalized.includes('account manager') ||
    normalized.includes('sdr') ||
    normalized.includes('bdr') ||
    normalized.includes('business development') ||
    normalized.includes('revenue') ||
    normalized.includes('growth')
  );
}

function pickFirstInlineValue(maxLength, ...values) {
  for (const value of values) {
    const normalized = toOptionalInlineString(value, maxLength);
    if (normalized) return normalized;
  }
  return undefined;
}

async function getStoredUserProfile() {
  try {
    const stored = await chrome.storage.local.get(['user']);
    return stored?.user && typeof stored.user === 'object' ? stored.user : null;
  } catch {
    return null;
  }
}

function buildGeminiContactPayload(message) {
  const contactData =
    message?.contactData && typeof message.contactData === 'object'
      ? message.contactData
      : {};

  const fullName = pickFirstInlineValue(220, contactData.fullName, contactData.name);
  const splitName = splitHumanName(fullName || '');

  const firstName =
    pickFirstInlineValue(120, contactData.firstName, splitName.firstName, 'there') || 'there';
  const company =
    pickFirstInlineValue(160, contactData.company, contactData.companyName, 'their company') ||
    'their company';
  const role = pickFirstInlineValue(160, contactData.role, contactData.designation);

  return {
    firstName,
    company,
    ...(role ? { role } : {}),
  };
}

async function buildGeminiSenderPayload() {
  const user = await getStoredUserProfile();
  const userMeta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};

  const name =
    pickFirstInlineValue(
      120,
      userMeta?.full_name,
      userMeta?.name,
      typeof user?.email === 'string' ? user.email.split('@')[0] : '',
      'Ellyn User'
    ) || 'Ellyn User';

  const context = pickFirstInlineValue(
    180,
    userMeta?.headline,
    userMeta?.title,
    userMeta?.context,
    userMeta?.bio
  );

  return {
    name,
    ...(context ? { context } : {}),
  };
}

async function resolveGeminiUseCase(message) {
  const directUseCase = normalizeGeminiUseCase(message?.use_case || message?.payload?.use_case);
  if (directUseCase) return directUseCase;

  const directPersona = normalizeGeminiUseCase(message?.persona || message?.payload?.persona);
  if (directPersona) return directPersona;

  const user = await getStoredUserProfile();
  const userMeta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
  const userMetaUseCase = normalizeGeminiUseCase(
    userMeta?.use_case || userMeta?.persona || userMeta?.persona_type || userMeta?.audience
  );
  if (userMetaUseCase) return userMetaUseCase;

  const roleHint =
    pickFirstInlineValue(
      160,
      message?.contactData?.role,
      message?.contactData?.designation,
      message?.payload?.contact?.role
    ) || '';

  return isSalesRole(roleHint) ? 'smb_sales' : 'job_seeker';
}

function defaultGoalForUseCase(useCase) {
  if (useCase === 'smb_sales') {
    return 'Book a demo call';
  }
  if (useCase === 'job_seeker') {
    return 'Get a job interview';
  }
  return 'Start a useful conversation';
}

async function handleGenerateAiDraftGeminiMessage(message, sendResponse) {
  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      sendResponse?.({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const useCase = await resolveGeminiUseCase(message);
    const goal =
      toOptionalInlineString(message?.goal, 400) || defaultGoalForUseCase(useCase);
    const contactPayload = buildGeminiContactPayload(message);
    const senderPayload = await buildGeminiSenderPayload();

    const payload = await callBackendPost(
      '/api/v1/ai/draft-email',
      {
        use_case: useCase,
        tone: 'professional',
        goal,
        contact: contactPayload,
        sender: senderPayload,
      },
      authToken,
      35000
    );

    const subject = String(payload?.subject || payload?.data?.subject || '').trim();
    const body = String(payload?.body || payload?.data?.body || '').trim();
    if (!subject || !body) {
      throw new Error('Gemini draft payload was invalid');
    }

    sendResponse?.({
      success: true,
      subject,
      body,
    });
  } catch (error) {
    if (Number(error?.status) === 402) {
      sendResponse?.({
        success: false,
        quotaExceeded: true,
        error: 'AI draft quota exceeded',
      });
      return;
    }

    sendResponse?.({
      success: false,
      error: error?.message || 'Gemini draft generation failed',
    });
  }
}

function normalizeCompanyBriefField(value, maxLength = 240) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';

  const lower = normalized.toLowerCase();
  const blockedValues = new Set([
    'unknown',
    'n/a',
    'na',
    'none',
    'null',
    'not available',
    'not found',
    '-',
    '--',
  ]);
  if (blockedValues.has(lower)) {
    return '';
  }

  return normalized.slice(0, maxLength);
}

function normalizeCompanyBriefYear(value) {
  const candidate = normalizeCompanyBriefField(value, 20);
  if (!candidate) return '';

  const match = candidate.match(/\b(18|19|20)\d{2}\b/);
  return match ? match[0] : '';
}

function normalizeCompanyBriefPayload(payload) {
  return {
    introBrief: normalizeCompanyBriefField(payload?.intro_brief || payload?.introBrief, 420),
    sector: normalizeCompanyBriefField(payload?.sector, 140),
    specialization: normalizeCompanyBriefField(payload?.specialization, 180),
    yearOfIncorporation: normalizeCompanyBriefYear(
      payload?.year_of_incorporation || payload?.yearOfIncorporation
    ),
  };
}

async function handleGetCompanyBriefGeminiMessage(message, sendResponse) {
  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      sendResponse?.({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const companyName = pickFirstInlineValue(
      160,
      message?.companyName,
      message?.data?.companyName
    );
    const companyPageUrl = pickFirstInlineValue(
      400,
      message?.companyPageUrl,
      message?.data?.companyPageUrl
    );

    if (!companyName) {
      sendResponse?.({
        success: false,
        error: 'companyName is required',
      });
      return;
    }

    const payload = await callBackendPost(
      '/api/v1/ai/company-brief',
      {
        company_name: companyName,
        ...(companyPageUrl ? { company_page_url: companyPageUrl } : {}),
      },
      authToken,
      12000
    );

    const normalized = normalizeCompanyBriefPayload(payload?.data || payload || {});
    sendResponse?.({
      success: true,
      data: normalized,
    });
  } catch (error) {
    sendResponse?.({
      success: false,
      error: error?.message || 'Failed to generate company brief',
    });
  }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  console.log('[Extension] Received message:', message.type);

  if (message.type === 'ELLYN_PING') {
    sendResponse?.({ success: true, version: '1.0.0' });
    return false;
  }

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

  if (message.type === 'SAVE_CONTACT_TO_SUPABASE') {
    void handleSaveContactToSupabaseMessage(message, sendResponse);
    return true;
  }

  if (message.type === 'PROCESS_SYNC_QUEUE') {
    void handleProcessSyncQueueMessage(sendResponse);
    return true;
  }

  if (message.type === 'GET_SYNC_QUEUE_STATUS') {
    void handleGetSyncQueueStatusMessage(sendResponse);
    return true;
  }

  if (message.type === 'ELLYN_SAVE_TEMPLATE') {
    void handleSaveTemplateMessage(message, sendResponse);
    return true;
  }

  if (message.type === 'ELLYN_GET_TEMPLATES') {
    void handleGetTemplatesMessage(sendResponse);
    return true;
  }

  if (message.type === 'ELLYN_DELETE_TEMPLATE') {
    void handleDeleteTemplateMessage(message, sendResponse);
    return true;
  }

  if (message.type === 'GENERATE_AI_DRAFT') {
    void handleGenerateAiDraftMessage(message, sendResponse);
    return true;
  }

  if (message.type === 'GENERATE_AI_DRAFT_GEMINI') {
    void handleGenerateAiDraftGeminiMessage(message, sendResponse);
    return true;
  }

  if (message.type === 'GET_COMPANY_BRIEF_GEMINI') {
    void handleGetCompanyBriefGeminiMessage(message, sendResponse);
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

  if (message.type === 'CONSUME_LOOKUP_CREDITS') {
    const requestedAmount = Number(message?.amount);
    const amount = Number.isFinite(requestedAmount)
      ? Math.max(1, Math.min(100, Math.floor(requestedAmount)))
      : 1;

    canPerformLookup(amount)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error('[Extension] CONSUME_LOOKUP_CREDITS failed:', error);
        sendResponse({
          allowed: false,
          remaining: null,
          resetDate: null,
          requestedCost: amount,
          error: error?.message || 'Failed to consume credits',
        });
      });
    return true;
  }

  if (message.type === 'AUTH_LOGOUT_LOCAL') {
    void clearAuthenticatedState(sendResponse);
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  const senderOrigin = normalizeOrigin(_sender?.url || _sender?.origin || '');
  if (!isAllowedExternalOrigin(senderOrigin)) {
    sendResponse?.({
      ok: false,
      error: 'Origin not allowed',
    });
    return false;
  }

  if (message.type === 'ELLYN_PING') {
    sendResponse?.({ success: true, version: '1.0.0' });
    return false;
  }

  if (message.type === 'ELLYN_SAVE_TEMPLATE') {
    void handleSaveTemplateMessage(message, sendResponse);
    return true;
  }

  if (message.type === 'ELLYN_GET_TEMPLATES') {
    void handleGetTemplatesMessage(sendResponse);
    return true;
  }

  if (message.type === 'ELLYN_DELETE_TEMPLATE') {
    void handleDeleteTemplateMessage(message, sendResponse);
    return true;
  }

  if (message.type === 'ELLYN_SET_SESSION') {
    void setSupabaseSessionFromExternalMessage(message, sendResponse, {
      sourceOrigin: senderOrigin,
    });
    return true;
  }

  if (message.type === 'WEBAPP_AUTH_SYNC') {
    void setAuthenticatedState(message.payload || null, sendResponse, {
      sourceOrigin: senderOrigin,
    });
    return true;
  }

  if (message.type === 'AUTH_SUCCESS') {
    void setAuthenticatedState(message.payload || null, sendResponse, {
      sourceOrigin: senderOrigin,
    });
    return true;
  }

  if (message.type === 'AUTH_LOGOUT') {
    void clearAuthenticatedState(sendResponse);
    return true;
  }
});

if (chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    const queueBridge = getContactSyncQueueBridge();
    if (alarm?.name && queueBridge?.SYNC_QUEUE_ALARM_NAME && alarm.name === queueBridge.SYNC_QUEUE_ALARM_NAME) {
      try {
        await queueBridge.processQueue();
      } catch (error) {
        console.warn('[Extension] Contact sync queue processing failed:', error);
      }
      return;
    }

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
  if (!quotaClient) {
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
  return quotaClient.getStatus();
}

async function canPerformLookup(cost = 1) {
  if (!quotaClient) {
    return {
      allowed: true,
      remaining: null,
      resetDate: null,
      warning: 'Quota manager unavailable',
      requestedCost: Number.isFinite(Number(cost))
        ? Math.max(1, Math.min(100, Math.floor(Number(cost))))
        : 1,
    };
  }
  const requestedCost = Number.isFinite(Number(cost))
    ? Math.max(1, Math.min(100, Math.floor(Number(cost))))
    : 1;
  const quotaCheck = await quotaClient.canPerformLookup(requestedCost);
  return {
    ...quotaCheck,
    requestedCost,
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
  const companySource = String(extracted?.company?.source || '').trim();

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
    // VOYAGER_TRACKING - preserve source metadata for transparency
    _extractionSources: {
      company: companySource || 'unknown',
      name: String(extracted?.name?.source || '').trim() || 'unknown',
      role: String(extracted?.role?.source || '').trim() || 'unknown',
    },
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

/**
 * Calls LinkedIn's Voyager internal API from the context of a LinkedIn tab
 * to get authoritative profile data (name, company, role).
 *
 * VOYAGER_CONFIDENCE_GATE - only call this when DOM extraction confidence
 * is below threshold. Calling it on every lookup would increase ToS exposure.
 *
 * @param {number} tabId
 * @returns {Promise<{fullName: string, company: string, role: string} | null>}
 */
async function fetchVoyagerForTab(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return new Promise(async (resolve) => {
          try {
            const identityMatch = window.location.pathname.match(/\/in\/([^/?#]+)/i);
            if (!identityMatch?.[1]) {
              resolve(null);
              return;
            }

            const memberIdentity = decodeURIComponent(identityMatch[1]);
            const tokenMatch = document.cookie.match(/(?:^|;\s*)JSESSIONID="?([^\";\s]+)"?/);
            const csrfToken = tokenMatch?.[1] ? tokenMatch[1].replace(/^"|"$/g, '') : '';

            const headers = {
              accept: 'application/json',
              'x-restli-protocol-version': '2.0.0',
            };
            if (csrfToken) headers['csrf-token'] = csrfToken;

            const clean = (v) =>
              String(v || '')
                .replace(/\s+/g, ' ')
                .trim();

            const extractCompanyFromPositions = (payload) => {
              const positions = payload?.positionView?.elements || payload?.data?.positionView?.elements || [];
              const current =
                positions.find((p) => !p.timePeriod?.endDate && (p.companyName || p.company?.name)) ||
                positions[0];
              if (current) {
                return clean(current.companyName || current.company?.name || '');
              }

              const included = Array.isArray(payload?.included) ? payload.included : [];
              const profilePositionEntry = included.find(
                (item) =>
                  item?.$type?.includes('ProfilePosition') || item?.entityUrn?.includes('profilePosition')
              );
              if (profilePositionEntry) {
                return clean(profilePositionEntry.companyName || profilePositionEntry.company?.name || '');
              }
              return '';
            };

            const extractRoleFromPositions = (payload) => {
              const positions = payload?.positionView?.elements || payload?.data?.positionView?.elements || [];
              const current = positions.find((p) => !p.timePeriod?.endDate) || positions[0];
              if (current?.title) return clean(current.title);

              const included = Array.isArray(payload?.included) ? payload.included : [];
              const posEntry = included.find(
                (item) =>
                  item?.$type?.includes('ProfilePosition') || item?.entityUrn?.includes('profilePosition')
              );
              return clean(posEntry?.title || '');
            };

            const endpoints = [
              `https://www.linkedin.com/voyager/api/identity/profileView/${encodeURIComponent(memberIdentity)}`,
              `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(memberIdentity)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-35`,
            ];

            for (const endpoint of endpoints) {
              try {
                const resp = await fetch(endpoint, {
                  method: 'GET',
                  credentials: 'include',
                  headers,
                });
                if (!resp.ok) continue;
                const payload = await resp.json();

                const profile = payload?.profile || payload?.data?.profile || payload;
                const firstName = clean(profile?.firstName || '');
                const lastName = clean(profile?.lastName || '');
                const fullName = firstName && lastName ? `${firstName} ${lastName}` : clean(profile?.name || '');

                const company = extractCompanyFromPositions(payload);
                const role = extractRoleFromPositions(payload);

                if (fullName || company) {
                  resolve({ fullName, company, role });
                  return;
                }
              } catch {
                // Try next endpoint
              }
            }
            resolve(null);
          } catch {
            resolve(null);
          }
        });
      },
    });

    return result?.result || null;
  } catch (error) {
    console.warn('[Extension] Voyager fetch failed:', error?.message || String(error));
    return null;
  }
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
      tabId: Number.isFinite(data?.tabId) ? data.tabId : null,
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
    case 'f_last':
      localPart = `${firstInitial}_${last}`;
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
    case 'first.l':
      localPart = `${first}.${lastInitial}`;
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
    case 'last_first':
      localPart = `${last}_${first}`;
      break;
    case 'lastfirst':
      localPart = `${last}${first}`;
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

function isValidDomainSyntax(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return false;
  if (normalized.length > 253) return false;
  if (!/^[a-z0-9.-]+$/.test(normalized)) return false;
  if (!normalized.includes('.')) return false;
  if (normalized.startsWith('.') || normalized.endsWith('.')) return false;
  if (normalized.includes('..')) return false;

  const labels = normalized.split('.');
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function isPlausibleTld(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized || !normalized.includes('.')) return false;
  const tld = normalized.split('.').pop() || '';
  return /^[a-z]{2,24}$/.test(tld);
}

function validateDomainAndTld(domain) {
  const normalized = normalizeDomain(domain);
  const syntaxOk = isValidDomainSyntax(normalized);
  const tldOk = syntaxOk && isPlausibleTld(normalized);
  return {
    domain: normalized,
    syntaxOk,
    tldOk,
    valid: syntaxOk && tldOk,
  };
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

    if (tokens.length >= 2) {
      const firstTwoCompact = `${tokens[0]}${tokens[1]}`;
      add(`${firstTwoCompact}.com`);
      add(`${firstTwoCompact}.in`);
      add(`${tokens[0]}-${tokens[1]}.com`);
      add(`${tokens[0]}-${tokens[1]}.in`);
    } else {
      add(`${tokens[0]}.com`);
      add(`${tokens[0]}.in`);
    }
  }

  return Array.from(out);
}

function hasStrongRecoveryDomainMatch(candidateDomain, companyName, resolvedDomain, companyPageUrl = '') {
  const candidateLabel = getRegistrableDomainLabel(candidateDomain);
  if (!candidateLabel) return false;

  const companyKey = normalizeCompanyKey(companyName);
  if (!companyKey) return true;

  const resolvedLabel = getRegistrableDomainLabel(resolvedDomain);
  const slugCompact = extractLinkedInCompanySlug(companyPageUrl).replace(/-/g, '');
  const companyTokens = tokenizeCompanyName(companyName);

  const candidateInCompany = companyKey.includes(candidateLabel);
  const candidateCoverage = companyKey.length > 0 ? candidateLabel.length / companyKey.length : 0;

  if (candidateLabel === companyKey || candidateLabel.includes(companyKey)) {
    return true;
  }

  if (candidateInCompany && candidateCoverage >= 0.65) {
    return true;
  }

  if (slugCompact) {
    const slugCoverage = slugCompact.length > 0 ? candidateLabel.length / slugCompact.length : 0;
    if (
      candidateLabel === slugCompact ||
      candidateLabel.includes(slugCompact) ||
      (slugCompact.includes(candidateLabel) && slugCoverage >= 0.65)
    ) {
      return true;
    }
  }

  let tokenHits = 0;
  for (const token of companyTokens) {
    if (token.length >= 3 && candidateLabel.includes(token)) {
      tokenHits += 1;
    }
  }

  if (companyTokens.length >= 2 && tokenHits >= 2) {
    return true;
  }

  if (companyTokens.length === 1 && tokenHits >= 1) {
    return true;
  }

  if (resolvedLabel) {
    const baselineCoverage = resolvedLabel.length > 0 ? candidateLabel.length / resolvedLabel.length : 0;
    if (resolvedLabel.includes(candidateLabel) && baselineCoverage < 0.65) {
      return false;
    }
  }

  return false;
}

async function recoverDomainForMismatch(companyName, resolvedDomain, companyPageUrl = '') {
  console.log('[ELLYN Domain Recovery] Starting recovery', {
    companyName,
    resolvedDomain,
    companyPageUrl,
  });
  const candidates = generateDomainGuessCandidates(companyName, companyPageUrl).filter(
    (candidate) =>
      candidate &&
      candidate !== resolvedDomain &&
      domainMatchesCompany(candidate, companyName, companyPageUrl) &&
      hasStrongRecoveryDomainMatch(candidate, companyName, resolvedDomain, companyPageUrl)
  );
  const limitedCandidates = candidates.slice(0, 6);
  console.log('[ELLYN Domain Recovery] Filtered candidates', {
    resolvedDomain,
    candidates: limitedCandidates,
  });

  for (const candidate of limitedCandidates) {
    try {
      const mx = await verifyDomainMx(candidate);
      if (mx?.hasMx) {
        console.log('[ELLYN Domain Recovery] Selected MX-backed recovery domain', {
          resolvedDomain,
          recoveredDomain: candidate,
        });
        return candidate;
      }
    } catch {
      // Continue trying candidates.
    }
  }

  console.log('[ELLYN Domain Recovery] No safe recovery domain found', {
    resolvedDomain,
  });

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

function updateCsrfTokenFromResponse(response, baseUrl = '') {
  const token = response?.headers?.get?.(CSRF_HEADER_NAME) || response?.headers?.get?.('x-csrf-token') || '';
  if (!token) return;
  csrfTokenCache = token;
  csrfTokenFetchedAt = Date.now();
  csrfTokenBaseUrl = String(baseUrl || '').trim();
}

async function refreshCsrfToken(baseUrl, force = false) {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalizedBaseUrl) return '';

  if (csrfTokenBaseUrl && csrfTokenBaseUrl !== normalizedBaseUrl) {
    csrfTokenCache = '';
    csrfTokenFetchedAt = 0;
    csrfRefreshPromise = null;
    csrfTokenBaseUrl = normalizedBaseUrl;
  }

  const cacheAgeMs = Date.now() - csrfTokenFetchedAt;
  if (!force && csrfTokenCache && cacheAgeMs < CSRF_TOKEN_TTL_MS) {
    return csrfTokenCache;
  }

  if (!force && csrfRefreshPromise) {
    return csrfRefreshPromise;
  }

  csrfRefreshPromise = (async () => {
    try {
      const response = await fetch(`${normalizedBaseUrl}${CSRF_REFRESH_PATH}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: createTimeoutSignal(5000),
      });
      updateCsrfTokenFromResponse(response, normalizedBaseUrl);
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

  const baseUrl = String(url || '')
    .replace(/\/api\/.*/i, '')
    .trim()
    .replace(/\/+$/, '');
  const csrfToken = await refreshCsrfToken(baseUrl, forceCsrfRefresh);
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
  updateCsrfTokenFromResponse(response, baseUrl);

  return { response, payload };
}

async function executeBackendPostWithCsrfRetry(url, body, authToken, timeoutMs) {
  let result = await executeBackendPost(url, body, authToken, timeoutMs, false);
  if (result.response.status === 403 && isCsrfInvalidPayload(result.payload)) {
    result = await executeBackendPost(url, body, authToken, timeoutMs, true);
  }
  return result;
}

async function callBackendPost(path, body, authToken, timeoutMs) {
  const baseUrl = await getBackendBaseUrl();
  if (!baseUrl) {
    throw buildPipelineError('NETWORK_FAILURE', 'API base URL is not configured.', {
      isRecoverable: true,
    });
  }

  const performRequest = async (requestUrl, token, forceCsrfRefresh = false) => {
    if (forceCsrfRefresh) {
      return executeBackendPost(requestUrl, body, token, timeoutMs, true);
    }
    return executeBackendPostWithCsrfRetry(requestUrl, body, token, timeoutMs);
  };

  let tokenInUse = String(authToken || '').trim();
  if (!tokenInUse) {
    tokenInUse = await getAuthToken();
  }
  const primaryUrl = `${baseUrl}${path}`;
  let { response, payload } = await performRequest(primaryUrl, tokenInUse, false);

  if (response.status === 401) {
    const refreshedToken = await getAuthToken();
    if (refreshedToken && refreshedToken !== tokenInUse) {
      tokenInUse = refreshedToken;
      ({ response, payload } = await performRequest(primaryUrl, tokenInUse, false));
    } else if (tokenInUse) {
      // Token may be stale. Retry without bearer to allow cookie-auth fallback.
      tokenInUse = '';
      ({ response, payload } = await performRequest(primaryUrl, tokenInUse, false));
    }
  }

  // If current origin is unauthorized, try local dev backends automatically.
  if (response.status === 401 && !LOCAL_DEV_ORIGINS.includes(baseUrl)) {
    for (const localBase of LOCAL_DEV_ORIGINS) {
      try {
        const localUrl = `${localBase}${path}`;
        ({ response, payload } = await performRequest(localUrl, tokenInUse, false));
        if (response.status !== 401) {
          backendBaseUrlCache = localBase;
          backendBaseUrlCachedAt = Date.now();
          break;
        }
      } catch {
        // Continue probing local fallback origins.
      }
    }
  }

  if (!response.ok) {
    const apiCode = getApiErrorCode(payload);
    const apiErrorMessage = getApiErrorMessage(payload);
    const normalizedApiCode = String(apiCode || '').toUpperCase();
    const normalizedMessage =
      normalizedApiCode === 'CSRF_INVALID'
        ? 'Session verification failed. Please retry or sign in again.'
        : apiErrorMessage || `Request failed: ${response.status} ${response.statusText}`;
    const fallbackErrorCode =
      response.status === 401
        ? 'UNAUTHORIZED'
        : response.status === 405
        ? 'METHOD_NOT_ALLOWED'
        : 'NETWORK_FAILURE';
    const error = buildPipelineError(
      normalizedApiCode || fallbackErrorCode,
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

function buildApiUrl(baseUrl, path) {
  const normalizedBase = String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getAbstractCandidateBases(primaryBase) {
  const primary = normalizeOrigin(primaryBase);
  const preferred = normalizeOrigin(abstractPreferredBaseUrl);
  const fallback = normalizeOrigin(CONFIG.API_BASE_URL);
  const localBases = LOCAL_DEV_ORIGINS.map((origin) => normalizeOrigin(origin)).filter(Boolean);
  const ordered = [preferred, primary, ...localBases, fallback].filter(Boolean);
  return Array.from(new Set(ordered));
}

function isLikelyJsonApiResponse(response, payload) {
  const contentType = String(response?.headers?.get?.('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return true;
  }
  return payload && typeof payload === 'object';
}

async function callAbstractVerifyWithFallback(email, authToken, timeoutMs, context = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const primaryBase = await getBackendBaseUrl();
  const candidateBases = getAbstractCandidateBases(primaryBase);

  if (candidateBases.length === 0) {
    throw buildPipelineError('NETWORK_FAILURE', 'No backend origin available for email verification.', {
      isRecoverable: true,
    });
  }

  let tokenInUse = String(authToken || '').trim();
  if (!tokenInUse) {
    tokenInUse = await getAuthToken();
  }

  let lastError = null;
  let sawUnauthorized = false;
  let successfulJsonResponses = 0;
  let notConfiguredResponses = 0;
  const attempts = [];

  for (const base of candidateBases) {
    const requestUrl = buildApiUrl(base, '/api/v1/email-verify');

    try {
      let { response, payload } = await executeBackendPostWithCsrfRetry(
        requestUrl,
        { email: normalizedEmail },
        tokenInUse,
        timeoutMs
      );

      if (response.status === 401) {
        const refreshedToken = await getAuthToken();
        if (refreshedToken && refreshedToken !== tokenInUse) {
          tokenInUse = refreshedToken;
          ({ response, payload } = await executeBackendPostWithCsrfRetry(
            requestUrl,
            { email: normalizedEmail },
            tokenInUse,
            timeoutMs
          ));
        } else {
          sawUnauthorized = true;
        }
      }

      const reason = String(payload?.reason || '').trim().toLowerCase();
      const finalOrigin = normalizeOrigin(response?.url || '');
      const redirected = response?.redirected === true;
      const redirectedOffOrigin = redirected && finalOrigin && finalOrigin !== normalizeOrigin(base);
      const looksJson = isLikelyJsonApiResponse(response, payload);

      attempts.push({
        base,
        status: Number(response?.status || 0),
        reason,
        redirected,
        finalOrigin,
      });

      console.log('[ELLYN Abstract Verify] Endpoint attempt', {
        operationId: context.operationId || '',
        base,
        status: response?.status,
        reason: reason || '',
        redirected,
        finalOrigin,
      });

      if (response.status === 401) {
        sawUnauthorized = true;
        continue;
      }

      if (response.ok && redirectedOffOrigin) {
        lastError = buildPipelineError(
          'REDIRECTED_API_RESPONSE',
          `Email verification endpoint redirected from ${base} to ${finalOrigin}.`,
          { status: response.status, isRecoverable: true }
        );
        continue;
      }

      if (response.ok && !looksJson) {
        lastError = buildPipelineError(
          'NON_JSON_RESPONSE',
          `Email verification endpoint returned non-JSON response from ${base}.`,
          { status: response.status, isRecoverable: true }
        );
        continue;
      }

      if (!response.ok) {
        const apiCode = getApiErrorCode(payload);
        const apiErrorMessage = getApiErrorMessage(payload);
        const fallbackCode = response.status === 401 ? 'UNAUTHORIZED' : 'NETWORK_FAILURE';
        const error = buildPipelineError(
          String(apiCode || fallbackCode).toUpperCase(),
          apiErrorMessage || `Request failed: ${response.status} ${response.statusText}`,
          {
            status: response.status,
            isRecoverable: [401, 403, 404, 405, 408, 429, 500, 502, 503, 504].includes(response.status),
          }
        );
        error.payload = payload;
        lastError = error;
        continue;
      }

      successfulJsonResponses += 1;
      if (reason === 'not_configured') {
        notConfiguredResponses += 1;
        continue;
      }

      abstractPreferredBaseUrl = base;
      backendBaseUrlCache = base;
      backendBaseUrlCachedAt = Date.now();

      return {
        payload: payload || {},
        baseUsed: base,
        attempts,
        authTokenUsed: tokenInUse,
      };
    } catch (error) {
      lastError = error;
      attempts.push({
        base,
        status: Number(error?.status || 0),
        reason: String(error?.code || ''),
        redirected: false,
        finalOrigin: '',
      });
      console.warn('[ELLYN Abstract Verify] Endpoint attempt failed', {
        operationId: context.operationId || '',
        base,
        error: error?.message || String(error),
      });
    }
  }

  const onlyNotConfiguredResponses =
    notConfiguredResponses > 0 && successfulJsonResponses === notConfiguredResponses;

  if (onlyNotConfiguredResponses && !sawUnauthorized) {
    return {
      payload: {
        email: normalizedEmail,
        deliverability: 'UNKNOWN',
        reason: 'not_configured',
        source: 'abstract',
        attemptedBases: attempts.map((entry) => entry.base).filter(Boolean),
      },
      baseUsed: '',
      attempts,
      authTokenUsed: tokenInUse,
    };
  }

  const allUnauthorized =
    attempts.length > 0 && attempts.every((entry) => Number(entry?.status || 0) === 401);

  if (sawUnauthorized && allUnauthorized) {
    throw buildPipelineError('UNAUTHORIZED', 'Please sign in again to verify emails.', {
      status: 401,
      isRecoverable: false,
    });
  }

  if (lastError) {
    throw lastError;
  }

  return {
    payload: {
      email: normalizedEmail,
      deliverability: 'UNKNOWN',
      reason: 'request_failed',
      source: 'abstract',
    },
    baseUsed: '',
    attempts,
    authTokenUsed: tokenInUse,
  };
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

  // VOYAGER_CONFIDENCE_GATE - check if company confidence is below threshold
  // If so, use Voyager to get authoritative structured company data.
  // Only fires when DOM/OG extraction is uncertain (confidence < 0.85).
  // This avoids unnecessary Voyager calls on high-confidence extractions.
  const VOYAGER_COMPANY_CONFIDENCE_THRESHOLD = 0.85; // VOYAGER_CONFIDENCE_GATE
  const companyConfidence = Number(extractorResponse?.data?.company?.confidence || 0);
  const companyName = String(normalized?.company || '').trim();

  const shouldCallVoyager =
    companyConfidence < VOYAGER_COMPANY_CONFIDENCE_THRESHOLD ||
    !companyName;

  if (shouldCallVoyager) {
    console.log('[Extension] Company confidence below threshold - calling Voyager', {
      companyConfidence,
      companyName: companyName || '(empty)',
      threshold: VOYAGER_COMPANY_CONFIDENCE_THRESHOLD,
    });

    try {
      const voyagerData = await withTimeout(
        fetchVoyagerForTab(tabId),
        4000,
        'Voyager confidence-gate fetch'
      );

      if (voyagerData) {
        console.log('[Extension] Voyager returned data', {
          fullName: voyagerData.fullName,
          company: voyagerData.company,
          role: voyagerData.role,
        });

        // Only overwrite company if Voyager returned something non-empty
        // and the result looks more authoritative than what we have.
        if (voyagerData.company && voyagerData.company !== normalized.company) {
          console.log('[Extension] Voyager overwriting company:', {
            old: normalized.company,
            new: voyagerData.company,
          });
          normalized.company = voyagerData.company;

          // Patch the underlying extractorResponse.data so the rest of the
          // pipeline sees the corrected value.
          if (extractorResponse?.data?.company) {
            extractorResponse.data.company.name = voyagerData.company;
            extractorResponse.data.company.source = 'voyager-confidence-gate';
            extractorResponse.data.company.confidence = 0.97;
          }
        }

        // Overwrite role only if we had nothing before
        if (voyagerData.role && !normalized.role) {
          normalized.role = voyagerData.role;
          if (extractorResponse?.data?.role) {
            extractorResponse.data.role.title = voyagerData.role;
            extractorResponse.data.role.source = 'voyager-confidence-gate';
            extractorResponse.data.role.confidence = 0.95;
          }
        }
      } else {
        console.log('[Extension] Voyager returned null - using DOM extraction result');
      }
    } catch (voyagerError) {
      // Voyager is non-critical. Log and continue with DOM result.
      console.warn('[Extension] Voyager confidence-gate failed (non-fatal):', {
        error: voyagerError?.message || String(voyagerError),
      });
    }
  } else {
    console.log('[Extension] Company confidence sufficient - skipping Voyager', {
      companyConfidence,
      companyName,
    });
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
  const normalizedFirstName = sanitizeNamePart(firstName);
  const normalizedLastName = sanitizeNamePart(lastName);
  const normalizedCompany = String(company || '')
    .replace(/\s+/g, ' ')
    .trim();
  const fullName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(' ');
  const aliasVariants = Array.from(
    new Set(
      [normalizedFirstName, normalizedLastName, `${normalizedFirstName}${normalizedLastName}`]
        .map((value) => sanitizeNamePart(value))
        .filter(Boolean)
    )
  );
  const explicitCompanyDomain = normalizeDomain(
    String(data?.companyDomain || data?.companyWebsite || data?.website || '').trim()
  );

  if (!normalizedFirstName || (!normalizedCompany && !(isStudent && hasEducation))) {
    throw new Error('Profile context incomplete. Refresh and confirm name + company before finding email.');
  }

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    fullName,
    aliasVariants,
    company: normalizedCompany,
    role,
    profileUrl,
    companyPageUrl,
    companyDomain: explicitCompanyDomain,
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

async function resolveDomain(companyName, authToken, companyPageUrl = '', options = {}) {
  const allowFallbackApi = options?.allowFallbackApi !== false;
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
    if (!allowFallbackApi) {
      throw error;
    }
    if (!isMethodNotAllowedError(error) && Number(error?.status) !== 404) {
      console.warn('[Extension] /api/v1/resolve-domain-v2 failed. Falling back to /api/v1/resolve-domain.', error);
    }
  }

  if (!allowFallbackApi) {
    throw buildPipelineError('NETWORK_FAILURE', 'Domain fallback API disabled by lookup budget.', {
      isRecoverable: true,
    });
  }

  return callBackendPost(
    '/api/v1/resolve-domain',
    { companyName },
    authToken,
    CONFIG.STAGE_TIMEOUT_MS.resolveDomain
  );
}

async function predictPatterns(input, authToken, options = {}) {
  const allowFallbackApi = options?.allowFallbackApi !== false;
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
        const providerRaw = String(predicted?.metadata?.provider || '').trim().toLowerCase();
        const modelRaw = String(predicted?.metadata?.model || '').trim();
        const inferredProvider =
          providerRaw || (/gemini/i.test(modelRaw) ? 'gemini' : modelRaw ? 'unknown' : '');
        return {
          patterns: normalizedPatterns,
          reasoning: String(predicted?.prediction?.recommendationReasoning || ''),
          source: 'predict-email',
          provider: inferredProvider || 'unknown',
          model: modelRaw || 'unknown',
          costUsd: Number(predicted?.debug?.estimatedCost || 0),
        };
      }

      if (!allowFallbackApi) {
        throw buildPipelineError('NETWORK_FAILURE', 'Predict-email returned no ranked patterns.', {
          isRecoverable: true,
        });
      }
    } catch (error) {
      if (!allowFallbackApi) {
        throw error;
      }
      if (!isMethodNotAllowedError(error) && Number(error?.status) !== 404) {
        console.warn('[Extension] /api/v1/predict-email failed. Falling back to /api/v1/predict-patterns.', error);
      }
    }
  }

  if (!allowFallbackApi) {
    throw buildPipelineError('NETWORK_FAILURE', 'Pattern fallback API disabled by lookup budget.', {
      isRecoverable: true,
    });
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

function detectMxProvider(mxHostname) {
  const mx = String(mxHostname || '').toLowerCase();
  if (mx.includes('google') || mx.includes('gmail')) return 'Google Workspace / Gmail';
  if (mx.includes('outlook') || mx.includes('microsoft')) return 'Microsoft 365 / Outlook';
  if (mx.includes('yahoo')) return 'Yahoo Mail';
  if (mx.includes('amazonses')) return 'Amazon SES';
  return 'Custom';
}

async function verifyEmailMx(email, domainCache) {
  const domain = extractDomainFromEmail(email);
  if (!domain) {
    return { email, domain: null, mxPassed: false, mxRecords: [], mxProvider: null };
  }

  // Use domain-level cache to avoid duplicate DNS queries for the same domain
  if (domainCache && domainCache.has(domain)) {
    const cached = domainCache.get(domain);
    return { email, ...cached };
  }

  try {
    const mxResult = await verifyDomainMx(domain);
    if (!mxResult?.hasMx) {
      const result = { domain, mxPassed: false, mxRecords: [], mxProvider: null };
      if (domainCache) domainCache.set(domain, result);
      return { email, ...result };
    }

    const mxAnswers = Array.isArray(mxResult.answers) ? mxResult.answers : [];
    const mxRecords = mxAnswers
      .filter((a) => Number(a?.type) === 15)
      .map((a) => {
        const parts = String(a?.data || '').split(/\s+/);
        return parts[parts.length - 1]?.replace(/\.$/, '') || '';
      })
      .filter(Boolean);

    const mxProvider = mxRecords.length > 0 ? detectMxProvider(mxRecords[0]) : null;

    // Verify at least one MX hostname has a real A record
    let hasARecord = false;
    for (const mxHost of mxRecords) {
      try {
        const aUrl = `https://dns.google/resolve?name=${encodeURIComponent(mxHost)}&type=A`;
        const { response: aResponse, payload: aPayload } = await fetchJson(aUrl, {
          method: 'GET',
          signal: createTimeoutSignal(3000),
          cache: 'no-store',
        });
        if (aResponse.ok) {
          const aAnswers = Array.isArray(aPayload?.Answer) ? aPayload.Answer : [];
          if (aAnswers.some((a) => Number(a?.type) === 1)) {
            hasARecord = true;
            break;
          }
        }
      } catch {
        // Continue to next MX hostname
      }
    }

    const result = { domain, mxPassed: hasARecord, mxRecords, mxProvider };
    if (domainCache) domainCache.set(domain, result);
    return { email, ...result };
  } catch (error) {
    console.warn('[ELLYN Stage 4] MX verification error for', email, error);
    const result = { domain, mxPassed: false, mxRecords: [], mxProvider: null };
    if (domainCache) domainCache.set(domain, result);
    return { email, ...result };
  }
}

async function confirmDomainWithGemini(companyName, domain, authToken) {
  try {
    const result = await callBackendPost(
      '/api/v1/confirm-domain',
      { companyName, domain },
      authToken,
      5000
    );
    return {
      confirmed: result?.confirmed !== false,
      correctedDomain: result?.correctedDomain || null,
      confidence: typeof result?.confidence === 'number' ? result.confidence : null,
      reason: result?.reason || '',
    };
  } catch (error) {
    console.warn('[ELLYN Stage 1.5] Gemini domain confirmation failed, treating as confirmed.', error);
    return { confirmed: true, correctedDomain: null, confidence: null, reason: 'gemini_unavailable' };
  }
}

function getFallbackPatterns() {
  return [
    { template: 'first.last', confidence: 0.35 },
    { template: 'flast', confidence: 0.20 },
    { template: 'firstlast', confidence: 0.12 },
    { template: 'first', confidence: 0.10 },
    { template: 'last.first', confidence: 0.08 },
    { template: 'lastfirst', confidence: 0.07 },
    { template: 'first_last', confidence: 0.05 },
    { template: 'f.last', confidence: 0.04 },
    { template: 'first.l', confidence: 0.03 },
    { template: 'last', confidence: 0.025 },
    { template: 'firstl', confidence: 0.02 },
    { template: 'f_last', confidence: 0.018 },
    { template: 'lastf', confidence: 0.017 },
    { template: 'last_first', confidence: 0.015 },
    { template: 'first-last', confidence: 0.012 },
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

async function getCachedDomainMapping(companyName) {
  const companyKey = normalizeCompanyKey(companyName);
  if (!companyKey) return null;

  const domainCacheKey = `${DOMAIN_CACHE_PREFIX}${companyKey}`;
  const domainCacheResult = await chrome.storage.local.get([domainCacheKey]);
  const domainCacheValue = domainCacheResult?.[domainCacheKey];
  if (!domainCacheValue || typeof domainCacheValue !== 'object') {
    return null;
  }

  const domain = normalizeDomain(domainCacheValue.domain);
  const timestamp = Number(domainCacheValue.timestamp || 0);
  const isFresh = Number.isFinite(timestamp) && Date.now() - timestamp <= CONFIG.CACHE_DURATION_MS;
  if (!domain || !isFresh) {
    return null;
  }

  return {
    domain,
    source: String(domainCacheValue.source || 'domain_cache'),
    confidence: Number(domainCacheValue.confidence || 0),
    timestamp,
  };
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
      verifiedBy: 'smtp_probe',
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
  void runSmtpProbeHealthCheck();

  const operationId = createOperationId();
  const senderTabId = Number.isFinite(sender?.tab?.id) ? sender.tab.id : null;
  const lookupStartedAt = Date.now();
  let stage = 'init';
  let normalizedInput = null;
  let domain = '';
  const lookupLimits = {
    maxExternalApiPulls: MAX_EXTERNAL_API_PULLS_PER_LOOKUP,
    externalApiPullsUsed: 0,
    maxSmtpAttemptsPerCandidate: MAX_SMTP_ATTEMPTS_PER_CANDIDATE,
    smtpAttemptsByCandidate: new Map(),
  };
  const consumeExternalApiPull = (label) => {
    if (lookupLimits.externalApiPullsUsed >= lookupLimits.maxExternalApiPulls) {
      console.log('[ELLYN Limit] External API pull blocked by hard cap.', {
        operationId,
        label,
        used: lookupLimits.externalApiPullsUsed,
        max: lookupLimits.maxExternalApiPulls,
      });
      return false;
    }

    lookupLimits.externalApiPullsUsed += 1;
    console.log('[ELLYN Limit] External API pull consumed.', {
      operationId,
      label,
      used: lookupLimits.externalApiPullsUsed,
      max: lookupLimits.maxExternalApiPulls,
    });
    return true;
  };

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
    console.log('[ELLYN Debug] Extracted + normalized profile context', {
      operationId,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName,
      company: input.company,
      role: input.role,
      profileUrl: input.profileUrl,
      companyPageUrl: input.companyPageUrl,
      companyDomain: input.companyDomain || '',
      aliasVariants: input.aliasVariants,
    });

    let authToken = await getAuthToken();
    if (!authToken) {
      console.warn('[Extension] No auth token in storage. Will still attempt with cookie credentials.');
    }

    const quota = await canPerformLookup();
    if (!quota?.allowed) {
      const isUnauthorized = quota?.error === 'Unauthorized';

      if (quotaClient && !isUnauthorized) {
        quotaClient.showUpgradeModal(quota?.resetDate || null);
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
    console.log('[ELLYN Debug] Gate result', {
      operationId,
      authenticated: Boolean(authToken),
      quotaAllowed: true,
      rateLimited: false,
    });

    let totalCost = 0;
    let geminiConfirmed = true;
    let geminiReason = '';
    let llmRankingPulled = false;
    let llmRankingSource = 'fallback';
    let llmRankingProvider = 'unknown';
    let mxSucceededAttempt = 'none';

    // STAGE 0: Cache lookup
    stage = 'cache_lookup';
    await updateOperation(operationId, { stage, profile: input });
    console.log('[ELLYN Stage 0] Cache lookup');

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
        externalApiPullsUsed: lookupLimits.externalApiPullsUsed,
        externalApiPullsMax: lookupLimits.maxExternalApiPulls,
        smtpAttemptsMaxPerCandidate: lookupLimits.maxSmtpAttemptsPerCandidate,
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
      console.log('[ELLYN Debug] Final selected email', {
        operationId,
        email: resultPayload.email,
        source: resultPayload.source,
        externalApiPullsUsed: resultPayload.externalApiPullsUsed,
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
      console.log('[ELLYN Stage 0.5] Student routing');

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

      // No university domain match â€” fall through to professional pipeline
      console.log('[Extension] Student routing: no university match, falling through to professional pipeline');
    }

    // STAGE 1: Domain resolution
    stage = 'resolve_domain';
    await updateOperation(operationId, { stage });
    console.log('[ELLYN Stage 1] Domain resolution');

    let domainResult = null;
    const domainWarnings = [];
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

    const explicitDomain = normalizeDomain(input.companyDomain);
    if (explicitDomain) {
      domainResult = {
        domain: explicitDomain,
        source: 'explicit_context',
        confidence: 0.92,
      };
    }

    if (!domainResult) {
      const cachedDomainHit = await getCachedDomainMapping(input.company);
      if (cachedDomainHit) {
        if (domainMatchesCompany(cachedDomainHit.domain, input.company, companyPageUrl)) {
          domainResult = {
            domain: cachedDomainHit.domain,
            source: 'cached_domain_mapping',
            confidence: Number(cachedDomainHit.confidence || 0.8),
          };
        } else {
          domainWarnings.push(
            `Cached domain ${cachedDomainHit.domain} did not match ${input.company}. Ignoring cached mapping.`
          );
        }
      }
    }

    if (!domainResult) {
      if (consumeExternalApiPull('resolve_domain')) {
        try {
          domainResult = await resolveDomain(input.company, authToken, companyPageUrl, {
            allowFallbackApi: false,
          });
        } catch (error) {
          const resolutionError = classifyApiError(error);
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
      } else {
        const guessedDomain = guessDomainFromCompanyName(input.company);
        if (!guessedDomain) {
          throw buildPipelineError('NETWORK_FAILURE', 'No API budget left and no domain could be inferred.', {
            isRecoverable: true,
          });
        }
        domainResult = {
          domain: guessedDomain,
          source: 'local_heuristic_budget',
          confidence: 0.38,
          warnings: ['External API pull cap reached. Used heuristic domain inference.'],
        };
      }
    }

    if (Array.isArray(domainResult?.warnings)) {
      domainWarnings.push(
        ...domainResult.warnings.filter((warning) => typeof warning === 'string' && warning.trim().length > 0)
      );
    }

    domain = normalizeDomain(domainResult?.domain);

    if (!domain) {
      throw new Error('Domain resolution failed.');
    }

    const domainValidation = validateDomainAndTld(domain);
    console.log('[ELLYN Debug] Domain/TLD validation', {
      operationId,
      domain: domainValidation.domain,
      syntaxOk: domainValidation.syntaxOk,
      tldOk: domainValidation.tldOk,
    });
    if (!domainValidation.valid) {
      throw buildPipelineError('INVALID_DOMAIN', `Resolved domain ${domain} failed domain/TLD validation.`, {
        isRecoverable: false,
      });
    }
    domain = domainValidation.domain;
    console.log('[ELLYN Debug] Resolved domain', {
      operationId,
      domain,
      source: domainResult?.source || 'unknown',
      apiPullsUsed: lookupLimits.externalApiPullsUsed,
      apiPullsMax: lookupLimits.maxExternalApiPulls,
    });

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

    // STAGE 1.5: Gemini domain confirmation
    stage = 'gemini_domain_confirmation';
    await updateOperation(operationId, { stage, domain });
    console.log('[ELLYN Stage 1.5] Gemini domain confirmation for', domain);

    geminiConfirmed = true;
    geminiReason = 'skipped_api_budget';
    console.log('[ELLYN Stage 1.5] Gemini confirmation skipped to preserve one-API-pull budget.');

    // STAGE 2: LLM pattern prediction
    stage = 'predict_patterns';
    await updateOperation(operationId, { stage, domain });
    console.log('[ELLYN Stage 2] LLM pattern prediction');

    let predictedPatterns = [];
    if (consumeExternalApiPull('predict_patterns')) {
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
          authToken,
          { allowFallbackApi: false }
        );

        predictedPatterns = Array.isArray(prediction?.patterns) ? prediction.patterns : [];
        llmRankingSource = String(prediction?.source || 'fallback').trim() || 'fallback';
        const llmProvider = String(prediction?.provider || '').trim().toLowerCase();
        llmRankingProvider = llmProvider || 'unknown';
        llmRankingPulled = llmRankingSource === 'predict-email' && llmRankingProvider === 'gemini';
        const llmModel = String(prediction?.model || '').trim();
        console.log('[ELLYN Stage 2] LLM ranking provider', {
          operationId,
          provider: llmRankingProvider,
          model: llmModel || 'unknown',
          source: llmRankingSource,
          pulled: llmRankingPulled,
        });
        if (llmRankingSource === 'predict-email' && llmRankingProvider !== 'gemini') {
          domainWarnings.push(`LLM ranking used ${llmRankingProvider}; Gemini was unavailable for this lookup.`);
        }
        const predictionCost = Number(prediction?.costUsd);
        const effectivePredictionCost = Number.isFinite(predictionCost)
          ? predictionCost
          : CONFIG.COSTS.predictPatternsFallback;

        totalCost = toRoundedMoney(totalCost + effectivePredictionCost);
        await trackApiCost(effectivePredictionCost);
      } catch (error) {
        console.warn('[Extension] Pattern prediction failed. Using fallback patterns.', error);
        predictedPatterns = getFallbackPatterns();
        llmRankingSource = 'fallback_api_error';
        llmRankingProvider = 'unknown';
        totalCost = toRoundedMoney(totalCost + CONFIG.COSTS.predictPatternsFallback);
        await trackApiCost(CONFIG.COSTS.predictPatternsFallback);
      }
    } else {
      predictedPatterns = getFallbackPatterns();
      llmRankingSource = 'fallback_api_budget';
      llmRankingProvider = 'unknown';
      console.log('[ELLYN Stage 2] Pattern API skipped because external API cap has been reached.');
    }

    // STAGE 3: Email generation
    stage = 'generate_candidates';
    await updateOperation(operationId, { stage });
    console.log('[ELLYN Stage 3] Email generation');

    let candidates = buildCandidates(
      input.firstName,
      input.lastName,
      domain,
      predictedPatterns
    );

    const _seen = new Set();
    candidates = candidates.filter((c) => {
      if (_seen.has(c.email)) return false;
      _seen.add(c.email);
      return true;
    });

    // Cap at top 8 candidates by pattern confidence
    candidates = candidates.slice(0, 8);
    console.log('[ELLYN Stage 3] Capped to top 8 candidates:', candidates.map((c) => c.email));
    console.log('[ELLYN Debug] Generated candidate list', {
      operationId,
      count: candidates.length,
      emails: candidates.map((c) => c.email),
    });

    if (candidates.length === 0) {
      throw new Error('Failed to generate email candidates from predicted patterns.');
    }

    // STAGE 4: Per-email MX verification
    stage = 'mx_verification';
    await updateOperation(operationId, { stage });
    console.log('[ELLYN Stage 4] Per-email MX verification');

    const mxDomainCache = new Map();
    let mxPassed = [];
    const mxByDomain = new Map();

    // Run MX verification on all candidates (domain-level cache prevents duplicate DNS queries)
    const mxResults = await Promise.allSettled(
      candidates.map((c) => verifyEmailMx(c.email, mxDomainCache))
    );

    for (let i = 0; i < candidates.length; i++) {
      const result = mxResults[i];
      if (result.status === 'fulfilled' && result.value.mxPassed) {
        mxPassed.push(candidates[i]);
        mxByDomain.set(result.value.domain, true);
      } else if (result.status === 'fulfilled') {
        mxByDomain.set(result.value.domain || extractDomainFromEmail(candidates[i].email), false);
      }
    }
    {
      const _seenEmails = new Set();
      mxPassed = mxPassed.filter((c) => {
        if (_seenEmails.has(c.email)) return false;
        _seenEmails.add(c.email);
        return true;
      });
    }
    if (mxPassed.length > 0) {
      mxSucceededAttempt = 'first';
    }

    if (mxPassed.length === 0) {
      // Recovery: try alternative domain
      const recoveredDomain = await recoverDomainForMismatch(input.company, domain, companyPageUrl);
      if (recoveredDomain) {
        domainWarnings.push(
          `All candidates for ${domain} failed MX. Switched to ${recoveredDomain}.`
        );
        domain = recoveredDomain;
        candidates = buildCandidates(input.firstName, input.lastName, domain, predictedPatterns);

        const retryMxCache = new Map();
        const retryMxResults = await Promise.allSettled(
          candidates.map((c) => verifyEmailMx(c.email, retryMxCache))
        );
        for (let i = 0; i < candidates.length; i++) {
          const result = retryMxResults[i];
          if (result.status === 'fulfilled' && result.value.mxPassed) {
            mxPassed.push(candidates[i]);
            mxByDomain.set(result.value.domain, true);
          }
        }
        {
          const _seenEmails = new Set();
          mxPassed = mxPassed.filter((c) => {
            if (_seenEmails.has(c.email)) return false;
            _seenEmails.add(c.email);
            return true;
          });
        }
        if (mxPassed.length > 0) {
          mxSucceededAttempt = 'second';
        }
      }

      if (mxPassed.length === 0) {
        // Graceful "not found" â€” not an error
        console.log('[ELLYN Stage 4] No MX-passing candidates. Returning not-found.');
        await completeOperation(operationId, 'completed', {
          stage: 'mx_verification',
          result: { found: false, reason: 'no_mx' },
        });
        // Fire-and-forget quota rollback
        void callBackendPost('/api/v1/quota/rollback', {}, authToken, 5000).catch((err) =>
          console.warn('[ELLYN] Quota rollback failed:', err)
        );
        sendResponse({
          success: false,
          found: false,
          reason: 'no_mx',
          message: 'No email ID found for this contact.',
          domain,
          totalCandidates: candidates.length,
          warnings: domainWarnings,
          llmRankingPulled,
          llmRankingSource,
          llmRankingProvider,
          mxSucceededAttempt,
          externalApiPullsUsed: lookupLimits.externalApiPullsUsed,
          externalApiPullsMax: lookupLimits.maxExternalApiPulls,
          type: 'EMAIL_NOT_FOUND',
        });
        return;
      }
    }

    const mxVerifiedCount = mxPassed.length;
    // Extract MX provider from first passing result
    const firstMxResult = mxResults.find(
      (r) => r.status === 'fulfilled' && r.value.mxPassed
    );
    const mxProvider = firstMxResult?.status === 'fulfilled' ? firstMxResult.value.mxProvider : null;

    console.log('[ELLYN Stage 4] MX passed:', mxVerifiedCount, '/', candidates.length, 'Provider:', mxProvider);
    console.log('[ELLYN Debug] MX result summary', {
      operationId,
      mxVerifiedCount,
      totalCandidates: candidates.length,
      mxProvider,
      mxSucceededAttempt,
    });
    // STAGE 5: Sequential Abstract verification on LLM-ranked top candidates
    stage = 'verify_candidates';
    await updateOperation(operationId, { stage });
    const rankedSmtpPool = (mxPassed.length > 0 ? mxPassed : candidates)
      .slice()
      .sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));
    const candidatesToVerify = rankedSmtpPool.slice(0, MAX_LLM_SHORTLIST_FOR_SMTP);
    console.log('[ELLYN Stage 5] LLM-ranked SMTP shortlist', {
      operationId,
      shortlistSize: candidatesToVerify.length,
      shortlistMax: MAX_LLM_SHORTLIST_FOR_SMTP,
      emails: candidatesToVerify.map((candidate) => candidate.email),
    });

    let selected = null;
    const alternativesFromVerification = [];
    const verificationResults = [];
    let validationCreditsUsed = 0;

    const verifyCandidateWithSmtpLimit = async (
      candidateEmail,
      maxAttemptsForCandidate = lookupLimits.maxSmtpAttemptsPerCandidate
    ) => {
      let validationResult = null;
      let lastError = null;
      let hadApiResponse = false;

      while (true) {
        const attemptsUsed = Number(lookupLimits.smtpAttemptsByCandidate.get(candidateEmail) || 0);
        if (attemptsUsed >= maxAttemptsForCandidate) {
          console.warn('[ELLYN Limit] SMTP attempts hard cap reached for candidate.', {
            operationId,
            candidateEmail,
            attemptsUsed,
            max: maxAttemptsForCandidate,
          });
          break;
        }

        const nextAttempt = attemptsUsed + 1;
        lookupLimits.smtpAttemptsByCandidate.set(candidateEmail, nextAttempt);
        console.log('[ELLYN Limit] SMTP attempt', {
          operationId,
          candidateEmail,
          attempt: nextAttempt,
          max: maxAttemptsForCandidate,
        });

        try {
          const verificationResponse = await callAbstractVerifyWithFallback(candidateEmail, authToken, 15000, {
            operationId,
          });
          validationResult = verificationResponse?.payload || null;
          hadApiResponse = Boolean(validationResult && typeof validationResult === 'object');
          if (verificationResponse?.authTokenUsed) {
            authToken = verificationResponse.authTokenUsed;
          }
          const validationReason = String(validationResult?.reason || '').trim().toLowerCase();
          if (hadApiResponse && validationReason !== 'not_configured') {
            validationCreditsUsed += 1;
          }
          break;
        } catch (err) {
          lastError = err;
          const authCode = String(err?.code || '').toUpperCase();
          if (authCode === 'UNAUTHORIZED' || Number(err?.status) === 401) {
            const refreshedAuthToken = await getAuthToken();
            if (refreshedAuthToken && refreshedAuthToken !== authToken) {
              authToken = refreshedAuthToken;
              continue;
            }
            throw buildPipelineError(
              'UNAUTHORIZED',
              'Please sign in again to verify emails.',
              { status: 401, isRecoverable: false }
            );
          }
          break;
        }
      }

      return {
        validationResult,
        lastError,
        hadApiResponse,
        attempts: Number(lookupLimits.smtpAttemptsByCandidate.get(candidateEmail) || 0),
      };
    };

    for (const candidate of candidatesToVerify) {
      console.log('[ELLYN Stage 5] Verifying:', candidate.email);
      const smtpCheck = await verifyCandidateWithSmtpLimit(candidate.email, 1);
      let validationResult = smtpCheck.validationResult;

      if (!validationResult) {
        console.warn('[ELLYN Stage 5] Abstract verification error for', candidate.email, smtpCheck.lastError?.message || '');
        validationResult = { deliverability: 'UNKNOWN', reason: 'request_failed' };
      }

      const validationReason = String(validationResult?.reason || '').trim().toLowerCase();
      if (
        validationReason === 'not_configured' ||
        validationReason === 'invalid_api_key' ||
        validationReason === 'upstream_auth_error'
      ) {
        const attemptedBases = Array.isArray(validationResult?.attemptedBases)
          ? validationResult.attemptedBases.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
          : [];
        const attemptedSuffix =
          attemptedBases.length > 0 ? ` Checked backend origins: ${attemptedBases.join(', ')}.` : '';
        throw buildPipelineError(
          'SMTP_NOT_CONFIGURED',
          `Email verification provider is not configured (ABSTRACT_EMAIL_VALIDATION_API_KEY).${attemptedSuffix}`,
          { isRecoverable: false }
        );
      }

      const deliverability = String(validationResult?.deliverability || 'UNKNOWN').toUpperCase();
      
      verificationResults.push({
        email: candidate.email,
        deliverability,
        confidence: validationResult?.confidence ?? candidate.confidence,
        subStatus: validationResult?.subStatus || null,
        smtpAttempts: smtpCheck.attempts,
        verifiedByApi: smtpCheck.hadApiResponse,
        source: 'abstract',
      });

      console.log('[ELLYN Stage 5] Abstract result for', candidate.email, '', deliverability);
      console.log('[ELLYN Debug] SMTP result', {
        operationId,
        email: candidate.email,
        deliverability,
        attempts: smtpCheck.attempts,
      });

      if (deliverability === 'DELIVERABLE') {
        selected = {
          ...candidate,
          source: 'abstract_verified',
          confidence: validationResult?.confidence ?? 0.95,
          tier: 'primary',
          validationSubStatus: validationResult?.subStatus || null,
        };
        console.log('[ELLYN Stage 5]  Found DELIVERABLE email:', selected.email, '- stopping verification');
        break; // Stop immediately - do not verify remaining candidates
      }

      if (deliverability === 'UNDELIVERABLE') {
        // Confirmed bad - skip entirely, do not add to alternatives
        continue;
      }

      if (deliverability === 'UNKNOWN') {
        // Keep as low-confidence alternative
        alternativesFromVerification.push({
          ...candidate,
          confidence: Math.min(candidate.confidence * 1.1, 0.45),
          source: 'mx_confirmed_unverified',
          tier: 'alternative',
        });
      }
    }

    // If no DELIVERABLE email was found via Abstract after retry cap,
    // treat lookup as unknown/undeliverable (do not fall back to pattern guess).
    if (!selected) {
      const anyVerificationResponse = verificationResults.some((row) => row.verifiedByApi === true);
      if (!anyVerificationResponse) {
        console.warn('[ELLYN Stage 5] Abstract verification unavailable for all candidates. Returning not-found.');
        await completeOperation(operationId, 'completed', {
          stage: 'verify_candidates',
          result: { found: false, reason: 'smtp_unavailable' },
        });
        sendResponse({
          success: false,
          found: false,
          reason: 'smtp_unavailable',
          message: 'Email verification could not be completed via Abstract. Please try again.',
          domain,
          totalCandidates: candidatesToVerify.length,
          warnings: [...domainWarnings, 'Abstract email verification was unavailable for this lookup.'],
          llmRankingPulled,
          llmRankingSource,
          llmRankingProvider,
          mxSucceededAttempt,
          externalApiPullsUsed: lookupLimits.externalApiPullsUsed,
          externalApiPullsMax: lookupLimits.maxExternalApiPulls,
          type: 'EMAIL_NOT_FOUND',
        });
        return;
      }

      console.log('[ELLYN Stage 5] No deliverable email after top-2 SMTP checks. Returning unknown.');
      await completeOperation(operationId, 'completed', {
        stage: 'verify_candidates',
        result: { found: false, reason: 'undeliverable' },
      });
      sendResponse({
        success: false,
        found: false,
        reason: 'undeliverable',
        message: 'Email ID unknown.',
        domain,
        totalCandidates: candidatesToVerify.length,
        warnings: domainWarnings,
        llmRankingPulled,
        llmRankingSource,
        llmRankingProvider,
        mxSucceededAttempt,
        externalApiPullsUsed: lookupLimits.externalApiPullsUsed,
        externalApiPullsMax: lookupLimits.maxExternalApiPulls,
        smtpAttemptsMaxPerCandidate: lookupLimits.maxSmtpAttemptsPerCandidate,
        verificationResults,
        type: 'EMAIL_NOT_FOUND',
      });
      return;
    }

    // Build alternatives list - exclude selected email, sort by confidence
    const finalAlternatives = alternativesFromVerification
      .filter((a) => a.email !== selected?.email)
      .sort((a, b) => b.confidence - a.confidence);
    const selectedVerification = verificationResults.find((row) => row.email === selected?.email) || null;
    console.log('[ELLYN Debug] Ranking result', {
      operationId,
      selectedEmail: selected?.email || '',
      selectedPattern: selected?.pattern || '',
      selectedConfidence: Number(selected?.confidence || 0),
      smtpDeliverability: selectedVerification?.deliverability || 'UNVERIFIED',
      mxDomainPass: mxByDomain.get(extractDomainFromEmail(selected?.email || '') || ''),
      alternativesCount: finalAlternatives.length,
    });

    totalCost = toRoundedMoney(totalCost + (validationCreditsUsed * CONFIG.COSTS.verifyEmail));
    console.log('[ELLYN Stage 5] Done. Credits used:', validationCreditsUsed, 
      'Selected:', selected?.email, 'Alternatives:', finalAlternatives.length);

    const smtpVerifiedCount = verificationResults.filter((r) => r.deliverability === 'DELIVERABLE').length;
    const abstractVerifiedCount = 0;
    // STAGE 6: Cache result
    stage = 'cache_result';
    await updateOperation(operationId, { stage });
    console.log('[ELLYN Stage 6] Cache result');

    const finalResult = selected;
    const verifiedDomain = extractDomainFromEmail(finalResult.email) || domain;
    await cacheVerifiedPattern(verifiedDomain, finalResult.pattern, finalResult.confidence);

    const finalDomain = verifiedDomain;
    const mxSelectedHasMx = mxByDomain.get(finalDomain) === true;

    const alternativeEmails = finalAlternatives.map((alt) => ({
      email: alt.email,
      pattern: alt.pattern,
      confidence: alt.confidence,
      tier: alt.tier,
      hasMx: true,
    }));

    const payload = {
      email: finalResult.email,
      pattern: finalResult.pattern,
      confidence: Number(finalResult.confidence || 0),
      source: finalResult.source || 'smtp_verified',
      smtpVerificationProvider: 'abstract',
      mxChecked: true,
      mxSelectedHasMx,
      mxSelectedFromAlternative: false,
      alternativeEmails,
      cost: toRoundedMoney(totalCost),
      domain: finalDomain,
      verificationResults,
      profileUrl: input.profileUrl || '',
      warnings: domainWarnings,
      geminiConfirmed,
      geminiReason,
      llmRankingPulled,
      llmRankingSource,
      llmRankingProvider,
      mxSucceededAttempt,
      mxVerifiedCount,
      mxProvider,
      smtpVerifiedCount,
      abstractVerifiedCount,
      totalCandidates: candidates.length,
      externalApiPullsUsed: lookupLimits.externalApiPullsUsed,
      externalApiPullsMax: lookupLimits.maxExternalApiPulls,
      smtpAttemptsMaxPerCandidate: lookupLimits.maxSmtpAttemptsPerCandidate,
    };
    console.log('[ELLYN Debug] Final selected email', {
      operationId,
      email: payload.email,
      source: payload.source,
      externalApiPullsUsed: payload.externalApiPullsUsed,
      smtpAttemptsMaxPerCandidate: payload.smtpAttemptsMaxPerCandidate,
    });

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
    console.log('[ELLYN Stage 7] Return result');

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
