const STAGES = {
  AUTH: "auth",
  MANUAL: "manual",
  DRAFT: "draft",
  TRACKING: "tracking",
};

const AUTH_REDIRECT_URL = "https://www.useellyn.com/auth";

const OUTREACH_STATUS = {
  DRAFTED: "drafted",
  SENT: "sent",
  REPLIED: "replied",
  SCHEDULED: "scheduled",
};

const STATUS_ORDER = [
  OUTREACH_STATUS.DRAFTED,
  OUTREACH_STATUS.SENT,
  OUTREACH_STATUS.REPLIED,
  OUTREACH_STATUS.SCHEDULED,
];

const appState = {
  stage: STAGES.AUTH,
  isAuthenticated: false,
  user: null,
  outreachStatus: OUTREACH_STATUS.DRAFTED,
  history: [],
  notes: "",
  contact: null,
  draft: null,
};

const DEFAULT_CONTACT = {
  firstName: "John",
  lastName: "Doe",
  name: "John Doe",
  role: "Senior Recruiter",
  company: "Microsoft",
  email: "john.doe@microsoft.com",
};

const HISTORY_TEXT = {
  [OUTREACH_STATUS.DRAFTED]: "Draft Created",
  [OUTREACH_STATUS.SENT]: "Email Sent",
  [OUTREACH_STATUS.REPLIED]: "Reply Received",
  [OUTREACH_STATUS.SCHEDULED]: "Follow-up Scheduled",
};

const HISTORY_DATE = {
  "Draft Created": "Feb 10",
  "Email Sent": "Feb 11",
  "Reply Received": "Feb 12",
  "Follow-up Scheduled": "Feb 13",
};

const TEMPLATE_CONTENT = {
  "Referral Request": {
    subject: "Quick question about opportunities at {{company}}",
    message:
      "Hi {{firstName}},\nI hope this message finds you well. I admire your work at {{company}} and would value any guidance on referral opportunities.\n\nThanks for your time.",
  },
  "Informational Chat": {
    subject: "Could I ask for 15 minutes to learn about {{company}}?",
    message:
      "Hi {{firstName}},\nI am exploring roles at {{company}} and would appreciate a short informational chat if you are open to it.\n\nThanks in advance.",
  },
  "Recruiter Outreach": {
    subject: "Interest in roles at {{company}}",
    message:
      "Hi {{firstName}},\nI am interested in opportunities at {{company}} and would love to connect regarding relevant openings.\n\nThank you.",
  },
  "Follow-up": {
    subject: "Following up on my previous note",
    message:
      "Hi {{firstName}},\nFollowing up on my previous message and sharing my continued interest in opportunities at {{company}}.\n\nThanks again.",
  },
  "Custom Blank": {
    subject: "",
    message: "",
  },
  "AI Draft (Pro)": {
    subject: "Personalized outreach for {{company}}",
    message:
      "Hi {{firstName}},\nI noticed your background at {{company}} and wanted to reach out with a tailored note about potential fit.\n\nBest regards.",
  },
};

const STATUS_TRANSITIONS = {
  [OUTREACH_STATUS.DRAFTED]: OUTREACH_STATUS.SENT,
  [OUTREACH_STATUS.SENT]: OUTREACH_STATUS.REPLIED,
  [OUTREACH_STATUS.REPLIED]: OUTREACH_STATUS.SCHEDULED,
  [OUTREACH_STATUS.SCHEDULED]: null,
};

const dom = {};
let listenersBound = false;
let runtimeListenerBound = false;
let storageListenerBound = false;

