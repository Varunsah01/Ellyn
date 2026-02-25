import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'SMTP probe replaced by ZeroBounce. Use /api/v1/zerobounce-verify instead.',
      code: 'DEPRECATED',
    },
    { status: 410 }
  )
}

export async function GET() {
  const serviceUrl = process.env.SMTP_PROBE_SERVICE_URL?.trim() || ''
  return NextResponse.json({ ok: true, smtpConfigured: !!serviceUrl && !!process.env.SMTP_PROBE_SECRET })
}
