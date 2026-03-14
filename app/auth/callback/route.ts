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

    let redirectOrigin = origin;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    if (!isLocalEnv && forwardedHost) {
      redirectOrigin = `https://${forwardedHost}`;
    }

    if (error) {
      // Check if user is already logged in (mitigates double-request race condition in Strict Mode/Prefetching)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        return NextResponse.redirect(new URL(next, redirectOrigin));
      }

      const loginUrl = new URL("/auth/login", redirectOrigin);
      loginUrl.searchParams.set("oauth_error", error.message);
      const nextParam = requestUrl.searchParams.get("next");
      if (nextParam) loginUrl.searchParams.set("redirect", sanitizeNextPath(nextParam));
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL(next, redirectOrigin));
  } catch (error) {
    let redirectOrigin = origin;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    if (!isLocalEnv && forwardedHost) {
      redirectOrigin = `https://${forwardedHost}`;
    }
    const loginUrl = new URL("/auth/login", redirectOrigin);
    loginUrl.searchParams.set(
      "oauth_error",
      error instanceof Error ? error.message : "OAuth callback failed"
    );
    return NextResponse.redirect(loginUrl);
  }
}
