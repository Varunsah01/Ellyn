(function initBackgroundEmailActionsDomain(globalScope) {
  const { MESSAGE_TYPES } = globalScope.EllynMessageContract;

  function handleRuntimeEmailActions(message, sender, sendResponse, deps) {
    if (message.type === MESSAGE_TYPES.ELLYN_PING) {
      sendResponse?.({ success: true, version: '1.0.0' });
      return false;
    }
    if (message.type === MESSAGE_TYPES.FIND_EMAIL) {
      deps.handleFindEmail(message.data, sender, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.EXTRACT_PROFILE_FROM_TAB) {
      const payload = message.data && typeof message.data === 'object' ? message.data : message;
      deps.handleExtractProfileFromTabMessage(payload, sender, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.EXTRACT_AND_ENRICH_ENHANCED) {
      void deps.handleExtractAndEnrichEnhanced(message, sender, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.ELLYN_SAVE_TEMPLATE) {
      void deps.handleSaveTemplateMessage(message, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.ELLYN_GET_TEMPLATES) {
      void deps.handleGetTemplatesMessage(sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.ELLYN_DELETE_TEMPLATE) {
      void deps.handleDeleteTemplateMessage(message, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.CHECK_QUOTA) {
      deps
        .checkQuota()
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error('[Extension] CHECK_QUOTA failed:', error);
          sendResponse({ allowed: false, error: error?.message || 'Failed to fetch quota' });
        });
      return true;
    }
    if (message.type === MESSAGE_TYPES.CONSUME_LOOKUP_CREDITS) {
      const requestedAmount = Number(message?.amount);
      const amount = Number.isFinite(requestedAmount)
        ? Math.max(1, Math.min(100, Math.floor(requestedAmount)))
        : 1;
      deps
        .canPerformLookup(amount)
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error('[Extension] CONSUME_LOOKUP_CREDITS failed:', error);
          sendResponse({
            allowed: false,
            remaining: null,
            resetDate: null,
            requestedCost: amount,
            error: error?.message || 'Failed to consume credits',
          });
        });
      return true;
    }
    return false;
  }

  function handleExternalEmailActions(message, sendResponse, deps) {
    if (message.type === MESSAGE_TYPES.ELLYN_PING) {
      sendResponse?.({ success: true, version: '1.0.0' });
      return false;
    }
    if (message.type === MESSAGE_TYPES.ELLYN_SAVE_TEMPLATE) {
      void deps.handleSaveTemplateMessage(message, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.ELLYN_GET_TEMPLATES) {
      void deps.handleGetTemplatesMessage(sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.ELLYN_DELETE_TEMPLATE) {
      void deps.handleDeleteTemplateMessage(message, sendResponse);
      return true;
    }
    return false;
  }

  globalScope.EllynBackgroundEmailActionsDomain = Object.freeze({
    handleRuntimeEmailActions,
    handleExternalEmailActions,
  });
})(globalThis);
