# Chrome Extension

Last updated: 2026-03-05

## Purpose

The Ellyn Chrome Extension brings email discovery and AI drafting directly into the browser. Users can extract contact information from LinkedIn profiles, find professional emails, generate AI-powered outreach drafts, and sync contacts to the web app — all from a side panel without leaving their current page.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│ Chrome Extension (Manifest V3)                    │
│                                                   │
│  Content Scripts (injected into web pages)        │
│  ├── linkedin-extractor.js — LinkedIn profiles    │
│  ├── linkedin-company-extractor.js — Companies    │
│  └── email-scanner.js — Generic email scanning    │
│         │                                         │
│         ▼                                         │
│  Background Service Worker (background.js)        │
│  ├── Message router (chrome.runtime.onMessage)    │
│  ├── Auth state bridge (reads web app session)    │
│  └── Email predictor (background/email-predictor) │
│         │                                         │
│         ▼                                         │
│  Side Panel (sidepanel.html + scripts/sidepanel)  │
│  ├── Contact card display                         │
│  ├── Email discovery (calls web app API)          │
│  ├── Draft editor + AI generation                 │
│  ├── Template picker                              │
│  └── Gmail compose integration                    │
│         │                                         │
│         ▼                                         │
│  Sync Layer (lib/sync.js + lib/syncQueue.js)      │
│  └── Batched contact sync to web app DB           │
└──────────────────────────────────────────────────┘
         │
         ▼ (API calls)
┌──────────────────────────────────────────────────┐
│ Ellyn Web App                                     │
│  ├── POST /api/extension/sync-contact             │
│  ├── POST /api/extension/sync-batch               │
│  ├── POST /api/extension-errors                   │
│  ├── POST /api/v1/enrich (email discovery)        │
│  ├── POST /api/v1/ai/draft-email (AI drafting)    │
│  └── GET /api/v1/email-templates (templates)      │
└──────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Vanilla JS (no React/bundler)**: The extension uses plain JavaScript, CSS, and HTML — no build step, no bundler, no framework. This is intentional: Chrome extensions load directly via the browser, and avoiding a build step simplifies development and debugging. The trade-off is more manual DOM manipulation.

2. **Side Panel over Popup**: The side panel provides more screen real estate than a popup and stays open as the user navigates. This is essential for the draft editor and contact card workflows.

3. **Auth via web app session**: Rather than implementing separate authentication, the extension reads the Supabase session cookie set by the web app. The `extension-auth` bridge page facilitates this token transfer.

4. **Batched sync queue**: Contact syncing uses a queue (`lib/syncQueue.js`) to batch multiple contacts into fewer API calls, reducing server load during rapid LinkedIn browsing.

5. **Vendored Supabase**: `lib/vendor/supabase.js` is a vendored copy of the Supabase client library, since the extension can't use npm modules directly.

---

## What Is Accomplished

### Core Features — Complete

| Feature | Status | Details |
|---------|--------|---------|
| LinkedIn profile extraction | ✅ | Extracts name, title, company, location from LinkedIn profile pages |
| LinkedIn company extraction | ✅ | Extracts company details from LinkedIn company pages |
| Generic email scanning | ✅ | Scans any web page for email addresses |
| Email discovery | ✅ | Calls `/api/v1/enrich` to find professional emails |
| AI draft generation | ✅ | Calls `/api/v1/ai/draft-email` for AI-powered outreach drafts |
| Draft editor | ✅ | In-panel rich text editor for email composition |
| Email type selector | ✅ | Choose outreach type: cold email, follow-up, networking, etc. |
| Template picker | ✅ | Load saved templates from web app |
| Gmail compose button | ✅ | One-click compose in Gmail with pre-filled draft |
| Contact card display | ✅ | Shows extracted contact info with confidence badges |
| Contact sync (single) | ✅ | `POST /api/extension/sync-contact` |
| Contact sync (batch) | ✅ | `POST /api/extension/sync-batch` with queue management |
| Error logging | ✅ | `POST /api/extension-errors` for server-side error tracking |
| Auth bridge | ✅ | `app/extension-auth/page.tsx` transfers session to extension |
| Quota checking | ✅ | `utils/quota.js` checks against web app quota API |
| Pattern caching | ✅ | `utils/pattern-cache.js` caches email patterns client-side |
| Draft analytics | ✅ | `utils/draft-analytics.js` tracks draft quality and usage |
| Role detection | ✅ | `utils/role-detector.js` detects LinkedIn role context |
| Safety checks | ✅ | `utils/safety.js` prevents sending to bad/internal domains |
| Recruiter templates | ✅ | `templates/recruiter-templates.js` provides built-in templates |
| University domain data | ✅ | `data/university-domains.json` for .edu domain handling |
| Extension heartbeat | ✅ | Periodic heartbeat to track active extension users (migration 009) |
| Popup UI | ✅ | Toolbar button popup with quick actions |

### Infrastructure — Complete

| Feature | Status | Details |
|---------|--------|---------|
| Manifest V3 | ✅ | Modern Chrome extension manifest |
| Side panel configuration | ✅ | `sidepanel.html` registered in manifest |
| Content script injection | ✅ | Auto-injected on LinkedIn and configurable sites |
| Background service worker | ✅ | Persistent message routing and auth management |
| CORS configuration | ✅ | `NEXT_PUBLIC_CHROME_EXTENSION_ID` used for allowlisting |
| Privacy policy | ✅ | `extension/privacy.html` |
| Extension icons | ✅ | 16x16, 48x48, 128x128 PNG + SVG in `assets/icons/` |

