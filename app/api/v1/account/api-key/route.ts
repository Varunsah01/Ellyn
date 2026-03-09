import { NextResponse } from "next/server";

const DISABLED_RESPONSE = {
  error: "API key endpoint is disabled in production hardening mode.",
  code: "API_KEY_ENDPOINT_DISABLED",
};

export async function GET() {
  return NextResponse.json(DISABLED_RESPONSE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(DISABLED_RESPONSE, { status: 410 });
}
