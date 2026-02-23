// Popup UI Controller
console.log('[Popup] Script loaded');

const CONFIG = {
  AUTH_BASE_URL: 'https://www.useellyn.com',
};
const BUNDLED_PRIVACY_PAGE = 'privacy.html';
const SYNC_QUEUE_KEY = 'sync_queue';
const LAST_SYNC_AT_KEY = 'last_sync_at';
const SUPABASE_SESSION_KEY = 'supabase_session';
const SYNC_LOG_KEY = 'sync_log';

// DOM elements
const elements = {
  authSection: document.getElementById('authSection'),
  finderSection: document.getElementById('finderSection'),
  signInBtn: document.getElementById('signInBtn'),
  connectAppBtn: document.getElementById('connectAppBtn'),
  findEmailBtn: document.getElementById('findEmailBtn'),
  loadingState: document.getElementById('loadingState'),
  resultsSection: document.getElementById('resultsSection'),
  profileTypeBadge: document.getElementById('profileTypeBadge'),
  quotaText: document.getElementById('quotaText'),
  upgradeBanner: document.getElementById('upgradeBanner'),
  upgradeMessage: document.getElementById('upgradeMessage'),
  upgradeLink: document.getElementById('upgradeLink'),
  syncStatus: document.getElementById('syncStatus'),
  syncStateDot: document.getElementById('syncStateDot'),
  syncStateText: document.getElementById('syncStateText'),
  syncStateMeta: document.getElementById('syncStateMeta'),
  syncRetryBtn: document.getElementById('syncRetryBtn'),
  syncHistoryList: document.getElementById('syncHistoryList'),
  syncHistoryEmpty: document.getElementById('syncHistoryEmpty'),
  privacyLink: document.getElementById('ellyn-privacy-link'),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  console.log('[Popup] Initializing...');

  bindRuntimeListeners();
  bindStorageListeners();
  await Promise.all([renderSyncStatus(), renderSyncHistory()]);

  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    showFinderSection();
    updateQuota();
  } else {
    showAuthSection();
  }

  elements.signInBtn?.addEventListener('click', handleSignIn);
  elements.connectAppBtn?.addEventListener('click', handleConnectApp);
  elements.findEmailBtn?.addEventListener('click', handleFindEmail);
  elements.syncRetryBtn?.addEventListener('click', handleSyncRetry);
  elements.privacyLink?.addEventListener('click', handleOpenPrivacyPage);
}

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

async function checkAuth() {
  try {
    const allStorage = await chrome.storage.local.get(null);
    const hasSupabaseSession = Object.entries(allStorage || {}).some(([key, value]) => {
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) {
        return false;
      }
      if (typeof value !== 'string' || value.trim().length === 0) {
        return false;
      }
      try {
        const parsed = JSON.parse(value);
        return typeof parsed?.access_token === 'string' && parsed.access_token.length > 0;
      } catch {
        return false;
      }
    });

    if (!hasSupabaseSession) {
      return false;
    }

    const result = await chrome.storage.local.get(['isAuthenticated', 'user', 'auth_token']);
    const hasStructuredAuth = result?.isAuthenticated === true && Boolean(result?.user);
    const hasTokenOnly = typeof result?.auth_token === 'string' && result.auth_token.length > 0;
    if (hasStructuredAuth || hasTokenOnly) {
      return true;
    }

    const runtimeToken = await chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' });
    return typeof runtimeToken === 'string' && runtimeToken.length > 0;
  } catch (error) {
    console.error('[Popup] Error checking auth:', error);
    return false;
  }
}

function hasAccessTokenInSupabaseSession(value) {
  if (!value) return false;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed?.access_token === 'string' && parsed.access_token.length > 0;
    } catch {
      return false;
    }
  }
  if (typeof value === 'object') {
    return typeof value?.access_token === 'string' && value.access_token.length > 0;
  }
  return false;
}

function formatRelativeTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';

  const deltaMs = Math.max(0, Date.now() - parsed.getTime());
  const deltaMinutes = Math.floor(deltaMs / 60000);

  if (deltaMinutes <= 0) return 'just now';
  if (deltaMinutes === 1) return '1 min ago';
  if (deltaMinutes < 60) return `${deltaMinutes} min ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours === 1) return '1 hour ago';
  if (deltaHours < 24) return `${deltaHours} hours ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays === 1) return '1 day ago';
  return `${deltaDays} days ago`;
}

function updateSyncStatusUI({ state, label, meta, showRetry = false, retryLabel = 'Retry', retryDisabled = false }) {
  if (elements.syncStateDot) {
    elements.syncStateDot.dataset.state = state;
  }
  if (elements.syncStateText) {
    elements.syncStateText.textContent = label;
  }
  if (elements.syncStateMeta) {
    elements.syncStateMeta.textContent = meta || '';
  }
  if (elements.syncRetryBtn) {
    elements.syncRetryBtn.textContent = retryLabel;
    elements.syncRetryBtn.disabled = retryDisabled;
    elements.syncRetryBtn.classList.toggle('hidden', !showRetry);
  }
}

async function renderSyncStatus() {
  try {
    const syncStorage = await chrome.storage.local.get([
      SYNC_QUEUE_KEY,
      LAST_SYNC_AT_KEY,
      SUPABASE_SESSION_KEY,
    ]);
    const queue = Array.isArray(syncStorage?.[SYNC_QUEUE_KEY]) ? syncStorage[SYNC_QUEUE_KEY] : [];
    const queueCount = queue.length;
    const lastSyncAt = typeof syncStorage?.[LAST_SYNC_AT_KEY] === 'string'
      ? syncStorage[LAST_SYNC_AT_KEY]
      : '';
    const hasSession = hasAccessTokenInSupabaseSession(syncStorage?.[SUPABASE_SESSION_KEY]);
    const authenticated = hasSession || (await checkAuth());

    if (!authenticated) {
      updateSyncStatusUI({
        state: 'none',
        label: 'Not authenticated',
        meta: 'Sign in at app.ellyn.ai to sync',
        showRetry: false,
      });
      return;
    }

    if (queueCount > 0) {
      updateSyncStatusUI({
        state: 'pending',
        label: `Authenticated • Pending (${queueCount})`,
        meta: 'Contacts queued for sync',
        showRetry: true,
        retryLabel: 'Retry',
      });
      return;
    }

    const relative = formatRelativeTime(lastSyncAt);
    updateSyncStatusUI({
      state: 'synced',
      label: 'Authenticated • Synced',
      meta: relative ? `Last synced ${relative}` : 'No recent sync activity',
      showRetry: false,
    });
  } catch (error) {
    console.error('[Popup] Error rendering sync status:', error);
    updateSyncStatusUI({
      state: 'error',
      label: 'Sync status error',
      meta: 'Unable to read sync state',
      showRetry: true,
      retryLabel: 'Retry',
    });
  }
}

function formatSyncHistoryStatus(status) {
  if (status === 'success') return 'Success';
  if (status === 'queued') return 'Queued';
  return 'Failed';
}