function cacheDom() {
  dom.stageAuth = document.getElementById("stageAuth");
  dom.stage1 = document.getElementById("stage1");
  dom.stage2 = document.getElementById("stage2");
  dom.stage3 = document.getElementById("stage3");

  dom.statusText = document.getElementById("statusText");
  dom.authHeaderActions = document.getElementById("authHeaderActions");
  dom.signInButton = document.getElementById("signInButton");
  dom.createAccountButton = document.getElementById("createAccountButton");
  dom.logoutButton = document.getElementById("logoutButton");

  dom.contactForm = document.getElementById("contactForm");
  dom.firstName = document.getElementById("firstName");
  dom.lastName = document.getElementById("lastName");
  dom.company = document.getElementById("company");
  dom.role = document.getElementById("role");
  dom.discoverEmailButton = document.getElementById("discoverEmailButton");
  dom.viewDraftsButton = document.getElementById("viewDraftsButton");
  dom.clearQueueButton = document.getElementById("clearQueueButton");

  dom.contactName = document.getElementById("contactName");
  dom.contactRole = document.getElementById("contactRole");
  dom.contactCompany = document.getElementById("contactCompany");
  dom.contactEmailText = document.getElementById("contactEmailText");
  dom.copyEmailButton = document.getElementById("copyEmailButton");

  dom.templateToggle = document.getElementById("templateToggle");
  dom.selectedTemplate = document.getElementById("selectedTemplate");
  dom.templateMenu = document.getElementById("templateMenu");
  dom.templateChevron = document.getElementById("templateChevron");
  dom.templateOptions = Array.from(document.querySelectorAll(".template-option"));
  dom.generateDraftButton = document.getElementById("generateDraftButton");

  dom.subjectInput = document.getElementById("subjectInput");
  dom.messageInput = document.getElementById("messageInput");
  dom.markSentButton = document.getElementById("markSentButton");

  dom.trackingName = document.getElementById("trackingName");
  dom.trackingRole = document.getElementById("trackingRole");
  dom.trackingCompany = document.getElementById("trackingCompany");
  dom.trackingEmail = document.getElementById("trackingEmail");
  dom.trackingCopyButton = document.getElementById("trackingCopyButton");

  dom.stepLabelDrafted = document.getElementById("stepLabelDrafted");
  dom.stepLabelSent = document.getElementById("stepLabelSent");
  dom.stepLabelReplied = document.getElementById("stepLabelReplied");
  dom.stepLabelScheduled = document.getElementById("stepLabelScheduled");
  dom.stepDotDrafted = document.getElementById("stepDotDrafted");
  dom.stepDotSent = document.getElementById("stepDotSent");
  dom.stepDotReplied = document.getElementById("stepDotReplied");
  dom.stepDotScheduled = document.getElementById("stepDotScheduled");
  dom.stepConn1 = document.getElementById("stepConn1");
  dom.stepConn2 = document.getElementById("stepConn2");
  dom.stepConn3 = document.getElementById("stepConn3");

  dom.trackingActionButton = document.getElementById("trackingActionButton");
  dom.followUpDate = document.getElementById("followUpDate");
  dom.notesInput = document.getElementById("notesInput");
  dom.historyList = document.getElementById("historyList");
  dom.backToDraftButton = document.getElementById("backToDraftButton");

  dom.inputs = Array.from(document.querySelectorAll(".ui-input"));
  dom.iconButtons = Array.from(document.querySelectorAll(".ui-icon-btn"));
}

function setStatusText(text, tone = "neutral") {
  if (!dom.statusText) return;
  dom.statusText.textContent = text;
  dom.statusText.className = "mb-4 min-h-5 px-1 text-xs";

  if (tone === "error") {
    dom.statusText.classList.add("text-rose-600");
    return;
  }

  if (tone === "success") {
    dom.statusText.classList.add("text-emerald-600");
    return;
  }

  dom.statusText.classList.add("text-slate-500");
}

function setHeaderActionsVisibility() {
  if (!dom.authHeaderActions) return;
  dom.authHeaderActions.classList.toggle("hidden", !appState.isAuthenticated);
}

function ensureDraft() {
  if (!appState.contact) {
    appState.contact = { ...DEFAULT_CONTACT };
  }
  if (!appState.draft) {
    appState.draft = generateDraftForTemplate("Referral Request");
  }
}

function fillTemplate(template, contact) {
  return template
    .replace(/\{\{firstName\}\}/g, contact.firstName)
    .replace(/\{\{company\}\}/g, contact.company);
}

function hideAllStages() {
  dom.stageAuth?.classList.add("hidden");
  dom.stage1?.classList.add("hidden");
  dom.stage2?.classList.add("hidden");
  dom.stage3?.classList.add("hidden");
}

function renderAuthStage() {
  dom.stageAuth?.classList.remove("hidden");
  setStatusText("Sign in to continue to your outreach workspace.");
}

function renderManualStage() {
  dom.stage1?.classList.remove("hidden");
  setStatusText("Complete manual details to generate a draft.");
}

function renderDraftStage() {
  ensureDraft();
  dom.stage2?.classList.remove("hidden");

  dom.contactName.textContent = appState.contact.name;
  dom.contactRole.textContent = appState.contact.role;
  dom.contactCompany.textContent = appState.contact.company;
  dom.contactEmailText.textContent = appState.contact.email;

  dom.selectedTemplate.textContent = appState.draft.template;
  dom.subjectInput.value = appState.draft.subject;
  dom.messageInput.value = appState.draft.message;

  setStatusText("Draft workspace ready.");
}

