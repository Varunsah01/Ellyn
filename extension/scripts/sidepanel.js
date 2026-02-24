const DEFAULT_AUTH_BASE_URL = "https://www.useellyn.com";
const PRICING_URL = "https://www.useellyn.com/pricing";
const DEFAULT_API_BASE_URL = "https://www.useellyn.com";
const DEFAULT_APP_BASE_URL = "https://app.ellyn.app";
const BASE_URL_OVERRIDE_KEY = "ellyn_base_url_override";
const AUTH_SOURCE_ORIGIN_KEY = "ellyn_auth_origin";
const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const AUTH_STORAGE_KEYS = ["isAuthenticated", "user", "auth_token", AUTH_SOURCE_ORIGIN_KEY];
const SAVED_CONTACTS_KEY = "saved_contact_results";
const FEEDBACK_QUEUE_KEY = "feedback_queue";
const SYNC_STATUS_KEY = "sync_status";
const SYNC_QUEUE_KEY = "sync_queue";
const PROFILE_SYNC_INTERVAL_MS = 2000;
const PROFILE_CONTEXT_FRESH_MS = 15000;
const CONTACT_SYNC_STATE = Object.freeze({
  SYNCED: "synced",
  QUEUED: "queued",
  AUTH_FAILED: "auth_failed",
  FAILED: "failed",
});

const STAGES = Object.freeze({
  EXTRACTION: "extraction",
  DRAFT: "draft",
  TRACKING: "tracking",
});

const appState = {
  stage: STAGES.EXTRACTION,
  contact: null,
};

const PIPELINE_STAGES = [
  { label: "Extracting LinkedIn data...", progress: 18 },
  { label: "Resolving company domain...", progress: 42 },
  { label: "Generating email patterns...", progress: 68 },
  { label: "Verifying email...", progress: 90 },
];

const emailFinderState = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  quotaKnown: false,
  quotaAllowsLookup: true,
  currentResult: null,
  currentError: null,
  resultProfileKey: "",
  loadingTimer: null,
  stageIndex: 0,
  upgradeUrl: PRICING_URL,
  profileContext: null,
  profileSyncTimer: null,
  profileRefreshInFlight: false,
  lastProfileKey: "",
  profileListenersBound: false,
  pendingSyncInFlight: false,
};

const elements = {
  statusText: null,
  authHeaderActions: null,
  stageAuth: null,
  emailFinderSection: null,
  stage1: null,
  stage2: null,
  stage3: null,
  signInButton: null,
  createAccountButton: null,
  logoutButton: null,
  findEmailBtn: null,
  draftMailBtn: null,
  loadingState: null,
  loadingStage: null,
  progressFill: null,
  resultsCard: null,
  errorState: null,
  errorMessage: null,
  retryBtn: null,
  confidenceBadge: null,
  confidenceText: null,
resultEmail: null,
  copyEmailBtn: null,
  saveToContactsBtn: null,
  alternativesDetails: null,
  alternativesSummary: null,
  alternativesList: null,
  feedbackSection: null,
  correctionTriggerBtn: null,
  correctionPanel: null,
  correctionAlternativesRow: null,
  correctionAlternativesSelect: null,
  correctionManualInput: null,
  correctionConfirmBtn: null,
  quotaBar: null,
  quotaCount: null,
  quotaFill: null,
  quotaWarning: null,
  upgradeCta: null,
  upgradeText: null,
  upgradeButton: null,
  profileContextCard: null,
  profileContextStatus: null,
  profileContextName: null,
  profileContextRole: null,
  profileContextCompany: null,
  profileContextUrl: null,
  refreshProfileContextBtn: null,
  toastContainer: null,
  syncStatusRow: null,
  syncDot: null,
  syncLabel: null,
  syncActionBtn: null,
  // Queue
  queueEmptyState: null,
  queuePopulatedView: null,
  queueCountLabel: null,
  generateAllDraftsBtn: null,
  queueContactsList: null,
  // Notes toggle
  notesToggle: null,
  notesBody: null,
  // Session-expired banner
  sessionExpiredBanner: null,
  sessionExpiredSignInBtn: null,
  // Dashboard footer nav
  dashFooter: null,
  dashNavContacts: null,
  dashNavAnalytics: null,
  dashNavSettings: null,
  // Stage 2 — sent callout + view-all link
  markSentButton: null,
  sentCallout: null,
  sentCalloutAction: null,
  sentCalloutDismiss: null,
  viewAllInDashboard: null,
  // Issue 1 — Discover Email gate
  discoverEmailButton: null,
  firstName: null,
  lastName: null,
  company: null,
  role: null,
  manualEntryToggle: null,
  manualEntryBody: null,
  // Issue 2 — Copy buttons
  copyEmailButton: null,
  trackingCopyButton: null,
  // Issue 3 — Template menu
  templateToggle: null,
  templateMenu: null,
  templateChevron: null,
  selectedTemplate: null,
  // Issue 4 — Stage 2 back navigation
  backToStage1Btn: null,
  // Issue 5 — Dynamic error state
  errorTitle: null,
  enterManuallyBtn: null,
  // Draft view
  dashNavDraft: null,
  draftViewContainer: null,
  // Stats / settings panel
  statsViewContainer: null,
};

function getDefaultProfileContext() {
  return {
    tabId: null,
    profileUrl: "",
    fullName: "",
    firstName: "",
    lastName: "",
    company: "",
    companyPageUrl: "",
    role: "",
    lastUpdatedAt: 0,
    sourceSummary: "",
  };
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

async function findLocalAppOriginFromOpenTabs() {
  if (!chrome?.tabs?.query) {
    return "";
  }

  try {
    const tabs = await chrome.tabs.query({});
    for (const origin of LOCAL_DEV_ORIGINS) {
      const originWithSlash = `${origin}/`;
      const match = tabs.some((tab) => {
        const tabUrl = String(tab?.url || "");
        return tabUrl === origin || tabUrl.startsWith(originWithSlash);
      });
      if (match) {
        return origin;
      }
    }
  } catch {
    // Ignore tab-query failures and fall back to defaults.
  }

  return "";
}

async function resolveBaseUrls() {
  try {
    const stored = await storageGet([BASE_URL_OVERRIDE_KEY, AUTH_SOURCE_ORIGIN_KEY]);
    const overrideOrigin = normalizeOrigin(stored?.[BASE_URL_OVERRIDE_KEY]);
    if (overrideOrigin) {
      return {
        apiBaseUrl: overrideOrigin,
        appBaseUrl: overrideOrigin,
        authBaseUrl: overrideOrigin,
      };
    }

    const authOrigin = normalizeOrigin(stored?.[AUTH_SOURCE_ORIGIN_KEY]);
    if (authOrigin) {
      return {
        apiBaseUrl: authOrigin,
        appBaseUrl: authOrigin,
        authBaseUrl: authOrigin,
      };
    }
  } catch {
    // Ignore storage read failures and continue.
  }

  const localOrigin = await findLocalAppOriginFromOpenTabs();
  if (localOrigin) {
    return {
      apiBaseUrl: localOrigin,
      appBaseUrl: localOrigin,
      authBaseUrl: localOrigin,
    };
  }

  return {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    appBaseUrl: DEFAULT_APP_BASE_URL,
    authBaseUrl: DEFAULT_AUTH_BASE_URL,
  };
}

async function openDashboardPath(pathname) {
  const normalizedPath = String(pathname || "").startsWith("/")
    ? String(pathname || "")
    : `/${String(pathname || "")}`;
  const { appBaseUrl } = await resolveBaseUrls();
  chrome.tabs.create({ url: `${appBaseUrl}${normalizedPath}` });
}

function cacheElements() {
  elements.statusText = document.getElementById("statusText");
  elements.authHeaderActions = document.getElementById("authHeaderActions");
  elements.stageAuth = document.getElementById("stageAuth");
  elements.emailFinderSection = document.getElementById("emailFinderSection");
  elements.stage1 = document.getElementById("stage1");
  elements.stage2 = document.getElementById("stage2");
  elements.stage3 = document.getElementById("stage3");

  elements.signInButton = document.getElementById("signInButton");
  elements.createAccountButton = document.getElementById("createAccountButton");
  elements.logoutButton = document.getElementById("logoutButton");

  elements.findEmailBtn = document.getElementById("findEmailBtn");
  elements.draftMailBtn = document.getElementById("draftMailBtn");
  elements.loadingState = document.getElementById("loadingState");
  elements.loadingStage = document.getElementById("loadingStage");
  elements.progressFill = document.getElementById("progressFill");
  elements.resultsCard = document.getElementById("resultsCard");
  elements.errorState = document.getElementById("errorState");
  elements.errorMessage = document.getElementById("errorMessage");
  elements.retryBtn = document.getElementById("retryBtn");

  elements.confidenceBadge = document.getElementById("confidenceBadge");
  elements.confidenceText = document.getElementById("confidenceText");
elements.resultEmail = document.getElementById("resultEmail");
  elements.copyEmailBtn = document.getElementById("copyEmailBtn");
  elements.saveToContactsBtn = document.getElementById("saveToContactsBtn");
  elements.alternativesDetails = document.getElementById("alternativesDetails");
  elements.alternativesSummary = document.getElementById("alternativesSummary");
  elements.alternativesList = document.getElementById("alternativesList");
  elements.feedbackSection = document.getElementById("feedbackSection");
  elements.correctionTriggerBtn = document.getElementById("correctionTriggerBtn");
  elements.correctionPanel = document.getElementById("correctionPanel");
  elements.correctionAlternativesRow = document.getElementById("correctionAlternativesRow");
  elements.correctionAlternativesSelect = document.getElementById("correctionAlternativesSelect");
  elements.correctionManualInput = document.getElementById("correctionManualInput");
  elements.correctionConfirmBtn = document.getElementById("correctionConfirmBtn");

  elements.quotaBar = document.getElementById("quotaBar");
  elements.quotaCount = document.getElementById("quotaCount");
  elements.quotaFill = document.getElementById("quotaFill");
  elements.quotaWarning = document.getElementById("quotaWarning");
  elements.upgradeCta = document.getElementById("upgradeCta");
  elements.upgradeText = document.getElementById("upgradeText");
  elements.upgradeButton = document.getElementById("upgradeButton");

  elements.profileContextCard = document.getElementById("profileContextCard");
  elements.profileContextStatus = document.getElementById("profileContextStatus");
  elements.profileContextName = document.getElementById("profileContextName");
  elements.profileContextRole = document.getElementById("profileContextRole");
  elements.profileContextCompany = document.getElementById("profileContextCompany");
  elements.profileContextUrl = document.getElementById("profileContextUrl");
  elements.refreshProfileContextBtn = document.getElementById("refreshProfileContextBtn");

  elements.toastContainer = document.getElementById("toastContainer");

  elements.syncStatusRow = document.getElementById("syncStatusRow");
  elements.syncDot = document.getElementById("syncDot");
  elements.syncLabel = document.getElementById("syncLabel");
  elements.syncActionBtn = document.getElementById("syncActionBtn");

  elements.queueEmptyState = document.getElementById("queueEmptyState");
  elements.queuePopulatedView = document.getElementById("queuePopulatedView");
  elements.queueCountLabel = document.getElementById("queueCountLabel");
  elements.generateAllDraftsBtn = document.getElementById("generateAllDraftsBtn");
  elements.queueContactsList = document.getElementById("queueContactsList");
  elements.notesToggle = document.getElementById("notesToggle");
  elements.notesBody = document.getElementById("notesBody");
  elements.sessionExpiredBanner = document.getElementById("sessionExpiredBanner");
  elements.sessionExpiredSignInBtn = document.getElementById("sessionExpiredSignInBtn");
  // Dashboard footer nav
  elements.dashFooter = document.getElementById("dashFooter");
  elements.dashNavContacts = document.getElementById("dashNavContacts");
  elements.dashNavAnalytics = document.getElementById("dashNavAnalytics");
  elements.dashNavSettings = document.getElementById("dashNavSettings");
  // Stage 2 — sent callout + view-all link
  elements.markSentButton = document.getElementById("markSentButton");
  elements.sentCallout = document.getElementById("sentCallout");
  elements.sentCalloutAction = document.getElementById("sentCalloutAction");
  elements.sentCalloutDismiss = document.getElementById("sentCalloutDismiss");
  elements.viewAllInDashboard = document.getElementById("viewAllInDashboard");
  // Issue 1 — Discover Email gate
  elements.discoverEmailButton = document.getElementById("discoverEmailButton");
  elements.firstName = document.getElementById("firstName");
  elements.lastName = document.getElementById("lastName");
  elements.company = document.getElementById("company");
  elements.role = document.getElementById("role");
  elements.manualEntryToggle = document.getElementById("manualEntryToggle");
  elements.manualEntryBody = document.getElementById("manualEntryBody");
  // Issue 2 — Copy buttons
  elements.copyEmailButton = document.getElementById("copyEmailButton");
  elements.trackingCopyButton = document.getElementById("trackingCopyButton");
  // Issue 3 — Template menu
  elements.templateToggle = document.getElementById("templateToggle");
  elements.templateMenu = document.getElementById("templateMenu");
  elements.templateChevron = document.getElementById("templateChevron");
  elements.selectedTemplate = document.getElementById("selectedTemplate");
  // Issue 4 — Stage 2 back navigation
  elements.backToStage1Btn = document.getElementById("backToStage1Btn");
  // Issue 5 — Dynamic error state
  elements.errorTitle = document.getElementById("errorTitle");
  elements.enterManuallyBtn = document.getElementById("enterManuallyBtn");
  // Draft view
  elements.dashNavDraft       = document.getElementById("dashNavDraft");
  elements.draftViewContainer = document.getElementById("draftViewContainer");
  elements.statsViewContainer = document.getElementById("statsViewContainer");
}

function bindEvents() {
  elements.syncActionBtn?.addEventListener("click", handleSyncAction);
  elements.notesToggle?.addEventListener("click", toggleNotesBody);
  elements.sessionExpiredSignInBtn?.addEventListener("click", () => openAuth("signin", elements.sessionExpiredSignInBtn));
  elements.signInButton?.addEventListener("click", () => openAuth("signin", elements.signInButton));
  elements.createAccountButton?.addEventListener("click", () => openAuth("signup", elements.createAccountButton));
  elements.logoutButton?.addEventListener("click", signOut);
  elements.findEmailBtn?.addEventListener("click", findEmail);
  elements.draftMailBtn?.addEventListener("click", () => {
    void openDraftForCurrentResult();
  });
  elements.retryBtn?.addEventListener("click", findEmail);
  elements.copyEmailBtn?.addEventListener("click", () => copyCurrentEmail());
  elements.saveToContactsBtn?.addEventListener("click", saveCurrentResultToContacts);
  elements.upgradeButton?.addEventListener("click", () => {
    const url = emailFinderState.upgradeUrl || PRICING_URL;
    chrome.tabs.create({ url });
  });
  elements.refreshProfileContextBtn?.addEventListener("click", () => {
    void refreshProfileContext("manual");
  });
  elements.queueContactsList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const copyBtn = target.closest(".queue-copy-btn");
    if (!(copyBtn instanceof HTMLElement)) return;
    const email = String(copyBtn.dataset.email || "").trim();
    if (!email) return;
    void copyTextWithFeedback(email, copyBtn);
  });

  // ── Dashboard footer nav ─────────────────────────────────────────────────
  elements.dashNavContacts?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/contacts");
  });
  elements.dashNavAnalytics?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/analytics");
  });
  elements.dashNavSettings?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/settings");
  });

  // ── Stage 2 — sent callout ───────────────────────────────────────────────
  elements.markSentButton?.addEventListener("click", () => {
    showSentCallout();
  });
  elements.sentCalloutAction?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/analytics");
    dismissSentCallout();
  });
  elements.sentCalloutDismiss?.addEventListener("click", dismissSentCallout);

  // ── Stage 2 — view all in dashboard link ────────────────────────────────
  elements.viewAllInDashboard?.addEventListener("click", (e) => {
    e.preventDefault();
    void openDashboardPath("/dashboard/contacts?status=contacted");
  });

  // ── Issue 1: Discover Email button gate ─────────────────────────────────
  const manualFields = [elements.firstName, elements.lastName, elements.company, elements.role];
  manualFields.forEach((field) => {
    field?.addEventListener("input", validateDiscoverEmailBtn);
  });
  // Prevent form submit if button is still disabled (double-safety)
  document.getElementById("contactForm")?.addEventListener("submit", (e) => {
    if (elements.discoverEmailButton?.disabled) e.preventDefault();
  });

  // ── Issue 2: Copy buttons with checkmark feedback ────────────────────────
  elements.copyEmailButton?.addEventListener("click", () => {
    const email = String(document.getElementById("contactEmailText")?.textContent || "").trim();
    void copyTextWithFeedback(email, elements.copyEmailButton);
  });
  elements.trackingCopyButton?.addEventListener("click", () => {
    const email = String(document.getElementById("trackingEmail")?.textContent || "").trim();
    void copyTextWithFeedback(email, elements.trackingCopyButton);
  });

  // ── Issue 3: Template menu ───────────────────────────────────────────────
  elements.templateToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTemplateMenu();
  });
  elements.templateMenu?.addEventListener("click", (e) => {
    const option = e.target.closest(".template-option");
    if (!option) return;
    const name = option.dataset.template || "";
    if (elements.selectedTemplate) elements.selectedTemplate.textContent = name;
    elements.templateToggle?.setAttribute("aria-selected-value", name);
    closeTemplateMenu();
  });
  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTemplateMenu();
  });
  // Close on click outside
  document.addEventListener("click", (e) => {
    if (!elements.templateMenu?.classList.contains("hidden") &&
        !elements.templateToggle?.contains(e.target) &&
        !elements.templateMenu?.contains(e.target)) {
      closeTemplateMenu();
    }
  });
  // Close on scroll
  document.querySelector("main")?.addEventListener("scroll", () => closeTemplateMenu(), { passive: true });

  // ── Issue 4: Stage 2 back button ─────────────────────────────────────────
  elements.backToStage1Btn?.addEventListener("click", () => {
    goToStage(STAGES.EXTRACTION);
  });

  // ── Issue 5: "Enter manually" link in error state ─────────────────────────
  elements.enterManuallyBtn?.addEventListener("click", () => {
    expandManualEntryForm();
  });

  // ── Draft view tab ─────────────────────────────────────────────────────────
  elements.dashNavDraft?.addEventListener("click", () => {
    if (elements.draftViewContainer?.classList.contains("hidden")) {
      void switchToDraftView();
    } else {
      switchToFinderView();
    }
  });

  // Events bubbled up from the draft view's own header buttons
  // Settings button → show local draft analytics (not web-app settings)
  elements.draftViewContainer?.addEventListener("dv-settings-clicked", () => {
    void switchToStatsView();
  });
  elements.draftViewContainer?.addEventListener("dv-profile-clicked", () => {
    void openDashboardPath("/dashboard");
  });
  elements.draftViewContainer?.addEventListener("dv-sent", (e) => {
    console.log("[Sidepanel] Draft sent via Gmail:", e.detail);
    // The draft view and gmail-action-button handle storage and toast internally
  });

  initCorrectionUI();
}

function bindRuntimeListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "AUTH_SUCCESS") {
      syncAuthStateFromStorage();
      setStatus("Authentication complete.", "success");
      return;
    }

    if (message.type === "AUTH_LOGOUT") {
      syncAuthStateFromStorage();
      setStatus("Signed out.", "neutral");
      return;
    }

    if (message.type === "SHOW_UPGRADE_MODAL") {
      // Credit limits are currently disabled for the extension flow.
      setUpgradeState(false, "", message?.data?.upgradeUrl || PRICING_URL);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const supabaseSessionChanged = Object.keys(changes).some(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
    );
    if (changes.isAuthenticated || changes.user || changes.auth_token || supabaseSessionChanged) {
      syncAuthStateFromStorage();
    }
    if (changes[SYNC_STATUS_KEY] || changes[SYNC_QUEUE_KEY]) {
      void renderSyncStatus();
    }
    if (changes[SAVED_CONTACTS_KEY] || changes[SYNC_QUEUE_KEY] || changes[SYNC_STATUS_KEY]) {
      void renderQueueCard();
    }
  });
}

async function init() {
  emailFinderState.profileContext = getDefaultProfileContext();
  cacheElements();
  bindEvents();
  bindRuntimeListeners();
  hideLegacyStages();
  resetProfileContext();
  await syncAuthStateFromStorage();
}

function hideLegacyStages() {
  elements.stage1?.classList.add("hidden");
  elements.stage2?.classList.add("hidden");
  elements.stage3?.classList.add("hidden");
}

function isSupabaseSessionValue(rawValue) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return false;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return typeof parsed?.access_token === "string" && parsed.access_token.length > 0;
  } catch {
    return false;
  }
}

async function hasStoredSupabaseSession() {
  try {
    const allStorage = await storageGet(null);
    return Object.entries(allStorage || {}).some(([key, value]) => {
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) {
        return false;
      }
      return isSupabaseSessionValue(value);
    });
  } catch {
    return false;
  }
}

async function syncAuthStateFromStorage() {
  const auth = await storageGet(AUTH_STORAGE_KEYS);
  const hasSupabaseSession = await hasStoredSupabaseSession();
  let authToken = typeof auth?.auth_token === "string" ? auth.auth_token.trim() : "";
  if (!authToken && hasSupabaseSession) {
    authToken = await getAuthToken();
  }
  const isAuthenticated = hasSupabaseSession && authToken.length > 0;

  emailFinderState.isAuthenticated = isAuthenticated;
  emailFinderState.user = auth?.user || null;
  renderAuthState();

  if (isAuthenticated) {
    // Personalised greeting — replaced once profile status is known
    const userMeta =
      emailFinderState.user &&
      typeof emailFinderState.user === "object" &&
      emailFinderState.user.user_metadata
        ? emailFinderState.user.user_metadata
        : {};
    const rawName = String(
      userMeta.full_name ||
        userMeta.name ||
        (typeof emailFinderState.user?.email === "string"
          ? emailFinderState.user.email.split("@")[0]
          : "") ||
        ""
    ).trim();
    const firstName = rawName.split(/\s+/)[0] || "";
    if (firstName) {
      setStatus(`Hi, ${firstName} 👋`, "neutral");
    }

    startProfileContextSync();
    await updateQuotaStatus();
    await refreshProfileContext("auth");
    const linkedInHint = await hasLinkedInProfileOpen();
    if (!linkedInHint) {
      setStatus("Open a LinkedIn profile to get started.", "neutral");
    } else {
      setStatus("Profile ready.", "success");
    }

    // Best effort: once auth is valid, flush any contacts waiting for backend sync.
    void syncPendingContactsQuietly();
  } else {
    setStatus("Sign in to use the email finder.", "neutral");
  }

  void renderSyncStatus();
}

function renderAuthState() {
  elements.authHeaderActions?.classList.toggle("hidden", !emailFinderState.isAuthenticated);
  elements.stageAuth?.classList.toggle("hidden", emailFinderState.isAuthenticated);
  elements.emailFinderSection?.classList.toggle("hidden", !emailFinderState.isAuthenticated);
  elements.dashFooter?.classList.toggle("visible", emailFinderState.isAuthenticated);

  if (!emailFinderState.isAuthenticated) {
    emailFinderState.quotaKnown = false;
    emailFinderState.quotaAllowsLookup = false;
    stopProfileContextSync();
    resetProfileContext();
    stopLoadingCycle();
    hideResultAndError();
    resetQuotaUI();
    // Tear down draft + stats views so they re-render fresh on next login
    _hideDraftView();
    _hideStatsView();
  } else {
    hideSessionExpiredBanner();
  }

  applyFindEmailAvailability();
  renderStages();
  if (emailFinderState.isAuthenticated) {
    void renderQueueCard();
  }
}

function startProfileContextSync() {
  if (!emailFinderState.isAuthenticated) return;

  if (!emailFinderState.profileListenersBound) {
    chrome.tabs.onActivated.addListener(handleProfileTabActivated);
    chrome.tabs.onUpdated.addListener(handleProfileTabUpdated);
    emailFinderState.profileListenersBound = true;
  }

  if (!emailFinderState.profileSyncTimer) {
    emailFinderState.profileSyncTimer = setInterval(() => {
      void refreshProfileContext("poll");
    }, PROFILE_SYNC_INTERVAL_MS);
  }
}

function stopProfileContextSync() {
  if (emailFinderState.profileSyncTimer) {
    clearInterval(emailFinderState.profileSyncTimer);
    emailFinderState.profileSyncTimer = null;
  }

  if (emailFinderState.profileListenersBound) {
    chrome.tabs.onActivated.removeListener(handleProfileTabActivated);
    chrome.tabs.onUpdated.removeListener(handleProfileTabUpdated);
    emailFinderState.profileListenersBound = false;
  }
}

function handleProfileTabActivated() {
  if (!emailFinderState.isAuthenticated) return;
  void refreshProfileContext("tab-activated");
}

function handleProfileTabUpdated(_tabId, changeInfo, tab) {
  if (!emailFinderState.isAuthenticated) return;
  if (!tab?.active) return;
  if (!changeInfo?.url && changeInfo?.status !== "complete") return;
  void refreshProfileContext("tab-updated");
}

