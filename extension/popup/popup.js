// Popup UI Controller
console.log('[Popup] Script loaded');

const CONFIG = {
  AUTH_BASE_URL: 'https://www.useellyn.com',
};

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
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  console.log('[Popup] Initializing...');

  bindRuntimeListeners();

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
}

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

async function checkAuth() {
  try {
    const result = await chrome.storage.local.get(['isAuthenticated', 'user', 'auth_token']);
    const hasStructuredAuth = result?.isAuthenticated === true && Boolean(result?.user);
    const hasTokenOnly = typeof result?.auth_token === 'string' && result.auth_token.length > 0;
    return hasStructuredAuth || hasTokenOnly;
  } catch (error) {
    console.error('[Popup] Error checking auth:', error);
    return false;
  }
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
