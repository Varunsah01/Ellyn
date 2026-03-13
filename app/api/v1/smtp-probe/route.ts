import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'SMTP probe replaced by Emailable verification. Use /api/v1/email-verify instead.',
      code: 'DEPRECATED',
    },
    { status: 410 }
  )
}

export async function GET() {
  const emailValidationConfigured = !!process.env.EMAILABLE_API_KEY?.trim()

  return NextResponse.json({
    ok: true,
    smtpConfigured: emailValidationConfigured,
    emailValidationConfigured,
  })
}