async function refreshProfileContext(reason = "auto") {
  if (!emailFinderState.isAuthenticated) return;
  if (emailFinderState.profileRefreshInFlight) return;

  console.log("[Sidepanel] Refreshing profile context", { reason });
  emailFinderState.profileRefreshInFlight = true;
  setProfileRefreshButtonBusy(true);

  try {
    const [activeTab] = await queryTabs({ active: true, currentWindow: true });
    const tabId = Number.isFinite(activeTab?.id) ? activeTab.id : null;
    const tabUrl = typeof activeTab?.url === "string" ? activeTab.url : "";
    const previousProfileKey = emailFinderState.lastProfileKey;
    console.log("[Sidepanel] Active tab for profile context", { tabId, tabUrl });

    if (!Number.isFinite(tabId) || !isLinkedInProfile(tabUrl)) {
      if (previousProfileKey || emailFinderState.currentResult || emailFinderState.currentError) {
        clearLookupStateForProfileChange("left-linkedin-profile");
      }
      emailFinderState.lastProfileKey = "";
      resetProfileContext("Open a LinkedIn profile to begin.", "neutral");
      return;
    }

    const incomingKey = buildProfileContextKey(tabId, tabUrl);
    if (previousProfileKey && incomingKey !== previousProfileKey) {
      clearLookupStateForProfileChange("linkedin-profile-url-changed");
    }
    const ageMs = Date.now() - Number(emailFinderState.profileContext?.lastUpdatedAt || 0);
    if (reason !== "manual" && incomingKey === emailFinderState.lastProfileKey && ageMs < PROFILE_SYNC_INTERVAL_MS) {
      return;
    }

    const extractorResponse = await requestProfileExtraction(tabId, reason === "manual");
    console.log("[Sidepanel] Extraction response", extractorResponse);
    if (!extractorResponse?.success || !extractorResponse?.data) {
      const failure = String(extractorResponse?.error || "");
      const isNeutral = /not on a linkedin profile page/i.test(failure);
      renderProfileContext(
        {
          ...getDefaultProfileContext(),
          tabId,
          profileUrl: tabUrl,
          lastUpdatedAt: Date.now(),
        },
        isNeutral ? "neutral" : "error",
        isNeutral ? "Open a LinkedIn profile to begin." : "Unable to load profile."
      );
      emailFinderState.lastProfileKey = incomingKey;
      return;
    }

    const normalized = normalizeProfileResponseData(extractorResponse, tabUrl);
    const firstName = normalized.firstName;
    const lastName = normalized.lastName;
    const fullName = normalized.fullName;
    const company = normalized.company;
    const role = normalized.role;
    const profileUrl = normalized.profileUrl;
    const sourceSummary = [
      normalized.nameSource ? `name:${normalized.nameSource}` : "",
      normalized.companySource ? `company:${normalized.companySource}` : "",
      normalized.roleSource ? `role:${normalized.roleSource}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const nextContext = {
      tabId,
      profileUrl,
      fullName,
      firstName,
      lastName,
      company,
      companyPageUrl: normalized.companyPageUrl || "",
      role,
      lastUpdatedAt: Date.now(),
      sourceSummary,
    };

    let tone = "success";
    let status = "Profile loaded.";
    if (!fullName && !company) {
      tone = "error";
      status = "Unable to load profile.";
    } else if (!fullName) {
      tone = "warning";
      status = "Profile detected, but name was not found.";
    } else if (!company) {
      tone = "warning";
      status = "Profile detected, but company was not found.";
    }

    renderProfileContext(nextContext, tone, status);
    console.log("[Sidepanel] Profile context updated", nextContext);
    emailFinderState.lastProfileKey = buildProfileContextKey(tabId, profileUrl || tabUrl);
  } catch (error) {
    console.warn("[Sidepanel] Failed refreshing profile context:", error);
    renderProfileContext(emailFinderState.profileContext || getDefaultProfileContext(), "error", "Unable to load profile.");
  } finally {
    emailFinderState.profileRefreshInFlight = false;
    setProfileRefreshButtonBusy(false);
  }
}

function normalizeProfileResponseData(response, fallbackUrl = "") {
  const data = response?.data || {};
  const normalized = response?.normalized || {};

  const firstName = String(normalized.firstName || data?.name?.firstName || "").trim();
  const lastName = String(normalized.lastName || data?.name?.lastName || "").trim();
  const fullName = String(normalized.fullName || data?.name?.fullName || [firstName, lastName].filter(Boolean).join(" ")).trim();
  let company = "";
  if (typeof normalized.company === "string") {
    company = normalized.company.trim();
  } else if (normalized.company && typeof normalized.company === "object" && normalized.company.name) {
    company = String(normalized.company.name).trim();
  } else if (typeof data?.company === "string") {
    company = data.company.trim();
  } else if (data?.company && typeof data.company === "object" && data.company.name) {
    company = String(data.company.name).trim();
  } else if (data?.company && typeof data.company === "object") {
    console.warn("[Sidepanel] Company is an object without a name field:", data.company);
  }

  let role = "";
  if (typeof normalized.role === "string") {
    role = normalized.role.trim();
  } else if (normalized.role && typeof normalized.role === "object" && normalized.role.title) {
    role = String(normalized.role.title).trim();
  } else if (typeof data?.role === "string") {
    role = data.role.trim();
  } else if (data?.role && typeof data.role === "object" && data.role.title) {
    role = String(data.role.title).trim();
  }

  if (!company && role) {
    const fromRoleMatch = role.match(/\b(?:at|@)\s+([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||,|\u00B7|\u2022|$))/i);
    if (fromRoleMatch?.[1]) {
      company = normalizeInline(fromRoleMatch[1]);
    }
  }

  const profileUrl = String(normalized.profileUrl || data?.profileUrl || fallbackUrl || "").trim();
  const companyPageUrl = String(
    normalized.companyPageUrl ||
      data?.company?.pageUrl ||
      data?.companyPageUrl ||
      ""
  ).trim();
  const nameSource = String(data?.name?.source || "").trim();
  const companySource = String(data?.company?.source || "").trim();
  const roleSource = String(data?.role?.source || "").trim();

  return {
    firstName,
    lastName,
    fullName,
    company,
    companyPageUrl,
    role,
    profileUrl,
    nameSource,
    companySource,
    roleSource,
  };
}

function renderProfileContext(context, statusTone = "neutral", statusText = "Open a LinkedIn profile to begin.") {
  const merged = {
    ...getDefaultProfileContext(),
    ...(context || {}),
  };

  emailFinderState.profileContext = merged;

  if (elements.profileContextStatus) {
    elements.profileContextStatus.dataset.tone = statusTone;
    elements.profileContextStatus.textContent = statusText;
  }

  if (elements.profileContextName) {
    elements.profileContextName.textContent = merged.fullName || "\u2014";
  }

  if (elements.profileContextRole) {
    let roleText = "\u2014";
    if (merged.role) {
      if (typeof merged.role === "string") {
        roleText = merged.role;
      } else if (typeof merged.role === "object") {
        roleText = merged.role.title || "\u2014";
      }
    }
    elements.profileContextRole.textContent = roleText;
  }

  if (elements.profileContextCompany) {
    let companyText = "\u2014";
    if (merged.company) {
      if (typeof merged.company === "string") {
        companyText = merged.company;
      } else if (typeof merged.company === "object") {
        companyText = merged.company.name || "\u2014";
        console.warn("[Sidepanel] Company was object in renderProfileContext:", merged.company);
      }
    }
    elements.profileContextCompany.textContent = companyText;
  }

  if (elements.profileContextUrl) {
    const displayUrl = formatProfileUrlForDisplay(merged.profileUrl);
    elements.profileContextUrl.textContent = displayUrl || "\u2014";
    elements.profileContextUrl.title = merged.profileUrl || "";

    if (merged.profileUrl && merged.profileUrl.startsWith("http")) {
      elements.profileContextUrl.style.cursor = "pointer";
      elements.profileContextUrl.style.color = "#3b82f6";
      elements.profileContextUrl.onclick = () => {
        chrome.tabs.create({ url: merged.profileUrl });
      };
    } else {
      elements.profileContextUrl.style.cursor = "default";
      elements.profileContextUrl.style.color = "inherit";
      elements.profileContextUrl.onclick = null;
    }
  }

  applyFindEmailAvailability();
}

function resetProfileContext(statusText = "Open a LinkedIn profile to begin.", tone = "neutral") {
  emailFinderState.profileContext = getDefaultProfileContext();
  emailFinderState.lastProfileKey = "";
  renderProfileContext(emailFinderState.profileContext, tone, statusText);
}

function setProfileRefreshButtonBusy(isBusy) {
  if (!elements.refreshProfileContextBtn) return;
  elements.refreshProfileContextBtn.disabled = isBusy;
  elements.refreshProfileContextBtn.textContent = isBusy ? "Refreshing..." : "Refresh";
}

function buildProfileContextKey(tabId, profileUrl) {
  const safeTabId = Number.isFinite(tabId) ? String(tabId) : "none";
  const safeUrl = String(profileUrl || "")
    .trim()
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();
  return `${safeTabId}:${safeUrl}`;
}

function splitHumanName(fullName) {
  const raw = String(fullName || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) {
    return { firstName: "", lastName: "", fullName: "" };
  }

  const parts = raw.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "", fullName: parts[0] };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: raw,
  };
}

function normalizeInline(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeInline(value);
    if (normalized) return normalized;
  }
  return "";
}

function toDisplayCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deriveNameFromEmail(email) {
  const localPart = String(email || "")
    .split("@")[0]
    .toLowerCase();
  const parts = localPart
    .split(/[._-]+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "Unknown", lastName: "Contact" };
  }

  const firstName = toDisplayCase(parts[0]) || "Unknown";
  const lastName = toDisplayCase(parts.slice(1).join(" ")) || "Contact";
  return { firstName, lastName };
}

function deriveCompanyFromEmail(email) {
  const domain = String(email || "")
    .split("@")[1]
    ?.toLowerCase()
    .trim();
  if (!domain) return "Unknown Company";

  const parts = domain.split(".").filter(Boolean);
  if (parts.length === 0) return "Unknown Company";

  const companyToken = (parts.length >= 2 ? parts[parts.length - 2] : parts[0])
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/[_-]+/g, " ");
  const displayName = toDisplayCase(companyToken);
  return displayName || "Unknown Company";
}

function normalizeLinkedInUrlForApi(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let candidate = raw;
  if (/^\/in\//i.test(candidate)) {
    candidate = `https://www.linkedin.com${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate) && /^www\.linkedin\.com\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!/linkedin\.com$/i.test(parsed.hostname) && !/\.linkedin\.com$/i.test(parsed.hostname)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function hasUsableProfileIdentity(response, fallbackUrl = "") {
  const normalized = normalizeProfileResponseData(response, fallbackUrl);
  return Boolean(normalized.fullName && normalized.company);
}

function getProfileContextGateStatus() {
  const context = emailFinderState.profileContext;
  if (!context || !Number.isFinite(context.tabId)) {
    return {
      ready: false,
      message: "Open a LinkedIn profile to begin.",
    };
  }

  const ageMs = Date.now() - Number(context.lastUpdatedAt || 0);
  if (ageMs > PROFILE_CONTEXT_FRESH_MS) {
    return {
      ready: false,
      message: "Profile preview is stale. Refresh to continue.",
    };
  }

  const hasName = Boolean(String(context.fullName || "").trim());
  const hasCompany = Boolean(String(context.company || "").trim());
  if (!hasName || !hasCompany) {
    return {
      ready: false,
      message: "Find Email is locked until both name and company are detected.",
    };
  }

  return { ready: true, message: "" };
}

function applyFindEmailAvailability() {
  if (!elements.findEmailBtn) return;

  const disabledByAuth = !emailFinderState.isAuthenticated;
  const gateStatus = getProfileContextGateStatus();
  const disabledByProfile = emailFinderState.isAuthenticated && !gateStatus.ready;
  const disabledByLoading = emailFinderState.isLoading;

  const shouldDisable = disabledByAuth || disabledByProfile || disabledByLoading;
  if (shouldDisable) {
    elements.findEmailBtn.setAttribute("disabled", "true");
  } else {
    elements.findEmailBtn.removeAttribute("disabled");
  }

  const reason = disabledByProfile
    ? gateStatus.message
    : disabledByAuth
    ? "Sign in to use email finder."
    : "";
  elements.findEmailBtn.title = reason;
}

function clearLookupStateForProfileChange(reason = "profile-changed") {
  const hadVisibleState = Boolean(
    emailFinderState.currentResult ||
      emailFinderState.currentError ||
      !elements.resultsCard?.classList.contains("hidden") ||
      !elements.errorState?.classList.contains("hidden")
  );

  emailFinderState.currentResult = null;
  emailFinderState.currentError = null;
  emailFinderState.resultProfileKey = "";

  if (elements.resultEmail) {
    elements.resultEmail.textContent = "";
  }

  renderAlternatives([]);
  elements.feedbackSection?.classList.add("hidden");
  hideResultAndError();
  _hideStatsView();
  _hideDraftView();
  _dvLastContactKey = "";

  if (hadVisibleState) {
    console.log("[Sidepanel] Cleared stale lookup state", { reason });
    setStatus("Profile changed. Previous result cleared.", "neutral");
  }
}

function setPrimaryFinderAction(mode = "find") {
  const showFind = mode === "find";
  const showDraft = mode === "draft";

  if (elements.findEmailBtn) {
    elements.findEmailBtn.classList.toggle("hidden", !showFind);
    if (!showFind) {
      elements.findEmailBtn.setAttribute("disabled", "true");
    }
  }

  if (elements.draftMailBtn) {
    elements.draftMailBtn.classList.toggle("hidden", !showDraft);
    elements.draftMailBtn.disabled = !showDraft;
  }

  if (showFind) {
    applyFindEmailAvailability();
  }
}

async function openDraftForCurrentResult() {
  const email = String(emailFinderState.currentResult?.email || "").trim();
  if (!email) {
    setPrimaryFinderAction("find");
    showToast("Find an email first.", "error");
    return;
  }
  await switchToDraftView();
}

function getFreshCompleteProfileContextPayload(tabId) {
  const context = emailFinderState.profileContext;
  if (!context || !Number.isFinite(context.tabId) || context.tabId !== tabId) {
    return null;
  }

  const ageMs = Date.now() - Number(context.lastUpdatedAt || 0);
  if (ageMs > PROFILE_CONTEXT_FRESH_MS) {
    return null;
  }

  const fullName = String(context.fullName || "").trim();
  const company = String(context.company || "").trim();
  if (!fullName || !company) {
    return null;
  }

  const split = splitHumanName(fullName);
  const firstName = String(context.firstName || split.firstName || "").trim();
  const lastName = String(context.lastName || split.lastName || "").trim();
  if (!firstName) {
    return null;
  }

  return {
    firstName,
    lastName,
    company,
    companyPageUrl: context.companyPageUrl || "",
    role: context.role || "",
    profileUrl: context.profileUrl || "",
  };
}

function hasIncompleteProfileContextForTab(tabId) {
  const context = emailFinderState.profileContext;
  if (!context || !Number.isFinite(context.tabId) || context.tabId !== tabId) {
    return false;
  }

  const ageMs = Date.now() - Number(context.lastUpdatedAt || 0);
  if (ageMs > PROFILE_CONTEXT_FRESH_MS) {
    return false;
  }

  return !context.fullName || !context.company;
}

function formatProfileUrlForDisplay(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  return value.replace(/^https?:\/\//i, "");
}

async function openAuth(mode, button) {
  if (button) button.disabled = true;

  try {
    const { authBaseUrl } = await resolveBaseUrls();
    const authPath = mode === "signup" ? "/auth/signup" : "/auth/login";
    const authUrl = new URL(authPath, `${authBaseUrl}/`);
    authUrl.searchParams.set("source", "extension");
    authUrl.searchParams.set("extensionId", chrome.runtime.id);

    chrome.tabs.create({ url: authUrl.toString() }, () => {
      if (chrome.runtime.lastError) {
        showToast("Unable to open auth tab.", "error");
        return;
      }
      setStatus("Authentication opened in a new tab.", "neutral");
    });
  } finally {
    if (button) button.disabled = false;
  }
}

function signOut() {
  elements.logoutButton?.setAttribute("disabled", "true");

  chrome.runtime.sendMessage({ type: "AUTH_LOGOUT_LOCAL" }, async (response) => {
    elements.logoutButton?.removeAttribute("disabled");

    if (chrome.runtime.lastError || !response?.ok) {
      await storageRemove(AUTH_STORAGE_KEYS);
      await syncAuthStateFromStorage();
      showToast("Signed out locally.", "info");
      return;
    }

    await syncAuthStateFromStorage();
    showToast("Signed out.", "success");
  });
}

async function findEmail() {
  if (emailFinderState.isLoading) return;

  if (!emailFinderState.isAuthenticated) {
    setStatus("Please sign in first.", "error");
    return;
  }

  const gateStatus = getProfileContextGateStatus();
  if (!gateStatus.ready) {
    setStatus(gateStatus.message, "error");
    return;
  }

  try {
    hideResultAndError();
    startLoadingCycle();

    const tab = await getLinkedInProfileTab();
    const contextPayload = getFreshCompleteProfileContextPayload(tab.id);
    if (!contextPayload) {
      throw new Error("Profile preview is stale or incomplete. Refresh and confirm name + company.");
    }

    const pipelineData = { tabId: tab.id, ...contextPayload };

    const response = await sendRuntimeMessage({
      type: "FIND_EMAIL",
      data: pipelineData,
    });

    finishLoadingCycle(100);

    if (!response?.success || !response?.data) {
      const error = new Error(response?.error || "Could not find email.");
      error.code = response?.code || "";
      error.resetDate = response?.resetDate || null;
      throw error;
    }

    displayResults(response.data);
    await updateQuotaStatus();
  } catch (error) {
    stopLoadingCycle();
    const message = error instanceof Error ? error.message : "Could not find email.";
    const code = error?.code || "";
    const resetDate = error?.resetDate || null;
    showError(message, code, resetDate);
    await updateQuotaStatus();
  }
}

function startLoadingCycle() {
  emailFinderState.isLoading = true;
  emailFinderState.stageIndex = 0;
  elements.emailFinderSection?.classList.add("is-loading");
  elements.loadingState?.classList.remove("hidden");
  setPrimaryFinderAction("none");
  updateLoadingStage(PIPELINE_STAGES[0].label, PIPELINE_STAGES[0].progress);

  stopStageTimerOnly();
  emailFinderState.loadingTimer = setInterval(() => {
    if (!emailFinderState.isLoading) return;

    const atFinalStage = emailFinderState.stageIndex >= PIPELINE_STAGES.length - 1;
    if (!atFinalStage) {
      emailFinderState.stageIndex += 1;
      const stage = PIPELINE_STAGES[emailFinderState.stageIndex];
      updateLoadingStage(stage.label, stage.progress);
      return;
    }

    const currentProgress = Number(elements.progressFill?.dataset.progress || "90");
    const nextProgress = Math.min(95, currentProgress + 1);
    updateLoadingStage(PIPELINE_STAGES[emailFinderState.stageIndex].label, nextProgress);
  }, 1300);
}

function finishLoadingCycle(finalProgress) {
  updateLoadingStage("Completed.", finalProgress);
  stopLoadingCycle();
}

function stopStageTimerOnly() {
  if (emailFinderState.loadingTimer) {
    clearInterval(emailFinderState.loadingTimer);
    emailFinderState.loadingTimer = null;
  }
}

function stopLoadingCycle() {
  emailFinderState.isLoading = false;
  stopStageTimerOnly();
  elements.loadingState?.classList.add("hidden");
  elements.emailFinderSection?.classList.remove("is-loading");
  const hasFoundEmail = Boolean(String(emailFinderState.currentResult?.email || "").trim());
  setPrimaryFinderAction(hasFoundEmail ? "draft" : "find");
}

function updateLoadingStage(label, progress) {
  if (elements.loadingStage) {
    elements.loadingStage.textContent = label;
  }

  if (elements.progressFill) {
    const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
    elements.progressFill.style.width = `${safeProgress}%`;
    elements.progressFill.dataset.progress = String(safeProgress);
    elements.progressFill.parentElement?.setAttribute("aria-valuenow", String(Math.round(safeProgress)));
  }
}

function hideResultAndError() {
  elements.resultsCard?.classList.add("hidden");
  elements.errorState?.classList.add("hidden");
  setPrimaryFinderAction("find");
}

function displayResults(data) {
  emailFinderState.currentResult = data || null;
  emailFinderState.currentError = null;
  emailFinderState.resultProfileKey = buildProfileContextKey(
    emailFinderState.profileContext?.tabId,
    emailFinderState.profileContext?.profileUrl
  );

  const email = String(data?.email || "").trim();
  const confidencePercent = toConfidencePercent(data?.confidence);
  const confidenceLevel = getConfidenceLevel(confidencePercent);
  const alternatives = Array.isArray(data?.alternativeEmails) ? data.alternativeEmails : [];

  if (elements.confidenceBadge) {
    elements.confidenceBadge.dataset.level = confidenceLevel;
  }
  if (elements.confidenceText) {
    elements.confidenceText.textContent = `Email Found (${confidencePercent}% confidence)`;
  }
  if (elements.resultEmail) {
    elements.resultEmail.textContent = email || "No email returned";
  }

  renderAlternatives(alternatives);

  elements.feedbackSection?.classList.remove("hidden");
  elements.resultsCard?.classList.remove("hidden");
  elements.errorState?.classList.add("hidden");
  setPrimaryFinderAction("draft");

  setStatus("Email found successfully.", "success");

  // A new email was found — invalidate the draft view's contact key so it
  // re-renders with the correct email the next time the user switches to it.
  _dvLastContactKey = "";

  // SUBTLE_CORRECTION_UI: Reset correction panel state for new result
  if (elements.correctionPanel) {
    elements.correctionPanel.classList.add("hidden");
  }
  if (elements.correctionTriggerBtn) {
    elements.correctionTriggerBtn.setAttribute("aria-expanded", "false");
    elements.correctionTriggerBtn.textContent = "Not the right email?";
  }
  if (elements.correctionManualInput) {
    elements.correctionManualInput.value = "";
  }
  if (elements.correctionAlternativesSelect) {
    elements.correctionAlternativesSelect.value = "";
  }
  if (elements.correctionConfirmBtn) {
    elements.correctionConfirmBtn.disabled = true;
  }
}

function renderAlternatives(items) {
  const alternatives = Array.isArray(items) ? items : [];

  if (elements.alternativesSummary) {
    elements.alternativesSummary.textContent = `Show alternatives (${alternatives.length})`;
  }

  if (!elements.alternativesList || !elements.alternativesDetails) return;

  if (alternatives.length === 0) {
    elements.alternativesDetails.classList.add("hidden");
    elements.alternativesList.innerHTML = "";
    return;
  }

  elements.alternativesDetails.classList.remove("hidden");
  elements.alternativesList.innerHTML = alternatives
    .map((item) => {
      const email = escapeHtml(String(item?.email || ""));
      const confidence = toConfidencePercent(item?.confidence);
      return `
        <li>
          <code>${email}</code>
          <span class="confidence-badge small">${confidence}%</span>
        </li>
      `;
    })
    .join("");
}

function showError(message, code, resetDate) {
  emailFinderState.currentError = message;
  emailFinderState.currentResult = null;
  emailFinderState.resultProfileKey = "";

  // Set dynamic title based on error type
  if (elements.errorTitle) {
    const isLinkedInError = /linkedin|profile|selector|page not detected/i.test(message || "");
    elements.errorTitle.textContent = isLinkedInError
      ? "LinkedIn page not detected"
      : "Could not find email";
  }

  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || "Unknown error";
  }

  elements.resultsCard?.classList.add("hidden");
  elements.errorState?.classList.remove("hidden");
  setPrimaryFinderAction("find");
  setStatus(message || "Could not find email.", "error");
  if (code === "QUOTA_EXCEEDED") {
    setUpgradeState(false, "", PRICING_URL);
  }
}

async function copyCurrentEmail() {
  const email = String(emailFinderState.currentResult?.email || "").trim();
  if (!email) {
    showToast("No email to copy.", "error");
    return;
  }
  await copyTextWithFeedback(email, elements.copyEmailBtn);
}

/**
 * Copy text to clipboard and swap the button icon to a checkmark for 1.5 s.
 * Falls back to a toast on failure.
 */
async function copyTextWithFeedback(text, btn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
    swapButtonToCheckmark(btn, 1500);
  } catch {
    showToast("Copy failed. Please copy manually.", "error");
  }
}

/**
 * Temporarily swap a button's inner SVG to a checkmark, then restore.
 * @param {HTMLElement|null} btn
 * @param {number} durationMs
 */
function swapButtonToCheckmark(btn, durationMs = 1500) {
  if (!btn) return;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" class="h-4 w-4" aria-hidden="true">
    <path d="M5 12.5 9 16l10-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  setTimeout(() => {
    btn.innerHTML = originalHTML;
  }, durationMs);
}

