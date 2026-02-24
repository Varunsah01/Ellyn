import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint has been deprecated. Email verification is now handled by the SMTP probe pipeline.',
      code: 'DEPRECATED',
    },
    { status: 410 }
  )
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
