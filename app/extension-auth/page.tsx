"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Inner component (needs Suspense because it reads searchParams) ───────────

function ExtensionAuthInner() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function sync() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const extensionId = searchParams.get("extensionId")?.trim() || "";
      const requestedMode = searchParams.get("mode") === "signup" ? "signup" : "login";

      if (!session) {
        const nextTarget = extensionId
          ? `/extension-auth?extensionId=${encodeURIComponent(extensionId)}`
          : "/extension-auth";
        const params = new URLSearchParams({
          source: "extension",
          next: nextTarget,
        });
        if (extensionId) {
          params.set("extensionId", extensionId);
        }
        router.replace(`/auth/${requestedMode}?${params.toString()}`);
        return;
      }

      if (!extensionId) {
        setStatus("error");
        setErrorMessage(
          "Extension ID missing. Open this page from the Ellyn extension."
        );
        return;
      }

      const sessionPayload = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };

      if (!sessionPayload.access_token || !sessionPayload.refresh_token) {
        setStatus("error");
        setErrorMessage("Unable to sync extension session. Please sign in again.");
        return;
      }

      // chrome.runtime.sendMessage is available to web pages listed in
      // the extension's externally_connectable manifest field.
      const chromeRuntime = (
        typeof window !== "undefined"
          ? (window as Window & { chrome?: { runtime?: { sendMessage?: unknown; lastError?: unknown } } }).chrome?.runtime
          : undefined
      );

      if (typeof chromeRuntime?.sendMessage !== "function") {
        setStatus("error");
        setErrorMessage(
          "Chrome extension APIs not available. Make sure the Ellyn extension is installed and this page is open in Chrome."
        );
        return;
      }

      try {
        await new Promise<void>((resolve, reject) => {
          (chromeRuntime.sendMessage as (
            extensionId: string,
            message: unknown,
            callback: (response: unknown) => void
          ) => void)(
            extensionId,
            { type: "ELLYN_SET_SESSION", session: sessionPayload },
            (response) => {
              const lastError = chromeRuntime.lastError as { message?: string } | undefined;
              if (lastError) {
                reject(new Error(lastError.message ?? "Extension error"));
                return;
              }
              const res = response as { ok?: boolean } | undefined;
              if (res?.ok) {
                resolve();
              } else {
                reject(new Error("Extension did not acknowledge the message."));
              }
            }
          );
        });

        // Persist the extensionId so the dashboard can notify on logout
        try {
          localStorage.setItem("ellyn_extension_id", extensionId);
        } catch {
          // localStorage may be unavailable in some contexts
        }

        setStatus("success");
      } catch (err) {
        console.error("[ExtensionAuth] Failed to sync with extension:", err);
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not communicate with the extension."
        );
      }
    }

    void sync();
  }, [router, searchParams]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <svg
          className="h-8 w-8 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <p className="text-sm">Connecting extension…</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="rounded-full bg-green-500/10 p-4 text-green-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">Extension connected successfully.</h1>
        <p className="text-sm text-muted-foreground">
          You can close this tab and return to the extension.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h1 className="text-xl font-semibold">Connection failed</h1>
      <p className="text-sm text-muted-foreground max-w-sm text-center">
        {errorMessage || "An unexpected error occurred."}
      </p>
    </div>
  );
}

// ─── Page export (wraps inner in Suspense for useSearchParams) ────────────────

export default function ExtensionAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ExtensionAuthInner />
    </Suspense>
  );
}
