import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  console.info("[api/v1/settings/test-smtp] payload:", payload);
  return NextResponse.json({ ok: true });
}
