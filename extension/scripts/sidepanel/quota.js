(function initSidepanelQuota(globalScope) {
  const contract = globalScope.EllynMessageContract;
  const api = globalScope.EllynSidepanelApi;
  const rendering = globalScope.EllynSidepanelRendering;

  async function consumeLookupCredits(credits, label, onDenied, onSuccess, onError) {
    const requestedCredits = Math.max(1, Math.min(100, Number(credits) || 1));
    try {
      const response = await api.sendRuntimeMessage({
        type: contract.MESSAGE_TYPES.CONSUME_LOOKUP_CREDITS,
        amount: requestedCredits,
      });

      const allowed = response?.allowed !== false;
      if (!allowed) {
        const resetLabel = rendering.formatResetDate(response?.resetDate);
        const message = resetLabel
          ? `Not enough credits for ${label}. Resets ${resetLabel}.`
          : `Not enough credits for ${label}.`;
        onDenied?.(message, response);
        return false;
      }

      await onSuccess?.(response);
      return true;
    } catch (error) {
      onError?.(error);
      return false;
    }
  }

  globalScope.EllynSidepanelQuota = Object.freeze({
    consumeLookupCredits,
  });
})(globalThis);
