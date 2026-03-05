"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BridgeStatus = "loading" | "success" | "error";

type ChromeRuntimeLike = {
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
};

function sanitizeInternalPath(value: string | null, fallback: string): string {
  const normalized = String(value || "").trim();
  if (!normalized || !normalized.startsWith("/") || normalized.startsWith("//")) {
    return fallback;
  }
  return normalized;
}

function ensureExtensionIdOnBridgePath(path: string, extensionId: string): string {
  const normalizedExtensionId = String(extensionId || "").trim();
  if (!normalizedExtensionId || !path.startsWith("/extension-auth")) {
    return path;
  }

  try {
    const parsed = new URL(path, "http://localhost");
    if (!parsed.searchParams.get("extensionId")) {
      parsed.searchParams.set("extensionId", normalizedExtensionId);
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return path;
  }
}

function ExtensionAuthInner() {
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  const bridgeParams = useMemo(() => {
    const extensionId = String(searchParams.get("extensionId") || "").trim();
    const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
    const source = String(searchParams.get("source") || "extension").trim() || "extension";
    const requestedNext = sanitizeInternalPath(searchParams.get("next"), "/extension-auth");
    const next = ensureExtensionIdOnBridgePath(requestedNext, extensionId);
    return { extensionId, mode, source, next };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function syncSessionToExtension() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (!session) {
        const authParams = new URLSearchParams();
        authParams.set("source", bridgeParams.source);
        authParams.set("next", bridgeParams.next);
        authParams.set("mode", bridgeParams.mode);
        if (bridgeParams.extensionId) {
          authParams.set("extensionId", bridgeParams.extensionId);
        }
        router.replace(`/auth/${bridgeParams.mode}?${authParams.toString()}`);
        return;
      }

      if (!bridgeParams.extensionId) {
        setStatus("error");
        setErrorMessage("Extension ID is missing. Open this page from the Ellyn extension.");
        return;
      }

      const accessToken = String(session.access_token || "").trim();
      const refreshToken = String(session.refresh_token || "").trim();
      if (!accessToken || !refreshToken) {
        setStatus("error");
        setErrorMessage("Unable to sync extension session. Please sign in again.");
        return;
      }

      const chromeRuntime = (
        typeof window !== "undefined"
          ? (window as Window & { chrome?: { runtime?: ChromeRuntimeLike } }).chrome?.runtime
          : undefined
      );

      if (typeof chromeRuntime?.sendMessage !== "function") {
        setStatus("error");
        setErrorMessage(
          "Chrome extension APIs are unavailable. Make sure the Ellyn extension is installed and this page is open in Chrome."
        );
        return;
      }

      try {
        await new Promise<void>((resolve, reject) => {
          chromeRuntime.sendMessage?.(
            bridgeParams.extensionId,
            {
              type: "ELLYN_SET_SESSION",
              session: {
                access_token: accessToken,
                refresh_token: refreshToken,
              },
            },
            (response) => {
              const lastError = chromeRuntime.lastError;
              if (lastError?.message) {
                reject(new Error(lastError.message));
                return;
              }

              const payload = response as { ok?: boolean; error?: string } | undefined;
              if (payload?.ok) {
                resolve();
                return;
              }

              reject(
                new Error(payload?.error || "Extension did not acknowledge the session sync request.")
              );
            }
          );
        });

        try {
          localStorage.setItem("ellyn_extension_id", bridgeParams.extensionId);
        } catch {
          // Ignore localStorage failures in restricted contexts.
        }

        setStatus("success");
      } catch (error) {
        console.error("[ExtensionAuth] Failed to sync extension session:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Could not communicate with the extension."
        );
      }
    }

    void syncSessionToExtension();

    return () => {
      cancelled = true;
    };
  }, [bridgeParams, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <svg className="h-8 w-8 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm">Connecting extension...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-green-500/10 p-4 text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">Extension connected successfully.</h1>
        <p className="text-sm text-muted-foreground">You can close this tab and return to the extension.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold">Connection failed</h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        {errorMessage || "An unexpected error occurred."}
      </p>
    </div>
  );
}

export default function ExtensionAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <ExtensionAuthInner />
    </Suspense>
  );
}
