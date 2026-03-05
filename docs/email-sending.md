# Email Sending (Gmail + Outlook Integration)

Last updated: 2026-03-05

## Purpose

Ellyn integrates with Gmail and Outlook to send outreach emails on behalf of users. Users connect their email accounts via OAuth, and the app handles token management, proactive refresh, encryption, and send execution. This is used for direct email sending from the dashboard and for automated sequence execution.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│ Email Sending System                                      │
│                                                           │
│  Dashboard / Sequence Engine                              │
│  ├── User clicks "Send" or sequence step triggers         │
│  │                                                        │
│  ▼                                                        │
│  POST /api/gmail/send   OR   POST /api/outlook/send       │
│  ├── Auth check (user session)                            │
│  ├── Decrypt stored tokens (AES-256-GCM)                  │
│  ├── Check token_expires_at                               │
│  │   └── If < 5 min → proactive refresh                   │
│  ├── Send via Gmail API / Microsoft Graph API              │
│  ├── Log to email_history table                           │
│  ├── Update contact status (contacted/sent)               │
│  └── Track email (tracking pixel, link wrapping)          │
│                                                           │
│  Token Storage (encrypted at rest)                        │
│  ├── gmail_credentials (AES-256-GCM)                      │
│  └── outlook_credentials (AES-256-GCM)                    │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **App-owned OAuth credentials**: Ellyn uses its own Google Cloud and Azure AD app credentials. Users never see or manage their own OAuth apps — they just click "Connect" and authorize.

2. **AES-256-GCM encryption**: All OAuth tokens are encrypted before DB storage using AES-256-GCM. The encryption key is stored as an environment variable, never in the database. Format: `iv:tag:ciphertext` (all base64, colon-separated).

3. **Proactive token refresh**: Before each send, the token expiry is checked. If the token expires within 5 minutes, it's refreshed proactively. This prevents "token expired" errors during sends.

4. **Retry on 401**: If a send fails with 401 (Unauthorized), the system refreshes the token and retries once. If the refresh fails (token revoked), it returns a `*_reauth_required` error code.

5. **Separate encryption keys**: Gmail and Outlook use separate encryption keys (`GMAIL_TOKEN_ENCRYPTION_KEY` and `OUTLOOK_TOKEN_ENCRYPTION_KEY`) so a compromise of one doesn't affect the other.

6. **Sequence engine integration**: `lib/sequence-engine.ts` calls `/api/gmail/send` via internal fetch. This reuses the full token refresh + encryption + logging pipeline rather than duplicating it.

---

## What Is Accomplished

### Gmail Integration — Complete

| Feature | Status | Details |
|---------|--------|---------|
| OAuth 2.0 flow | ✅ | CSRF state in cookie, Google consent screen, code exchange |
| Token encryption (AES-256-GCM) | ✅ | `iv:tag:ciphertext` format with backward compatibility |
| Proactive token refresh | ✅ | Checks `token_expires_at`, refreshes if < 5 min remaining |
| Send via Gmail API | ✅ | MIME message construction, HTML support, Gmail API v1 |
| Connection status check | ✅ | Returns connected state, email address, connection date |
| Disconnect (revoke + delete) | ✅ | Revokes token at Google, deletes DB row |
| Email history logging | ✅ | All sends logged in `email_history` |
| Contact/Lead linking | ✅ | Send requires `contactId` or `leadId` for tracking |
| Legacy token migration | ✅ | `decryptToken()` handles legacy base64 format |
| Sequence engine integration | ✅ | `sendViaGmailApi()` in sequence engine |

### Outlook Integration — Complete

| Feature | Status | Details |
|---------|--------|---------|
| OAuth 2.0 flow | ✅ | CSRF state in cookie, Microsoft consent screen, code exchange |
| Token encryption (AES-256-GCM) | ✅ | Same pattern as Gmail, separate encryption key |
| Proactive token refresh | ✅ | Same pattern as Gmail |
| Send via MS Graph API | ✅ | `/me/sendMail` endpoint with HTML support |
| Connection status check | ✅ | Returns connected state, email address, connection date |
| Disconnect | ✅ | Deletes DB row (Microsoft has no token revocation endpoint) |
| Email history logging | ✅ | Same `email_history` table as Gmail |
| Retry on 401 | ✅ | Token refresh + retry on authentication failure |

### Shared UI — Complete

| Feature | Status | Details |
|---------|--------|---------|
| `useEmailIntegrations` hook | ✅ | Fetches both statuses in parallel, handles connect/disconnect |
| `EmailIntegrationCard` component | ✅ | Skeleton loading, connected/disconnected UI, AlertDialog disconnect confirmation |
| Settings page integration | ✅ | Uses hook + component, cleans up OAuth query params after toast |
| Email tracking pixels | ✅ | Tracking pixel insertion for open tracking |
| Link click tracking | ✅ | Link wrapping for click tracking |

---

## What Is Not Yet Accomplished