async function renderSyncHistory() {
  if (!elements.syncHistoryList || !elements.syncHistoryEmpty) return;

  try {
    const storage = await chrome.storage.local.get([SYNC_LOG_KEY]);
    const entries = Array.isArray(storage?.[SYNC_LOG_KEY]) ? storage[SYNC_LOG_KEY] : [];
    const recentEntries = entries.slice(0, 5);

    elements.syncHistoryList.innerHTML = '';
    elements.syncHistoryEmpty.classList.toggle('hidden', recentEntries.length > 0);

    recentEntries.forEach((entry) => {
      const status = String(entry?.status || 'failed').trim();
      const timeLabel = formatRelativeTime(entry?.timestamp);
      const item = document.createElement('li');
      item.className = 'sync-history-item';
      const errorText = typeof entry?.error === 'string' && entry.error.trim().length > 0
        ? ` • ${entry.error.trim()}`
        : '';
      const row = document.createElement('div');
      row.className = 'sync-history-row';

      const nameNode = document.createElement('span');
      nameNode.className = 'sync-history-name';
      nameNode.textContent = String(entry?.contactName || 'Unknown Contact');

      const statusNode = document.createElement('span');
      statusNode.className = `sync-history-status ${status}`;
      statusNode.textContent = formatSyncHistoryStatus(status);

      const metaNode = document.createElement('p');
      metaNode.className = 'sync-history-meta';
      metaNode.textContent = `${timeLabel || 'just now'}${errorText}`;

      row.appendChild(nameNode);
      row.appendChild(statusNode);
      item.appendChild(row);
      item.appendChild(metaNode);
      elements.syncHistoryList.appendChild(item);
    });
  } catch (error) {
    console.error('[Popup] Error rendering sync history:', error);
    elements.syncHistoryList.innerHTML = '';
    elements.syncHistoryEmpty.textContent = 'Unable to load sync history';
    elements.syncHistoryEmpty.classList.remove('hidden');
  }
}

async function handleSyncRetry() {
  if (!elements.syncRetryBtn) return;
  elements.syncRetryBtn.disabled = true;
  elements.syncRetryBtn.textContent = 'Retrying...';

  try {
    const result = await chrome.runtime.sendMessage({ type: 'PROCESS_SYNC_QUEUE' });
    if (result && typeof result === 'object' && result.ok === false) {
      updateSyncStatusUI({
        state: 'error',
        label: 'Sync status error',
        meta: typeof result.error === 'string' ? result.error : 'Queue retry failed',
        showRetry: true,
      });
    }
  } catch (error) {
    console.error('[Popup] Retry failed:', error);
    updateSyncStatusUI({
      state: 'error',
      label: 'Sync status error',
      meta: 'Queue retry failed',
      showRetry: true,
    });
  } finally {
    await Promise.all([renderSyncStatus(), renderSyncHistory()]);
    if (elements.syncRetryBtn) {
      elements.syncRetryBtn.disabled = false;
      elements.syncRetryBtn.textContent = 'Retry';
    }
  }
}

function bindStorageListeners() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (
      !changes?.[SYNC_QUEUE_KEY] &&
      !changes?.[LAST_SYNC_AT_KEY] &&
      !changes?.[SUPABASE_SESSION_KEY] &&
      !changes?.[SYNC_LOG_KEY]
    ) {
      return;
    }

    void renderSyncStatus();
    void renderSyncHistory();
  });
}

function handleSignIn() {
  const authBase = String(CONFIG.AUTH_BASE_URL || '').replace(/\/+$/, '');
  const authUrl = `${authBase}/auth/login?source=extension&extensionId=${chrome.runtime.id}`;
  chrome.tabs.create({ url: authUrl });
  window.close();
}

function handleConnectApp() {
  const authBase = String(CONFIG.AUTH_BASE_URL || '').replace(/\/+$/, '');
  const url = `${authBase}/extension-auth?extensionId=${chrome.runtime.id}`;
  chrome.tabs.create({ url });
  window.close();
}