async function setSyncStatus(status, extras = {}) {
  const stored = await storageGet([SYNC_STATUS_KEY]);
  const current = stored?.[SYNC_STATUS_KEY] && typeof stored[SYNC_STATUS_KEY] === "object"
    ? stored[SYNC_STATUS_KEY]
    : {};

  await storageSet({
    [SYNC_STATUS_KEY]: {
      ...current,
      ...extras,
      lastSyncStatus: status,
      lastSyncAt: new Date().toISOString(),
    },
  });
}

function formatSyncRelativeTimestamp(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";

  const deltaMs = Math.max(0, Date.now() - parsed.getTime());
  const deltaMinutes = Math.floor(deltaMs / 60000);

  if (deltaMinutes <= 0) return "just now";
  if (deltaMinutes === 1) return "1 min ago";
  return `${deltaMinutes} min ago`;
}

async function renderSyncStatus() {
  if (!elements.syncStatusRow) return;
  elements.syncStatusRow.classList.remove("hidden");

  if (!emailFinderState.isAuthenticated) {
    if (elements.syncDot) elements.syncDot.dataset.status = "none";
    if (elements.syncLabel) elements.syncLabel.textContent = "Sign in to sync";
    if (elements.syncActionBtn) {
      elements.syncActionBtn.textContent = "Sign in";
      elements.syncActionBtn.dataset.action = "connect";
      elements.syncActionBtn.classList.remove("hidden");
      elements.syncActionBtn.disabled = false;
    }
    return;
  }

  const stored = await storageGet([SYNC_STATUS_KEY, SYNC_QUEUE_KEY]);
  const syncState = stored?.[SYNC_STATUS_KEY] && typeof stored[SYNC_STATUS_KEY] === "object"
    ? stored[SYNC_STATUS_KEY]
    : {};
  const queue = Array.isArray(stored?.[SYNC_QUEUE_KEY]) ? stored[SYNC_QUEUE_KEY] : [];
  const queueCount = queue.length;
  const status = String(syncState?.lastSyncStatus || "").trim();
  const lastSyncAt = String(syncState?.lastSyncAt || "").trim();

  if (queueCount > 0) {
    if (elements.syncDot) elements.syncDot.dataset.status = "queued";
    if (elements.syncLabel) {
      elements.syncLabel.textContent = `${queueCount} contact${queueCount === 1 ? "" : "s"} pending sync`;
    }
    if (elements.syncActionBtn) {
      elements.syncActionBtn.textContent = "Retry";
      elements.syncActionBtn.dataset.action = "retry";
      elements.syncActionBtn.classList.remove("hidden");
      elements.syncActionBtn.disabled = false;
    }
    return;
  }

  if (status === "failed") {
    if (elements.syncDot) elements.syncDot.dataset.status = "error";
    if (elements.syncLabel) elements.syncLabel.textContent = "Sync failed";
    if (elements.syncActionBtn) {
      elements.syncActionBtn.textContent = "Retry";
      elements.syncActionBtn.dataset.action = "retry";
      elements.syncActionBtn.classList.remove("hidden");
      elements.syncActionBtn.disabled = false;
    }
    return;
  }

  if (status === "auth_failed") {
    if (elements.syncDot) elements.syncDot.dataset.status = "error";
    if (elements.syncLabel) elements.syncLabel.textContent = "Sync failed (sign in required)";
    if (elements.syncActionBtn) {
      elements.syncActionBtn.textContent = "Sign in";
      elements.syncActionBtn.dataset.action = "connect";
      elements.syncActionBtn.classList.remove("hidden");
      elements.syncActionBtn.disabled = false;
    }
    return;
  }

  if (elements.syncDot) elements.syncDot.dataset.status = "success";
  const lastSyncDate = lastSyncAt ? new Date(lastSyncAt) : null;
  const isRecent =
    lastSyncDate &&
    Number.isFinite(lastSyncDate.getTime()) &&
    Date.now() - lastSyncDate.getTime() < 5 * 60 * 1000;

  if (elements.syncLabel) {
    if (isRecent) {
      const relative = formatSyncRelativeTimestamp(lastSyncAt);
      elements.syncLabel.textContent = relative ? `Synced ${relative}` : "Synced";
    } else {
      elements.syncLabel.textContent = "Synced";
    }
  }
  if (elements.syncActionBtn) {
    elements.syncActionBtn.classList.add("hidden");
    elements.syncActionBtn.disabled = false;
  }
}

