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
const TODO_CACHE_KEY = "ellyn_todo_items_cache";
const EMAIL_LOOKUP_CACHE_KEY = "ellyn_email_lookup_cache";
const TODO_MAX_ITEMS = 30;
const TODO_VISIBLE_COMPLETED = 2;
const PROFILE_SYNC_INTERVAL_MS = 2000;
const PROFILE_CONTEXT_FRESH_MS = 15000;
const PROFILE_CONTEXT_EMPTY_NAME = "Open a LinkedIn profile";
const PROFILE_CONTEXT_EMPTY_SUBTEXT = "to unlock email IDs and contact details.";
const PROFILE_CONTEXT_EMPTY_STATUS = "Open a user's LinkedIn profile to view email IDs.";
const ABOUT_BRIEF_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ABOUT_BRIEF_FAILURE_TTL_MS = 30 * 60 * 1000;
const ABOUT_BRIEF_MAX_CACHE_ENTRIES = 40;
const ABOUT_BRIEF_UNAVAILABLE_MESSAGE =
  "We couldn't fetch company details right now. Try again later.";
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
  quotaVisibleRequested: false,
  profileSectionMode: "none",
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
  aboutBriefCache: new Map(),
  aboutBriefRequestId: 0,
  activeAboutBriefKey: "",
  todoItems: [],
  todoSaveInFlight: false,
  revealedPhone: "",
};

