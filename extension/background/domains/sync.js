(function initBackgroundSyncDomain(globalScope) {
  const { MESSAGE_TYPES } = globalScope.EllynMessageContract;

  function handleRuntimeSync(message, _sender, sendResponse, deps) {
    if (message.type === MESSAGE_TYPES.SAVE_CONTACT_TO_SUPABASE) {
      void deps.handleSaveContactToSupabaseMessage(message, sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.PROCESS_SYNC_QUEUE) {
      void deps.handleProcessSyncQueueMessage(sendResponse);
      return true;
    }
    if (message.type === MESSAGE_TYPES.GET_SYNC_QUEUE_STATUS) {
      void deps.handleGetSyncQueueStatusMessage(sendResponse);
      return true;
    }
    return false;
  }

  globalScope.EllynBackgroundSyncDomain = Object.freeze({ handleRuntimeSync });
})(globalThis);