async function handleSyncAction() {
  const action = elements.syncActionBtn?.dataset.action;
  if (action === "connect") {
    const { apiBaseUrl } = await resolveBaseUrls();
    const url = `${apiBaseUrl}/extension-auth?extensionId=${chrome.runtime.id}`;
    chrome.tabs.create({ url });
  } else if (action === "retry") {
    await retryPendingContacts();
  }
}

async function retryPendingContacts() {
  if (elements.syncActionBtn) {
    elements.syncActionBtn.textContent = "Retrying...";
    elements.syncActionBtn.disabled = true;
  }

  try {
    try {
      await sendRuntimeMessage({ type: "PROCESS_SYNC_QUEUE" });
    } catch {
      // Queue processor may be unavailable during transient worker restarts.
    }

    const existing = await storageGet([SAVED_CONTACTS_KEY, SYNC_QUEUE_KEY]);
    const list = Array.isArray(existing?.[SAVED_CONTACTS_KEY]) ? existing[SAVED_CONTACTS_KEY] : [];
    const queue = Array.isArray(existing?.[SYNC_QUEUE_KEY]) ? existing[SYNC_QUEUE_KEY] : [];
    const queuedLocalIds = new Set(
      queue
        .map((entry) => String(entry?.localId || "").trim())
        .filter(Boolean)
    );
    const pending = list.filter((entry) => {
      const localId = String(entry?.localId || "").trim();
      if (localId && queuedLocalIds.has(localId)) return false;
      return !isSavedContactSynced(entry);
    });

    for (const entry of pending) {
      await syncContactToBackend(entry, null);
    }
  } finally {
    if (elements.syncActionBtn) {
      elements.syncActionBtn.disabled = false;
    }
    await renderQueueCard();
    await renderSyncStatus();
  }
}

async function syncPendingContactsQuietly() {
  if (!emailFinderState.isAuthenticated) return;
  if (emailFinderState.pendingSyncInFlight) return;

  emailFinderState.pendingSyncInFlight = true;
  try {
    try {
      await sendRuntimeMessage({ type: "PROCESS_SYNC_QUEUE" });
    } catch {
      // Background may be sleeping; local retries below are still attempted.
    }

    const existing = await storageGet([SAVED_CONTACTS_KEY, SYNC_QUEUE_KEY]);
    const list = Array.isArray(existing?.[SAVED_CONTACTS_KEY]) ? existing[SAVED_CONTACTS_KEY] : [];
    const queue = Array.isArray(existing?.[SYNC_QUEUE_KEY]) ? existing[SYNC_QUEUE_KEY] : [];
    const queuedLocalIds = new Set(
      queue
        .map((entry) => String(entry?.localId || "").trim())
        .filter(Boolean)
    );
    const pending = list.filter((entry) => {
      const localId = String(entry?.localId || "").trim();
      if (localId && queuedLocalIds.has(localId)) return false;
      return !isSavedContactSynced(entry);
    });
    if (pending.length === 0) return;

    for (const entry of pending) {
      await syncContactToBackend(entry, null);
    }
  } finally {
    emailFinderState.pendingSyncInFlight = false;
    await renderQueueCard();
    await renderSyncStatus();
  }
}

function isSavedContactSynced(savedRow) {
  const syncState = String(savedRow?.syncState || "").trim();
  const backendId = String(savedRow?.backendId || "").trim();
  return syncState === CONTACT_SYNC_STATE.SYNCED || backendId.length > 0;
}

function getCompanyDomainFromEmail(email) {
  const domain = String(email || "").trim().split("@")[1] || "";
  return String(domain || "").trim().toLowerCase();
}

function resolveSavedRowIndex(list, savedRow) {
  const localId = String(savedRow?.localId || "").trim();
  if (localId) {
    const localMatchIndex = list.findIndex((entry) => String(entry?.localId || "").trim() === localId);
    if (localMatchIndex !== -1) return localMatchIndex;
  }

  const createdAt = String(savedRow?.createdAt || "").trim();
  const email = String(savedRow?.email || "").trim().toLowerCase();
  if (email && createdAt) {
    const exactIndex = list.findIndex(
      (entry) =>
        String(entry?.email || "").trim().toLowerCase() === email &&
        String(entry?.createdAt || "").trim() === createdAt
    );
    if (exactIndex !== -1) return exactIndex;
  }

  if (email) {
    return list.findIndex((entry) => String(entry?.email || "").trim().toLowerCase() === email);
  }

  return -1;
}

async function updateSavedRowSyncState(savedRow, syncState, extras = {}) {
  const existing = await storageGet([SAVED_CONTACTS_KEY]);
  const list = Array.isArray(existing?.[SAVED_CONTACTS_KEY]) ? existing[SAVED_CONTACTS_KEY] : [];
  const idx = resolveSavedRowIndex(list, savedRow);

  if (idx !== -1) {
    list[idx] = {
      ...list[idx],
      ...extras,
      syncState,
      syncUpdatedAt: new Date().toISOString(),
      syncError:
        syncState === CONTACT_SYNC_STATE.SYNCED
          ? null
          : String(extras?.syncError || list[idx]?.syncError || "").trim() || null,
    };
    await storageSet({ [SAVED_CONTACTS_KEY]: list });
    return list[idx];
  }

  const fallbackRow = {
    ...savedRow,
    ...extras,
    syncState,
    syncUpdatedAt: new Date().toISOString(),
    syncError:
      syncState === CONTACT_SYNC_STATE.SYNCED
        ? null
        : String(extras?.syncError || "").trim() || null,
  };
  list.unshift(fallbackRow);
  await storageSet({ [SAVED_CONTACTS_KEY]: list.slice(0, 250) });
  console.warn("[Sidepanel] updateSavedRowSyncState: row not found, inserted fallback row", {
    email: savedRow?.email,
    createdAt: savedRow?.createdAt,
    localId: savedRow?.localId,
  });
  return fallbackRow;
}

function buildContactSyncPayload(savedRow, profileContext) {
  const ctx = profileContext || {};
  const mergedName = pickFirstNonEmpty(ctx.fullName, savedRow.fullName);
  const splitName = splitHumanName(mergedName);
  const fallbackName = deriveNameFromEmail(savedRow.email);
  const firstName = pickFirstNonEmpty(
    ctx.firstName,
    savedRow.firstName,
    splitName.firstName,
    fallbackName.firstName,
    "Unknown"
  );
  const lastName = pickFirstNonEmpty(
    ctx.lastName,
    savedRow.lastName,
    splitName.lastName,
    fallbackName.lastName,
    "Contact"
  );
  const company = pickFirstNonEmpty(
    ctx.company,
    savedRow.company,
    deriveCompanyFromEmail(savedRow.email),
    "Unknown"
  );
  const role = pickFirstNonEmpty(ctx.role, savedRow.role);
  const linkedinUrl = normalizeLinkedInUrlForApi(
    pickFirstNonEmpty(ctx.profileUrl, savedRow.profileUrl)
  );
  const email = pickFirstNonEmpty(savedRow.email);

  return {
    firstName,
    lastName,
    company,
    designation: role || "",
    role: role || "",
    linkedinUrl: linkedinUrl || "",
    headline: pickFirstNonEmpty(savedRow.headline, ctx.headline),
    photoUrl: pickFirstNonEmpty(savedRow.photoUrl, ctx.photoUrl),
    email,
    emailConfidence: toFiniteNumber(savedRow.confidence),
    emailVerified: savedRow.emailVerified === true,
    emailSource: pickFirstNonEmpty(savedRow.emailSource, "extension"),
    companyDomain: pickFirstNonEmpty(
      savedRow.companyDomain,
      getCompanyDomainFromEmail(email)
    ),
  };
}