const elements = {
  statusText: null,
  authHeaderActions: null,
  settingsButton: null,
  profileButton: null,
  stageAuth: null,
  emailFinderSection: null,
  contactDefaultView: null,
  contactDetailView: null,
  emailContactRow: null,
  phoneContactRow: null,
  stage1: null,
  stage2: null,
  stage3: null,
  signInButton: null,
  createAccountButton: null,
  logoutButton: null,
  findEmailBtn: null,
  accessEmailBtnLabel: null,
  foundEmailText: null,
  lookupTraceText: null,
  lookupWarningsList: null,
  phoneNumberBtn: null,
  phoneNumberText: null,
  copyPhoneBtn: null,
  sendMailBtn: null,
  addToListContactBtn: null,
  draftMailBtn: null,
  addToListBtn: null,
  addToSequenceBtn: null,
  logActivityBtn: null,
  viewCatalogBtn: null,
  todoAddMoreBtn: null,
  todoList: null,
  todoEmptyState: null,
  todoInputRow: null,
  todoInput: null,
  todoSaveBtn: null,
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
  profileAvatarInitials: null,
  aboutCardTitle: null,
  aboutCardIntro: null,
  aboutCardBullets: null,
  aboutCard: null,
  quickActionsCard: null,
  contactSection: null,
  todoCard: null,
  companyPeopleCard: null,
  companyPeopleTitle: null,
  companyPeopleBtn: null,
  companyPeopleBtnLabel: null,
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
  viewAllContactsButton: null,
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
  const localOrigin = await findLocalAppOriginFromOpenTabs();
  if (localOrigin) {
    return {
      apiBaseUrl: localOrigin,
      appBaseUrl: localOrigin,
      authBaseUrl: localOrigin,
    };
  }

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
  elements.settingsButton = document.getElementById("settingsButton");
  elements.profileButton = document.getElementById("profileButton");
  elements.stageAuth = document.getElementById("stageAuth");
  elements.emailFinderSection = document.getElementById("emailFinderSection");
  elements.contactDefaultView = document.getElementById("contactDefaultView");
  elements.contactDetailView = document.getElementById("contactDetailView");
  elements.emailContactRow = document.getElementById("emailContactRow");
  elements.phoneContactRow = document.getElementById("phoneContactRow");
  elements.stage1 = document.getElementById("stage1");
  elements.stage2 = document.getElementById("stage2");
  elements.stage3 = document.getElementById("stage3");

  elements.signInButton = document.getElementById("signInButton");
  elements.createAccountButton = document.getElementById("createAccountButton");
  elements.logoutButton = document.getElementById("logoutButton");

  elements.findEmailBtn = document.getElementById("findEmailBtn");
  elements.accessEmailBtnLabel = document.getElementById("accessEmailBtnLabel");
  elements.foundEmailText = document.getElementById("foundEmailText");
  elements.lookupTraceText = document.getElementById("lookupTraceText");
  elements.lookupWarningsList = document.getElementById("lookupWarningsList");
  elements.phoneNumberBtn = document.getElementById("phoneNumberBtn");
  elements.phoneNumberText = document.getElementById("phoneNumberText");
  elements.copyPhoneBtn = document.getElementById("copyPhoneBtn");
  elements.sendMailBtn = document.getElementById("sendMailBtn");
  elements.addToListContactBtn = document.getElementById("addToListContactBtn");
  elements.draftMailBtn = document.getElementById("draftMailBtn");
  elements.addToListBtn = document.getElementById("addToListBtn");
  elements.addToSequenceBtn = document.getElementById("addToSequenceBtn");
  elements.logActivityBtn = document.getElementById("logActivityBtn");
  elements.viewCatalogBtn = document.getElementById("viewCatalogBtn");
  elements.todoAddMoreBtn = document.getElementById("todoAddMoreBtn");
  elements.todoList = document.getElementById("todoList");
  elements.todoEmptyState = document.getElementById("todoEmptyState");
  elements.todoInputRow = document.getElementById("todoInputRow");
  elements.todoInput = document.getElementById("todoInput");
  elements.todoSaveBtn = document.getElementById("todoSaveBtn");
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
  elements.profileAvatarInitials = document.getElementById("profileAvatarInitials");
  elements.aboutCardTitle = document.getElementById("aboutCardTitle");
  elements.aboutCardIntro = document.getElementById("aboutCardIntro");
  elements.aboutCardBullets = document.getElementById("aboutCardBullets");
  elements.aboutCard = document.getElementById("aboutCard");
  elements.quickActionsCard = document.getElementById("quickActionsCard");
  elements.contactSection = document.getElementById("contactSection");
  elements.todoCard = document.getElementById("todoCard");
  elements.companyPeopleCard = document.getElementById("companyPeopleCard");
  elements.companyPeopleTitle = document.getElementById("companyPeopleTitle");
  elements.companyPeopleBtn = document.getElementById("companyPeopleBtn");
  elements.companyPeopleBtnLabel = document.getElementById("companyPeopleBtnLabel");
  elements.refreshProfileContextBtn = document.getElementById("refreshProfileContextBtn");

  elements.toastContainer = document.getElementById("toastContainer");

  elements.syncStatusRow = document.getElementById("syncStatusRow");
  elements.syncDot = document.getElementById("syncDot");
  elements.syncLabel = document.getElementById("syncLabel");
  elements.syncActionBtn = document.getElementById("syncActionBtn");

  elements.queueEmptyState = document.getElementById("queueEmptyState");
  elements.queuePopulatedView = document.getElementById("queuePopulatedView");
  elements.queueCountLabel = document.getElementById("queueCountLabel");
  elements.viewAllContactsButton = document.getElementById("viewAllContactsButton");
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
  elements.profileButton?.addEventListener("click", () => {
    void openDashboardPath("/dashboard");
  });
  elements.settingsButton?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/settings");
  });
  elements.logoutButton?.addEventListener("click", signOut);
  elements.findEmailBtn?.addEventListener("click", () => {
    console.log("[Sidepanel] Access Email click received");
    void findEmail();
  });
  elements.phoneNumberBtn?.addEventListener("click", () => {
    void handlePhoneNumberAccess();
  });
  elements.copyPhoneBtn?.addEventListener("click", () => {
    void copyCurrentPhoneNumber();
  });
  elements.sendMailBtn?.addEventListener("click", () => {
    void openDraftForCurrentResult();
  });
  elements.addToListContactBtn?.addEventListener("click", saveCurrentResultToContacts);
  elements.draftMailBtn?.addEventListener("click", () => {
    void openDraftForCurrentResult();
  });
  elements.retryBtn?.addEventListener("click", findEmail);
  elements.copyEmailBtn?.addEventListener("click", () => copyCurrentEmail());
  elements.saveToContactsBtn?.addEventListener("click", saveCurrentResultToContacts);
  elements.addToListBtn?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/contacts");
  });
  elements.addToSequenceBtn?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/sequences/new");
  });
  elements.logActivityBtn?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/analytics");
  });
  elements.viewCatalogBtn?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/templates");
  });
  elements.companyPeopleBtn?.addEventListener("click", () => {
    showToast("People profile view will be available soon.", "info");
  });
  elements.todoAddMoreBtn?.addEventListener("click", () => {
    openTodoComposer();
  });
  elements.todoSaveBtn?.addEventListener("click", () => {
    void handleTodoSave();
  });
  elements.todoInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleTodoSave();
      return;
    }
    if (event.key === "Escape") {
      closeTodoComposer();
    }
  });
  elements.todoList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-todo-toggle]");
    if (!(button instanceof HTMLElement)) return;
    const todoId = String(button.dataset.todoId || "").trim();
    if (!todoId) return;
    void toggleTodoItemById(todoId);
  });
  elements.upgradeButton?.addEventListener("click", () => {
    const url = emailFinderState.upgradeUrl || PRICING_URL;
    chrome.tabs.create({ url });
  });
  elements.refreshProfileContextBtn?.addEventListener("click", () => {
    void refreshProfileContext("manual");
  });
  elements.viewAllContactsButton?.addEventListener("click", () => {
    void openDashboardPath("/dashboard/contacts");
  });
  elements.queueContactsList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const sendBtn = target.closest(".queue-send-btn");
    if (sendBtn instanceof HTMLElement) {
      const email = String(sendBtn.dataset.email || "").trim();
      if (!email) return;
      const fullName = String(sendBtn.dataset.name || "").trim();
      const company = String(sendBtn.dataset.company || "").trim();
      const role = String(sendBtn.dataset.role || "").trim();
      void openDraftForQueueContact({
        email,
        fullName,
        company,
        role,
      });
      return;
    }
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
  elements.draftViewContainer?.addEventListener("dv-back-clicked", () => {
    switchToFinderView();
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
      setUpgradeState(
        true,
        "Upgrade to continue.",
        message?.data?.upgradeUrl || PRICING_URL
      );
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
    if (changes[TODO_CACHE_KEY]) {
      const cached = normalizeTodoItems(changes[TODO_CACHE_KEY].newValue);
      emailFinderState.todoItems = cached;
      renderTodoList();
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
  setProfileDependentSectionsVisible(false);
  await loadTodosFromCache();
  renderTodoList();
  await syncAuthStateFromStorage();
}

function hideLegacyStages() {
  elements.stage1?.classList.add("hidden");
  elements.stage2?.classList.add("hidden");
  elements.stage3?.classList.add("hidden");
}

function setProfileDependentSectionsVisible(modeOrVisible = "none") {
  let mode = "none";
  if (typeof modeOrVisible === "string") {
    mode = modeOrVisible;
  } else if (modeOrVisible === true) {
    mode = "profile";
  }

  const showAbout = mode === "profile" || mode === "company";
  const showQuickActions = mode === "profile";
  const showContact = mode === "profile";
  const showCompanyPeople = mode === "company";
  const showUsage = mode === "profile" && emailFinderState.quotaVisibleRequested;

  emailFinderState.profileSectionMode = mode;

  elements.aboutCard?.classList.toggle("hidden", !showAbout);
  elements.quickActionsCard?.classList.toggle("hidden", !showQuickActions);
  elements.contactSection?.classList.toggle("hidden", !showContact);
  elements.companyPeopleCard?.classList.toggle("hidden", !showCompanyPeople);
  elements.quotaBar?.classList.toggle("hidden", !showUsage);
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
      setStatus(PROFILE_CONTEXT_EMPTY_STATUS, "neutral");
    } else {
      setStatus("Profile ready.", "success");
    }

    // Best effort: once auth is valid, flush any contacts waiting for backend sync.
    void syncPendingContactsQuietly();
    void syncTodosFromServer();
  } else {
    setStatus("Sign in to use the email finder.", "neutral");
    closeTodoComposer();
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
    emailFinderState.revealedPhone = "";
    stopProfileContextSync();
    resetProfileContext();
    stopLoadingCycle();
    hideResultAndError();
    resetQuotaUI();
    // Tear down draft + stats views so they re-render fresh on next login
    _hideDraftView();
    _hideStatsView();
    resetContactDetailView();
    updateFoundEmailText("");
    updatePhoneNumberText("");
    setProfileDependentSectionsVisible(false);
  } else {
    hideSessionExpiredBanner();
  }

  setPrimaryFinderAction("find");
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
    const tabTitle = typeof activeTab?.title === "string" ? activeTab.title : "";
    const onLinkedInProfilePage = isLinkedInProfile(tabUrl);
    const onLinkedInCompanyPage = isLinkedInCompanyPage(tabUrl);
    const previousProfileKey = emailFinderState.lastProfileKey;
    console.log("[Sidepanel] Active tab for profile context", { tabId, tabUrl });

    if (!Number.isFinite(tabId) || (!onLinkedInProfilePage && !onLinkedInCompanyPage)) {
      setProfileDependentSectionsVisible("none");
      if (previousProfileKey || emailFinderState.currentResult || emailFinderState.currentError) {
        clearLookupStateForProfileChange("left-linkedin-profile");
      }
      emailFinderState.lastProfileKey = "";
      resetProfileContext(PROFILE_CONTEXT_EMPTY_STATUS, "neutral");
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

    if (onLinkedInCompanyPage) {
      const companyContext = buildCompanyPageContext(tabId, tabUrl, tabTitle);
      renderProfileContext(companyContext, "success", "Company page detected.");
      renderCompanyPeopleCard(companyContext.company, companyContext.companyPageUrl);
      setProfileDependentSectionsVisible("company");
      emailFinderState.lastProfileKey = incomingKey;
      return;
    }

    const extractorResponse = await requestProfileExtraction(tabId, reason === "manual");
    console.log("[Sidepanel] Extraction response", extractorResponse);
    if (!extractorResponse?.success || !extractorResponse?.data) {
      const failure = String(extractorResponse?.error || "");
      const isNeutral = /not on a linkedin profile page/i.test(failure);
      setProfileDependentSectionsVisible(isNeutral ? "none" : "profile");
      renderProfileContext(
        {
          ...getDefaultProfileContext(),
          tabId,
          profileUrl: tabUrl,
          lastUpdatedAt: Date.now(),
        },
        isNeutral ? "neutral" : "error",
        isNeutral ? PROFILE_CONTEXT_EMPTY_STATUS : "Unable to load profile."
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
    setProfileDependentSectionsVisible("profile");
    console.log("[Sidepanel] Profile context updated", nextContext);
    emailFinderState.lastProfileKey = buildProfileContextKey(tabId, profileUrl || tabUrl);
    void restoreLookupResultForActiveProfile();
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

function normalizeAboutCardField(value, maxLength = 240) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  const blockedValues = new Set([
    "unknown",
    "n/a",
    "na",
    "none",
    "null",
    "not available",
    "not found",
    "-",
    "--",
  ]);
  if (blockedValues.has(lower)) {
    return "";
  }

  return normalized.slice(0, maxLength);
}

function normalizeAboutCardYear(value) {
  const candidate = normalizeAboutCardField(value, 20);
  if (!candidate) return "";

  const match = candidate.match(/\b(18|19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function normalizeAboutBriefPayload(data) {
  return {
    introBrief: normalizeAboutCardField(data?.introBrief || data?.intro_brief, 420),
    sector: normalizeAboutCardField(data?.sector, 140),
    specialization: normalizeAboutCardField(data?.specialization, 180),
    yearOfIncorporation: normalizeAboutCardYear(
      data?.yearOfIncorporation || data?.year_of_incorporation
    ),
  };
}

function buildAboutBriefCacheKey(companyName, companyPageUrl = "") {
  return `${normalizeInline(companyName).toLowerCase()}|${normalizeInline(companyPageUrl).toLowerCase()}`;
}

function getAboutBriefCacheEntry(cacheKey) {
  const entry = emailFinderState.aboutBriefCache.get(cacheKey);
  if (!entry) return null;

  const ageMs = Date.now() - Number(entry.cachedAt || 0);
  const ttlMs = entry.status === "failed" ? ABOUT_BRIEF_FAILURE_TTL_MS : ABOUT_BRIEF_CACHE_TTL_MS;
  if (ageMs > ttlMs) {
    emailFinderState.aboutBriefCache.delete(cacheKey);
    return null;
  }

  return entry;
}

function getCachedAboutBrief(cacheKey) {
  const entry = getAboutBriefCacheEntry(cacheKey);
  if (!entry || entry.status === "failed") {
    return null;
  }
  return entry.data || null;
}

function getFailedAboutBrief(cacheKey) {
  const entry = getAboutBriefCacheEntry(cacheKey);
  if (!entry || entry.status !== "failed") {
    return null;
  }
  return entry;
}

function setCachedAboutBrief(cacheKey, data, status = "success", errorMessage = "") {
  if (!cacheKey) return;
  emailFinderState.aboutBriefCache.set(cacheKey, {
    cachedAt: Date.now(),
    data,
    status,
    errorMessage: normalizeInline(errorMessage),
  });

  if (emailFinderState.aboutBriefCache.size > ABOUT_BRIEF_MAX_CACHE_ENTRIES) {
    const oldestKey = emailFinderState.aboutBriefCache.keys().next().value;
    if (oldestKey) {
      emailFinderState.aboutBriefCache.delete(oldestKey);
    }
  }
}

function setFailedAboutBrief(cacheKey, errorMessage = "") {
  setCachedAboutBrief(cacheKey, null, "failed", errorMessage);
}

function hasMeaningfulAboutBrief(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return Boolean(
    normalizeInline(payload.introBrief) ||
      normalizeInline(payload.sector) ||
      normalizeInline(payload.specialization) ||
      normalizeInline(payload.yearOfIncorporation)
  );
}

function buildAboutBriefFallback(companyName) {
  const safeCompany = normalizeInline(companyName);
  if (!safeCompany) {
    return {
      introBrief: ABOUT_BRIEF_UNAVAILABLE_MESSAGE,
      sector: "",
      specialization: "",
      yearOfIncorporation: "",
    };
  }

  return {
    introBrief: `${safeCompany} has a LinkedIn company page. Detailed company insights are unavailable right now.`,
    sector: "",
    specialization: "",
    yearOfIncorporation: "",
  };
}

function renderAboutCard(companyName, payload = null, options = {}) {
  const isLoading = options.isLoading === true;
  const hasCompany = Boolean(companyName);

  if (elements.aboutCardTitle) {
    elements.aboutCardTitle.textContent = hasCompany
      ? `About ${companyName}`
      : "About Company";
  }

  if (elements.aboutCardIntro) {
    if (!hasCompany) {
      elements.aboutCardIntro.textContent =
        "Details about the company will appear here when profile context is available.";
    } else if (isLoading) {
      elements.aboutCardIntro.textContent = "Loading company intro brief...";
    } else if (payload?.introBrief) {
      elements.aboutCardIntro.textContent = payload.introBrief;
    } else {
      elements.aboutCardIntro.textContent =
        "A short company intro brief is not available yet.";
    }
  }

  if (!elements.aboutCardBullets) return;

  const bulletRows = [];
  if (payload?.sector) {
    bulletRows.push(`Sector: ${payload.sector}`);
  }
  if (payload?.specialization) {
    bulletRows.push(`Specialization: ${payload.specialization}`);
  }
  if (payload?.yearOfIncorporation) {
    bulletRows.push(`Year Of Incorporation: ${payload.yearOfIncorporation}`);
  }

  elements.aboutCardBullets.innerHTML = "";
  if (bulletRows.length === 0) {
    elements.aboutCardBullets.classList.add("hidden");
    return;
  }

  elements.aboutCardBullets.classList.remove("hidden");
  for (const row of bulletRows) {
    const item = document.createElement("li");
    item.textContent = row;
    elements.aboutCardBullets.appendChild(item);
  }
}

function renderCompanyPeopleCard(companyName, companyPageUrl = "") {
  const safeCompanyName = normalizeInline(companyName);
  if (elements.companyPeopleTitle) {
    elements.companyPeopleTitle.textContent = safeCompanyName
      ? `People at ${safeCompanyName}`
      : "People Working Here";
  }

  if (elements.companyPeopleBtnLabel) {
    elements.companyPeopleBtnLabel.textContent = safeCompanyName
      ? `See ${safeCompanyName} Profiles`
      : "See People Profiles";
  }

  if (elements.companyPeopleBtn) {
    elements.companyPeopleBtn.dataset.companyPageUrl = normalizeLinkedInCompanyPageUrl(companyPageUrl);
  }
}

async function requestCompanyBrief(companyName, companyPageUrl = "") {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: "GET_COMPANY_BRIEF_GEMINI",
          companyName,
          companyPageUrl,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message || "Background request failed",
            });
            return;
          }

          resolve(response || { success: false, error: "No response received" });
        }
      );
    } catch (error) {
      resolve({
        success: false,
        error: error?.message || "Failed to request company brief",
      });
    }
  });
}

