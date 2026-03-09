/* eslint-disable no-undef */
/*
 * Copy this file to extension/public-config.js (gitignored) and fill values,
 * or generate it with scripts/security/generate-extension-public-config.mjs.
 */
(function initEllynPublicConfig(scope) {
  scope.ELLYN_PUBLIC_CONFIG = Object.freeze({
    supabaseUrl: 'https://your-project-ref.supabase.co',
    supabaseAnonKey: 'sb_publishable_replace_me',
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