function renderTrackingStage() {
  ensureDraft();
  dom.stage3?.classList.remove("hidden");

  dom.trackingName.textContent = appState.contact.name;
  dom.trackingRole.textContent = appState.contact.role;
  dom.trackingCompany.textContent = appState.contact.company;
  dom.trackingEmail.textContent = appState.contact.email;

  renderStepper();
  renderTrackingActionButton();
  renderHistory();

  dom.notesInput.value = appState.notes;

  setStatusText("Tracking outreach progression.");
}

function renderStepper() {
  const index = STATUS_ORDER.indexOf(appState.outreachStatus);

  const labels = [
    dom.stepLabelDrafted,
    dom.stepLabelSent,
    dom.stepLabelReplied,
    dom.stepLabelScheduled,
  ];
  const dots = [
    dom.stepDotDrafted,
    dom.stepDotSent,
    dom.stepDotReplied,
    dom.stepDotScheduled,
  ];
  const connectors = [dom.stepConn1, dom.stepConn2, dom.stepConn3];

  labels.forEach((label, i) => {
    label.classList.remove("text-blue-700", "text-slate-600", "text-slate-400", "font-semibold");
    if (i === index) {
      label.classList.add("text-blue-700", "font-semibold");
    } else if (i < index) {
      label.classList.add("text-slate-600");
    } else {
      label.classList.add("text-slate-400");
    }
  });

  dots.forEach((dot, i) => {
    dot.classList.remove(
      "bg-blue-600",
      "border-blue-600",
      "bg-slate-400",
      "border-slate-400",
      "bg-white",
      "border-slate-300",
    );

    if (i === index) {
      dot.classList.add("bg-blue-600", "border-blue-600");
    } else if (i < index) {
      dot.classList.add("bg-slate-400", "border-slate-400");
    } else {
      dot.classList.add("bg-white", "border-slate-300");
    }
  });

  connectors.forEach((line, i) => {
    line.classList.remove("bg-slate-300", "bg-slate-400");
    line.classList.add(i < index ? "bg-slate-400" : "bg-slate-300");
  });
}

function renderTrackingActionButton() {
  const nextStatus = STATUS_TRANSITIONS[appState.outreachStatus];

  if (!nextStatus) {
    dom.trackingActionButton.textContent = "All steps complete";
    dom.trackingActionButton.disabled = true;
    dom.trackingActionButton.classList.add("opacity-50", "cursor-not-allowed");
    return;
  }

  dom.trackingActionButton.disabled = false;
  dom.trackingActionButton.classList.remove("opacity-50", "cursor-not-allowed");

  if (nextStatus === OUTREACH_STATUS.SENT) {
    dom.trackingActionButton.textContent = "Mark as Sent";
  } else if (nextStatus === OUTREACH_STATUS.REPLIED) {
    dom.trackingActionButton.textContent = "Mark as Replied";
  } else {
    dom.trackingActionButton.textContent = "Schedule Follow-Up";
  }
}

function renderHistory() {
  dom.historyList.innerHTML = "";

  appState.history.forEach((item) => {
    const li = document.createElement("li");
    li.className = "relative border-l border-slate-200 pl-4";

    const dot = document.createElement("span");
    dot.className = "absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-slate-300 bg-white";

    const text = document.createElement("p");
    text.className = "text-sm text-slate-600";
    const date = HISTORY_DATE[item] || "Today";
    text.textContent = `${date} - ${item}`;

    li.appendChild(dot);
    li.appendChild(text);
    dom.historyList.appendChild(li);
  });
}

function renderUI() {
  setHeaderActionsVisibility();

  if (!appState.isAuthenticated) {
    hideAllStages();
    renderAuthStage();
    return;
  }

  hideAllStages();

  switch (appState.stage) {
    case STAGES.MANUAL:
      renderManualStage();
      break;
    case STAGES.DRAFT:
      renderDraftStage();
      break;
    case STAGES.TRACKING:
      renderTrackingStage();
      break;
    default:
      appState.stage = STAGES.MANUAL;
      renderManualStage();
      break;
  }
}

function updateOutreachStatus(nextStatus) {
  const current = appState.outreachStatus;
  const expectedNext = STATUS_TRANSITIONS[current];

  if (expectedNext !== nextStatus) {
    setStatusText("Invalid status transition.", "error");
    return false;
  }

  appState.outreachStatus = nextStatus;
  const historyEntry = HISTORY_TEXT[nextStatus];
  if (historyEntry && !appState.history.includes(historyEntry)) {
    appState.history.push(historyEntry);
  }

  return true;
}