async function refreshAboutCardFromProfileContext(context) {
  const companyName = normalizeInline(context?.company || "");
  const companyPageUrl = normalizeInline(context?.companyPageUrl || "");
  const cacheKey = buildAboutBriefCacheKey(companyName, companyPageUrl);

  emailFinderState.activeAboutBriefKey = cacheKey;

  if (!companyName) {
    renderAboutCard("", null, { isLoading: false });
    return;
  }

  const failedEntry = getFailedAboutBrief(cacheKey);
  if (failedEntry) {
    renderAboutCard(companyName, buildAboutBriefFallback(companyName), { isLoading: false });
    return;
  }

  const cached = getCachedAboutBrief(cacheKey);
  if (cached) {
    renderAboutCard(companyName, cached, { isLoading: false });
    return;
  }

  renderAboutCard(companyName, null, { isLoading: true });

  const requestId = (emailFinderState.aboutBriefRequestId || 0) + 1;
  emailFinderState.aboutBriefRequestId = requestId;

  const response = await requestCompanyBrief(companyName, companyPageUrl);
  if (requestId !== emailFinderState.aboutBriefRequestId) return;
  if (cacheKey !== emailFinderState.activeAboutBriefKey) return;

  if (!response?.success) {
    setFailedAboutBrief(cacheKey, response?.error || "company-brief-request-failed");
    renderAboutCard(companyName, buildAboutBriefFallback(companyName), { isLoading: false });
    return;
  }

  const normalized = normalizeAboutBriefPayload(response?.data || {});
  if (!hasMeaningfulAboutBrief(normalized)) {
    const fallback = buildAboutBriefFallback(companyName);
    setCachedAboutBrief(cacheKey, fallback);
    renderAboutCard(companyName, fallback, { isLoading: false });
    return;
  }

  setCachedAboutBrief(cacheKey, normalized);
  renderAboutCard(companyName, normalized, { isLoading: false });
}

function renderProfileContext(context, statusTone = "neutral", statusText = PROFILE_CONTEXT_EMPTY_STATUS) {
  const merged = {
    ...getDefaultProfileContext(),
    ...(context || {}),
  };

  emailFinderState.profileContext = merged;

  if (elements.profileContextStatus) {
    elements.profileContextStatus.dataset.tone = statusTone;
    elements.profileContextStatus.textContent = statusText;
  }

  const displayName = String(merged.fullName || "").trim();
  const displayRole = String(
    typeof merged.role === "string" ? merged.role : merged?.role?.title || ""
  ).trim();
  const displayCompany = String(
    typeof merged.company === "string" ? merged.company : merged?.company?.name || ""
  ).trim();
  const hasProfileIdentity = Boolean(displayName || displayRole || displayCompany);

  if (elements.profileContextName) {
    elements.profileContextName.textContent = hasProfileIdentity
      ? displayName || "LinkedIn member"
      : PROFILE_CONTEXT_EMPTY_NAME;
  }

  if (elements.profileContextRole) {
    elements.profileContextRole.textContent = hasProfileIdentity
      ? displayRole || "Role not found yet"
      : PROFILE_CONTEXT_EMPTY_SUBTEXT;
  }

  if (elements.profileContextCompany) {
    if (!hasProfileIdentity) {
      elements.profileContextCompany.textContent = "";
      elements.profileContextCompany.classList.add("hidden");
    } else {
      elements.profileContextCompany.classList.remove("hidden");
      elements.profileContextCompany.textContent = displayCompany || "Company not found yet";
      if (merged.company && typeof merged.company === "object" && !displayCompany) {
        console.warn("[Sidepanel] Company was object in renderProfileContext:", merged.company);
      }
    }
  }

  if (elements.profileAvatarInitials) {
    elements.profileAvatarInitials.textContent = hasProfileIdentity
      ? deriveInitials(displayName || "Unknown")
      : "LI";
  }

  void refreshAboutCardFromProfileContext({
    company: displayCompany,
    companyPageUrl: merged.companyPageUrl || "",
  });

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

  if (!String(emailFinderState.currentResult?.email || "").trim()) {
    updateFoundEmailText("");
  }

  setPrimaryFinderAction("find");
  applyFindEmailAvailability();
}

