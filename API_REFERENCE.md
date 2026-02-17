# AI API Reference

Base routes are under `/api/ai/*`.

## 1) Enhance Draft

`POST /api/ai/enhance-draft`

Request:
```json
{
  "draft": "string",
  "action": "enhance | shorten | lengthen | fix-grammar",
  "additionalContext": {
    "tone": "professional",
    "company": "Google",
    "userName": "Alex",
    "userSchool": "Stanford"
  }
}
```

Response:
```json
{
  "success": true,
  "enhancedDraft": "string",
  "originalLength": 78,
  "newLength": 92,
  "tokensUsed": { "input": 123, "output": 210, "total": 333 },
  "cost": 0.0002
}
```

## 2) Customize Tone

`POST /api/ai/customize-tone`

Request:
```json
{
  "draft": "string",
  "targetTone": "professional | casual | friendly | formal | enthusiastic"
}
```

Response:
```json
{
  "success": true,
  "customizedDraft": "string",
  "tokensUsed": { "input": 90, "output": 130, "total": 220 },
  "cost": 0.0001
}
```

## 3) Generate Template

`POST /api/ai/generate-template`

Request:
```json
{
  "templateType": "recruiter | referral | advice | follow-up | thank-you | custom",
  "instructions": "Focus on backend roles",
  "context": {
    "userName": "Alex",
    "userSchool": "Stanford",
    "userMajor": "CS"
  },
  "targetRole": "Software Engineer",
  "targetCompany": "Google"
}
```

Response:
```json
{
  "success": true,
  "template": {
    "subject": "Interested in backend roles at Google",
    "body": "Hi {{firstName}}, ..."
  },
  "tokensUsed": { "input": 140, "output": 180, "total": 320 },
  "cost": 0.0002
}
```

## Errors

- `400`: invalid request payload
- `405`: non-POST method
- `429`: rate limit reached
- `500`: model or server failure

## Rate Limits

- Hourly: 100 operations per identifier
- Monthly: 500 operations per identifier

Current limiter is in-memory and should be replaced with durable storage in multi-instance production.

## CSRF Protection

Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) are CSRF-protected.

### Browser clients (cookie-authenticated)

1. Send an initial `GET` request to any app/API route.
2. Read the CSRF token from either:
   - response header: `X-CSRF-Token`
   - cookie: `csrf_token`
3. Include the token on every mutating request:
   - header: `X-CSRF-Token: <token>`
   - or form field: `_csrf=<token>`

If the token is missing or invalid, the API returns:

```json
{
  "success": false,
  "error": "Invalid CSRF token",
  "code": "CSRF_INVALID"
}
```

Status code: `403`

### External integrations (Bearer token flows)

Requests using `Authorization: Bearer <token>` without browser session cookies are treated as non-cookie clients and are not blocked by CSRF checks. This is intended for server-to-server and extension integrations.

Recommended practice for external integrations:
- Always send `Authorization: Bearer <token>`
- Prefer HTTPS only
- Do not rely on browser cookies for auth