async function syncContactToBackend(savedRow, profileContext) {
  const payload = buildContactSyncPayload(savedRow, profileContext);
  if (!payload.email) {
    await updateSavedRowSyncState(savedRow, CONTACT_SYNC_STATE.FAILED, {
      syncError: "Missing email address",
    });
    await setSyncStatus("failed", {
      lastErrorType: "validation",
      lastErrorMessage: "Missing email address",
    });
    return {
      ok: false,
      status: CONTACT_SYNC_STATE.FAILED,
      error: "Missing email address",
    };
  }

  try {
    const response = await sendRuntimeMessage({
      type: "SAVE_CONTACT_TO_SUPABASE",
      localId: String(savedRow?.localId || "").trim(),
      contactData: payload,
    });
    const result = response && typeof response === "object" ? response : {};
    const status = String(result?.status || "").trim();
    const errorMessage = String(result?.error || "").trim();
    const queueCount = Number(result?.queueCount);

    if (status === CONTACT_SYNC_STATE.SYNCED && result?.ok) {
      const backendId = String(
        result?.data?.id ||
          result?.data?.contact?.id ||
          savedRow?.backendId ||
          "synced"
      );
      await updateSavedRowSyncState(savedRow, CONTACT_SYNC_STATE.SYNCED, {
        backendId,
        syncedAt: new Date().toISOString(),
      });
      await setSyncStatus("success", {
        queueCount: Number.isFinite(queueCount) ? queueCount : 0,
        lastErrorType: null,
        lastErrorMessage: null,
      });
      return {
        ok: true,
        status: CONTACT_SYNC_STATE.SYNCED,
        data: result?.data || null,
      };
    }

    if (status === CONTACT_SYNC_STATE.QUEUED) {
      await updateSavedRowSyncState(savedRow, CONTACT_SYNC_STATE.QUEUED, {
        syncError: errorMessage || "Queued for sync retry",
      });
      await setSyncStatus("queued", {
        queueCount: Number.isFinite(queueCount) ? queueCount : 1,
        lastErrorType: "network",
        lastErrorMessage: errorMessage || "Queued for sync retry",
      });
      return {
        ok: false,
        status: CONTACT_SYNC_STATE.QUEUED,
        error: errorMessage || "Queued for sync retry",
      };
    }

    if (status === CONTACT_SYNC_STATE.AUTH_FAILED) {
      showSessionExpiredBanner();
      await updateSavedRowSyncState(savedRow, CONTACT_SYNC_STATE.AUTH_FAILED, {
        syncError: errorMessage || "Authentication required",
      });
      await setSyncStatus("auth_failed", {
        queueCount: Number.isFinite(queueCount) ? queueCount : 0,
        lastErrorType: "auth",
        lastErrorMessage: errorMessage || "Authentication required",
      });
      return {
        ok: false,
        status: CONTACT_SYNC_STATE.AUTH_FAILED,
        error: errorMessage || "Authentication required",
      };
    }

    await updateSavedRowSyncState(savedRow, CONTACT_SYNC_STATE.FAILED, {
      syncError: errorMessage || "Supabase sync failed",
    });
    await setSyncStatus("failed", {
      queueCount: Number.isFinite(queueCount) ? queueCount : 0,
      lastErrorType: "unknown",
      lastErrorMessage: errorMessage || "Supabase sync failed",
    });
    return {
      ok: false,
      status: CONTACT_SYNC_STATE.FAILED,
      error: errorMessage || "Supabase sync failed",
    };
  } catch (err) {
    const message = String(err?.message || "Supabase sync failed");
    console.warn("[Sidepanel] syncContactToBackend failed:", err);
    await updateSavedRowSyncState(savedRow, CONTACT_SYNC_STATE.FAILED, {
      syncError: message,
    });
    await setSyncStatus("failed", {
      lastErrorType: "runtime",
      lastErrorMessage: message,
    });
    return {
      ok: false,
      status: CONTACT_SYNC_STATE.FAILED,
      error: message,
    };
  } finally {
    await renderQueueCard();
    await renderSyncStatus();
  }
}

async function saveCurrentResultToContacts() {
  const result = emailFinderState.currentResult;
  if (!result?.email) {
    showToast("No result to save.", "error");
    return;
  }

  const context = emailFinderState.profileContext || {};
  const splitName = splitHumanName(pickFirstNonEmpty(context.fullName));
  const nowIso = new Date().toISOString();
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const inferredDomain = getCompanyDomainFromEmail(result.email);
  const savedRow = {
    localId,
    email: String(result.email),
    pattern: String(result.pattern || ""),
    confidence: toConfidencePercent(result.confidence),
    source: "extension",
    profileUrl: pickFirstNonEmpty(context.profileUrl, result.profileUrl),
    fullName: pickFirstNonEmpty(context.fullName),
    firstName: pickFirstNonEmpty(context.firstName, splitName.firstName),
    lastName: pickFirstNonEmpty(context.lastName, splitName.lastName),
    company: pickFirstNonEmpty(context.company),
    role: pickFirstNonEmpty(context.role),
    headline: pickFirstNonEmpty(context.headline),
    photoUrl: pickFirstNonEmpty(context.photoUrl),
    emailSource: pickFirstNonEmpty(result.source, "extension"),
    companyDomain: inferredDomain,
    emailVerified: false,
    syncState: emailFinderState.isAuthenticated
      ? CONTACT_SYNC_STATE.QUEUED
      : CONTACT_SYNC_STATE.AUTH_FAILED,
    syncUpdatedAt: nowIso,
    createdAt: nowIso,
  };

  const existing = await storageGet([SAVED_CONTACTS_KEY]);
  const list = Array.isArray(existing?.[SAVED_CONTACTS_KEY]) ? existing[SAVED_CONTACTS_KEY] : [];
  list.unshift(savedRow);
  await storageSet({ [SAVED_CONTACTS_KEY]: list.slice(0, 250) });
  await renderQueueCard();

  if (!emailFinderState.isAuthenticated) {
    await setSyncStatus("auth_failed", {
      lastErrorType: "auth",
      lastErrorMessage: "Authentication required",
    });
    showToast("Saved locally (sync failed)", "info");
    await renderQueueCard();
    await renderSyncStatus();
    return;
  }

  const syncResult = await syncContactToBackend(savedRow, emailFinderState.profileContext);
  if (syncResult?.status === CONTACT_SYNC_STATE.SYNCED) {
    showToast("Saved to Ellyn \u2713", "success");
  } else if (syncResult?.status === CONTACT_SYNC_STATE.QUEUED) {
    showToast("Working offline \u2014 contacts queued", "info");
  } else {
    showToast("Saved locally (sync failed)", "info");
  }
}

async function submitFeedback(worked) {
  const result = emailFinderState.currentResult;
  if (!result?.email || !result?.pattern) {
    showToast("No result available for feedback.", "error");
    return;
  }

  const companyDomain = String(result.email).split("@")[1] || "";
  if (!companyDomain) {
    showToast("Invalid email format for feedback.", "error");
    return;
  }

  const token = await getAuthToken();
  const payload = {
    email: String(result.email),
    pattern: String(result.pattern),
    companyDomain,
    worked: worked === true,
  };

  try {
    const { apiBaseUrl } = await resolveBaseUrls();
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let response = await fetchWithTimeout(`${apiBaseUrl}/api/v1/email-feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok && (response.status === 404 || response.status === 405)) {
      response = await fetchWithTimeout(`${apiBaseUrl}/api/v1/pattern-feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      throw new Error(`Feedback API failed with status ${response.status}`);
    }

    showToast("Feedback submitted. Thank you!", "success");
    elements.feedbackSection?.classList.add("hidden");
  } catch (error) {
    const queued = await storageGet([FEEDBACK_QUEUE_KEY]);
    const queue = Array.isArray(queued?.[FEEDBACK_QUEUE_KEY]) ? queued[FEEDBACK_QUEUE_KEY] : [];
    queue.unshift({
      ...payload,
      queuedAt: new Date().toISOString(),
    });
    await storageSet({ [FEEDBACK_QUEUE_KEY]: queue.slice(0, 100) });

    console.warn("[Sidepanel] Feedback submission failed, queued locally:", error);
    showToast("Feedback queued offline.", "info");
    elements.feedbackSection?.classList.add("hidden");
  }
}

/**
 * SUBTLE_CORRECTION_UI
 * Initializes the inline email correction interaction.
 * Called once from bindEvents().
 */
function initCorrectionUI() {
  const {
    correctionTriggerBtn,
    correctionPanel,
    correctionAlternativesRow,
    correctionAlternativesSelect,
    correctionManualInput,
    correctionConfirmBtn,
  } = elements;

  if (!correctionTriggerBtn || !correctionPanel) return;

  // ── Toggle panel open/close ──────────────────────────────────────────────
  correctionTriggerBtn.addEventListener("click", () => {
    const isExpanded = correctionPanel.classList.contains("hidden") === false;

    if (isExpanded) {
      correctionPanel.classList.add("hidden");
      correctionTriggerBtn.setAttribute("aria-expanded", "false");
      correctionTriggerBtn.textContent = "Not the right email?";
    } else {
      correctionPanel.classList.remove("hidden");
      correctionTriggerBtn.setAttribute("aria-expanded", "true");
      correctionTriggerBtn.textContent = "Cancel";

      populateCorrectionAlternatives();

      setTimeout(() => correctionManualInput?.focus(), 120);
    }
  });

  // ── Enable confirm button when either field has a value ──────────────────
  const updateConfirmState = () => {
    const hasManual = String(correctionManualInput?.value || "").trim().length > 3;
    const hasDropdown =
      correctionAlternativesSelect?.value &&
      correctionAlternativesSelect.value !== "";

    if (correctionConfirmBtn) {
      correctionConfirmBtn.disabled = !hasManual && !hasDropdown;
    }
  };

  correctionManualInput?.addEventListener("input", () => {
    if (correctionAlternativesSelect && correctionManualInput.value.length > 0) {
      correctionAlternativesSelect.value = "";
    }
    updateConfirmState();
  });

  correctionAlternativesSelect?.addEventListener("change", () => {
    if (correctionManualInput) {
      correctionManualInput.value = "";
    }
    updateConfirmState();
  });

  // ── Confirm handler ──────────────────────────────────────────────────────
  correctionConfirmBtn?.addEventListener("click", async () => {
    const manualVal = String(correctionManualInput?.value || "").trim();
    const dropdownVal = String(correctionAlternativesSelect?.value || "").trim();

    const newEmail = manualVal || dropdownVal;
    if (!newEmail) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }

    const previousEmail = String(emailFinderState.currentResult?.email || "");

    // 1. Update the displayed email in the result card
    if (elements.resultEmail) {
      elements.resultEmail.textContent = newEmail;
    }

    // 2. Update state
    if (emailFinderState.currentResult) {
      emailFinderState.currentResult.email = newEmail;
    }

    // 3. Invalidate draft so it re-generates with the correct email
    _dvLastContactKey = "";

    // 4. Submit correction feedback (fire-and-forget)
    void submitCorrectionFeedback(previousEmail, newEmail);

    // 5. Quiet success toast
    showToast("Email updated.", "success");

    // 6. Collapse the correction panel
    correctionPanel.classList.add("hidden");
    if (correctionTriggerBtn) {
      correctionTriggerBtn.setAttribute("aria-expanded", "false");
      correctionTriggerBtn.textContent = "Not the right email?";
    }

    // 7. Clear input fields
    if (correctionManualInput) correctionManualInput.value = "";
    if (correctionAlternativesSelect) correctionAlternativesSelect.value = "";
    if (correctionConfirmBtn) correctionConfirmBtn.disabled = true;
  });
}

/**
 * SUBTLE_CORRECTION_UI
 * Populates the alternatives dropdown with emails from the current result.
 */
function populateCorrectionAlternatives() {
  const { correctionAlternativesRow, correctionAlternativesSelect } = elements;
  if (!correctionAlternativesSelect) return;

  const alternatives = Array.isArray(emailFinderState.currentResult?.alternativeEmails)
    ? emailFinderState.currentResult.alternativeEmails
    : [];

  const currentEmail = String(emailFinderState.currentResult?.email || "").toLowerCase();
  const filtered = alternatives.filter(
    (alt) => String(alt?.email || "").toLowerCase() !== currentEmail
  );

  if (filtered.length === 0) {
    correctionAlternativesRow?.classList.add("hidden");
    return;
  }

  correctionAlternativesRow?.classList.remove("hidden");

  correctionAlternativesSelect.innerHTML =
    '<option value="">Choose from found alternatives...</option>';

  filtered.forEach((alt) => {
    const email = String(alt?.email || "");
    const pct = Math.round((alt?.confidence || 0) * 100);
    if (!email) return;
    const option = document.createElement("option");
    option.value = email;
    option.textContent = pct > 0 ? `${email} (${pct}%)` : email;
    correctionAlternativesSelect.appendChild(option);
  });
}

/**
 * SUBTLE_CORRECTION_UI
 * Sends a correction event to the backend. Fire-and-forget, never blocks UI.
 *
 * @param {string} originalEmail  - The email we found
 * @param {string} correctedEmail - The email the user confirmed is correct
 */
async function submitCorrectionFeedback(originalEmail, correctedEmail) {
  const result = emailFinderState.currentResult;
  if (!result?.pattern) return;

  const companyDomain = String(originalEmail).split("@")[1] || "";
  if (!companyDomain) return;

  const token = await getAuthToken();
  const payload = {
    email: String(originalEmail),
    correctedEmail: String(correctedEmail),
    pattern: String(result.pattern),
    companyDomain,
    worked: false,
    source: "inline_correction",
  };

  try {
    const { apiBaseUrl } = await resolveBaseUrls();
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let response = await fetchWithTimeout(`${apiBaseUrl}/api/v1/email-feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok && (response.status === 404 || response.status === 405)) {
      response = await fetchWithTimeout(`${apiBaseUrl}/api/v1/pattern-feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const queued = await storageGet([FEEDBACK_QUEUE_KEY]);
      const queue = Array.isArray(queued?.[FEEDBACK_QUEUE_KEY])
        ? queued[FEEDBACK_QUEUE_KEY] : [];
      queue.push({ ...payload, queuedAt: new Date().toISOString() });
      await storageSet({ [FEEDBACK_QUEUE_KEY]: queue.slice(0, 50) });
    }
  } catch {
    try {
      const queued = await storageGet([FEEDBACK_QUEUE_KEY]);
      const queue = Array.isArray(queued?.[FEEDBACK_QUEUE_KEY])
        ? queued[FEEDBACK_QUEUE_KEY] : [];
      queue.push({ ...payload, queuedAt: new Date().toISOString() });
      await storageSet({ [FEEDBACK_QUEUE_KEY]: queue.slice(0, 50) });
    } catch { /* silently ignore */ }
  }
}

