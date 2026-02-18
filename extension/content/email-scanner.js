/**
 * ProfileEmailScanner
 * Scans visible LinkedIn profile text for publicly listed email addresses.
 */

class ProfileEmailScanner {
  scanForEmails() {
    const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
    const results = [];
    const sections = [
      document.querySelector('section[id*="about"]'),
      document.querySelector('div[class*="pv-contact-info"]'),
      document.querySelector('main'),
    ].filter(Boolean);
    const seen = new Set();
    for (const el of sections) {
      for (const email of (el.textContent || '').match(EMAIL_RE) || []) {
        if (!seen.has(email) && !email.includes('linkedin')) {
          seen.add(email);
          results.push(email);
        }
      }
    }
    return results;
  }
}

window.ProfileEmailScanner = ProfileEmailScanner;

// Respond to background requests
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SCAN_EMAILS') {
    try {
      const scanner = new ProfileEmailScanner();
      sendResponse({ emails: scanner.scanForEmails() });
    } catch (e) {
      sendResponse({ emails: [] });
    }
  }
});
