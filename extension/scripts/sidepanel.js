const AUTH_REDIRECT_URL = "https://www.useellyn.com/auth";
const PRICING_URL = "https://www.useellyn.com/pricing";
const API_BASE_URL = "https://www.useellyn.com";
const AUTH_STORAGE_KEYS = ["isAuthenticated", "user", "auth_token"];
const SAVED_CONTACTS_KEY = "saved_contact_results";
const FEEDBACK_QUEUE_KEY = "feedback_queue";
const PROFILE_SYNC_INTERVAL_MS = 2000;
const PROFILE_CONTEXT_FRESH_MS = 15000;

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
  quotaAllowsLookup: false,
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
  metaPattern: null,
  metaSource: null,
  metaCost: null,
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
};

function getDefaultProfileContext() {
  return {
    tabId: null,
    profileUrl: "",
    fullName: "",
    firstName: "",
    lastName: "",
    company: "",
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
  elements.metaPattern = document.getElementById("metaPattern");
  elements.metaSource = document.getElementById("metaSource");
  elements.metaCost = document.getElementById("metaCost");
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
}

function bindEvents() {
  elements.signInButton?.addEventListener("click", () => openAuth("signin", elements.signInButton));
  elements.createAccountButton?.addEventListener("click", () => openAuth("signup", elements.createAccountButton));
  elements.logoutButton?.addEventListener("click", signOut);
  elements.findEmailBtn?.addEventListener("click", findEmail);
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
      const resetText = formatResetDate(message?.data?.resetDate);
      const copy = resetText
        ? `Quota reached. Credits reset ${resetText}.`
        : "Quota reached. Upgrade to continue finding emails.";
      setUpgradeState(true, copy, message?.data?.upgradeUrl || PRICING_URL);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.isAuthenticated && !changes.user && !changes.auth_token) return;
    syncAuthStateFromStorage();
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
}

function renderAuthState() {
  elements.authHeaderActions?.classList.toggle("hidden", !emailFinderState.isAuthenticated);
  elements.stageAuth?.classList.toggle("hidden", emailFinderState.isAuthenticated);
  elements.emailFinderSection?.classList.toggle("hidden", !emailFinderState.isAuthenticated);

  if (!emailFinderState.isAuthenticated) {
    emailFinderState.quotaKnown = false;
    emailFinderState.quotaAllowsLookup = false;
    stopProfileContextSync();
    resetProfileContext();
    stopLoadingCycle();
    hideResultAndError();
    resetQuotaUI();
  }

  applyFindEmailAvailability();
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
  const nameSource = String(data?.name?.source || "").trim();
  const companySource = String(data?.company?.source || "").trim();
  const roleSource = String(data?.role?.source || "").trim();

  return {
    firstName,
    lastName,
    fullName,
    company,
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
  const disabledByQuota = emailFinderState.isAuthenticated && emailFinderState.quotaKnown && !emailFinderState.quotaAllowsLookup;
  const gateStatus = getProfileContextGateStatus();
  const disabledByProfile = emailFinderState.isAuthenticated && !gateStatus.ready;
  const disabledByLoading = emailFinderState.isLoading;

  const shouldDisable = disabledByAuth || disabledByQuota || disabledByProfile || disabledByLoading;
  if (shouldDisable) {
    elements.findEmailBtn.setAttribute("disabled", "true");
  } else {
    elements.findEmailBtn.removeAttribute("disabled");
  }

  const reason = disabledByProfile
    ? gateStatus.message
    : disabledByQuota
    ? "No credits available right now."
    : disabledByAuth
    ? "Sign in to use email finder."
    : "";
  elements.findEmailBtn.title = reason;
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
  elements.findEmailBtn?.setAttribute("disabled", "true");
  elements.findEmailBtn?.classList.add("hidden");
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
  elements.findEmailBtn?.classList.remove("hidden");
  applyFindEmailAvailability();
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

  const domain = email.includes("@") ? email.split("@")[1] : "";
  if (elements.metaPattern) {
    elements.metaPattern.textContent = buildPatternDisplay(data?.pattern, domain);
  }
  if (elements.metaSource) {
    elements.metaSource.textContent = formatSourceLabel(data?.source);
  }
  if (elements.metaCost) {
    elements.metaCost.textContent = formatCost(data?.cost);
  }

  renderAlternatives(alternatives);

  elements.feedbackSection?.classList.remove("hidden");
  elements.resultsCard?.classList.remove("hidden");
  elements.errorState?.classList.add("hidden");

  setStatus("Email found successfully.", "success");
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

  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || "Unknown error";
  }

  elements.resultsCard?.classList.add("hidden");
  elements.errorState?.classList.remove("hidden");
  setStatus(message || "Could not find email.", "error");

  if (code === "QUOTA_EXCEEDED") {
    const resetText = formatResetDate(resetDate);
    const warning = resetText
      ? `Quota reached. Credits reset ${resetText}.`
      : "Quota reached. Upgrade to continue.";
    setUpgradeState(true, warning, PRICING_URL);
  }
}

