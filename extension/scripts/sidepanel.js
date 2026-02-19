const AUTH_REDIRECT_URL = "https://www.useellyn.com/auth";
const PRICING_URL = "https://www.useellyn.com/pricing";
const API_BASE_URL = "https://www.useellyn.com";
const APP_BASE_URL = "https://app.ellyn.app";
const AUTH_STORAGE_KEYS = ["isAuthenticated", "user", "auth_token"];
const SAVED_CONTACTS_KEY = "saved_contact_results";
const FEEDBACK_QUEUE_KEY = "feedback_queue";
const SYNC_STATUS_KEY = "sync_status";
const PROFILE_SYNC_INTERVAL_MS = 2000;
const PROFILE_CONTEXT_FRESH_MS = 15000;

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
  loadingTimer: null,
  stageIndex: 0,
  upgradeUrl: PRICING_URL,
  profileContext: null,
  profileSyncTimer: null,
  profileRefreshInFlight: false,
  lastProfileKey: "",
  profileListenersBound: false,
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
  feedbackYesBtn: null,
  feedbackNoBtn: null,
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
  elements.feedbackYesBtn = document.getElementById("feedbackYesBtn");
  elements.feedbackNoBtn = document.getElementById("feedbackNoBtn");

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
  elements.feedbackYesBtn?.addEventListener("click", () => submitFeedback(true));
  elements.feedbackNoBtn?.addEventListener("click", () => submitFeedback(false));
  elements.upgradeButton?.addEventListener("click", () => {
    const url = emailFinderState.upgradeUrl || PRICING_URL;
    chrome.tabs.create({ url });
  });
  elements.refreshProfileContextBtn?.addEventListener("click", () => {
    void refreshProfileContext("manual");
  });

  // ── Dashboard footer nav ─────────────────────────────────────────────────
  elements.dashNavContacts?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_BASE_URL}/dashboard/contacts` });
  });
  elements.dashNavAnalytics?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_BASE_URL}/dashboard/analytics` });
  });
  elements.dashNavSettings?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_BASE_URL}/dashboard/settings` });
  });

  // ── Stage 2 — sent callout ───────────────────────────────────────────────
  elements.markSentButton?.addEventListener("click", () => {
    showSentCallout();
  });
  elements.sentCalloutAction?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_BASE_URL}/dashboard/analytics` });
    dismissSentCallout();
  });
  elements.sentCalloutDismiss?.addEventListener("click", dismissSentCallout);

  // ── Stage 2 — view all in dashboard link ────────────────────────────────
  elements.viewAllInDashboard?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${APP_BASE_URL}/dashboard/contacts?status=contacted` });
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
    chrome.tabs.create({ url: `${APP_BASE_URL}/dashboard` });
  });
  elements.draftViewContainer?.addEventListener("dv-sent", (e) => {
    console.log("[Sidepanel] Draft sent via Gmail:", e.detail);
    // The draft view and gmail-action-button handle storage and toast internally
  });
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
    if (changes.isAuthenticated || changes.user || changes.auth_token) {
      syncAuthStateFromStorage();
    }
    if (changes[SYNC_STATUS_KEY]) {
      void renderSyncStatus();
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

async function syncAuthStateFromStorage() {
  const auth = await storageGet(AUTH_STORAGE_KEYS);
  const isAuthenticated =
    auth?.isAuthenticated === true ||
    (typeof auth?.auth_token === "string" && auth.auth_token.length > 0);

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
    console.log("[Sidepanel] Active tab for profile context", { tabId, tabUrl });

    if (!Number.isFinite(tabId) || !isLinkedInProfile(tabUrl)) {
      emailFinderState.lastProfileKey = "";
      resetProfileContext("Open a LinkedIn profile to begin.", "neutral");
      return;
    }

    const incomingKey = buildProfileContextKey(tabId, tabUrl);
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
    const authUrl = new URL(AUTH_REDIRECT_URL);
    authUrl.searchParams.set("source", "extension");
    authUrl.searchParams.set("extensionId", chrome.runtime.id);
    authUrl.searchParams.set("mode", mode === "signup" ? "signup" : "signin");

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

async function setSyncStatus(status) {
  await storageSet({
    [SYNC_STATUS_KEY]: {
      lastSyncStatus: status,
      lastSyncAt: new Date().toISOString(),
    },
  });
}

async function renderSyncStatus() {
  if (!elements.syncStatusRow) return;

  if (!emailFinderState.isAuthenticated) {
    // Gray dot — not connected
    elements.syncStatusRow.classList.remove("hidden");
    if (elements.syncDot) elements.syncDot.dataset.status = "none";
    if (elements.syncLabel) elements.syncLabel.textContent = "Not connected";
    if (elements.syncActionBtn) {
      elements.syncActionBtn.textContent = "Connect";
      elements.syncActionBtn.dataset.action = "connect";
      elements.syncActionBtn.classList.remove("hidden");
    }
    return;
  }

  // Authenticated — read persisted sync state
  const stored = await storageGet([SYNC_STATUS_KEY]);
  const syncState = stored?.[SYNC_STATUS_KEY] || null;
  const status = syncState?.lastSyncStatus || null;

  elements.syncStatusRow.classList.remove("hidden");

  if (status === "failed") {
    // Yellow dot — sync pending
    if (elements.syncDot) elements.syncDot.dataset.status = "failed";
    if (elements.syncLabel) elements.syncLabel.textContent = "Sync pending";
    if (elements.syncActionBtn) {
      elements.syncActionBtn.textContent = "Retry";
      elements.syncActionBtn.dataset.action = "retry";
      elements.syncActionBtn.classList.remove("hidden");
    }
  } else {
    // Green dot — synced (covers "success" and null/no-sync-yet)
    if (elements.syncDot) elements.syncDot.dataset.status = "success";
    if (elements.syncLabel) elements.syncLabel.textContent = "Synced with Ellyn App";
    if (elements.syncActionBtn) elements.syncActionBtn.classList.add("hidden");
  }
}

async function handleSyncAction() {
  const action = elements.syncActionBtn?.dataset.action;
  if (action === "connect") {
    const url = `${API_BASE_URL}/extension-auth?extensionId=${chrome.runtime.id}`;
    chrome.tabs.create({ url });
  } else if (action === "retry") {
    await retryPendingContacts();
  }
}

async function retryPendingContacts() {
  if (elements.syncActionBtn) {
    elements.syncActionBtn.textContent = "Retrying…";
    elements.syncActionBtn.disabled = true;
  }

  try {
    const existing = await storageGet([SAVED_CONTACTS_KEY]);
    const list = Array.isArray(existing?.[SAVED_CONTACTS_KEY]) ? existing[SAVED_CONTACTS_KEY] : [];
    const pending = list.filter((entry) => !entry.backendId);

    for (const entry of pending) {
      // syncContactToBackend handles success/failure status internally
      await syncContactToBackend(entry, null);
    }
  } finally {
    if (elements.syncActionBtn) {
      elements.syncActionBtn.disabled = false;
    }
    await renderSyncStatus();
  }
}

async function syncContactToBackend(savedRow, profileContext) {
  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      showSessionExpiredBanner();
      return;
    }

    const ctx = profileContext || {};
    const body = {
      firstName: String(ctx.firstName || "").trim() || undefined,
      lastName: String(ctx.lastName || "").trim() || undefined,
      company: String(ctx.company || "").trim() || undefined,
      role: String(ctx.role || "").trim() || undefined,
      inferredEmail: String(savedRow.email || "").trim() || undefined,
      linkedinUrl: String(ctx.profileUrl || savedRow.profileUrl || "").trim() || undefined,
      source: "extension",
    };

    // Remove undefined keys so the API schema validation doesn't choke on them
    Object.keys(body).forEach((k) => {
      if (body[k] === undefined) delete body[k];
    });

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/contacts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      },
      10000
    );

    if (response.status === 401) {
      // Auth token expired — show the session-expired banner
      showSessionExpiredBanner();
      await setSyncStatus("failed");
      return;
    }

    if (response.status === 409) {
      // Already exists in backend — treat as success
      console.log("[Sidepanel] Contact already exists in backend (409).");
      await setSyncStatus("success");
      return;
    }

    if (!response.ok) {
      console.warn("[Sidepanel] syncContactToBackend: non-OK status", response.status);
      await setSyncStatus("failed");
      return;
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      await setSyncStatus("failed");
      return;
    }

    const backendId = data?.contact?.id;
    if (!backendId) {
      await setSyncStatus("failed");
      return;
    }

    // Patch the local entry with the backend-assigned ID
    const existing = await storageGet([SAVED_CONTACTS_KEY]);
    const list = Array.isArray(existing?.[SAVED_CONTACTS_KEY]) ? existing[SAVED_CONTACTS_KEY] : [];
    const idx = list.findIndex(
      (entry) => entry.email === savedRow.email && entry.createdAt === savedRow.createdAt
    );
    if (idx !== -1) {
      list[idx] = { ...list[idx], backendId };
      await storageSet({ [SAVED_CONTACTS_KEY]: list });
    }

    await setSyncStatus("success");
  } catch (err) {
    console.warn("[Sidepanel] syncContactToBackend failed:", err);
    await setSyncStatus("failed");
  }
}

async function saveCurrentResultToContacts() {
  const result = emailFinderState.currentResult;
  if (!result?.email) {
    showToast("No result to save.", "error");
    return;
  }

  const nowIso = new Date().toISOString();
  const savedRow = {
    email: String(result.email),
    pattern: String(result.pattern || ""),
    confidence: toConfidencePercent(result.confidence),
    source: String(result.source || "unknown"),
    profileUrl: String(result.profileUrl || ""),
    createdAt: nowIso,
  };

  const existing = await storageGet([SAVED_CONTACTS_KEY]);
  const list = Array.isArray(existing?.[SAVED_CONTACTS_KEY]) ? existing[SAVED_CONTACTS_KEY] : [];
  list.unshift(savedRow);
  await storageSet({ [SAVED_CONTACTS_KEY]: list.slice(0, 250) });

  showToast("Saved to contacts.", "success");
  void renderQueueCard();

  // Best-effort backend sync — never blocks or shows errors to the user
  void syncContactToBackend(savedRow, emailFinderState.profileContext);
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
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/email-feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok && (response.status === 404 || response.status === 405)) {
      response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/pattern-feedback`, {
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

    if (elements.quotaCount) {
      if (Number.isFinite(safeUsed) && Number.isFinite(safeLimit)) {
        elements.quotaCount.textContent = `${safeUsed}/${safeLimit}`;
      } else if (Number.isFinite(safeUsed) && unlimitedPlan) {
        elements.quotaCount.textContent = `${safeUsed}/Unlimited`;
      } else if (Number.isFinite(safeRemaining) && Number.isFinite(safeLimit)) {
        const derivedUsed = Math.max(0, safeLimit - safeRemaining);
        elements.quotaCount.textContent = `${derivedUsed}/${safeLimit}`;
      } else {
        elements.quotaCount.textContent = "0/Unlimited";
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
    emailFinderState.quotaKnown = true;
    emailFinderState.quotaAllowsLookup = true;
    setUpgradeState(false, "", emailFinderState.upgradeUrl);

    if (unlimitedPlan) {
      if (Number.isFinite(safeUsed)) {
        setQuotaWarning(`Unlimited plan active. ${safeUsed} credits used.`);
      } else {
        setQuotaWarning("Unlimited plan active.");
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
    if (elements.quotaCount) {
      elements.quotaCount.textContent = "0/Unlimited";
    }
    if (elements.quotaFill) {
      elements.quotaFill.style.width = "0%";
      elements.quotaFill.classList.remove("warning", "danger");
    }
    setQuotaWarning("Unlimited plan active.");
    setUpgradeState(false, "", emailFinderState.upgradeUrl);
    applyFindEmailAvailability();
  }
}

function resetQuotaUI() {
  if (elements.quotaCount) {
    elements.quotaCount.textContent = "0/Unlimited";
  }
  if (elements.quotaFill) {
    elements.quotaFill.style.width = "0%";
    elements.quotaFill.classList.remove("warning", "danger");
  }
  setQuotaWarning("");
  setUpgradeState(false, "", emailFinderState.upgradeUrl);
  applyFindEmailAvailability();
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
  try {
    const directResponse = await sendTabMessage(tabId, { type: "EXTRACT_PROFILE", debug });
    if (directResponse) {
      return directResponse;
    }
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }
  }

  return sendRuntimeMessage({
    type: "EXTRACT_PROFILE_FROM_TAB",
    tabId,
    debug,
    data: { tabId, debug },
  });
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
    return typeof auth.auth_token === "string" ? auth.auth_token : "";
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
async function renderQueueCard() {
  if (!elements.queueEmptyState || !elements.queuePopulatedView) return;

  const stored = await storageGet([SAVED_CONTACTS_KEY]);
  const contacts = Array.isArray(stored?.[SAVED_CONTACTS_KEY])
    ? stored[SAVED_CONTACTS_KEY]
    : [];
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
        const dateStr = c.createdAt
          ? new Date(c.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "";
        return `<div class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:12px;color:#334155">${email}</span>
          <span style="flex-shrink:0;font-size:11px;color:#94a3b8">${dateStr}</span>
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
