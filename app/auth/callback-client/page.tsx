"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthPageLoading } from "@/components/auth/AuthFormLayout";
import { createClient } from "@/lib/supabase/client";

function sanitizeNextPath(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default function AuthCallbackClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function exchangeCode() {
      const code = searchParams.get("code");
      const oauthError =
        searchParams.get("error_description") ?? searchParams.get("error") ?? null;
      const next = sanitizeNextPath(searchParams.get("next"));

      if (oauthError) {
        const loginParams = new URLSearchParams();
        loginParams.set("oauth_error", oauthError);
        loginParams.set("redirect", next);
        router.replace(`/auth/login?${loginParams.toString()}`);
        return;
      }

      if (!code) {
        const loginParams = new URLSearchParams();
        loginParams.set("oauth_error", "Missing OAuth code");
        loginParams.set("redirect", next);
        router.replace(`/auth/login?${loginParams.toString()}`);
        return;
      }

      try {
        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (cancelled) {
          return;
        }

        if (error) {
          const loginParams = new URLSearchParams();
          loginParams.set("oauth_error", error.message);
          loginParams.set("redirect", next);
          router.replace(`/auth/login?${loginParams.toString()}`);
          return;
        }

        router.replace(next);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const loginParams = new URLSearchParams();
        loginParams.set(
          "oauth_error",
          error instanceof Error ? error.message : "OAuth callback failed"
        );
        loginParams.set("redirect", next);
        router.replace(`/auth/login?${loginParams.toString()}`);
      }
    }

    void exchangeCode();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return <AuthPageLoading text="Completing sign in..." />;
}
