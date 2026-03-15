(function initSidepanelProfileExtraction(globalScope) {
  const api = globalScope.EllynSidepanelApi;

  function isMissingReceiverError(error) {
    const msg = String(error?.message || error || "").toLowerCase();
    return (
      msg.includes("receiving end does not exist") ||
      msg.includes("could not establish connection") ||
      msg.includes("message port closed")
    );
  }

  function isLinkedInProfile(url) {
    return typeof url === "string" && /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/in\/[^/?#]+/i.test(url);
  }

  function isLinkedInCompanyPage(url) {
    return typeof url === "string" && /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/company\/[^/?#]+/i.test(url);
  }

  async function getLinkedInProfileTab(profileMissingMessage) {
    const [activeTab] = await api.queryTabs({ active: true, currentWindow: true });
    if (isLinkedInProfile(activeTab?.url) && Number.isFinite(activeTab?.id)) return activeTab;

    const allTabs = await api.queryTabs({ currentWindow: true });
    const candidate = allTabs.find((tab) => isLinkedInProfile(tab?.url) && Number.isFinite(tab?.id));
    if (candidate) return candidate;
    throw new Error(profileMissingMessage);
  }

  async function hasLinkedInProfileOpen() {
    try {
      const tabs = await api.queryTabs({ currentWindow: true });
      return tabs.some((tab) => isLinkedInProfile(tab?.url) || isLinkedInCompanyPage(tab?.url));
    } catch {
      return false;
    }
  }

  async function requestProfileExtraction(tabId, debug, hasUsableProfileIdentity) {
    let directResponse = null;
    try {
      directResponse = await api.sendTabMessage(tabId, { type: "EXTRACT_PROFILE", debug });
      if (directResponse && hasUsableProfileIdentity(directResponse)) return directResponse;
    } catch (error) {
      if (!isMissingReceiverError(error)) throw error;
    }

    const runtimeResponse = await api.sendRuntimeMessage({
      type: "EXTRACT_PROFILE_FROM_TAB",
      tabId,
      debug,
      data: { tabId, debug },
    });

    if (runtimeResponse && hasUsableProfileIdentity(runtimeResponse)) return runtimeResponse;
    return runtimeResponse || directResponse;
  }

  globalScope.EllynSidepanelProfileExtraction = Object.freeze({
    isLinkedInProfile,
    isLinkedInCompanyPage,
    getLinkedInProfileTab,
    hasLinkedInProfileOpen,
    requestProfileExtraction,
  });
})(globalThis);
