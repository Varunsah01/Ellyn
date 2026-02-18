import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ key: "sk-ellyn-demo-key-123", used: 0, limit: 1000 });
}

export async function POST() {
  return NextResponse.json({ key: "sk-ellyn-demo-key-456", used: 0, limit: 1000 });
}