---

## What Is Not Yet Accomplished

| Feature | Status | Notes |
|---------|--------|-------|
| Chrome Web Store publishing | ❌ Unknown | Extension exists but publication status unclear |
| Auto-update mechanism | ❌ Not started | No automatic update configuration |
| Offline mode | ❌ Not started | Extension requires web app connectivity |
| Multi-tab contact tracking | ❌ Not started | Each tab operates independently |
| Sequence enrollment from extension | ❌ Not started | Can't enroll contacts in sequences directly from extension |
| Outlook compose integration | ❌ Not started | Only Gmail compose button exists |
| Extension settings page | ❌ Not started | No in-extension settings/preferences UI |
| Keyboard shortcuts (extension) | ❌ Not started | No keyboard shortcut registration in manifest |
| Context menu integration | ❌ Not started | No right-click context menu actions |
| Extension analytics dashboard | ❌ Not started | No admin view of extension usage metrics |
| Non-LinkedIn extractors | ⚠️ Partial | Generic email scanner exists, but no specialized extractors for Twitter/X, GitHub, etc. |

---

## File Reference

### Core Entry Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (permissions, content scripts, side panel) |
| `background.js` | Service worker — message routing, auth bridge, email prediction |
| `sidepanel.html` | Side panel UI shell (HTML) |
| `scripts/sidepanel.js` | **Authoritative** side panel logic (mounted in sidepanel.html) |
| `popup/popup.html` | Popup UI (toolbar button click) |
| `popup/popup.js` | Popup logic |
| `privacy.html` | In-extension privacy policy |

### Content Scripts

| File | Purpose |
|------|---------|
| `content/linkedin-extractor.js` | Extracts contact data from LinkedIn profile pages |
| `content/linkedin-company-extractor.js` | Extracts company data from LinkedIn company pages |
| `content/email-scanner.js` | Scans any web page for email addresses |

### Side Panel Components

| File | Purpose |
|------|---------|
| `components/contact-card.js` | Contact card UI (name, title, company, email, confidence) |
| `components/draft-editor.js` | Email draft editor with formatting |
| `components/draft-stats-panel.js` | Draft quality analytics display |
| `components/email-type-selector.js` | Select email type (cold outreach, follow-up, etc.) |
| `components/generate-draft-button.js` | Trigger AI draft generation |
| `components/gmail-action-button.js` | One-click compose in Gmail |

### Views

| File | Purpose |
|------|---------|
| `views/draft-view.js` | Full draft composition view layout |

### Libraries

| File | Purpose |
|------|---------|
| `lib/supabase.js` | Supabase browser client for extension |
| `lib/vendor/supabase.js` | Vendored Supabase JS library (no npm) |
| `lib/sync.js` | Contact sync logic (single + batch push to web app) |
| `lib/syncQueue.js` | Queue manager for batched sync operations |

### Utilities

| File | Purpose |
|------|---------|
| `utils/analytics.js` | Event tracking from extension |
| `utils/draft-analytics.js` | Draft quality/usage analytics |
| `utils/empty-states.js` | Empty state rendering helpers |
| `utils/pattern-cache.js` | Client-side email pattern cache |
| `utils/quota.js` | Quota check against web app API |
| `utils/role-detector.js` | Detect LinkedIn role from page context |
| `utils/safety.js` | Safety checks (suppress bad domains, internal emails) |
| `utils/saved-templates.js` | Load saved templates from web app API |

### Templates & Data

| File | Purpose |
|------|---------|
| `templates/recruiter-templates.js` | Hardcoded recruiter-focused email templates |
| `data/university-domains.json` | University domain list for .edu handling |

---

## Auth Bridge Flow

```
1. User installs extension
2. Extension checks chrome.storage.local for session
3. If no session → opens app/extension-auth/page.tsx in a new tab
4. extension-auth page reads Supabase session from cookie
5. Sends session data via postMessage to extension
6. Extension stores session in chrome.storage.local
7. Tab is closed automatically
8. Subsequent API calls use stored session token
```

**Session refresh**: The background service worker periodically checks session validity and re-bridges if expired.

---

## Web App Sync Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/extension/sync-contact` | POST | Push a single contact from extension to DB |
| `POST /api/extension/sync-batch` | POST | Push batch of contacts from extension to DB |
| `POST /api/extension-errors` | POST | Log extension-side errors to server |

Sync utilities live in `app/api/extension/_lib/sync-utils.ts`.

---

## Layout Rules (Side Panel)

- Fixed width side panel (Chrome constraint, ~400px)
- Vanilla JS + CSS (no React, no bundler)
- All UI state managed via DOM manipulation in `scripts/sidepanel.js`
- Templates load from web app API via `utils/saved-templates.js`
- Responsive within the panel width (scrollable content areas)

---

## Extension-Specific Environment

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CHROME_EXTENSION_ID` | Required for CORS allowlist on sync routes |

The extension ID must match the published Chrome Extension ID. During development, use the unpacked extension ID from `chrome://extensions/`.