function resetProfileContext(statusText = PROFILE_CONTEXT_EMPTY_STATUS, tone = "neutral") {
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

function normalizeLinkedInCompanyPageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!/linkedin\.com$/i.test(parsed.hostname) && !/\.linkedin\.com$/i.test(parsed.hostname)) {
      return "";
    }

    const slugMatch = parsed.pathname.match(/^\/company\/([^/?#]+)/i);
    if (!slugMatch?.[1]) {
      return "";
    }

    return `https://www.linkedin.com/company/${slugMatch[1]}/`;
  } catch {
    return "";
  }
}

function deriveCompanyNameFromLinkedInCompanyPage(url, tabTitle = "") {
  const titleCandidate = normalizeInline(String(tabTitle || "").split("|")[0] || "");
  if (titleCandidate && !/^linkedin$/i.test(titleCandidate)) {
    return titleCandidate;
  }

  const normalizedUrl = normalizeLinkedInCompanyPageUrl(url);
  const slugMatch = normalizedUrl.match(/\/company\/([^/]+)\/?$/i);
  const slug = String(slugMatch?.[1] || "").trim();
  if (!slug) return "";

  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    decodedSlug = slug;
  }

  const normalizedSlug = decodedSlug
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return toDisplayCase(normalizedSlug);
}

function buildCompanyPageContext(tabId, tabUrl, tabTitle = "") {
  const companyPageUrl = normalizeLinkedInCompanyPageUrl(tabUrl);
  const companyName = deriveCompanyNameFromLinkedInCompanyPage(tabUrl, tabTitle) || "LinkedIn Company";

  return {
    ...getDefaultProfileContext(),
    tabId,
    profileUrl: companyPageUrl || String(tabUrl || "").trim(),
    fullName: companyName,
    company: companyName,
    companyPageUrl,
    role: "LinkedIn company page",
    lastUpdatedAt: Date.now(),
    sourceSummary: "company-page:url",
  };
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
      message: PROFILE_CONTEXT_EMPTY_STATUS,
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

function openContactDetailView(mode = "email") {
  const normalizedMode = String(mode || "email").toLowerCase();
  const hasResolvedEmail = Boolean(String(emailFinderState.currentResult?.email || "").trim());
  const hasResolvedPhone = Boolean(String(emailFinderState.revealedPhone || "").trim());

  let showEmailRow = hasResolvedEmail;
  let showPhoneRow = hasResolvedPhone;

  if (normalizedMode === "email") {
    showEmailRow = true;
  } else if (normalizedMode === "phone") {
    showPhoneRow = true;
  } else if (normalizedMode === "all") {
    showEmailRow = true;
    showPhoneRow = true;
  }

  const showDetail = showEmailRow || showPhoneRow;
  elements.contactDefaultView?.classList.remove("hidden");
  elements.contactDetailView?.classList.toggle("hidden", !showDetail);
  elements.emailContactRow?.classList.toggle("hidden", !showEmailRow);
  elements.phoneContactRow?.classList.toggle("hidden", !showPhoneRow);
  elements.findEmailBtn?.classList.remove("is-placeholder");
  elements.phoneNumberBtn?.classList.remove("is-placeholder");
}

function resetContactDetailView() {
  elements.contactDetailView?.classList.add("hidden");
  elements.contactDefaultView?.classList.remove("hidden");
  elements.emailContactRow?.classList.add("hidden");
  elements.phoneContactRow?.classList.add("hidden");
  if (elements.findEmailBtn) {
    elements.findEmailBtn.classList.remove("is-placeholder");
    elements.findEmailBtn.setAttribute("aria-hidden", "false");
    elements.findEmailBtn.tabIndex = 0;
  }
  if (elements.phoneNumberBtn) {
    elements.phoneNumberBtn.classList.remove("is-placeholder");
    elements.phoneNumberBtn.classList.remove("hidden");
    elements.phoneNumberBtn.setAttribute("aria-hidden", "false");
    elements.phoneNumberBtn.tabIndex = 0;
  }
  setLookupTrace("");
  setLookupWarnings([]);
}

function normalizePhoneNumber(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return normalized;
}

function getCurrentPhoneNumber() {
  const candidates = [
    emailFinderState.currentResult?.phone,
    emailFinderState.currentResult?.phoneNumber,
    emailFinderState.currentResult?.mobile,
    emailFinderState.currentResult?.mobileNumber,
    emailFinderState.currentResult?.contactPhone,
    emailFinderState.profileContext?.phone,
    emailFinderState.profileContext?.phoneNumber,
    emailFinderState.profileContext?.mobile,
    emailFinderState.profileContext?.mobileNumber,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePhoneNumber(candidate);
    if (normalized) return normalized;
  }

  return "";
}

function updatePhoneNumberText(phone = "", fallback = "Phone Number") {
  const normalized = normalizePhoneNumber(phone);
  if (elements.phoneNumberText) {
    elements.phoneNumberText.textContent = normalized || fallback;
  }

  if (elements.copyPhoneBtn) {
    elements.copyPhoneBtn.disabled = !normalized;
  }
}

function updateFoundEmailText(email = "", fallback = "Access Email") {
  const normalized = String(email || "").trim();
  if (elements.foundEmailText) {
    elements.foundEmailText.textContent = normalized || fallback;
  }

  if (elements.copyEmailBtn) {
    elements.copyEmailBtn.disabled = !Boolean(normalized);
  }
}

function setLookupTrace(message = "", tone = "neutral") {
  if (!elements.lookupTraceText) return;
  const normalized = String(message || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    elements.lookupTraceText.textContent = "";
    elements.lookupTraceText.dataset.tone = "neutral";
    elements.lookupTraceText.classList.add("hidden");
    return;
  }

  elements.lookupTraceText.textContent = normalized;
  elements.lookupTraceText.dataset.tone =
    tone === "error" ? "error" : tone === "success" ? "success" : "neutral";
  elements.lookupTraceText.classList.remove("hidden");
}

function setLookupWarnings(items = []) {
  if (!elements.lookupWarningsList) return;
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);

  if (normalized.length === 0) {
    elements.lookupWarningsList.innerHTML = "";
    elements.lookupWarningsList.classList.add("hidden");
    return;
  }

  elements.lookupWarningsList.innerHTML = normalized
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
  elements.lookupWarningsList.classList.remove("hidden");
}

function formatPipelineStage(stage) {
  const value = String(stage || "").trim().toLowerCase();
  const labels = {
    cache_lookup: "cache lookup",
    student_routing: "student routing",
    resolve_domain: "domain resolution",
    legacy_generate_emails: "legacy email generation",
    gemini_domain_confirmation: "Gemini domain confirmation",
    predict_patterns: "pattern prediction",
    generate_candidates: "candidate generation",
    mx_verification: "MX verification",
    verify_candidates: "email verification",
    cache_result: "result caching",
    return_result: "result delivery",
    offline_fallback: "offline fallback",
  };
  return labels[value] || "pipeline";
}

function getSmtpProbeCount(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((count, entry) => {
    const attempts = Number(entry?.smtpAttempts || 0);
    if (Number.isFinite(attempts) && attempts > 0) {
      return count + attempts;
    }
    return count + 1;
  }, 0);
}

function buildSuccessLookupTrace(data) {
  const source = String(data?.source || "").trim().toLowerCase();
  const hasDomain = Boolean(String(data?.domain || "").trim());
  const hasMx = data?.mxChecked === true || Number(data?.mxVerifiedCount || 0) > 0;
  const verificationRows = Array.isArray(data?.verificationResults) ? data.verificationResults : [];
  const smtpProbeCount = getSmtpProbeCount(verificationRows);
  const hasDeliverable = verificationRows.some(
    (entry) => String(entry?.deliverability || "").toUpperCase() === "DELIVERABLE"
  );
  const llmPulled = data?.llmRankingPulled === true;
  const llmSource = String(data?.llmRankingSource || "").trim().toLowerCase();
  const llmProvider = String(data?.llmRankingProvider || "").trim().toLowerCase();
  const llmStatusLabel = llmPulled
    ? llmProvider === "gemini"
      ? "Gemini"
      : llmProvider
      ? `Done (${llmProvider})`
      : "Done"
    : llmSource === "predict-email" && llmProvider
    ? `Fallback (${llmProvider})`
    : llmSource === "predict-patterns"
    ? "Fallback route"
    : "Not pulled";
  const smtpAttemptLabel =
    smtpProbeCount >= 2 ? "2nd try" : smtpProbeCount === 1 ? "1st try" : hasMx ? "Passed" : "Failed";

  const steps = [];
  steps.push(`Domain: ${hasDomain ? "OK" : "Skipped"}`);
  steps.push(`Patterns: ${source === "cache_verified" ? "Skipped (cache)" : "OK"}`);
  steps.push(`LLM Ranking: ${llmStatusLabel}`);
  steps.push(`SMTP: ${smtpAttemptLabel}`);

  if (verificationRows.length > 0) {
    steps.push(`Verify: ${hasDeliverable ? "OK" : "No deliverable"}`);
  } else if (
    source === "cache_verified" ||
    source === "profile_scan" ||
    source === "student_university"
  ) {
    steps.push("Verify: Skipped");
  }

  return steps.join(" | ");
}

