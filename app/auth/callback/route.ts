import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function sanitizeNextPath(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const origin = requestUrl.origin;

  if (oauthError) {
    const loginUrl = new URL("/auth/login", origin);
    loginUrl.searchParams.set("oauth_error", oauthError);
    const nextParam = requestUrl.searchParams.get("next");
    if (nextParam) loginUrl.searchParams.set("redirect", sanitizeNextPath(nextParam));
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL("/auth/login", origin);
    loginUrl.searchParams.set("oauth_error", "Missing OAuth code");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const loginUrl = new URL("/auth/login", origin);
      loginUrl.searchParams.set("oauth_error", error.message);
      const nextParam = requestUrl.searchParams.get("next");
      if (nextParam) loginUrl.searchParams.set("redirect", sanitizeNextPath(nextParam));
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL(next, origin));
  } catch (error) {
    const loginUrl = new URL("/auth/login", origin);
    loginUrl.searchParams.set(
      "oauth_error",
      error instanceof Error ? error.message : "OAuth callback failed"
    );
    return NextResponse.redirect(loginUrl);
  }
}
