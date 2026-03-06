import { NextResponse } from 'next/server'

const DEPRECATION_RESPONSE = {
  success: false,
  error: 'Deprecated endpoint. Use /api/email-feedback.',
}

export async function POST() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 })
}

export async function GET() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 })
}