function buildNotFoundLookupTrace(response) {
  const reason = String(response?.reason || "unknown").trim().toLowerCase();
  const domain = String(response?.domain || "").trim();
  const candidateCount = Number(response?.totalCandidates || 0);
  const llmPulled = response?.llmRankingPulled === true;
  const llmSource = String(response?.llmRankingSource || "").trim().toLowerCase();
  const llmProvider = String(response?.llmRankingProvider || "").trim().toLowerCase();
  const llmStatusLabel = llmPulled
    ? llmProvider === "gemini"
      ? "Gemini"
      : llmProvider
      ? `Done (${llmProvider})`
      : "Done"
    : llmSource === "predict-email" && llmProvider
    ? `Fallback (${llmProvider})`
    : llmSource === "predict-patterns"
    ? "Fallback route"
    : "Not pulled";
  const verificationRows = Array.isArray(response?.verificationResults) ? response.verificationResults : [];
  const smtpProbeCount = getSmtpProbeCount(verificationRows);
  const smtpAttemptLabel =
    smtpProbeCount >= 2
      ? "2nd try"
      : smtpProbeCount === 1
      ? "1st try"
      : String(response?.mxSucceededAttempt || "").trim().toLowerCase() === "second"
      ? "2nd try"
      : String(response?.mxSucceededAttempt || "").trim().toLowerCase() === "first"
      ? "1st try"
      : "Failed";
  const reasonLabel =
    reason === "no_mx" ? "MX failed" : reason === "undeliverable" ? "undeliverable" : "not found";

  const bits = [
    `Domain: ${domain ? "OK" : "Unknown"}`,
    `LLM Ranking: ${llmStatusLabel}`,
    `SMTP: ${smtpAttemptLabel}`,
    `Result: ${reasonLabel}`,
  ];
  if (candidateCount > 0) {
    bits.push(`Candidates checked: ${candidateCount}`);
  }
  return bits.join(" | ");
}

function buildErrorLookupTrace(code, stage) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const stageLabel = formatPipelineStage(stage);
  if (normalizedCode === "QUOTA_EXCEEDED") {
    return "Request blocked: quota exceeded.";
  }
  if (normalizedCode === "UNAUTHORIZED") {
    return "Request blocked: authentication required.";
  }
  if (normalizedCode === "SMTP_NOT_CONFIGURED") {
    return "Abstract Email Validation is not configured on the active backend origin.";
  }
  if (normalizedCode === "REDIRECTED_API_RESPONSE" || normalizedCode === "NON_JSON_RESPONSE") {
    return "Backend endpoint mismatch detected. Verify extension API base URL.";
  }
  return `Failed at ${stageLabel}.`;
}

function updateAccessEmailButtonState() {
  if (elements.accessEmailBtnLabel) {
    elements.accessEmailBtnLabel.textContent = emailFinderState.isLoading
      ? "Finding..."
      : "Access Email";
  }

  const hasFoundEmail = Boolean(String(emailFinderState.currentResult?.email || "").trim());
  if (elements.foundEmailText && !hasFoundEmail) {
    elements.foundEmailText.textContent = emailFinderState.isLoading
      ? "Finding..."
      : "Access Email";
  }
  elements.findEmailBtn?.classList.toggle("is-busy", emailFinderState.isLoading);
}

function normalizeTodoText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function normalizeTodoTimestamp(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return new Date().toISOString();

  const parsed = new Date(candidate);
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toTodoMillis(value) {
  const parsed = new Date(String(value || ""));
  const millis = parsed.getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function normalizeTodoItems(rawItems) {
  const source = Array.isArray(rawItems) ? rawItems : [];
  const deduped = new Map();

  source.forEach((rawItem) => {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return;
    const id = String(rawItem.id || "")
      .trim()
      .slice(0, 80);
    const text = normalizeTodoText(rawItem.text);
    if (!id || !text) return;

    deduped.set(id, {
      id,
      text,
      completed: Boolean(rawItem.completed),
      created_at: normalizeTodoTimestamp(rawItem.created_at),
      updated_at: normalizeTodoTimestamp(rawItem.updated_at),
    });
  });

  const normalized = Array.from(deduped.values()).sort(
    (a, b) => toTodoMillis(b.updated_at) - toTodoMillis(a.updated_at)
  );
  const active = normalized.filter((item) => !item.completed);
  const completed = normalized.filter((item) => item.completed).slice(0, TODO_VISIBLE_COMPLETED);
  return [...active, ...completed].slice(0, TODO_MAX_ITEMS);
}

function areTodoItemsEqual(a, b) {
  const left = normalizeTodoItems(a);
  const right = normalizeTodoItems(b);
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const lhs = left[index];
    const rhs = right[index];
    if (!rhs) return false;
    if (
      lhs.id !== rhs.id ||
      lhs.text !== rhs.text ||
      lhs.completed !== rhs.completed ||
      lhs.created_at !== rhs.created_at ||
      lhs.updated_at !== rhs.updated_at
    ) {
      return false;
    }
  }
  return true;
}

function renderTodoList() {
  if (!elements.todoList || !elements.todoEmptyState) return;

  const items = normalizeTodoItems(emailFinderState.todoItems);
  emailFinderState.todoItems = items;

  if (items.length === 0) {
    elements.todoList.innerHTML = "";
    elements.todoEmptyState.classList.remove("hidden");
  } else {
    elements.todoEmptyState.classList.add("hidden");
    elements.todoList.innerHTML = items
      .map((item) => {
        const isCompleted = item.completed === true;
        const disabled = emailFinderState.todoSaveInFlight ? "disabled" : "";
        return `
          <li>
            <button type="button" class="ellyn-todo-item ${isCompleted ? "is-completed" : ""}" data-todo-toggle="true" data-todo-id="${escapeHtml(item.id)}" ${disabled}>
              <span class="ellyn-todo-check" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.25 4.8 9 10 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="ellyn-todo-text">${escapeHtml(item.text)}</span>
            </button>
          </li>
        `;
      })
      .join("");
  }

  if (elements.todoSaveBtn) {
    elements.todoSaveBtn.disabled = emailFinderState.todoSaveInFlight;
  }

  if (elements.todoAddMoreBtn) {
    elements.todoAddMoreBtn.disabled = emailFinderState.todoSaveInFlight;
  }
}

function openTodoComposer() {
  elements.todoInputRow?.classList.remove("hidden");
  if (elements.todoInput) {
    elements.todoInput.focus();
    elements.todoInput.select();
  }
}

function closeTodoComposer(clearInput = false) {
  elements.todoInputRow?.classList.add("hidden");
  if (clearInput && elements.todoInput) {
    elements.todoInput.value = "";
  }
}

async function loadTodosFromCache() {
  try {
    const stored = await storageGet([TODO_CACHE_KEY]);
    emailFinderState.todoItems = normalizeTodoItems(stored?.[TODO_CACHE_KEY]);
  } catch (error) {
    console.warn("[Sidepanel] Failed to load todo cache:", error);
    emailFinderState.todoItems = [];
  }
}

async function persistTodosToCache(items) {
  const normalized = normalizeTodoItems(items);
  emailFinderState.todoItems = normalized;
  await storageSet({ [TODO_CACHE_KEY]: normalized });
}

function parseTodoApiError(payload, fallback) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const message = String(payload.error || "").trim();
  return message || fallback;
}

async function fetchTodosFromApi() {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Missing authentication token");
  }

  const { apiBaseUrl } = await resolveBaseUrls();
  const response = await fetchWithTimeout(
    `${apiBaseUrl}/api/todos`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    10000
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseTodoApiError(payload, "Failed to load to-do list"));
  }

  return normalizeTodoItems(payload?.items);
}

