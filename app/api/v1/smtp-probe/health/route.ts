import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.SMTP_PROBE_SERVICE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  try {
    const res = await fetch(`${url}/metrics`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: `upstream_${res.status}` }, { status: 503 });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: 'unreachable' }, { status: 503 });
  }
}