async function updateQuotaStatus() {
  try {
    const response = await sendRuntimeMessage({ type: "CHECK_QUOTA" });
    const used = toFiniteNumber(response?.used);
    const remaining = toFiniteNumber(response?.remaining);
    const limit = toFiniteNumber(response?.limit);

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.round(limit)) : null;
    let safeUsed = Number.isFinite(used) ? Math.max(0, Math.round(used)) : null;
    let safeRemaining = Number.isFinite(remaining) ? Math.max(0, Math.round(remaining)) : null;

    if (!Number.isFinite(safeUsed) && Number.isFinite(safeLimit) && Number.isFinite(safeRemaining)) {
      safeUsed = Math.max(0, safeLimit - safeRemaining);
    }
    if (!Number.isFinite(safeRemaining) && Number.isFinite(safeLimit) && Number.isFinite(safeUsed)) {
      safeRemaining = Math.max(0, safeLimit - safeUsed);
    }

    const unlimitedPlan = !Number.isFinite(safeLimit);
    const shouldShowQuota =
      (Number.isFinite(safeUsed) && safeUsed > 0) || safeLimit !== null;
    setQuotaVisibility(shouldShowQuota);

    if (!shouldShowQuota) {
      emailFinderState.quotaKnown = false;
      emailFinderState.quotaAllowsLookup = true;

      if (elements.quotaCount) {
        elements.quotaCount.textContent = "";
      }
      if (elements.quotaFill) {
        elements.quotaFill.style.width = "0%";
        elements.quotaFill.classList.remove("warning", "danger");
      }
      setQuotaWarning("");
      setUpgradeState(false, "", emailFinderState.upgradeUrl);
      applyFindEmailAvailability();
      return;
    }

    emailFinderState.quotaKnown = true;
    emailFinderState.quotaAllowsLookup = true;

    if (elements.quotaCount) {
      if (Number.isFinite(safeUsed) && Number.isFinite(safeLimit)) {
        elements.quotaCount.textContent = `${safeUsed}/${safeLimit}`;
      } else if (Number.isFinite(safeUsed) && unlimitedPlan) {
        elements.quotaCount.textContent = `${safeUsed}/Unlimited`;
      } else if (Number.isFinite(safeRemaining) && Number.isFinite(safeLimit)) {
        const derivedUsed = Math.max(0, safeLimit - safeRemaining);
        elements.quotaCount.textContent = `${derivedUsed}/${safeLimit}`;
      } else if (Number.isFinite(safeLimit)) {
        elements.quotaCount.textContent = `0/${safeLimit}`;
      } else {
        elements.quotaCount.textContent = "";
      }
    }

    if (elements.quotaFill) {
      let percent = 0;
      if (Number.isFinite(safeLimit) && safeLimit > 0) {
        const usedForBar = Number.isFinite(safeUsed)
          ? safeUsed
          : Number.isFinite(safeRemaining)
          ? Math.max(0, safeLimit - safeRemaining)
          : 0;
        percent = Math.max(0, Math.min(100, (usedForBar / safeLimit) * 100));
      }

      elements.quotaFill.style.width = `${percent}%`;
      elements.quotaFill.classList.remove("warning", "danger");
      if (Number.isFinite(safeLimit) && Number.isFinite(safeRemaining)) {
        if (safeRemaining <= 0) {
          elements.quotaFill.classList.add("danger");
        } else if (safeRemaining <= Math.max(3, Math.ceil(safeLimit * 0.15))) {
          elements.quotaFill.classList.add("warning");
        }
      }
    }

    // Credit limits are currently disabled: quota UI is informational only.
    setUpgradeState(false, "", emailFinderState.upgradeUrl);

    if (unlimitedPlan) {
      if (Number.isFinite(safeUsed)) {
        setQuotaWarning(`Unlimited plan active. ${safeUsed} credits used.`);
      } else {
        setQuotaWarning("");
      }
    } else if (Number.isFinite(safeRemaining)) {
      const lowThreshold = Math.max(3, Math.ceil(safeLimit * 0.15));
      if (safeRemaining <= lowThreshold) {
        setQuotaWarning(`Low credits: ${safeRemaining} left this period.`);
      } else {
        setQuotaWarning("");
      }
    } else {
      setQuotaWarning("");
    }

    applyFindEmailAvailability();
  } catch (error) {
    console.warn("[Sidepanel] Failed to update quota:", error);
    emailFinderState.quotaKnown = false;
    emailFinderState.quotaAllowsLookup = true;
    setQuotaVisibility(false);
    if (elements.quotaCount) {
      elements.quotaCount.textContent = "";
    }
    if (elements.quotaFill) {
      elements.quotaFill.style.width = "0%";
      elements.quotaFill.classList.remove("warning", "danger");
    }
    setQuotaWarning("");
    setUpgradeState(false, "", emailFinderState.upgradeUrl);
    applyFindEmailAvailability();
  }
}

function resetQuotaUI() {
  setQuotaVisibility(false);
  if (elements.quotaCount) {
    elements.quotaCount.textContent = "";
  }
  if (elements.quotaFill) {
    elements.quotaFill.style.width = "0%";
    elements.quotaFill.classList.remove("warning", "danger");
  }
  setQuotaWarning("");
  setUpgradeState(false, "", emailFinderState.upgradeUrl);
  applyFindEmailAvailability();
}

function setQuotaVisibility(visible) {
  elements.quotaBar?.classList.toggle("hidden", !visible);
}

function setQuotaWarning(message) {
  if (!elements.quotaWarning) return;
  if (!message) {
    elements.quotaWarning.classList.add("hidden");
    elements.quotaWarning.textContent = "";
    return;
  }
  elements.quotaWarning.classList.remove("hidden");
  elements.quotaWarning.textContent = message;
}

function setUpgradeState(visible, copy, url) {
  if (!elements.upgradeCta) return;

  if (url) {
    emailFinderState.upgradeUrl = url;
  }

  elements.upgradeCta.classList.toggle("hidden", !visible);
  if (visible && elements.upgradeText) {
    elements.upgradeText.textContent = copy || "Upgrade to continue.";
  }
}

function setStatus(message, tone) {
  if (!elements.statusText) return;
  elements.statusText.textContent = message || "";
  elements.statusText.className = "mb-4 min-h-5 px-1 text-xs";

  if (tone === "error") {
    elements.statusText.classList.add("text-rose-600");
    return;
  }
  if (tone === "success") {
    elements.statusText.classList.add("text-emerald-600");
    return;
  }
  elements.statusText.classList.add("text-slate-500");
}

function showToast(message, tone = "info") {
  if (!elements.toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

async function getLinkedInProfileTab() {
  const [activeTab] = await queryTabs({ active: true, currentWindow: true });
  if (isLinkedInProfile(activeTab?.url) && Number.isFinite(activeTab?.id)) {
    return activeTab;
  }

  const allTabs = await queryTabs({ currentWindow: true });
  const candidate = allTabs.find((tab) => isLinkedInProfile(tab?.url) && Number.isFinite(tab?.id));
  if (candidate) {
    return candidate;
  }

  throw new Error("Open a LinkedIn profile to get started.");
}

async function hasLinkedInProfileOpen() {
  try {
    const tabs = await queryTabs({ currentWindow: true });
    return tabs.some((tab) => isLinkedInProfile(tab?.url));
  } catch {
    return false;
  }
}

function isLinkedInProfile(url) {
  return typeof url === "string" && /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/in\/[^/?#]+/i.test(url);
}

function toConfidencePercent(value) {
  const n = toFiniteNumber(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

function getConfidenceLevel(percent) {
  if (percent >= 85) return "high";
  if (percent >= 65) return "medium";
  return "low";
}

function formatSourceLabel(source) {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "abstract_verified") return "Verified via API";
  if (normalized === "cache_verified") return "Cache verified";
  if (normalized === "llm_best_guess") return "AI best guess";
  return normalized ? normalized.replace(/_/g, " ") : "Unknown";
}

function buildPatternDisplay(pattern, domain) {
  const template = String(pattern || "").trim();
  if (!template) return "-";
  if (template.includes("@")) return template;
  if (!domain) return template;
  return `${template}@${domain}`;
}

function formatCost(cost) {
  const value = toFiniteNumber(cost);
  if (!Number.isFinite(value)) return "$0.0000";
  return `$${value.toFixed(4)}`;
}

function formatResetDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || null);
    });
  });
}

function isMissingReceiverError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("receiving end does not exist") ||
    msg.includes("could not establish connection") ||
    msg.includes("message port closed")
  );
}

async function requestProfileExtraction(tabId, debug = false) {
  let directResponse = null;

  try {
    directResponse = await sendTabMessage(tabId, { type: "EXTRACT_PROFILE", debug });
    if (directResponse && hasUsableProfileIdentity(directResponse)) {
      return directResponse;
    }
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }
  }

  const runtimeResponse = await sendRuntimeMessage({
    type: "EXTRACT_PROFILE_FROM_TAB",
    tabId,
    debug,
    data: { tabId, debug },
  });

  if (runtimeResponse && hasUsableProfileIdentity(runtimeResponse)) {
    return runtimeResponse;
  }

  return runtimeResponse || directResponse;
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || null);
    });
  });
}

function queryTabs(query) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(query, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(Array.isArray(tabs) ? tabs : []);
    });
  });
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(data || {});
    });
  });
}

