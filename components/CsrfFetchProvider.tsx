"use client";

import { useEffect } from "react";
import { CSRF_HEADER_NAME, getCsrfTokenFromDocument } from "@/lib/csrf";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isApiRequestUrl(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false;

  if (input instanceof Request) {
    const url = new URL(input.url, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  }

  const raw = typeof input === "string" ? input : input.toString();
  const url = new URL(raw, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return String(init.method).toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

/**
 * Render the CsrfFetchProvider component.
 * @returns {unknown} JSX output for CsrfFetchProvider.
 * @example
 * <CsrfFetchProvider />
 */
export function CsrfFetchProvider() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isApiRequestUrl(input)) {
        return originalFetch(input, init);
      }

      const method = resolveMethod(input, init);
      if (!MUTATING_METHODS.has(method)) {
        return originalFetch(input, init);
      }

      const csrfToken = getCsrfTokenFromDocument();
      if (!csrfToken) {
        return originalFetch(input, init);
      }

      if (input instanceof Request) {
        const headers = new Headers(input.headers);
        if (!headers.has(CSRF_HEADER_NAME)) {
          headers.set(CSRF_HEADER_NAME, csrfToken);
        }

        const nextRequest = new Request(input, { headers });
        return originalFetch(nextRequest);
      }

      const headers = new Headers(init?.headers || {});
      if (!headers.has(CSRF_HEADER_NAME)) {
        headers.set(CSRF_HEADER_NAME, csrfToken);
      }

      return originalFetch(input, {
        ...(init || {}),
        headers,
      });
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

