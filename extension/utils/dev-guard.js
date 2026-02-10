(function(window) {
  'use strict';

  // Only active in development environment
  let isDev = false;
  try {
    const manifest = chrome.runtime.getManifest();
    // installType is available in background contexts, might be missing in some contexts depending on permissions
    // In sidepanel/content script, we can't always easily check installType without messaging background.
    // We'll infer it or default to false to be safe, but requirements say "No impact on production".
    // A safe heuristic for local dev is checking if an extension ID is the unpacked one or simply checking specific flags.
    // For now, let's assume we can query it or use a simpler check like 'update_url' missing in manifest (common for unpacked).
    isDev = !manifest.update_url; 
  } catch (e) {
    // If we can't access manifest, assume production to be safe
    isDev = false;
  }

  if (!isDev) {
    window.EllynDevGuard = {
      reportLegacyCall: () => {},
      reportErrorEscape: () => {}
    };
    return;
  }

  class DevGuard {
    constructor() {
      this.initAlertInterceptor();
      this.initErrorMonitor();
      console.log('[EllynDevGuard] Regression guards active 🛡️');
    }

    /**
     * Intercept window.alert to warn about UX anti-patterns
     */
    initAlertInterceptor() {
      const originalAlert = window.alert;
      window.alert = (message) => {
        console.warn(
          '%c[UX Regression] alert() called! Use showToast() instead.',
          'background: #ef4444; color: white; padding: 4px; border-radius: 4px;'
        );
        console.trace(); // Show where it came from
        
        // Still allow it for now so we don't break functionality during dev, 
        // but arguably we should block it to enforce the rule.
        // Requirement: "logs a warning if..."
        originalAlert(message); 
      };
    }

    /**
     * Monitor unhandled rejections that might be escaped errors
     */
    initErrorMonitor() {
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message && event.reason.message.includes('Workflow')) {
          console.warn(
            '%c[Orchestrator Regression] Error escaped workflow logic!',
            'background: #f59e0b; color: black; padding: 4px; border-radius: 4px;',
            event.reason
          );
        }
      });
    }

    /**
     * Report usage of legacy code
     */
    reportLegacyCall(featureName) {
      console.warn(
        `%c[Legacy Code] ${featureName} executed. This path should be unreachable.`,
        'background: #ef4444; color: white; padding: 4px; border-radius: 4px;'
      );
      console.trace();
    }
  }

  window.EllynDevGuard = new DevGuard();

})(typeof window !== 'undefined' ? window : self);
