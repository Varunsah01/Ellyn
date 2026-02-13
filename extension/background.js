chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

const AUTH_STORAGE_KEYS = ["isAuthenticated", "user"];

function setAuthenticatedState(payload, sendResponse) {
  chrome.storage.local.set(
    {
      isAuthenticated: true,
      user: payload || null,
    },
    () => {
      if (chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      chrome.runtime.sendMessage({ type: "AUTH_SUCCESS", payload }, () => {
        void chrome.runtime.lastError;
      });

      sendResponse({ ok: true });
    },
  );
}

function clearAuthenticatedState(sendResponse) {
  chrome.storage.local.remove(AUTH_STORAGE_KEYS, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    chrome.runtime.sendMessage({ type: "AUTH_LOGOUT" }, () => {
      void chrome.runtime.lastError;
    });

    sendResponse({ ok: true });
  });
}

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "AUTH_SUCCESS") {
    setAuthenticatedState(message.payload || null, sendResponse);
    return true;
  }

  if (message.type === "AUTH_LOGOUT") {
    clearAuthenticatedState(sendResponse);
    return true;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "AUTH_LOGOUT_LOCAL") {
    clearAuthenticatedState(sendResponse);
    return true;
  }
});
