> DEPRECATED: This service is no longer used.  
> Email verification is now handled by ZeroBounce API via /api/v1/zerobounce-verify.

# SMTP Probe Service

Standalone Node.js SMTP probe microservice for deliverability probing.  
This service runs on a VPS and is **not part of the Next.js app runtime**.

## Why this is separate

- This service must open raw outbound SMTP connections on port `25`.
- Vercel runs on AWS networking where outbound port `25` is blocked.
- Therefore this service must be deployed outside Vercel (for example, a VPS).

## Deploy

1. Copy environment values:
   - `SMTP_PROBE_SECRET`
   - `PORT` (optional, defaults to `3001`)
2. Install dependencies:
   - `npm install`
3. Start service:
   - `node index.js`
   - or with PM2: `pm2 start index.js --name smtp-probe`

## Required network ports

- Inbound `3001` (from your API/app servers such as Vercel).
- Outbound `25` (to recipient mail servers for SMTP handshake probing).

## Endpoints

- `POST /probe`
- `GET /health`
