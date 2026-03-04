# Chrome Extension

Last updated: 2026-03-04

## Overview

Manifest V3 Chrome Extension that integrates with the Ellyn web app. Provides a side panel for email discovery, AI drafting, and contact sync directly from LinkedIn and other pages.

## Core Entry Files

| File | Purpose |
|------|---------|
| `extension/manifest.json` | Extension manifest (permissions, content scripts, side panel) |
| `extension/background.js` | Service worker — message routing between content scripts, side panel, and web app |
| `extension/sidepanel.html` | Side panel UI shell |
| `extension/scripts/sidepanel.js` | **Authoritative** side panel logic (mounted in sidepanel.html) |
| `extension/popup/popup.html` | Popup UI (for toolbar button click) |
| `extension/popup/popup.js` | Popup logic |
| `extension/privacy.html` | In-extension privacy policy |

## Background Service Worker

`extension/background.js` handles:
- Auth state bridge between web app and extension (reads cookies/session)
- Message routing (`chrome.runtime.onMessage`) between content scripts, side panel, and popup
- Email prediction via `extension/background/email-predictor.js`

## Content Scripts

| File | Purpose |
|------|---------|
| `extension/content/email-scanner.js` | Extracts emails from any web page |
| `extension/content/linkedin-extractor.js` | Extracts contact data from LinkedIn profiles |
| `extension/content/linkedin-company-extractor.js` | Extracts company data from LinkedIn company pages |

## Side Panel Components

All built as vanilla JS modules mounted by `scripts/sidepanel.js`:

| File | Purpose |
|------|---------|
| `extension/components/contact-card.js` | Contact card UI |
| `extension/components/draft-editor.js` | Email draft editor in side panel |
| `extension/components/draft-stats-panel.js` | Draft analytics display |
| `extension/components/email-type-selector.js` | Select email type (cold outreach, follow-up, etc.) |
| `extension/components/generate-draft-button.js` | Trigger AI draft generation |
| `extension/components/gmail-action-button.js` | One-click compose in Gmail |

## Views

| File | Purpose |
|------|---------|
| `extension/views/draft-view.js` | Full draft composition view |

## Utilities

| File | Purpose |
|------|---------|
| `extension/lib/supabase.js` | Supabase browser client for extension |
| `extension/lib/vendor/supabase.js` | Vendored Supabase (no npm build) |
| `extension/lib/sync.js` | Sync logic for contact push to web app |
| `extension/lib/syncQueue.js` | Queue manager for batched sync |
| `extension/utils/analytics.js` | Event tracking from extension |
| `extension/utils/draft-analytics.js` | Draft quality/usage analytics |
| `extension/utils/empty-states.js` | Empty state rendering helpers |
| `extension/utils/pattern-cache.js` | Client-side email pattern cache |
| `extension/utils/quota.js` | Quota check against web app API |
| `extension/utils/role-detector.js` | Detect LinkedIn role from page context |
| `extension/utils/safety.js` | Safety checks (suppress sending to bad domains) |
| `extension/utils/saved-templates.js` | Load saved templates from web app |

## Templates

| File | Purpose |
|------|---------|
| `extension/templates/recruiter-templates.js` | Hardcoded recruiter-focused email templates |

## Auth Bridge

The extension authenticates via the web app session:
1. Extension background reads the Supabase session cookie set by the web app.
2. `app/extension-auth/page.tsx` acts as an auth bridge page — extension opens this page in a tab, extracts the session, closes the tab.
3. Session is stored in `chrome.storage.local` for subsequent API calls.

## Sync API Routes (Web App Side)

| Route | Purpose |
|-------|---------|
| `POST /api/extension/sync-contact` | Push a single contact from extension to DB |
| `POST /api/extension/sync-batch` | Push batch of contacts from extension to DB |
| `POST /api/extension-errors` | Log extension-side errors to server |

Sync utilities live in `app/api/extension/_lib/sync-utils.ts`.

## Layout Rules (Side Panel)

- Fixed width side panel (Chrome constraint)
- Vanilla JS + CSS (no React/bundler — loaded directly by browser)
- All UI state managed via DOM manipulation in `scripts/sidepanel.js`
- Templates from `extension/utils/saved-templates.js` pull from web app API

## Extension-Specific Env

- `NEXT_PUBLIC_CHROME_EXTENSION_ID` — required for CORS allowlist on sync routes
