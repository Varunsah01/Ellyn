import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, encryptToken } from "@/lib/gmail-helper";
import { supabase } from "@/lib/supabase";
import { captureApiException } from '@/lib/monitoring/sentry'

export const dynamic = "force-dynamic";

/**
 * Handle GET requests for `/api/gmail/oauth`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/gmail/oauth request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/gmail/oauth
 * fetch('/api/gmail/oauth')
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle user cancellation
    if (error === "access_denied") {
      return NextResponse.redirect(
        new URL("/dashboard?tab=settings&status=cancelled", request.url)
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code not found" },
        { status: 400 }
      );
    }

    // Get stored credentials from Supabase
    const { data: credentials, error: credError } = await supabase
      .from("gmail_credentials")
      .select("client_id, client_secret")
      .single();

    if (credError || !credentials) {
      return NextResponse.redirect(
        new URL("/dashboard?tab=settings&status=no_credentials", request.url)
      );
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/oauth`;
    const tokenResponse = await exchangeCodeForTokens(
      code,
      credentials.client_id,
      credentials.client_secret,
      redirectUri
    );

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = encryptToken(tokenResponse.refresh_token);

    // Update credentials with tokens
    const { error: updateError } = await supabase
      .from("gmail_credentials")
      .update({
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
      })
      .eq("client_id", credentials.client_id);

    if (updateError) {
      console.error("Error saving tokens:", updateError);
      return NextResponse.redirect(
        new URL("/dashboard?tab=settings&status=save_failed", request.url)
      );
    }

    // Success redirect
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&status=success", request.url)
    );
  } catch (error) {
    console.error("OAuth error:", error);
    captureApiException(error, { route: '/api/gmail/oauth', method: 'GET' })
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&status=error", request.url)
    );
  }
}