async function copyCurrentEmail() {
  const email = String(emailFinderState.currentResult?.email || "").trim();
  if (!email) {
    showToast("No email to copy.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(email);
    showToast("Copied to clipboard!", "success");
  } catch {
    showToast("Copy failed. Please copy manually.", "error");
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

    let response = await fetchWithTimeout(`${API_BASE_URL}/api/email-feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok && (response.status === 404 || response.status === 405)) {
      response = await fetchWithTimeout(`${API_BASE_URL}/api/pattern-feedback`, {
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
    const remaining = toFiniteNumber(response?.remaining);
    const limit = toFiniteNumber(response?.limit);
    const allowed = response?.allowed !== false;

    if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) {
      emailFinderState.quotaKnown = false;
      emailFinderState.quotaAllowsLookup = false;
      resetQuotaUI();
      return;
    }

    const safeRemaining = Math.max(0, Math.round(remaining));
    const safeLimit = Math.max(1, Math.round(limit));
    const percent = Math.max(0, Math.min(100, (safeRemaining / safeLimit) * 100));

    if (elements.quotaCount) {
      elements.quotaCount.textContent = `${safeRemaining}/${safeLimit}`;
    }

    if (elements.quotaFill) {
      elements.quotaFill.style.width = `${percent}%`;
      elements.quotaFill.classList.remove("warning", "danger");
      if (safeRemaining <= 0) {
        elements.quotaFill.classList.add("danger");
      } else if (safeRemaining <= Math.max(3, Math.ceil(safeLimit * 0.15))) {
        elements.quotaFill.classList.add("warning");
      }
    }

    if (!allowed || safeRemaining <= 0) {
      const resetText = formatResetDate(response?.resetDate);
      const warning = resetText
        ? `Quota reached. Credits reset ${resetText}.`
        : "Quota reached. Upgrade to continue.";
      setUpgradeState(true, warning, emailFinderState.upgradeUrl);
      emailFinderState.quotaKnown = true;
      emailFinderState.quotaAllowsLookup = false;
      setQuotaWarning("No credits remaining.");
      applyFindEmailAvailability();
      return;
    }

    emailFinderState.quotaKnown = true;
    emailFinderState.quotaAllowsLookup = true;
    setUpgradeState(false, "", emailFinderState.upgradeUrl);

    const lowThreshold = Math.max(3, Math.ceil(safeLimit * 0.15));
    if (safeRemaining <= lowThreshold) {
      setQuotaWarning(`Low credits: ${safeRemaining} left this period.`);
    } else {
      setQuotaWarning("");
    }

    applyFindEmailAvailability();
  } catch (error) {
    console.warn("[Sidepanel] Failed to update quota:", error);
    emailFinderState.quotaKnown = false;
    emailFinderState.quotaAllowsLookup = false;
    resetQuotaUI();
  }
}

function resetQuotaUI() {
  if (elements.quotaCount) {
    elements.quotaCount.textContent = "--/--";
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

window.addEventListener("beforeunload", () => {
  stopProfileContextSync();
});

document.addEventListener("DOMContentLoaded", () => {
  void init();
});
