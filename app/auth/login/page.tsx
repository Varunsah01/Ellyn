"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { AuthFormLayout, AuthPageLoading } from "@/components/auth/AuthFormLayout";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type SearchParamsLike = {
  get(name: string): string | null;
  toString(): string;
};

function sanitizeInternalRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
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

function resolveRedirectPath(searchParams: SearchParamsLike, extensionId: string): string {
  const rawPath = searchParams.get("redirect") || searchParams.get("next") || "/dashboard";
  const sanitizedPath = sanitizeInternalRedirectPath(rawPath);
  return ensureExtensionIdOnBridgePath(sanitizedPath, extensionId);
}

function buildAuthSwitchHref(
  searchParams: SearchParamsLike,
  targetPath: "/auth/signup" | "/auth/login"
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("oauth_error");
  const query = params.toString();
  return query ? `${targetPath}?${query}` : targetPath;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.6 7.4l3.2 2.3c.9-1.7 2.7-2.8 5.2-2.8 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 8.2 2.5 4.9 4.6 3.6 7.4z"
      />
      <path
        fill="#4A90E2"
        d="M12 21.5c2.6 0 4.8-.9 6.5-2.5l-3-2.5c-.8.6-2 1.1-3.5 1.1-3.9 0-5.2-2.6-5.5-3.9l-3.2 2.5c1.3 2.9 4.6 5.3 8.7 5.3z"
      />
      <path
        fill="#FBBC05"
        d="M6.5 13.7c-.1-.4-.2-.9-.2-1.4s.1-1 .2-1.4L3.3 8.4C2.8 9.4 2.5 10.7 2.5 12s.3 2.6.8 3.6l3.2-1.9z"
      />
    </svg>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extensionIdFromQuery = useMemo(
    () => String(searchParams.get("extensionId") || "").trim(),
    [searchParams]
  );

  const redirectPath = useMemo(() => {
    return resolveRedirectPath(searchParams, extensionIdFromQuery);
  }, [extensionIdFromQuery, searchParams]);

  const signupHref = useMemo(
    () => buildAuthSwitchHref(searchParams, "/auth/signup"),
    [searchParams]
  );

  const googleAuthHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("provider", "google");
    params.set("next", redirectPath);
    return `/auth/oauth/start?${params.toString()}`;
  }, [redirectPath]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      form.setError("root", { message: decodeURIComponent(oauthError) });
    }
  }, [form, searchParams]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    form.clearErrors("root");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (error) {
        form.setError("root", { message: error.message });
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to sign in",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title="Log in"
      subtitle="Sign in to continue to your dashboard."
      isSupabaseConfigured={isSupabaseConfigured}
      errorMessage={form.formState.errors.root?.message}
      isBusy={isSubmitting}
    >
      <div className="space-y-5">
        <Button
          variant="outline"
          className="h-11 w-full border-[#D8D6EA] bg-white text-[#2D2B55] hover:bg-[#F5F3FD]"
          asChild
        >
          <Link href={googleAuthHref}>
            <span className="mr-2">
              <GoogleIcon />
            </span>
            Continue with Google
          </Link>
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#E2E2E8]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#7A7894]">Or continue with email</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm-sans text-[#2D2B55]">Email Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="border-[#D8D6EA] focus-visible:ring-[#2D2B55]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm-sans text-[#2D2B55]">Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Your password"
                      autoComplete="current-password"
                      className="border-[#D8D6EA] focus-visible:ring-[#2D2B55]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full bg-[#2D2B55] font-dm-sans text-white hover:bg-[#25234A]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log in"
              )}
            </Button>
          </form>
        </Form>

        <div className="space-y-2 text-center font-dm-sans text-sm text-[#5E5B86]">
          <Link href="/auth/forgot-password" className="font-medium text-[#2D2B55] underline">
            Forgot password?
          </Link>
          <p>
            Don&apos;t have an account?{" "}
            <Link href={signupHref} className="font-medium text-[#2D2B55] underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </AuthFormLayout>
  );
}

function LoginPageFallback() {
  return <AuthPageLoading text="Loading login..." />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
