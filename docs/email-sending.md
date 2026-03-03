# Email Sending (Gmail Integration)

Last updated: 2026-03-03

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
