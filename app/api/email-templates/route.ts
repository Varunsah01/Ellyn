/**
 * @deprecated Use /api/templates or /api/v1/templates instead.
 * This route proxies to /api/templates for backwards compatibility.
 */
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL('/api/templates', request.url);
  return fetch(url.toString(), { headers: request.headers });
}

export async function POST(request: NextRequest) {
  const url = new URL('/api/templates', request.url);
  return fetch(url.toString(), {
    method: 'POST',
    headers: request.headers,
    body: await request.text(),
  });
}