async function saveTodosToApi(items) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Missing authentication token");
  }

  const { apiBaseUrl } = await resolveBaseUrls();
  const response = await fetchWithTimeout(
    `${apiBaseUrl}/api/todos`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: normalizeTodoItems(items) }),
    },
    10000
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseTodoApiError(payload, "Failed to save to-do list"));
  }

  return normalizeTodoItems(payload?.items);
}

async function syncTodosFromServer() {
  if (!emailFinderState.isAuthenticated) return;

  try {
    const remoteItems = await fetchTodosFromApi();
    const localItems = normalizeTodoItems(emailFinderState.todoItems);
    const mergedItems = normalizeTodoItems([...localItems, ...remoteItems]);

    emailFinderState.todoItems = mergedItems;
    await persistTodosToCache(mergedItems);
    renderTodoList();

    if (!areTodoItemsEqual(remoteItems, mergedItems)) {
      const synced = await saveTodosToApi(mergedItems);
      emailFinderState.todoItems = synced;
      await persistTodosToCache(synced);
      renderTodoList();
    }
  } catch (error) {
    console.warn("[Sidepanel] Failed to sync todos from server:", error);
  }
}

async function persistTodoItems(items) {
  const normalized = normalizeTodoItems(items);
  emailFinderState.todoItems = normalized;
  renderTodoList();

  try {
    await persistTodosToCache(normalized);
  } catch (error) {
    console.warn("[Sidepanel] Failed to persist todo cache:", error);
  }

  if (!emailFinderState.isAuthenticated) return;

  emailFinderState.todoSaveInFlight = true;
  renderTodoList();

  try {
    const synced = await saveTodosToApi(normalized);
    emailFinderState.todoItems = synced;
    await persistTodosToCache(synced);
  } catch (error) {
    console.warn("[Sidepanel] Failed to save todos to server:", error);
    showToast("To-do saved locally. We'll sync it soon.", "info");
  } finally {
    emailFinderState.todoSaveInFlight = false;
    renderTodoList();
  }
}

async function handleTodoSave() {
  if (emailFinderState.todoSaveInFlight) return;
  const text = normalizeTodoText(elements.todoInput?.value);
  if (!text) {
    closeTodoComposer();
    return;
  }

  const now = new Date().toISOString();
  const nextItem = {
    id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    text,
    completed: false,
    created_at: now,
    updated_at: now,
  };

  if (elements.todoInput) {
    elements.todoInput.value = "";
  }
  closeTodoComposer();
  await persistTodoItems([nextItem, ...emailFinderState.todoItems]);
}

async function toggleTodoItemById(todoId) {
  if (emailFinderState.todoSaveInFlight) return;

  const normalizedId = String(todoId || "").trim();
  if (!normalizedId) return;

  const now = new Date().toISOString();
  const nextItems = emailFinderState.todoItems.map((item) =>
    item.id === normalizedId
      ? {
          ...item,
          completed: !item.completed,
          updated_at: now,
        }
      : item
  );

  await persistTodoItems(nextItems);
}

async function consumeLookupCredits(credits, label = "action") {
  const requestedCredits = Math.max(1, Math.min(100, Number(credits) || 1));
  try {
    const response = await sendRuntimeMessage({
      type: "CONSUME_LOOKUP_CREDITS",
      amount: requestedCredits,
    });

    const allowed = response?.allowed !== false;
    if (!allowed) {
      const resetLabel = formatResetDate(response?.resetDate);
      const message = resetLabel
        ? `Not enough credits for ${label}. Resets ${resetLabel}.`
        : `Not enough credits for ${label}.`;
      showToast(message, "error");
      setUpgradeState(true, message, PRICING_URL);
      return false;
    }

    await updateQuotaStatus();
    return true;
  } catch (error) {
    console.warn("[Sidepanel] Failed to consume credits:", error);
    showToast("Could not verify credits. Try again.", "error");
    return false;
  }
}

async function handlePhoneNumberAccess() {
  const creditsAllowed = await consumeLookupCredits(1, "phone number access");
  if (!creditsAllowed) {
    return;
  }

  const phone = getCurrentPhoneNumber();
  if (phone) {
    emailFinderState.revealedPhone = phone;
    openContactDetailView("phone");
    updatePhoneNumberText(phone, "Phone Number");
    return;
  }

  emailFinderState.revealedPhone = "";
  updatePhoneNumberText("", "Phone Number");
  if (String(emailFinderState.currentResult?.email || "").trim()) {
    openContactDetailView("email");
  } else {
    resetContactDetailView();
  }
  showToast("Phone number not available for this profile.", "info");
}

async function copyCurrentPhoneNumber() {
  const phone = getCurrentPhoneNumber();
  if (!phone) {
    showToast("No phone number to copy.", "error");
    return;
  }

  await copyTextWithFeedback(phone, elements.copyPhoneBtn);
}

function applyFindEmailAvailability() {
  if (!elements.findEmailBtn) return;

  const disabledByAuth = !emailFinderState.isAuthenticated;
  const gateStatus = getProfileContextGateStatus();
  const disabledByProfile = emailFinderState.isAuthenticated && !gateStatus.ready;
  const disabledByLoading = emailFinderState.isLoading;
  const disabledByQuota =
    emailFinderState.isAuthenticated &&
    emailFinderState.quotaKnown &&
    !emailFinderState.quotaAllowsLookup;

  const shouldDisable = disabledByAuth || disabledByProfile || disabledByLoading || disabledByQuota;
  if (shouldDisable) {
    elements.findEmailBtn.setAttribute("disabled", "true");
  } else {
    elements.findEmailBtn.removeAttribute("disabled");
  }

  const reason = disabledByProfile
    ? gateStatus.message
    : disabledByQuota
    ? "No credits left. Upgrade to continue."
    : disabledByAuth
    ? "Sign in to use email finder."
    : "";
  elements.findEmailBtn.title = reason;
  updateAccessEmailButtonState();
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
  emailFinderState.revealedPhone = "";

  if (elements.resultEmail) {
    elements.resultEmail.textContent = "";
  }
  resetContactDetailView();
  updateFoundEmailText("");
  updatePhoneNumberText("");

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
  const hasFoundEmail = Boolean(String(emailFinderState.currentResult?.email || "").trim());
  const disableSecondaryActions = emailFinderState.isLoading || !hasFoundEmail;

  if (elements.draftMailBtn) {
    elements.draftMailBtn.disabled = disableSecondaryActions;
  }

  if (elements.sendMailBtn) {
    elements.sendMailBtn.disabled = disableSecondaryActions;
  }

  if (elements.saveToContactsBtn) {
    elements.saveToContactsBtn.disabled = disableSecondaryActions;
  }

  if (elements.addToListContactBtn) {
    elements.addToListContactBtn.disabled = disableSecondaryActions;
  }

  updatePhoneNumberText(emailFinderState.revealedPhone, "Phone Number");

  if (mode === "none" && elements.findEmailBtn) {
    elements.findEmailBtn.setAttribute("disabled", "true");
    updateAccessEmailButtonState();
  } else {
    applyFindEmailAvailability();
  }
}

function getActiveProfileLookupKey() {
  const context = emailFinderState.profileContext;
  if (!context) return "";
  const key = buildProfileContextKey(context.tabId, context.profileUrl);
  return String(key || "").trim();
}

function normalizeLookupCacheMap(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  const next = {};
  Object.entries(rawValue).forEach(([key, value]) => {
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) return;
    const email = String(value?.data?.email || value?.email || "").trim();
    if (!email) return;
    next[String(key)] = {
      data: value.data && typeof value.data === "object" ? value.data : value,
      updatedAt: Number(value.updatedAt || Date.now()),
      profileUrl: String(value.profileUrl || ""),
    };
  });

  const limited = Object.entries(next)
    .sort(([, a], [, b]) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 120);
  return Object.fromEntries(limited);
}

async function persistLookupResultForActiveProfile(result) {
  const key = getActiveProfileLookupKey();
  const email = String(result?.email || "").trim();
  if (!key || !email) return;

  try {
    const stored = await storageGet([EMAIL_LOOKUP_CACHE_KEY]);
    const cache = normalizeLookupCacheMap(stored?.[EMAIL_LOOKUP_CACHE_KEY]);
    cache[key] = {
      data: result,
      updatedAt: Date.now(),
      profileUrl: String(emailFinderState.profileContext?.profileUrl || ""),
    };
    await storageSet({ [EMAIL_LOOKUP_CACHE_KEY]: normalizeLookupCacheMap(cache) });
    console.log("[Sidepanel] Lookup result persisted", { key, email });
  } catch (error) {
    console.warn("[Sidepanel] Failed persisting lookup result", { key, error: error?.message || String(error) });
  }
}

