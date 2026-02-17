"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CsrfHiddenInput } from "@/components/CsrfHiddenInput";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { AuthFormLayout, AuthPageLoading } from "@/components/auth/AuthFormLayout";
import { useAuthForm } from "@/hooks/useAuthForm";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const auth = useAuthForm({ searchParams });
  const signupHref = auth.createAuthHref("signup");
  const isBusy = auth.isSubmitting || auth.isGoogleSubmitting;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    auth.clearMessages();

    if (!auth.requireSupabaseConfig()) return;

    auth.setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    auth.setIsSubmitting(false);

    if (error) {
      auth.setErrorMessage(error.message);
      return;
    }

    auth.setSuccessMessage("Signed in successfully. Redirecting...");

    if (data.user) {
      await auth.handleAuthenticatedUser(data.user, trimmedEmail);
    }
  };

  const handleGoogleLogin = async () => {
    auth.clearMessages();

    if (!auth.requireSupabaseConfig()) return;

    auth.setIsGoogleSubmitting(true);

    const redirectTo = auth.createAuthRedirectUrl("login");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      auth.setIsGoogleSubmitting(false);
      auth.setErrorMessage(error.message);
    }
  };

  return (
    <AuthFormLayout
      title="Welcome Back"
      subtitle="Sign in to continue finding emails"
      isSupabaseConfigured={auth.isSupabaseConfigured}
      errorMessage={auth.errorMessage}
      successMessage={auth.successMessage}
      isBusy={isBusy}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <CsrfHiddenInput />
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Email Address</label>
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
            <label className="text-sm font-medium text-slate-700">Password</label>
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
          disabled={isBusy}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white h-12 text-base"
        >
          {auth.isSubmitting ? "Signing In..." : "Sign In"}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-slate-500">Or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-12"
        disabled={isBusy}
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
        {auth.isGoogleSubmitting ? "Redirecting..." : "Sign in with Google"}
      </Button>

      <p className="text-center text-sm text-slate-600 mt-6">
        Don&apos;t have an account?{" "}
        <Link href={signupHref} className="text-blue-600 hover:underline font-medium">
          Sign up free
        </Link>
      </p>
    </AuthFormLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageLoading text="Loading sign in..." />}>
      <LoginPageContent />
    </Suspense>
  );
}