function handleOpenPrivacyPage(event) {
  event?.preventDefault?.();
  const url = chrome.runtime.getURL(BUNDLED_PRIVACY_PAGE);
  chrome.tabs.create({ url });
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function showAuthSection() {
  elements.authSection?.classList.remove('hidden');
  elements.finderSection?.classList.add('hidden');
  elements.quotaText.textContent = '--/--';
  hideUpgradeBanner();
}

function showFinderSection() {
  elements.authSection?.classList.add('hidden');
  elements.finderSection?.classList.remove('hidden');
}

function showLoading() {
  elements.findEmailBtn?.classList.add('hidden');
  elements.loadingState?.classList.remove('hidden');
}

function hideLoading() {
  elements.findEmailBtn?.classList.remove('hidden');
  elements.loadingState?.classList.add('hidden');
}

// ============================================================================
// QUOTA FUNCTIONS
// ============================================================================

async function updateQuota() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_QUOTA' });

    if (!response) {
      elements.quotaText.textContent = '--/--';
      return;
    }

    const used = Number(response.used);
    const limit = Number(response.limit);
    const remaining = Number(response.remaining);

    if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0) {
      elements.quotaText.textContent = `${Math.max(0, used)}/${Math.max(1, limit)}`;
    } else if (Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0) {
      const computedUsed = Math.max(0, limit - remaining);
      elements.quotaText.textContent = `${computedUsed}/${limit}`;
    } else {
      elements.quotaText.textContent = '--/--';
    }

    const shouldShowUpgrade =
      response.error === 'Unauthorized'
        ? false
        : Number.isFinite(remaining) && remaining <= 0;

    if (shouldShowUpgrade) {
      showUpgradeBanner({
        resetDate: response.resetDate || null,
      });
    } else {
      hideUpgradeBanner();
    }
  } catch (error) {
    console.error('[Popup] Error updating quota:', error);
    elements.quotaText.textContent = '--/--';
  }
}

// ============================================================================
// EMAIL FINDER (skeleton - will be implemented in main prompts)
// ============================================================================

async function handleFindEmail() {
  console.log('[Popup] Find email clicked');
  showLoading();
  elements.resultsSection?.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com/in/')) {
      alert('Please open a LinkedIn profile page first');
      hideLoading();
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'FIND_EMAIL',
      data: { tabId: tab.id },
    });

    hideLoading();

    if (response?.success) {
      elements.resultsSection?.classList.remove('hidden');
      const source = response?.data?.source;
      if (source === 'student_university') {
        showProfileTypeBadge('Student · Academic email');
      } else if (source === 'profile_scan') {
        showProfileTypeBadge('Public email · Found in profile');
      } else {
        hideProfileTypeBadge();
      }
    } else {
      if (response?.code === 'QUOTA_EXCEEDED' || response?.resetDate) {
        showUpgradeBanner({
          resetDate: response?.resetDate || null,
        });
      }
      alert(`Error: ${response?.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('[Popup] Error finding email:', error);
    hideLoading();
    alert('An error occurred. Please try again.');
  }
}

function bindRuntimeListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type !== 'SHOW_UPGRADE_MODAL') return;

    showUpgradeBanner({
      resetDate: message?.data?.resetDate || null,
      upgradeUrl: message?.data?.upgradeUrl || null,
    });
  });
}

function showUpgradeBanner({ resetDate, upgradeUrl } = {}) {
  if (!elements.upgradeBanner) return;

  const resetText = formatResetDate(resetDate);
  const message = resetText
    ? `Monthly credits reached. Resets ${resetText}.`
    : 'Monthly credits reached. Upgrade to continue.';

  if (elements.upgradeMessage) {
    elements.upgradeMessage.textContent = message;
  }

  if (elements.upgradeLink && typeof upgradeUrl === 'string' && upgradeUrl) {
    elements.upgradeLink.href = upgradeUrl;
  }

  elements.upgradeBanner.classList.remove('hidden');
}

function hideUpgradeBanner() {
  elements.upgradeBanner?.classList.add('hidden');
}

function showProfileTypeBadge(label) {
  if (!elements.profileTypeBadge) return;
  elements.profileTypeBadge.textContent = label;
  elements.profileTypeBadge.classList.remove('hidden');
}

function hideProfileTypeBadge() {
  elements.profileTypeBadge?.classList.add('hidden');
}

function formatResetDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// START
// ============================================================================

document.addEventListener('DOMContentLoaded', init);
