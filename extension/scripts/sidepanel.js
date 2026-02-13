const AUTH_REDIRECT_URL = "https://www.useellyn.com/auth";
const DASHBOARD_URL = "https://www.useellyn.com/dashboard";
const AUTH_STORAGE_KEYS = ["isAuthenticated", "user"];

const ui = {
  welcomeTitle: null,
  trustBadge: null,
  actionButtons: null,
  signedInSection: null,
  signedInMeta: null,
  footerLinks: null,
  footer: null,
  statusText: null,
  signInButton: null,
  createAccountButton: null,
  openDashboardButton: null,
  signOutButton: null,
};

function setStatus(message) {
  if (!ui.statusText) return;
  ui.statusText.textContent = message;
}

function setButtonLoading(button, loading) {
  if (!button) return;
  const label = button.querySelector(".btn-label");

  if (loading) {
    button.dataset.originalLabel = label ? label.textContent : "";
    if (label && button.dataset.loadingText) {
      label.textContent = button.dataset.loadingText;
    }
    button.classList.add("is-loading");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    return;
  }

  if (label && button.dataset.originalLabel) {
    label.textContent = button.dataset.originalLabel;
  }

  button.classList.remove("is-loading");
  button.disabled = false;
  button.removeAttribute("aria-busy");
}

function formatSignedInMeta(user) {
  if (!user || typeof user !== "object") return "Signed in successfully.";

  const userRecord = user;
  const email = typeof userRecord.email === "string" ? userRecord.email : "";
  const name = typeof userRecord.name === "string" ? userRecord.name : "";

  if (name && email) return `${name} (${email})`;
  if (email) return email;
  if (name) return name;
  return "Signed in successfully.";
}

function toggleElementVisibility(element, shouldShow) {
  if (!element) return;
  element.classList.toggle("hidden", !shouldShow);
}

function renderAuthState(isAuthenticated, user) {
  if (!ui.welcomeTitle) return;

  if (isAuthenticated) {
    ui.welcomeTitle.textContent = "Welcome back";
    if (ui.signedInMeta) {
      ui.signedInMeta.textContent = formatSignedInMeta(user);
    }

    toggleElementVisibility(ui.actionButtons, false);
    toggleElementVisibility(ui.signedInSection, true);
    toggleElementVisibility(ui.footerLinks, false);
    toggleElementVisibility(ui.footer, false);
    return;
  }

  ui.welcomeTitle.textContent = "Welcome to Ellyn";
  if (ui.signedInMeta) {
    ui.signedInMeta.textContent = "";
  }

  toggleElementVisibility(ui.actionButtons, true);
  toggleElementVisibility(ui.signedInSection, false);
  toggleElementVisibility(ui.footerLinks, true);
  toggleElementVisibility(ui.footer, true);
}

function syncAuthStateFromStorage() {
  chrome.storage.local.get(AUTH_STORAGE_KEYS, (result) => {
    const isAuthenticated = result?.isAuthenticated === true;
    renderAuthState(isAuthenticated, result?.user || null);
  });
}

function openAuth(mode, button) {
  setButtonLoading(button, true);

  const authUrl = new URL(AUTH_REDIRECT_URL);
  authUrl.searchParams.set("source", "extension");
  authUrl.searchParams.set("extensionId", chrome.runtime.id);
  authUrl.searchParams.set("mode", mode === "signup" ? "signup" : "signin");

  chrome.tabs.create({ url: authUrl.toString() }, () => {
    setButtonLoading(button, false);

    if (chrome.runtime.lastError) {
      setStatus("Unable to open authentication tab. Please try again.");
      return;
    }

    setStatus("Authentication opened in a new tab.");
  });
}

function openDashboard() {
  chrome.tabs.create({ url: DASHBOARD_URL }, () => {
    if (chrome.runtime.lastError) {
      setStatus("Unable to open dashboard. Please try again.");
    }
  });
}

function clearAuthLocalState(onDone) {
  chrome.storage.local.remove(AUTH_STORAGE_KEYS, () => {
    renderAuthState(false, null);
    if (typeof onDone === "function") {
      onDone();
    }
  });
}

function signOut() {
  if (!ui.signOutButton) return;
  ui.signOutButton.disabled = true;

  chrome.runtime.sendMessage({ type: "AUTH_LOGOUT_LOCAL" }, (response) => {
    ui.signOutButton.disabled = false;

    if (chrome.runtime.lastError || !response?.ok) {
      clearAuthLocalState(() => {
        setStatus("Signed out locally.");
      });
      return;
    }

    renderAuthState(false, null);
    setStatus("Signed out.");
  });
}

function bindRuntimeListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "AUTH_SUCCESS") {
      renderAuthState(true, message.payload || null);
      setStatus("Authentication complete.");
    } else if (message.type === "AUTH_LOGOUT") {
      renderAuthState(false, null);
      setStatus("Signed out.");
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.isAuthenticated && !changes.user) return;
    syncAuthStateFromStorage();
  });
}

function cacheElements() {
  ui.welcomeTitle = document.getElementById("welcomeTitle");
  ui.trustBadge = document.querySelector(".trust-badge");
  ui.actionButtons = document.querySelector(".action-buttons");
  ui.signedInSection = document.getElementById("signedInSection");
  ui.signedInMeta = document.getElementById("signedInMeta");
  ui.footerLinks = document.querySelector(".footer-links");
  ui.footer = document.querySelector(".footer");
  ui.statusText = document.getElementById("statusText");

  ui.signInButton = document.getElementById("signInButton");
  ui.createAccountButton = document.getElementById("createAccountButton");
  ui.openDashboardButton = document.getElementById("openDashboardButton");
  ui.signOutButton = document.getElementById("signOutButton");
}

function bindEvents() {
  ui.signInButton?.addEventListener("click", () => {
    openAuth("signin", ui.signInButton);
  });

  ui.createAccountButton?.addEventListener("click", () => {
    openAuth("signup", ui.createAccountButton);
  });

  ui.openDashboardButton?.addEventListener("click", () => {
    openDashboard();
  });

  ui.signOutButton?.addEventListener("click", () => {
    signOut();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  bindRuntimeListeners();
  syncAuthStateFromStorage();
});