async function readPersistedLookupResultForActiveProfile() {
  const key = getActiveProfileLookupKey();
  if (!key) return null;

  try {
    const stored = await storageGet([EMAIL_LOOKUP_CACHE_KEY]);
    const cache = normalizeLookupCacheMap(stored?.[EMAIL_LOOKUP_CACHE_KEY]);
    const entry = cache[key];
    if (!entry || !entry.data || typeof entry.data !== "object") return null;
    const email = String(entry.data.email || "").trim();
    if (!email) return null;
    return entry.data;
  } catch (error) {
    console.warn("[Sidepanel] Failed reading persisted lookup result", { key, error: error?.message || String(error) });
    return null;
  }
}

async function restoreLookupResultForActiveProfile() {
  if (emailFinderState.isLoading) return;
  const key = getActiveProfileLookupKey();
  if (!key) return;

  const currentEmail = String(emailFinderState.currentResult?.email || "").trim();
  if (currentEmail && emailFinderState.resultProfileKey === key) {
    return;
  }

  const restored = await readPersistedLookupResultForActiveProfile();
  if (!restored) return;

  console.log("[Sidepanel] Restoring persisted lookup result", { key, email: restored.email });
  displayResults(restored);
  setStatus("Loaded saved email for this profile.", "neutral");
}

async function openDraftForCurrentResult() {
  let email = String(emailFinderState.currentResult?.email || "").trim();
  if (!email) {
    const restored = await readPersistedLookupResultForActiveProfile();
    if (restored) {
      emailFinderState.currentResult = restored;
      emailFinderState.resultProfileKey = getActiveProfileLookupKey();
      email = String(restored.email || "").trim();
      console.log("[Sidepanel] Draft flow restored email from persisted lookup", { email });
      updateFoundEmailText(email, "Access Email");
      setPrimaryFinderAction("draft");
    }
  }

  if (!email) {
    setPrimaryFinderAction("find");
    showToast("Find an email first.", "error");
    return;
  }
  appState.contact = null;
  await switchToDraftView();
}

function deriveInitials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

async function openDraftForQueueContact(contact) {
  const email = String(contact?.email || "").trim();
  if (!email) {
    showToast("No email available for this contact.", "error");
    return;
  }

  const fullName = String(contact?.fullName || "").trim();
  const company = String(contact?.company || "").trim();
  const role = String(contact?.role || "").trim();
  const fallbackName = fullName || "Contact";

  appState.contact = {
    name: fallbackName,
    company,
    role,
    email,
  };

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
    const requestedMode = mode === "signup" ? "signup" : "login";
    const authUrl = new URL("/extension-auth", `${authBaseUrl}/`);
    authUrl.searchParams.set("source", "extension");
    authUrl.searchParams.set("extensionId", chrome.runtime.id);
    authUrl.searchParams.set("next", "/extension-auth");
    authUrl.searchParams.set("mode", requestedMode);

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
    resetContactDetailView();
    console.log("[Sidepanel] Access Email gate result", { allowed: false, reason: "not_authenticated" });
    setStatus("Please sign in first.", "error");
    return;
  }

  const gateStatus = getProfileContextGateStatus();
  console.log("[Sidepanel] Access Email gate result", {
    allowed: gateStatus.ready,
    reason: gateStatus.ready ? "ok" : gateStatus.message,
  });
  if (!gateStatus.ready) {
    resetContactDetailView();
    setStatus(gateStatus.message, "error");
    return;
  }

  try {
    hideResultAndError();
    startLoadingCycle();
    setLookupTrace("Running: profile extraction -> domain lookup -> pattern prediction -> verification.", "neutral");
    setLookupWarnings([]);

    const tab = await getLinkedInProfileTab();
    const contextPayload = getFreshCompleteProfileContextPayload(tab.id);
    if (!contextPayload) {
      throw new Error("Profile preview is stale or incomplete. Refresh and confirm name + company.");
    }

    const pipelineData = { tabId: tab.id, ...contextPayload };
    console.log("[Sidepanel] Sending FIND_EMAIL request", {
      tabId: pipelineData.tabId,
      firstName: pipelineData.firstName,
      lastName: pipelineData.lastName,
      company: pipelineData.company,
      companyPageUrl: pipelineData.companyPageUrl,
    });

    const response = await sendRuntimeMessage({
      type: "FIND_EMAIL",
      data: pipelineData,
    });

    finishLoadingCycle(100);

    if (!response?.success || !response?.data) {
      // Check for graceful "not found" (pipeline completed, no valid email)
      if (response?.found === false) {
        console.log("[Sidepanel] FIND_EMAIL returned not_found", response);
        displayNotFound(response);
        await updateQuotaStatus();
        return;
      }
      const error = new Error(response?.error || "Could not find email.");
      error.code = response?.code || "";
      error.resetDate = response?.resetDate || null;
      error.stage = response?.stage || "";
      throw error;
    }

    displayResults(response.data);
    console.log("[Sidepanel] FIND_EMAIL success", {
      email: response?.data?.email || "",
      source: response?.data?.source || "",
    });
    await updateQuotaStatus();
  } catch (error) {
    stopLoadingCycle();
    const message = error instanceof Error ? error.message : "Could not find email.";
    const code = error?.code || "";
    const resetDate = error?.resetDate || null;
    const stage = error?.stage || "";
    console.warn("[Sidepanel] FIND_EMAIL failed", { message, code, stage });
    showError(message, code, resetDate, stage);
    await updateQuotaStatus();
  }
}