function createContactFromForm() {
  const firstName = dom.firstName.value.trim();
  const lastName = dom.lastName.value.trim();
  const company = dom.company.value.trim();
  const role = dom.role.value.trim() || "Senior Recruiter";

  if (!firstName || !lastName || !company) {
    setStatusText("Please fill First Name, Last Name, and Company.", "error");
    return null;
  }

  const emailDomain = company.toLowerCase().replace(/[^a-z0-9]/g, "") || "company";
  const generatedEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}.com`;

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    role,
    company,
    email: generatedEmail,
  };
}

function generateDraftForTemplate(template) {
  const draftTemplate = TEMPLATE_CONTENT[template] || TEMPLATE_CONTENT["Referral Request"];
  return {
    template,
    subject: fillTemplate(draftTemplate.subject, appState.contact),
    message: fillTemplate(draftTemplate.message, appState.contact),
  };
}

function closeTemplateMenu() {
  dom.templateMenu.classList.add("hidden");
  dom.templateChevron.classList.remove("rotate-180");
}

function copyToClipboardWithFeedback(button, value) {
  const flash = () => {
    button.classList.add("bg-blue-50", "text-blue-600");
    window.setTimeout(() => {
      button.classList.remove("bg-blue-50", "text-blue-600");
    }, 700);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(flash).catch(flash);
  } else {
    flash();
  }
}

function resetWorkflowState() {
  appState.outreachStatus = OUTREACH_STATUS.DRAFTED;
  appState.history = [];
  appState.notes = "";
  appState.contact = null;
  appState.draft = null;
}

function openAuthTab() {
  const authUrl = new URL(AUTH_REDIRECT_URL);
  authUrl.searchParams.set("source", "extension");
  authUrl.searchParams.set("extensionId", chrome.runtime.id);

  chrome.tabs.create({ url: authUrl.toString() }, () => {
    if (chrome.runtime.lastError) {
      setStatusText("Unable to open sign-in tab. Please try again.", "error");
      return;
    }
    setStatusText("Complete sign in in the opened tab, then return here.");
  });
}

function handleAuthSuccess(payload) {
  appState.isAuthenticated = true;
  appState.user = payload || null;

  chrome.storage.local.set(
    {
      isAuthenticated: true,
      user: payload || null,
    },
    () => {
      if (chrome.runtime.lastError) {
        setStatusText("Signed in, but failed to persist auth state locally.", "error");
      }
    },
  );

  appState.stage = STAGES.MANUAL;
  renderUI();

  if (payload?.email) {
    setStatusText(`Signed in as ${payload.email}.`, "success");
    return;
  }

  setStatusText("Signed in successfully.", "success");
}

function handleLogout() {
  chrome.storage.local.clear(() => {
    appState.isAuthenticated = false;
    appState.user = null;
    appState.stage = STAGES.AUTH;
    resetWorkflowState();
    renderUI();

    if (chrome.runtime.lastError) {
      setStatusText("Logged out locally. Storage clear failed.", "error");
      return;
    }

    setStatusText("Logged out successfully.");
  });
}

function getStorageData(keys) {
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

async function hydrateAuthStateFromStorage() {
  const data = await getStorageData(["isAuthenticated", "user"]);
  appState.isAuthenticated = Boolean(data.isAuthenticated);
  appState.user = data.user || null;
  appState.stage = appState.isAuthenticated ? STAGES.MANUAL : STAGES.AUTH;
}

function setupRuntimeMessageListener() {
  if (runtimeListenerBound) return;
  runtimeListenerBound = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (!message) {
      return;
    }

    if (message.type === "AUTH_SUCCESS") {
      handleAuthSuccess(message.payload);
      return;
    }

    if (message.type === "AUTH_LOGOUT") {
      handleLogout();
    }
  });
}

function setupStorageListener() {
  if (storageListenerBound) return;
  storageListenerBound = true;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    const authChange = changes.isAuthenticated;
    const userChange = changes.user;

    if (!authChange && !userChange) return;

    if (authChange) {
      appState.isAuthenticated = Boolean(authChange.newValue);
    }

    if (userChange) {
      appState.user = userChange.newValue || null;
    }

    if (!appState.isAuthenticated) {
      resetWorkflowState();
    }

    appState.stage = appState.isAuthenticated ? STAGES.MANUAL : STAGES.AUTH;
    renderUI();
  });
}

function setupEventListeners() {
  if (listenersBound) return;
  listenersBound = true;

  dom.signInButton?.addEventListener("click", openAuthTab);
  dom.createAccountButton?.addEventListener("click", openAuthTab);
  dom.logoutButton?.addEventListener("click", handleLogout);

  dom.contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const contact = createContactFromForm();
    if (!contact) return;

    appState.contact = contact;
    appState.draft = generateDraftForTemplate("Referral Request");
    appState.outreachStatus = OUTREACH_STATUS.DRAFTED;
    appState.history = ["Draft Created"];
    appState.stage = STAGES.DRAFT;
    renderUI();
  });

  dom.discoverEmailButton.addEventListener("click", (event) => {
    event.preventDefault();

    const contact = createContactFromForm() || { ...DEFAULT_CONTACT };
    appState.contact = contact;
    appState.draft = generateDraftForTemplate("Referral Request");
    appState.outreachStatus = OUTREACH_STATUS.DRAFTED;
    appState.history = ["Draft Created"];
    appState.stage = STAGES.DRAFT;
    renderUI();
  });

  dom.templateToggle.addEventListener("click", () => {
    const willOpen = dom.templateMenu.classList.contains("hidden");
    dom.templateMenu.classList.toggle("hidden", !willOpen);
    dom.templateChevron.classList.toggle("rotate-180", willOpen);
  });

  dom.templateOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const template = option.dataset.template || "Referral Request";
      if (!appState.contact) appState.contact = { ...DEFAULT_CONTACT };
      appState.draft = generateDraftForTemplate(template);
      renderUI();
      closeTemplateMenu();
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node) || !dom.templateMenu || !dom.templateToggle) return;

    if (!dom.templateMenu.contains(target) && !dom.templateToggle.contains(target)) {
      closeTemplateMenu();
    }
  });

  dom.generateDraftButton.addEventListener("click", () => {
    if (!appState.contact) {
      appState.contact = { ...DEFAULT_CONTACT };
    }

    const selectedTemplate = dom.selectedTemplate.textContent?.trim() || "Referral Request";
    appState.draft = generateDraftForTemplate(selectedTemplate);
    renderUI();
  });

  dom.subjectInput.addEventListener("input", () => {
    if (!appState.draft) ensureDraft();
    appState.draft.subject = dom.subjectInput.value;
  });

  dom.messageInput.addEventListener("input", () => {
    if (!appState.draft) ensureDraft();
    appState.draft.message = dom.messageInput.value;
  });

  dom.markSentButton.addEventListener("click", () => {
    const ok = updateOutreachStatus(OUTREACH_STATUS.SENT);
    if (!ok) return;
    appState.stage = STAGES.TRACKING;
    renderUI();
  });

  dom.trackingActionButton.addEventListener("click", () => {
    const nextStatus = STATUS_TRANSITIONS[appState.outreachStatus];
    if (!nextStatus) return;

    const ok = updateOutreachStatus(nextStatus);
    if (!ok) return;

    renderUI();
  });

  dom.backToDraftButton.addEventListener("click", () => {
    appState.stage = STAGES.DRAFT;
    renderUI();
  });

  dom.notesInput.addEventListener("input", () => {
    appState.notes = dom.notesInput.value;
  });

  dom.copyEmailButton.addEventListener("click", () => {
    if (!appState.contact) return;
    copyToClipboardWithFeedback(dom.copyEmailButton, appState.contact.email);
  });

  dom.trackingCopyButton.addEventListener("click", () => {
    if (!appState.contact) return;
    copyToClipboardWithFeedback(dom.trackingCopyButton, appState.contact.email);
  });

  dom.inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      input.classList.add("ring-2", "ring-blue-100", "border-blue-500");
    });

    input.addEventListener("blur", () => {
      input.classList.remove("ring-2", "ring-blue-100", "border-blue-500");
    });
  });

  [...dom.iconButtons, dom.viewDraftsButton].forEach((button) => {
    if (!button) return;

    button.addEventListener("mousedown", () => {
      button.classList.add("scale-95");
    });

    button.addEventListener("mouseup", () => {
      button.classList.remove("scale-95");
    });

    button.addEventListener("mouseleave", () => {
      button.classList.remove("scale-95");
    });
  });

  dom.clearQueueButton.addEventListener("click", () => {
    dom.clearQueueButton.classList.add("rotate-6");
    window.setTimeout(() => {
      dom.clearQueueButton.classList.remove("rotate-6");
    }, 140);
  });
}

async function initializeApp() {
  cacheDom();
  setupEventListeners();
  setupRuntimeMessageListener();
  setupStorageListener();
  await hydrateAuthStateFromStorage();
  renderUI();
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApp().catch(() => {
    appState.isAuthenticated = false;
    appState.user = null;
    appState.stage = STAGES.AUTH;
    renderUI();
    setStatusText("Sign in to continue.");
  });
});
