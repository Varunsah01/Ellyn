(function initSidepanelRendering(globalScope) {
  function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : Number.NaN;
  }

  function formatResetDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  globalScope.EllynSidepanelRendering = Object.freeze({
    toFiniteNumber,
    formatResetDate,
    escapeHtml,
  });
})(globalThis);