| Feature | Status | Notes |
|---------|--------|-------|
| Outlook in sequence engine | ⚠️ Not wired | Outlook send route exists, but sequence engine only calls Gmail |
| Email thread/conversation view | ❌ Not started | No UI to view email threads; only flat send history |
| Reply detection (real-time) | ❌ Not started | Cron-based polling only (`/api/cron/check-replies`) |
| Attachment sending | ❌ Not started | Gmail/Outlook APIs support attachments, but not implemented in send routes |
| Email scheduling (send later) | ❌ Not started | No delayed send support |
| Multiple account support | ❌ Not started | One Gmail + one Outlook per user only |
| Read receipt tracking | ❌ Not started | Only open/click tracking via pixel/link |
| Bounce handling (webhooks) | ❌ Not started | No Gmail/Outlook webhook for bounce notifications |
| DKIM/SPF verification UI | ❌ Not started | No UI to verify domain sending configuration |
| Email signature management | ❌ Not started | No saved signatures; user must include in body |

---

## Gmail OAuth Flow (Detailed)

```
1. User clicks "Connect Gmail" on Settings page
   │
   ▼
2. GET /api/v1/auth/gmail
   ├── Auth guard (cookie-based session)
   ├── Generate cryptographic CSRF state token
   ├── Store state in HTTP-only cookie (5 min expiry)
   ├── Build Google OAuth URL with scopes:
   │   gmail.send, gmail.readonly, userinfo.email
   └── 302 Redirect to Google OAuth consent screen
   │
   ▼
3. User authorizes on Google
   │
   ▼
4. Google redirects to /api/gmail/oauth?code=...&state=...
   ├── Validate CSRF state against cookie
   ├── Exchange authorization code for tokens
   │   (access_token, refresh_token, expires_in)
   ├── Fetch Gmail address via /gmail/v1/users/me/profile
   ├── Encrypt access_token and refresh_token (AES-256-GCM)
   ├── Upsert into gmail_credentials:
   │   user_id, access_token, refresh_token, gmail_email,
   │   token_expires_at, encrypted_version=2
   └── 302 Redirect to /dashboard/settings?tab=account&gmail=success
   │
   ▼
5. Settings page shows toast + refreshes integration status
```

---

## Outlook OAuth Flow (Detailed)

```
1. User clicks "Connect Outlook" on Settings page
   │
   ▼
2. GET /api/v1/auth/outlook
   ├── Auth guard (cookie-based session)
   ├── Check MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET
   │   └── If missing → redirect with ?reason=misconfigured
   ├── Generate CSRF state token → store in cookie
   ├── Build Microsoft OAuth URL with scopes:
   │   Mail.Send, Mail.Read, User.Read, offline_access
   └── 302 Redirect to Microsoft consent screen
   │
   ▼
3. User authorizes on Microsoft
   │
   ▼
4. Microsoft redirects to /api/outlook/oauth?code=...&state=...
   ├── Validate CSRF state against cookie
   │   └── Mismatch → redirect with ?reason=csrf
   ├── Exchange code for tokens
   ├── Fetch email via /me (Microsoft Graph API)
   ├── Encrypt tokens (AES-256-GCM)
   ├── Upsert into outlook_credentials
   └── 302 Redirect to /dashboard/settings?tab=account&outlook=success
   │
   ▼
5. Settings page shows toast + refreshes integration status
```

---

## Token Security

### Encryption Details

| Aspect | Implementation |
|--------|---------------|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key size | 256-bit (64-char hex string = 32 bytes) |
| IV | Random 12 bytes per encryption |
| Auth tag | 16 bytes |
| Storage format | `base64(iv):base64(tag):base64(ciphertext)` |
| Key generation | `openssl rand -hex 32` |

### Key Management

- Gmail key: `GMAIL_TOKEN_ENCRYPTION_KEY` env var
- Outlook key: `OUTLOOK_TOKEN_ENCRYPTION_KEY` env var
- Keys are never stored in DB or committed to code
- Each provider uses a separate key (isolation)

### Backward Compatibility

- `decryptToken()` detects legacy format (no `:` delimiter = old base64 encoding)
- Legacy tokens are decrypted with fallback, then re-encrypted on next token refresh
- `encrypted_version` column tracks format: 1 = legacy, 2 = AES-256-GCM

---

## API Routes

### Gmail

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/gmail` | GET | Initiate OAuth flow (redirects to Google) |
| `/api/gmail/oauth` | GET | OAuth callback (exchanges code, stores tokens) |
| `/api/gmail/send` | POST | Send email via Gmail API |
| `/api/gmail/status` | GET | Check Gmail connection status |
| `/api/gmail/disconnect` | POST | Revoke tokens and delete credentials |

V1 wrappers exist for all routes under `/api/v1/gmail/`.

### Outlook

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/outlook` | GET | Initiate OAuth flow (redirects to Microsoft) |
| `/api/outlook/oauth` | GET | OAuth callback (exchanges code, stores tokens) |
| `/api/outlook/send` | POST | Send email via Microsoft Graph API |
| `/api/outlook/status` | GET | Check Outlook connection status |
| `/api/outlook/disconnect` | DELETE | Delete credentials row (no MS revocation endpoint) |

