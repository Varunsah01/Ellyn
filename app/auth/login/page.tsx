"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ExtensionPayload = {
  id: string;
  email: string;
  name: string;
};

function buildExtensionPayload(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  },
  fallbackEmail = "",
): ExtensionPayload {
  const metadata = user.user_metadata || {};
  const email = user.email || fallbackEmail || "";
  const nameFromMetadata =
    (metadata.full_name as string | undefined) ||
    (metadata.name as string | undefined);

  return {
    id: user.id,
    email,
    name: nameFromMetadata || email || "User",
  };
}

function parseNextPath(rawValue: string | null): string {
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/dashboard";
  }

  return rawValue;
}

function resolveAuthOrigin(isExtensionSource: boolean): string {
  if (isExtensionSource) {
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (rawAppUrl) {
      try {
        return new URL(rawAppUrl).origin;
      } catch {
        // Fall through to current origin.
      }
    }
  }

  return window.location.origin;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const extensionNotifiedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const nextPath = useMemo(() => parseNextPath(searchParams.get("next")), [searchParams]);
  const isExtensionSource = searchParams.get("source") === "extension";
  const extensionIdFromQuery = searchParams.get("extensionId")?.trim() || "";
  const signupHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("next", nextPath);

    if (isExtensionSource) {
      params.set("source", "extension");
    }

    if (extensionIdFromQuery) {
      params.set("extensionId", extensionIdFromQuery);
    }

    return `/auth/signup?${params.toString()}`;
  }, [extensionIdFromQuery, isExtensionSource, nextPath]);

  const notifyExtensionAuthSuccess = useCallback(
    async (payload: ExtensionPayload) => {
      if (!isExtensionSource || extensionNotifiedRef.current) return;

      const extensionId = extensionIdFromQuery || process.env.NEXT_PUBLIC_EXTENSION_ID;
      if (!extensionId) return;

      const maybeWindow = window as unknown as {
        chrome?: { runtime?: { sendMessage?: (...args: unknown[]) => void } };
      };

      const runtime = maybeWindow.chrome?.runtime;
      if (!runtime || typeof runtime.sendMessage !== "function") return;

      extensionNotifiedRef.current = true;

      await new Promise<void>((resolve) => {
        try {
          runtime.sendMessage!(
            extensionId,
            { type: "AUTH_SUCCESS", payload },
            () => resolve(),
          );
        } catch {
          resolve();
        }
      });
    },
    [extensionIdFromQuery, isExtensionSource],
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
        void notifyExtensionAuthSuccess(buildExtensionPayload(data.session.user));
        router.replace(nextPath);
      }
    };

    checkSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void notifyExtensionAuthSuccess(buildExtensionPayload(session.user));
        router.replace(nextPath);
      }
    });

    return () => {
      isMounted = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [nextPath, notifyExtensionAuthSuccess, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const user = data.user;
    if (user) {
      await notifyExtensionAuthSuccess(buildExtensionPayload(user, email.trim()));
    }

    setSuccessMessage("Signed in successfully. Redirecting...");
    router.replace(nextPath);
  };

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setIsGoogleSubmitting(true);

    const params = new URLSearchParams();
    params.set("next", nextPath);
    if (isExtensionSource) {
      params.set("source", "extension");
    }

    const redirectTo = `${resolveAuthOrigin(isExtensionSource)}/auth/login?${params.toString()}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setIsGoogleSubmitting(false);
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-white flex items-center justify-center p-4">
      <Link href="/" className="absolute top-8 left-8 flex items-center group">
        <div className="relative h-12 w-[160px]">
          <img
            src="https://subsnacks.sirv.com/Ellyn_logo.png"
            alt="Ellyn logo"
            className="h-full w-full object-contain"
          />
        </div>
      </Link>

      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-3xl font-bold text-slate-900">
            Welcome Back
          </CardTitle>
          <p className="text-slate-600 mt-2">
            Sign in to continue finding emails
          </p>
        </CardHeader>

        <CardContent>
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Supabase is not configured. Update <code>.env</code> with valid public keys.
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <a href="#" className="text-sm text-blue-600 hover:underline">
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white h-12 text-base"
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12"
            disabled={isSubmitting || isGoogleSubmitting}
            onClick={handleGoogleLogin}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isGoogleSubmitting ? "Redirecting..." : "Sign in with Google"}
          </Button>

          <p className="text-center text-sm text-slate-600 mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href={signupHref}
              className="text-blue-600 hover:underline font-medium"
            >
              Sign up free
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-white flex items-center justify-center p-4">
          <div className="text-sm text-slate-600">Loading sign in...</div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
