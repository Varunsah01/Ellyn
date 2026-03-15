(function initBackgroundAuthBridge(globalScope) {
  const { MESSAGE_TYPES } = globalScope.EllynMessageContract;

  function handleRuntimeAuthBridge(message, _sender, sendResponse, deps) {
    if (message.type === MESSAGE_TYPES.GET_AUTH_TOKEN) {
      deps
        .getAuthToken()
        .then((token) => sendResponse(token))
        .catch((error) => {
          console.error('[Extension] GET_AUTH_TOKEN failed:', error);
          sendResponse('');
        });
      return true;
    }

    if (message.type === MESSAGE_TYPES.AUTH_LOGOUT_LOCAL) {
      void deps.clearAuthenticatedState(sendResponse);
      return true;
    }

    return false;
  }

  function handleExternalAuthBridge(message, senderOrigin, sendResponse, deps) {
    if (message.type === MESSAGE_TYPES.ELLYN_SET_SESSION) {
      void deps.setSupabaseSessionFromExternalMessage(message, sendResponse, { sourceOrigin: senderOrigin });
      return true;
    }

    if (message.type === MESSAGE_TYPES.WEBAPP_AUTH_SYNC || message.type === MESSAGE_TYPES.AUTH_SUCCESS) {
      void deps.setAuthenticatedState(message.payload || null, sendResponse, { sourceOrigin: senderOrigin });
      return true;
    }

    if (message.type === MESSAGE_TYPES.AUTH_LOGOUT) {
      void deps.clearAuthenticatedState(sendResponse);
      return true;
    }

    return false;
  }

  globalScope.EllynBackgroundAuthBridge = Object.freeze({
    handleRuntimeAuthBridge,
    handleExternalAuthBridge,
  });
})(globalThis);
