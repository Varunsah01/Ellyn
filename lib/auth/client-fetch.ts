import { withCsrfHeaders } from "@/lib/csrf";
import { createClient } from "@/lib/supabase/client";

async function buildAuthedInit(init?: RequestInit): Promise<RequestInit> {
  const headers = new Headers(init?.headers ?? {});

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token?.trim();
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
