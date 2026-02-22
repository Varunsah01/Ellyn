import { withCsrfHeaders } from "@/lib/csrf";
import { createClient } from "@/lib/supabase/client";
import { supabase as legacySupabase } from "@/lib/supabase";

function firstNonEmptyToken(candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const token = candidate.trim();
    if (token) return token;
  }
  return "";
}

function readAccessTokenFromLocalStorage(): string {
  if (typeof window === "undefined") return "";

  try {
    const keys = Object.keys(window.localStorage).filter((key) =>
      /^sb-[a-z0-9]+-auth-token$/i.test(key)
    );

    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as
          | { access_token?: unknown; currentSession?: { access_token?: unknown } | null; session?: { access_token?: unknown } | null }
          | null;

        const token = firstNonEmptyToken([
          typeof parsed?.access_token === "string" ? parsed.access_token : "",
          typeof parsed?.currentSession?.access_token === "string" ? parsed.currentSession.access_token : "",
          typeof parsed?.session?.access_token === "string" ? parsed.session.access_token : "",
        ]);
        if (token) return token;
      } catch {
        // Skip malformed localStorage entries.
      }
    }
  } catch {
    // localStorage can throw in strict environments.
  }

  return "";
}

async function resolveAccessToken(): Promise<string> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = firstNonEmptyToken([session?.access_token]);
    if (token) return token;
  } catch {
    // Continue to fallbacks.
  }

  try {
    const {
      data: { session },
    } = await legacySupabase.auth.getSession();
    const token = firstNonEmptyToken([session?.access_token]);
    if (token) return token;
  } catch {
    // Continue to localStorage fallback.
  }

  return readAccessTokenFromLocalStorage();
}

async function buildAuthedInit(init?: RequestInit): Promise<RequestInit> {
  const headers = new Headers(init?.headers ?? {});

  try {
    const accessToken = await resolveAccessToken();
    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  } catch {
    // Best effort: unauthenticated requests can still proceed for public endpoints.
  }

  return withCsrfHeaders({
    ...(init ?? {}),
    headers,
  });
}

/**
 * Performs a client-side fetch with Supabase bearer token (if available).
 */
export async function supabaseAuthedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const authedInit = await buildAuthedInit(init);
  return fetch(input, authedInit);
}
