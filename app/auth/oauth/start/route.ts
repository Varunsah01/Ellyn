import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function sanitizeNextPath(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function resolveRedirectOrigin(request: NextRequest): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (!isLocalEnv && forwardedHost) {
    return `https://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const provider = requestUrl.searchParams.get("provider");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const redirectOrigin = resolveRedirectOrigin(request);

  if (provider !== "google") {
    const loginUrl = new URL("/auth/login", redirectOrigin);
    loginUrl.searchParams.set("oauth_error", "Unsupported OAuth provider");
    loginUrl.searchParams.set("redirect", next);
    return NextResponse.redirect(loginUrl);
  }

  const callbackUrl = new URL("/auth/callback", redirectOrigin);
  callbackUrl.searchParams.set("next", next);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error || !data.url) {
      const loginUrl = new URL("/auth/login", redirectOrigin);
      loginUrl.searchParams.set("oauth_error", error?.message ?? "Failed to start OAuth sign in");
      loginUrl.searchParams.set("redirect", next);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(data.url);
  } catch (error) {
    const loginUrl = new URL("/auth/login", redirectOrigin);
    loginUrl.searchParams.set(
      "oauth_error",
      error instanceof Error ? error.message : "Failed to start OAuth sign in"
    );
    loginUrl.searchParams.set("redirect", next);
    return NextResponse.redirect(loginUrl);
  }
}
