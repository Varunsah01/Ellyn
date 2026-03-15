(function initSidepanelState(globalScope) {
  const STAGES = Object.freeze({
    EXTRACTION: "extraction",
    DRAFT: "draft",
    TRACKING: "tracking",
  });

  const CONTACT_SYNC_STATE = Object.freeze({
    SYNCED: "synced",
    QUEUED: "queued",
    AUTH_FAILED: "auth_failed",
    FAILED: "failed",
  });

  const PIPELINE_STAGES = [
    { label: "Extracting LinkedIn data...", progress: 18 },
    { label: "Resolving company domain...", progress: 42 },
    { label: "Generating email patterns...", progress: 68 },
    { label: "Verifying email...", progress: 90 },
  ];

  function createAppState() {
    return {
      stage: STAGES.EXTRACTION,
      contact: null,
    };
  }

  function createEmailFinderState(pricingUrl) {
    return {
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
      upgradeUrl: pricingUrl,
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
  }

  globalScope.EllynSidepanelState = Object.freeze({
    STAGES,
    CONTACT_SYNC_STATE,
    PIPELINE_STAGES,
    createAppState,
    createEmailFinderState,
  });
})(globalThis);
