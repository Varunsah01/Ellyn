# Email Sending (Gmail + Outlook Integration)

Last updated: 2026-03-04

## Architecture Overview

Ellyn uses **app-owned Google OAuth 2.0 credentials** to connect users' Gmail accounts for outreach. Users never see or manage their own Google Cloud projects.

### OAuth Flow

```
User clicks "Connect Gmail" (Settings page)
  → GET /api/v1/auth/gmail
    → Auth guard (cookie-based session)
    → Generate CSRF state token → store in HTTP-only cookie
    → Redirect to Google OAuth consent screen
  → Google redirects to /api/gmail/oauth?code=...&state=...
    → Validate CSRF state against cookie
    → Exchange code for tokens (app-level client ID/secret from env)
    → Fetch Gmail email via /gmail/v1/users/me/profile
    → Encrypt tokens with AES-256-GCM
    → Upsert into gmail_credentials (scoped to user_id)
    → Redirect to /dashboard/settings?tab=account&gmail=success
```

### Token Security

- **Encryption**: AES-256-GCM (Node.js `crypto` module)
- **Format**: `iv:tag:ciphertext` (all base64, colon-separated)
- **Key**: `GMAIL_TOKEN_ENCRYPTION_KEY` env var (64-char hex = 32 bytes)
- **Backward compatibility**: `decryptToken()` detects legacy base64 (no `:`) and falls back

### Proactive Token Refresh

The send route checks `token_expires_at` before each send. If the token expires within 5 minutes, it proactively refreshes using the stored refresh token. If refresh fails (token revoked), returns `gmail_reauth_required` error code.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM (`openssl rand -hex 32`) |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/gmail` | GET | Initiate OAuth flow (redirects to Google) |
| `/api/gmail/oauth` | GET | OAuth callback (exchanges code, stores tokens) |
| `/api/gmail/send` | POST | Send email via Gmail API |
| `/api/gmail/status` | GET | Check Gmail connection status |
| `/api/gmail/disconnect` | POST | Revoke tokens and delete credentials |

All routes (except the OAuth callback) also have `/api/v1/` versioned wrappers.

### POST /api/gmail/send — Request Body

```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "body": "<p>Email body</p>",
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

## Database Tables

### gmail_credentials

Stores per-user OAuth tokens (encrypted). Key columns:
- `user_id` (PK, FK to auth.users)
- `access_token`, `refresh_token` — AES-256-GCM encrypted
- `gmail_email` — the connected Gmail address
- `token_expires_at` — for proactive refresh
- `encrypted_version` — 1 = legacy base64, 2 = AES-256-GCM

### email_history

Logs all sent emails. Key columns:
- `user_id` — owner of the sent email
- `contact_id` — optional link to contacts table
- `from_email` — sender's Gmail address
- `to_email`, `subject`, `body`, `gmail_message_id`, `status`

## Sequence Engine Integration

`lib/sequence-engine.ts` exports `sendViaGmailApi()` which makes an internal fetch to `/api/gmail/send`. This is a thin integration point; full server-to-server refactor is planned for a follow-up PR.

---

## Outlook Integration

### Architecture Overview

Uses **Microsoft Graph API** with delegated OAuth 2.0 (app-owned Azure AD credentials). Mirrors the Gmail integration pattern.

### OAuth Flow

```
User clicks "Connect Outlook" (Settings page)
  → GET /api/v1/auth/outlook
    → Auth guard (cookie-based session)
    → Generate CSRF state token → store in HTTP-only cookie
    → Redirect to Microsoft OAuth consent screen
  → Microsoft redirects to /api/outlook/oauth?code=...&state=...
    → Validate CSRF state against cookie
    → Exchange code for tokens
    → Fetch Outlook email via /me (Graph API)
    → Encrypt tokens with AES-256-GCM
    → Upsert into outlook_credentials (scoped to user_id)
    → Redirect to /dashboard/settings?tab=account&outlook=success
```

### Core Files

- `lib/outlook-helper.ts` — AES-256-GCM encryption; exports `encryptToken`, `decryptToken`, `getMicrosoftClientId`, `getMicrosoftClientSecret`, `getAuthUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `getOutlookEmail`, `sendEmail` / `OutlookSendOptions`
- `lib/types/integrations.ts` — `GmailStatus`, `OutlookStatus`, `EmailIntegrationStatus` types

### Token Security

- Same AES-256-GCM pattern as Gmail (`iv:tag:ciphertext`, colon-separated, all base64)
- Key: `OUTLOOK_TOKEN_ENCRYPTION_KEY` env var (64-char hex = 32 bytes; generate with `openssl rand -hex 32`)

### Proactive Token Refresh

Send route performs proactive refresh before each send. On 401, retries once. If refresh fails, returns `outlook_reauth_required`.

Note: Microsoft has no token revocation endpoint; disconnect simply deletes the DB row.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `MICROSOFT_CLIENT_ID` | Azure AD Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Azure AD client secret |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | 64-char hex for AES-256-GCM (`openssl rand -hex 32`) |

Azure redirect URI: `https://www.useellyn.com/api/outlook/oauth`
Required scopes (delegated): `Mail.Send`, `Mail.Read`, `User.Read`, `offline_access`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/outlook` | GET | Initiate OAuth flow (redirects to Microsoft) |
| `/api/outlook/oauth` | GET | OAuth callback (exchanges code, stores tokens) |
| `/api/outlook/send` | POST | Send email via Graph API |
| `/api/outlook/status` | GET | Check Outlook connection status |
| `/api/outlook/disconnect` | DELETE | Delete credentials row (no MS revocation) |

V1 wrappers exist for status, send, disconnect via re-export under `app/api/v1/outlook/`.

### POST /api/outlook/send — Request Body

Same shape as Gmail send. `OutlookSendOptions` from `lib/outlook-helper.ts`.

### GET /api/outlook/status — Response

```json
{
  "connected": true,
  "outlookEmail": "user@outlook.com",
  "connectedAt": "2026-03-01T12:00:00Z"
}
```

### Database Table

**`outlook_credentials`** (migration `031_outlook_credentials.sql`)

- `user_id` (PK, FK to auth.users)
- `access_token`, `refresh_token` — AES-256-GCM encrypted
- `outlook_email` — connected address
- `token_expires_at`

### Required Migration

Run `lib/db/migrations/031_outlook_credentials.sql` in Supabase SQL editor before using Outlook features.

---

## Shared UI

- `hooks/useEmailIntegrations.ts` — fetches both Gmail and Outlook statuses in parallel; exposes `disconnectGmail`, `disconnectOutlook`, `refreshGmail`, `refreshOutlook`
- `components/settings/EmailIntegrationCard.tsx` — skeleton loading, connected/disconnected state, AlertDialog disconnect confirmation for both providers
- `app/dashboard/settings/page.tsx` — uses hook + component; cleans up OAuth query params via `router.replace` after showing toast
