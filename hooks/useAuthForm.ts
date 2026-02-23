"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, type ReadonlyURLSearchParams } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type ExtensionPayload = {
  id: string;
  email: string;
  name: string;
  auth_token?: string;
};

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const SUPABASE_MISSING_CONFIG_ERROR =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

/**
 * Normalize redirect path to avoid open redirect behavior.
 */
export function parseNextPath(rawValue: string | null): string {
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/dashboard";
  }

  return rawValue;
}

/**
 * Build the payload expected by the extension on auth success.
 */
export function buildExtensionPayload(
  user: AuthUser,
  fallbackEmail = "",
  fallbackName = "",
): ExtensionPayload {
  const metadata = user.user_metadata || {};
  const email = user.email || fallbackEmail || "";
  const nameFromMetadata =
    (metadata.full_name as string | undefined) ||
    (metadata.name as string | undefined);

  return {
    id: user.id,
    email,
    name: nameFromMetadata || fallbackName || email || "User",
  };
}

function resolveAuthOrigin(isExtensionSource: boolean): string {
  if (isExtensionSource) {
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (rawAppUrl) {
      try {
        return new URL(rawAppUrl).origin;
      } catch {
        // Fall through to browser origin.
      }
    }
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
}

function buildAuthParams(
  nextPath: string,
  isExtensionSource: boolean,
  extensionIdFromQuery: string,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("next", nextPath);

  if (isExtensionSource) {
    params.set("source", "extension");
  }

  if (extensionIdFromQuery) {
    params.set("extensionId", extensionIdFromQuery);
  }

  return params;
}

interface UseAuthFormOptions {
  searchParams: ReadonlyURLSearchParams;
}

/**
 * Custom hook for auth form.
 * @param {UseAuthFormOptions} param1 - Param1 input.
 * @returns {unknown} Hook state and actions for auth form.
 * @example
 * const state = useAuthForm()
 */
export function useAuthForm({ searchParams }: UseAuthFormOptions) {
  const router = useRouter();
  const extensionNotifiedRef = useRef(false);

  const rawNextPath = searchParams.get("next");
  const rawSource = searchParams.get("source");
  const rawExtensionId = searchParams.get("extensionId");

  const nextPath = useMemo(() => parseNextPath(rawNextPath), [rawNextPath]);
  const isExtensionSource = rawSource === "extension";
  const extensionIdFromQuery = rawExtensionId?.trim() || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessageState] = useState("");
  const [successMessage, setSuccessMessageState] = useState("");

  const setErrorMessage = useCallback((message: string) => {
    setSuccessMessageState("");
    setErrorMessageState(message);
  }, []);

  const setSuccessMessage = useCallback((message: string) => {
    setErrorMessageState("");
    setSuccessMessageState(message);
  }, []);

  const clearMessages = useCallback(() => {
    setErrorMessageState("");
    setSuccessMessageState("");
  }, []);

  const requireSupabaseConfig = useCallback(() => {
    if (!isSupabaseConfigured) {
      setErrorMessage(SUPABASE_MISSING_CONFIG_ERROR);
      return false;
    }

    return true;
  }, [setErrorMessage]);

  const notifyExtensionAuthSuccess = useCallback(
    async (payload: ExtensionPayload) => {
      if (!isExtensionSource || extensionNotifiedRef.current) return;

      const extensionId = extensionIdFromQuery || process.env.NEXT_PUBLIC_EXTENSION_ID;
      if (!extensionId) return;

      let authToken = "";
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        authToken =
          typeof session?.access_token === "string" ? session.access_token.trim() : "";
      } catch {
        authToken = "";
      }

      // Extension sync requires a valid bearer token for subsequent API calls.
      if (!authToken) {
        return;
      }

      const maybeWindow = window as unknown as {
        chrome?: { runtime?: { sendMessage?: (...args: unknown[]) => void } };
      };

      const runtime = maybeWindow.chrome?.runtime;
      if (!runtime || typeof runtime.sendMessage !== "function") return;

      extensionNotifiedRef.current = true;
      const syncPayload: ExtensionPayload = {
        ...payload,
        auth_token: authToken,
      };

      await new Promise<void>((resolve) => {
        try {
          runtime.sendMessage!(
            extensionId,
            { type: "AUTH_SUCCESS", payload: syncPayload },
            () => resolve(),
          );
        } catch {
          resolve();
        }
      });
    },
    [extensionIdFromQuery, isExtensionSource],
  );

  const handleAuthenticatedUser = useCallback(
    async (user: AuthUser, fallbackEmail = "", fallbackName = "") => {
      await notifyExtensionAuthSuccess(
        buildExtensionPayload(user, fallbackEmail, fallbackName),
      );
      router.replace(nextPath);
    },
    [nextPath, notifyExtensionAuthSuccess, router],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session?.user) {
        await handleAuthenticatedUser(data.session.user);
      }
    };

    checkSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted || !session?.user) return;
      void handleAuthenticatedUser(session.user);
    });

    return () => {
      isMounted = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [handleAuthenticatedUser, setErrorMessage]);

  const createAuthHref = useCallback(
    (target: "login" | "signup") => {
      const params = buildAuthParams(nextPath, isExtensionSource, extensionIdFromQuery);
      return `/auth/${target}?${params.toString()}`;
    },
    [extensionIdFromQuery, isExtensionSource, nextPath],
  );

  const createAuthRedirectUrl = useCallback(
    (target: "login" | "signup") => {
      const params = buildAuthParams(nextPath, isExtensionSource, extensionIdFromQuery);
      const origin = resolveAuthOrigin(isExtensionSource);
      return `${origin}/auth/${target}?${params.toString()}`;
    },
    [extensionIdFromQuery, isExtensionSource, nextPath],
  );

  return {
    isSupabaseConfigured,
    isSubmitting,
    isGoogleSubmitting,
    errorMessage,
    successMessage,
    nextPath,
    isExtensionSource,
    setIsSubmitting,
    setIsGoogleSubmitting,
    setErrorMessage,
    setSuccessMessage,
    clearMessages,
    requireSupabaseConfig,
    createAuthHref,
    createAuthRedirectUrl,
    handleAuthenticatedUser,
  };
}