function startLoadingCycle() {
  emailFinderState.isLoading = true;
  emailFinderState.stageIndex = 0;
  elements.emailFinderSection?.classList.add("is-loading");
  elements.loadingState?.classList.remove("hidden");
  updateFoundEmailText("", "Searching for email...");
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
  if (!hasFoundEmail) {
    updateFoundEmailText("");
  }
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
  if (!emailFinderState.isLoading) {
    updateFoundEmailText(
      String(emailFinderState.currentResult?.email || "").trim(),
      "Access Email"
    );
  }
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
  const confidenceBadgeMeta = getSourceConfidenceBadgeMeta(data?.source);
  const alternatives = Array.isArray(data?.alternativeEmails) ? data.alternativeEmails : [];

  if (elements.confidenceBadge) {
    elements.confidenceBadge.dataset.level = "source";
    elements.confidenceBadge.style.color = confidenceBadgeMeta.color;
    elements.confidenceBadge.style.backgroundColor = "#f8fafc";
    elements.confidenceBadge.style.border = "1px solid #e2e8f0";
  }
  if (elements.confidenceText) {
    elements.confidenceText.textContent = `${confidenceBadgeMeta.label}  ${confidencePercent}%`;
  }
  if (elements.resultEmail) {
    elements.resultEmail.textContent = email || "No email returned";
  }
  openContactDetailView("email");
  updateFoundEmailText(email, "Access Email");
  console.log("[Sidepanel] UI update: email result rendered", {
    profileKey: emailFinderState.resultProfileKey,
    email,
    source: String(data?.source || ""),
  });
  void persistLookupResultForActiveProfile(data);

  renderAlternatives(alternatives);

  elements.feedbackSection?.classList.remove("hidden");
  elements.resultsCard?.classList.remove("hidden");
  elements.errorState?.classList.add("hidden");
  elements.errorState?.classList.remove("not-found");
  setPrimaryFinderAction("draft");

  setStatus("Email found successfully.", "success");
  setLookupTrace(buildSuccessLookupTrace(data), "success");
  setLookupWarnings(Array.isArray(data?.warnings) ? data.warnings : []);

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
  const alternativeCount = alternatives.length;

  if (!elements.alternativesList || !elements.alternativesDetails) return;

  if (alternativeCount === 0) {
    elements.alternativesDetails.open = false;
    elements.alternativesDetails.classList.add("hidden");
    elements.alternativesList.innerHTML = "";
    return;
  }

  if (elements.alternativesSummary) {
    elements.alternativesSummary.textContent = `Show alternatives (${alternativeCount})`;
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

function displayNotFound(response) {
  resetContactDetailView();
  emailFinderState.currentResult = null;
  emailFinderState.currentError = null;
  emailFinderState.resultProfileKey = "";
  emailFinderState.revealedPhone = "";
  console.log("[Sidepanel] UI update: email not found state rendered", {
    reason: String(response?.reason || "unknown"),
  });

  const reason = response?.reason || "unknown";
  const verificationRows = Array.isArray(response?.verificationResults) ? response.verificationResults : [];
  const smtpProbeCount = getSmtpProbeCount(verificationRows);
  let subtext;
  if (reason === "no_mx") {
    subtext =
      "We couldn\u2019t verify a mail server for this company\u2019s domain. This person may use a private or undiscoverable email.";
  } else if (reason === "undeliverable") {
    const attemptText =
      smtpProbeCount >= 2 ? "after two Abstract API checks" : "after Abstract API verification";
    subtext =
      `We found this company's mail server, but no deliverable email was confirmed ${attemptText}. Email ID is unknown.`;
  } else {
    subtext =
      "We couldn\u2019t determine a valid email address for this contact.";
  }

  if (elements.errorTitle) {
    elements.errorTitle.textContent = reason === "undeliverable" ? "Email ID Unknown" : "No Email ID Found";
  }
  if (elements.errorMessage) {
    elements.errorMessage.textContent = subtext;
  }

  elements.resultsCard?.classList.add("hidden");
  elements.errorState?.classList.remove("hidden");
  elements.errorState?.classList.add("not-found");
  updateFoundEmailText("", reason === "undeliverable" ? "Email ID unknown" : "No email found for this contact.");
  setPrimaryFinderAction("find");
  setStatus(reason === "undeliverable" ? "Email ID unknown." : "No email found for this contact.", "info");
  setLookupTrace(buildNotFoundLookupTrace(response), "error");
  setLookupWarnings(Array.isArray(response?.warnings) ? response.warnings : []);
}

function showError(message, code, resetDate, stage) {
  resetContactDetailView();
  emailFinderState.currentError = message;
  emailFinderState.currentResult = null;
  emailFinderState.resultProfileKey = "";
  emailFinderState.revealedPhone = "";
  console.log("[Sidepanel] UI update: email error state rendered", {
    message: String(message || ""),
    code: String(code || ""),
    stage: String(stage || ""),
  });

  // Reset not-found styling if previously set
  elements.errorState?.classList.remove("not-found");

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
  updateFoundEmailText("", "Email lookup failed. Try again.");
  setPrimaryFinderAction("find");
  setStatus(message || "Could not find email.", "error");
  setLookupTrace(buildErrorLookupTrace(code, stage), "error");
  setLookupWarnings([]);
  if (code === "QUOTA_EXCEEDED") {
    setUpgradeState(true, "Upgrade to continue.", PRICING_URL);
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
  const phoneNumber = normalizePhoneNumber(
    pickFirstNonEmpty(
      ctx.phone,
      ctx.phoneNumber,
      ctx.mobile,
      savedRow.phone,
      savedRow.phoneNumber
    )
  );
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
    phone: phoneNumber || "",
    phoneNumber: phoneNumber || "",
    customFields: phoneNumber
      ? {
          phone: phoneNumber,
        }
      : {},
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
  const phoneNumber = getCurrentPhoneNumber();
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
    phone: phoneNumber || "",
    phoneNumber: phoneNumber || "",
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
    const allowsLookup = response?.allowed !== false;
    const resetLabel = formatResetDate(response?.resetDate);
    const quotaBlockedMessage =
      typeof response?.error === "string" && response.error.trim()
        ? response.error.trim()
        : resetLabel
        ? `No credits left. Resets ${resetLabel}.`
        : "No credits left. Upgrade to continue.";
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
      (Number.isFinite(safeUsed) && safeUsed > 0) || safeLimit !== null || !allowsLookup;
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
    emailFinderState.quotaAllowsLookup = allowsLookup;

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

    setUpgradeState(
      !emailFinderState.quotaAllowsLookup,
      quotaBlockedMessage,
      emailFinderState.upgradeUrl
    );

    if (!emailFinderState.quotaAllowsLookup) {
      setQuotaWarning(quotaBlockedMessage);
    } else if (unlimitedPlan) {
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
  emailFinderState.quotaVisibleRequested = Boolean(visible);
  const profileModeActive = emailFinderState.profileSectionMode === "profile";
  elements.quotaBar?.classList.toggle("hidden", !(visible && profileModeActive));
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

  throw new Error(PROFILE_CONTEXT_EMPTY_STATUS);
}

async function hasLinkedInProfileOpen() {
  try {
    const tabs = await queryTabs({ currentWindow: true });
    return tabs.some((tab) => isLinkedInProfile(tab?.url) || isLinkedInCompanyPage(tab?.url));
  } catch {
    return false;
  }
}

function isLinkedInProfile(url) {
  return typeof url === "string" && /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/in\/[^/?#]+/i.test(url);
}

function isLinkedInCompanyPage(url) {
  return typeof url === "string" && /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/company\/[^/?#]+/i.test(url);
}

function toConfidencePercent(value) {
  const n = toFiniteNumber(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

function getSourceConfidenceBadgeMeta(source) {
  const normalized = String(source || "").trim().toLowerCase();

  if (normalized === "abstract_verified" || normalized === "zerobounce_verified") {
    return { label: " Verified", color: "#16a34a" };
  }
  if (normalized === "abstract_catchall" || normalized === "zerobounce_catchall") {
    return { label: "~ Catch-all Domain", color: "#d97706" };
  }
  if (normalized === "mx_confirmed_unverified") {
    return { label: "MX Confirmed", color: "#d97706" };
  }
  if (normalized === "pattern_confidence" || normalized === "offline_heuristic") {
    return { label: "Pattern Match", color: "#6b7280" };
  }

  return { label: "Checking", color: "#6b7280" };
}

function getConfidenceLevel(percent) {
  if (percent >= 90) return "high";
  if (percent >= 65) return "medium";
  return "low";
}

function getConfidenceDescriptor(percent) {
  if (percent >= 90) return "High confidence";
  if (percent >= 70) return "Good confidence";
  if (percent >= 65) return "Medium confidence";
  return "Low confidence";
}

function formatSourceLabel(source) {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "abstract_verified") return "Verified";
  if (normalized === "abstract_catchall") return "Catch-all Domain";
  if (normalized === "smtp_verified") return "SMTP Verified";
  if (normalized === "pattern_confidence") return "Pattern Match";
  if (normalized === "cache_verified") return "Cache Verified";
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
async function renderQueueCard() {
  if (!elements.queueEmptyState || !elements.queuePopulatedView) return;

  const stored = await storageGet([SAVED_CONTACTS_KEY, SYNC_QUEUE_KEY, SYNC_STATUS_KEY]);
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
        const rawEmail = String(c.email || "").trim();
        const emailAttr = escapeHtml(rawEmail);
        const fullNameRaw = String(c.fullName || `${c.firstName || ""} ${c.lastName || ""}` || "").trim();
        const companyRaw = String(c.company || "").trim();
        const roleRaw = String(c.role || "").trim();
        const fullNameAttr = escapeHtml(fullNameRaw);
        const companyAttr = escapeHtml(companyRaw);
        const roleAttr = escapeHtml(roleRaw);
        return `<div class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div style="flex:1;min-width:0;">
            <span style="display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:12px;color:#334155">${email}</span>
          </div>
          <button
            type="button"
            class="queue-copy-btn"
            data-email="${emailAttr}"
            style="flex-shrink:0;border:1px solid #e2e8f0;background:#f8fafc;color:#334155;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:600;line-height:1.1;cursor:pointer"
          >
            Copy
          </button>
          <button
            type="button"
            class="queue-send-btn"
            data-email="${emailAttr}"
            data-name="${fullNameAttr}"
            data-company="${companyAttr}"
            data-role="${roleAttr}"
            style="flex-shrink:0;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:600;line-height:1.1;cursor:pointer"
          >
            Send Mail
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
  const selectedContact = appState.contact && typeof appState.contact === "object"
    ? appState.contact
    : null;
  if (selectedContact) {
    const selectedEmail = String(selectedContact.email || "").trim();
    if (selectedEmail) {
      return {
        name: String(selectedContact.name || selectedContact.fullName || "").trim(),
        company: String(selectedContact.company || "").trim(),
        role: String(selectedContact.role || "").trim(),
        email: selectedEmail,
      };
    }
  }

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

