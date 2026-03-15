(function initBackgroundAnalyticsDomain(globalScope) {
  const { MESSAGE_TYPES } = globalScope.EllynMessageContract;

  function handleRuntimeAnalytics(message, _sender, sendResponse, deps) {
    if (message.type === MESSAGE_TYPES.GENERATE_AI_DRAFT) {
      void deps.handleGenerateAiDraftMessage(message, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.GENERATE_AI_DRAFT_GEMINI) {
      void deps.handleGenerateAiDraftGeminiMessage(message, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.GET_COMPANY_BRIEF_GEMINI) {
      void deps.handleGetCompanyBriefGeminiMessage(message, sendResponse);
      return true;
    }
    return false;
  }

  globalScope.EllynBackgroundAnalyticsDomain = Object.freeze({ handleRuntimeAnalytics });
})(globalThis);