function storageSet(payload) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(payload, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function getAuthToken() {
  try {
    const auth = await storageGet(["auth_token"]);
    const storedToken = typeof auth.auth_token === "string" ? auth.auth_token : "";
    if (storedToken) return storedToken;

    const runtimeToken = await sendRuntimeMessage({ type: "GET_AUTH_TOKEN" });
    return typeof runtimeToken === "string" ? runtimeToken : "";
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ── Session-expired banner helpers ──────────────────────────────────────────

function showSessionExpiredBanner() {
  elements.sessionExpiredBanner?.classList.remove("hidden");
}

function hideSessionExpiredBanner() {
  elements.sessionExpiredBanner?.classList.add("hidden");
}

// ── Sent callout helpers ─────────────────────────────────────────────────────

let _sentCalloutTimer = null;

function showSentCallout() {
  if (!elements.sentCallout) return;
  elements.sentCallout.classList.remove("hidden");
  // Auto-dismiss after 5 seconds
  clearTimeout(_sentCalloutTimer);
  _sentCalloutTimer = setTimeout(dismissSentCallout, 5000);
}

function dismissSentCallout() {
  clearTimeout(_sentCalloutTimer);
  _sentCalloutTimer = null;
  elements.sentCallout?.classList.add("hidden");
}

// ── Stage / Queue / Notes helpers ──────────────────────────────────────────

/**
 * Show/hide stage1/stage2/stage3 based on authentication state and appState.
 * Stage 1 (extraction + queue): visible when authenticated and stage === EXTRACTION.
 * Stage 2 (draft workspace): visible when stage === DRAFT and a contact is set.
 * Stage 3 (tracking): visible when stage === TRACKING.
 */
function renderStages() {
  if (!emailFinderState.isAuthenticated) {
    elements.stage1?.classList.add("hidden");
    elements.stage2?.classList.add("hidden");
    elements.stage3?.classList.add("hidden");
    return;
  }

  const stage = appState.stage;
  elements.stage1?.classList.toggle("hidden", stage !== STAGES.EXTRACTION);
  elements.stage2?.classList.toggle("hidden", !(stage === STAGES.DRAFT && appState.contact !== null));
  elements.stage3?.classList.toggle("hidden", stage !== STAGES.TRACKING);
}

/**
 * Load saved contacts from chrome.storage.local and render the queue card.
 * Shows the empty-state (from empty-states.js) when no contacts exist.
 * Shows the populated view with count + contact rows otherwise.
 */
function resolveQueueContactSyncState(contact, queuedLocalIds, lastSyncStatus = "") {
  const localId = String(contact?.localId || "").trim();
  const rowSyncState = String(contact?.syncState || "").trim();
  if (isSavedContactSynced(contact)) return CONTACT_SYNC_STATE.SYNCED;
  if (localId && queuedLocalIds.has(localId)) return CONTACT_SYNC_STATE.QUEUED;
  if (
    rowSyncState === CONTACT_SYNC_STATE.QUEUED &&
    localId &&
    !queuedLocalIds.has(localId) &&
    lastSyncStatus === "success"
  ) {
    return CONTACT_SYNC_STATE.SYNCED;
  }
  if (rowSyncState === CONTACT_SYNC_STATE.AUTH_FAILED) return CONTACT_SYNC_STATE.AUTH_FAILED;
  if (rowSyncState === CONTACT_SYNC_STATE.FAILED) return CONTACT_SYNC_STATE.FAILED;
  if (rowSyncState === CONTACT_SYNC_STATE.QUEUED) return CONTACT_SYNC_STATE.QUEUED;
  return emailFinderState.isAuthenticated ? CONTACT_SYNC_STATE.QUEUED : CONTACT_SYNC_STATE.AUTH_FAILED;
}

function getQueueSyncBadgeMeta(syncState) {
  if (syncState === CONTACT_SYNC_STATE.SYNCED) {
    return { dotColor: "#22c55e", label: "Synced" };
  }
  if (syncState === CONTACT_SYNC_STATE.QUEUED) {
    return { dotColor: "#eab308", label: "Queued" };
  }
  if (syncState === CONTACT_SYNC_STATE.AUTH_FAILED) {
    return { dotColor: "#ef4444", label: "Sign in required" };
  }
  return { dotColor: "#ef4444", label: "Sync failed" };
}

async function renderQueueCard() {
  if (!elements.queueEmptyState || !elements.queuePopulatedView) return;

  const stored = await storageGet([SAVED_CONTACTS_KEY, SYNC_QUEUE_KEY, SYNC_STATUS_KEY]);
  const contacts = Array.isArray(stored?.[SAVED_CONTACTS_KEY])
    ? stored[SAVED_CONTACTS_KEY]
    : [];
  const queue = Array.isArray(stored?.[SYNC_QUEUE_KEY]) ? stored[SYNC_QUEUE_KEY] : [];
  const syncStatus = stored?.[SYNC_STATUS_KEY] && typeof stored[SYNC_STATUS_KEY] === "object"
    ? stored[SYNC_STATUS_KEY]
    : {};
  const lastSyncStatus = String(syncStatus?.lastSyncStatus || "").trim();
  const queuedLocalIds = new Set(
    queue
      .map((entry) => String(entry?.localId || "").trim())
      .filter(Boolean)
  );
  const isEmpty = contacts.length === 0;

  elements.queueEmptyState.classList.toggle("hidden", !isEmpty);
  elements.queuePopulatedView.classList.toggle("hidden", isEmpty);

  if (isEmpty) {
    // Inject the empty-state node once (idempotent)
    if (
      elements.queueEmptyState.childElementCount === 0 &&
      typeof createQueueEmptyState === "function"
    ) {
      elements.queueEmptyState.appendChild(createQueueEmptyState());
    }
    return;
  }

  if (elements.queueCountLabel) {
    elements.queueCountLabel.textContent = `${contacts.length} Contact${contacts.length !== 1 ? "s" : ""}`;
  }

  if (elements.queueContactsList) {
    elements.queueContactsList.innerHTML = contacts
      .slice(0, 20)
      .map((c) => {
        const email = escapeHtml(String(c.email || "\u2014"));
        const rawEmail = String(c.email || "").trim();
        const emailAttr = rawEmail.replace(/"/g, "&quot;");
        const resolvedSyncState = resolveQueueContactSyncState(c, queuedLocalIds, lastSyncStatus);
        const badgeMeta = getQueueSyncBadgeMeta(resolvedSyncState);
        return `<div class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <span aria-hidden="true" style="flex-shrink:0;width:8px;height:8px;border-radius:999px;background:${badgeMeta.dotColor};"></span>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:12px;color:#334155">${email}</span>
          </div>
          <span style="flex-shrink:0;font-size:10px;font-weight:600;color:#64748b;white-space:nowrap">${badgeMeta.label}</span>
          <button
            type="button"
            class="queue-copy-btn"
            data-email="${emailAttr}"
            style="flex-shrink:0;border:1px solid #e2e8f0;background:#f8fafc;color:#334155;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:600;line-height:1.1;cursor:pointer"
          >
            Copy
          </button>
        </div>`;
      })
      .join("");
  }
}

/**
 * Toggle the notes textarea open/closed and update the chevron rotation.
 */
function toggleNotesBody() {
  if (!elements.notesBody || !elements.notesToggle) return;

  const willExpand = elements.notesBody.classList.contains("hidden");
  elements.notesBody.classList.toggle("hidden", !willExpand);
  elements.notesToggle.setAttribute("aria-expanded", String(willExpand));

  const chevron = document.getElementById("notesChevron");
  if (chevron) {
    chevron.style.transform = willExpand ? "rotate(180deg)" : "";
  }

  if (willExpand) {
    elements.notesBody.querySelector("textarea")?.focus();
  }
}

window.addEventListener("beforeunload", () => {
  stopProfileContextSync();
});

document.addEventListener("DOMContentLoaded", () => {
  void init();
});

// ── Issue 1: Discover Email button validation ────────────────────────────────

function validateDiscoverEmailBtn() {
  if (!elements.discoverEmailButton) return;
  const allFilled =
    (elements.firstName?.value || "").trim().length > 0 &&
    (elements.lastName?.value || "").trim().length > 0 &&
    (elements.company?.value || "").trim().length > 0 &&
    (elements.role?.value || "").trim().length > 0;
  elements.discoverEmailButton.disabled = !allFilled;
}

// ── Issue 3: Template menu open/close ───────────────────────────────────────

function toggleTemplateMenu() {
  const isOpen = !elements.templateMenu?.classList.contains("hidden");
  if (isOpen) {
    closeTemplateMenu();
  } else {
    openTemplateMenu();
  }
}

function openTemplateMenu() {
  elements.templateMenu?.classList.remove("hidden");
  elements.templateToggle?.setAttribute("aria-expanded", "true");
  if (elements.templateChevron) {
    elements.templateChevron.style.transform = "rotate(180deg)";
  }
}

function closeTemplateMenu() {
  elements.templateMenu?.classList.add("hidden");
  elements.templateToggle?.setAttribute("aria-expanded", "false");
  if (elements.templateChevron) {
    elements.templateChevron.style.transform = "";
  }
}

// ── Issue 4 + 7: Stage navigation with scroll reset ─────────────────────────

function goToStage(newStage) {
  appState.stage = newStage;
  renderStages();
  // Scroll the main panel to top on every stage transition
  document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Issue 5: Expand manual entry form from error state ──────────────────────

function expandManualEntryForm() {
  if (!elements.manualEntryBody || !elements.manualEntryToggle) return;
  // Expand the accordion
  elements.manualEntryBody.classList.remove("hidden");
  elements.manualEntryToggle.setAttribute("aria-expanded", "true");
  const chevron = document.getElementById("manualEntryChevron");
  if (chevron) chevron.style.transform = "rotate(180deg)";
  // Scroll to it and focus the first field
  elements.manualEntryToggle.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => elements.firstName?.focus(), 300);
}

// ── Draft view ────────────────────────────────────────────────────────────────
//
// State for the draft view panel. Module-level (not inside emailFinderState)
// since these are implementation details of the view layer, not UI model state.

let _dvHandle          = null;   // { destroy() } from initDraftView()
let _dvLastContactKey  = "";     // tracks which contact the draft was built for

/**
 * Builds a contact object from the current profile context + email result.
 * This is passed into renderDraftView / initDraftView.
 *
 * @returns {{ name: string, company: string, role: string, email: string }}
 */
function _buildDraftContact() {
  const ctx     = emailFinderState.profileContext || {};
  const company = typeof ctx.company === "string"
    ? ctx.company
    : String(ctx.company?.name ?? "");
  const role    = typeof ctx.role === "string"
    ? ctx.role
    : String(ctx.role?.title ?? "");
  return {
    name:    String(ctx.fullName  ?? "").trim(),
    company: company.trim(),
    role:    role.trim(),
    email:   String(emailFinderState.currentResult?.email ?? "").trim(),
  };
}

/**
 * Returns a cache key for a contact — used to detect when a re-render
 * is needed because the user has moved to a different LinkedIn profile
 * or a new email result has been found.
 *
 * @param {{ name: string, company: string, email: string }} contact
 * @returns {string}
 */
function _dvContactKey(contact) {
  return [contact.email, contact.name, contact.company]
    .map((v) => String(v ?? "").toLowerCase().trim())
    .join("|") || "unknown";
}

/**
 * Sets the active-tab highlight on the footer nav.
 * Pass null to clear all highlights (used when showing external-app tabs).
 *
 * @param {HTMLElement | null} activeBtn
 */
function _setFooterActiveTab(activeBtn) {
  [
    elements.dashNavContacts,
    elements.dashNavAnalytics,
    elements.dashNavSettings,
    elements.dashNavDraft,
  ].forEach((btn) => btn?.classList.remove("is-active"));
  activeBtn?.classList.add("is-active");
}

/**
 * Switches the panel into Draft Generator mode:
 *   - Hides <main> (the email-finder content)
 *   - Shows #draftViewContainer
 *   - Renders/re-renders the draft view if the contact has changed
 */
async function switchToDraftView() {
  if (!emailFinderState.isAuthenticated) return;
  if (!elements.draftViewContainer) return;

  const contact    = _buildDraftContact();
  const contactKey = _dvContactKey(contact);
  const needsRender =
    contactKey !== _dvLastContactKey ||
    elements.draftViewContainer.childElementCount === 0;

  // Show the draft container; hide the finder scroll area
  document.querySelector("main")?.classList.add("hidden");
  elements.draftViewContainer.classList.remove("hidden");
  _setFooterActiveTab(elements.dashNavDraft);

  if (!needsRender) return;  // same contact, view already rendered — just show it

  // Destroy previous instance so its storage listeners don't fire redundantly
  _dvHandle?.destroy();
  _dvHandle = null;

  // Render the HTML shell
  if (typeof renderDraftView === "function") {
    elements.draftViewContainer.innerHTML = renderDraftView(contact);
  } else {
    // Draft view scripts not loaded — show a friendly fallback
    elements.draftViewContainer.innerHTML = `
      <div style="padding:32px 20px;text-align:center;color:#64748b;font-family:inherit">
        <p style="font-size:22px;margin:0 0 8px">✉️</p>
        <p style="font-size:14px;margin:0">Draft Generator is unavailable.<br>Reload the panel to try again.</p>
      </div>`;
    return;
  }

  // Wire all inter-component events
  if (typeof initDraftView === "function") {
    _dvHandle = await initDraftView(elements.draftViewContainer, contact);
  }

  _dvLastContactKey = contactKey;
}

/**
 * Switches the panel back to the email-finder (main) view.
 */
function switchToFinderView() {
  document.querySelector("main")?.classList.remove("hidden");
  elements.draftViewContainer?.classList.add("hidden");
  _setFooterActiveTab(null);  // no tab highlighted — footer buttons open web app
}

/**
 * Tears down the draft view entirely (called on logout or when auth state resets).
 * The next call to switchToDraftView() will re-render from scratch.
 */
function _hideDraftView() {
  if (!elements.draftViewContainer) return;
  // Destroy component listeners first to prevent orphan timers/handlers
  _dvHandle?.destroy();
  _dvHandle = null;
  _dvLastContactKey = "";
  elements.draftViewContainer.innerHTML = "";
  elements.draftViewContainer.classList.add("hidden");
  document.querySelector("main")?.classList.remove("hidden");
  elements.dashNavDraft?.classList.remove("is-active");
}

// ── Stats / Settings panel ────────────────────────────────────────────────────
//
// The gear icon inside the Draft Generator opens a local analytics panel
// instead of navigating to the web app settings page.

let _statsHandle = null;  // { refresh(), destroy() } from initDraftStatsPanelListeners()

/**
 * Renders and displays the draft analytics (stats) panel as a fixed overlay.
 * Hides the draft view while stats are shown.
 */
async function switchToStatsView() {
  if (!elements.statsViewContainer) return;

  // Hide the draft view container (keep its state — just visually hide it)
  elements.draftViewContainer?.classList.add("hidden");

  // Render the stats panel HTML shell
  if (typeof renderDraftStatsPanel === "function") {
    elements.statsViewContainer.innerHTML = renderDraftStatsPanel();
  } else {
    elements.statsViewContainer.innerHTML = `
      <div style="padding:40px 20px;text-align:center;color:#64748b;font-family:inherit">
        <p style="font-size:22px;margin:0 0 8px">📊</p>
        <p style="font-size:14px;margin:0">Analytics unavailable. Reload the panel to try again.</p>
      </div>`;
    elements.statsViewContainer.classList.remove("hidden");
    return;
  }

  elements.statsViewContainer.classList.remove("hidden");

  // Destroy any previous stats handle
  _statsHandle?.destroy();
  _statsHandle = null;

  // Wire listeners; listen for the close event to return to the draft view
  if (typeof initDraftStatsPanelListeners === "function") {
    _statsHandle = await initDraftStatsPanelListeners(elements.statsViewContainer);
  }

  // Close the stats panel and return to the draft view when "dsp-close" fires
  elements.statsViewContainer.addEventListener(
    "dsp-close",
    () => { _hideStatsView(); elements.draftViewContainer?.classList.remove("hidden"); },
    { once: true }
  );
}

/**
 * Tears down the stats panel (called on logout or draft view teardown).
 */
function _hideStatsView() {
  if (!elements.statsViewContainer) return;
  _statsHandle?.destroy();
  _statsHandle = null;
  elements.statsViewContainer.innerHTML = "";
  elements.statsViewContainer.classList.add("hidden");
}