V1 wrappers exist for status, send, disconnect under `/api/v1/outlook/`.

---

## Request/Response Shapes

### POST /api/gmail/send (or /api/outlook/send) — Request

```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "body": "<p>Email body with HTML</p>",
  "isHtml": true,
  "contactId": "uuid-optional",
  "leadId": "uuid-optional"
}
```

At least one of `contactId` or `leadId` must be provided.

### GET /api/gmail/status — Response

```json
{
  "connected": true,
  "gmailEmail": "user@gmail.com",
  "connectedAt": "2026-03-01T12:00:00Z"
}
```

### GET /api/outlook/status — Response

```json
{
  "connected": true,
  "outlookEmail": "user@outlook.com",
  "connectedAt": "2026-03-01T12:00:00Z"
}
```

---

## Database Tables

### `gmail_credentials`

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | UUID (PK) | FK to auth.users |
| `access_token` | TEXT | AES-256-GCM encrypted |
| `refresh_token` | TEXT | AES-256-GCM encrypted |
| `gmail_email` | TEXT | Connected Gmail address |
| `token_expires_at` | TIMESTAMPTZ | For proactive refresh |
| `encrypted_version` | INT | 1 = legacy, 2 = AES-256-GCM |

Migrations: 025 (base table), 027 (production columns)

### `outlook_credentials`

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | UUID (PK) | FK to auth.users |
| `access_token` | TEXT | AES-256-GCM encrypted |
| `refresh_token` | TEXT | AES-256-GCM encrypted |
| `outlook_email` | TEXT | Connected Outlook address |
| `token_expires_at` | TIMESTAMPTZ | For proactive refresh |

Migration: 031

### `email_history`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID (PK) | |
| `user_id` | UUID | Owner of the sent email |
| `contact_id` | UUID | Optional link to contacts |
| `from_email` | TEXT | Sender's email address |
| `to_email` | TEXT | Recipient email |
| `subject` | TEXT | Email subject |
| `body` | TEXT | Email body |
| `gmail_message_id` | TEXT | Gmail API message ID |
| `status` | TEXT | sent, failed, bounced |
| `sequence_enrollment_id` | UUID | Link to sequence (migration 033) |
| `provider_thread_id` | TEXT | Thread ID for reply polling (migration 033) |

---

## Core Files

| File | Purpose |
|------|---------|
| `lib/gmail-helper.ts` | Gmail OAuth helpers (token exchange, refresh, profile fetch) |
| `lib/gmail-send.ts` | Gmail send implementation (MIME construction, API call) |
| `lib/outlook-helper.ts` | Outlook OAuth + encryption: `encryptToken`, `decryptToken`, `getAuthUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `getOutlookEmail`, `sendEmail` |
| `lib/types/integrations.ts` | `GmailStatus`, `OutlookStatus`, `EmailIntegrationStatus` types |
| `hooks/useEmailIntegrations.ts` | Fetches both statuses in parallel; `disconnectGmail/Outlook`, `refreshGmail/Outlook` |
| `components/settings/EmailIntegrationCard.tsx` | Connected/disconnected UI for both providers |
| `lib/sequence-engine.ts` | `sendViaGmailApi()` — internal fetch to `/api/gmail/send` for sequence execution |

---

## Environment Variables

### Gmail

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM (`openssl rand -hex 32`) |

### Outlook

| Variable | Purpose |
|----------|---------|
| `MICROSOFT_CLIENT_ID` | Azure AD Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Azure AD client secret |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | 64-char hex for AES-256-GCM (`openssl rand -hex 32`) |

Azure redirect URI: `https://www.useellyn.com/api/outlook/oauth`
Required scopes (delegated): `Mail.Send`, `Mail.Read`, `User.Read`, `offline_access`

---

## Sequence Engine Integration

`lib/sequence-engine.ts` exports `sendViaGmailApi()`:

```
Sequence Engine → sendViaGmailApi(params)
  → Internal fetch to POST /api/gmail/send
  → Full pipeline: token decrypt → refresh check → send → log to email_history
```

**Current limitation**: Only Gmail is wired. To support Outlook in sequences, a similar `sendViaOutlookApi()` function needs to be added that calls `/api/outlook/send`.

**Future architecture consideration**: The internal fetch approach (sequence engine → API route → send) adds HTTP overhead. A direct function call approach (sequence engine → `lib/gmail-send.ts` directly) would be more efficient but requires refactoring token management.

---

## Email Tracking Integration

When emails are sent:
1. A tracking pixel (`<img>`) is inserted into the HTML body → tracks opens via `GET /api/track/open`
2. Links are optionally wrapped to track clicks via `GET /api/track/click`
3. Events are stored in `email_tracking_events` table
4. Migration 033 adds `idempotency_key` for open event deduplication
