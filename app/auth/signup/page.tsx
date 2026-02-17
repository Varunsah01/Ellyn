"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CsrfHiddenInput } from "@/components/CsrfHiddenInput";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { supabase } from "@/lib/supabase";
import { AuthFormLayout, AuthPageLoading } from "@/components/auth/AuthFormLayout";
import { useAuthForm } from "@/hooks/useAuthForm";
import { validatePasswordStrength } from "@/lib/validation/password";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { apiFetch } from "@/lib/api-client";

function SignupPageContent() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const auth = useAuthForm({ searchParams });
  const passwordStrength = useMemo(() => validatePasswordStrength(password), [password]);
  const loginHref = auth.createAuthHref("login");
  const isBusy = auth.isSubmitting || auth.isGoogleSubmitting;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    auth.clearMessages();

    if (password !== confirmPassword) {
      auth.setErrorMessage("Passwords do not match.");
      return;
    }

    if (!agreeToTerms) {
      auth.setErrorMessage("Please agree to the terms and conditions.");
      return;
    }

    if (!passwordStrength.isValid) {
      auth.setErrorMessage("Password does not meet strength requirements.");
      return;
    }

    if (!auth.requireSupabaseConfig()) return;

    auth.setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const emailRedirectTo = auth.createAuthRedirectUrl("login");

    try {
      const response = await apiFetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          emailRedirectTo,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const signupError =
          payload?.error || payload?.data?.error || "Failed to create account.";
        auth.setErrorMessage(signupError);
        return;
      }

      const returnedUser = payload?.user || payload?.data?.user;
      const hasSession = Boolean(payload?.hasSession ?? payload?.data?.hasSession);

      if (returnedUser && hasSession) {
        auth.setSuccessMessage("Account created successfully. Redirecting...");
        await auth.handleAuthenticatedUser(returnedUser, trimmedEmail, trimmedName);
        return;
      }

      auth.setSuccessMessage(
        payload?.message ||
          payload?.data?.message ||
          "Account created. Check your email to verify your address before signing in.",
      );
    } catch (error) {
      console.error("Signup error:", error);
      auth.setErrorMessage("Failed to create account.");
    } finally {
      auth.setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    auth.clearMessages();

    if (!agreeToTerms) {
      auth.setErrorMessage(
        "Please agree to the terms and conditions before continuing with Google.",
      );
      return;
    }

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
      title="Create Your Account"
      subtitle="Start finding emails for free, forever"
      isSupabaseConfigured={auth.isSupabaseConfigured}
      errorMessage={auth.errorMessage}
      successMessage={auth.successMessage}
      isBusy={isBusy}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <CsrfHiddenInput />
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

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
          <label className="text-sm font-medium text-slate-700">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
              minLength={8}
            />
          </div>
          <PasswordStrengthIndicator result={passwordStrength} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="password"
              placeholder="********"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10"
              required
              minLength={8}
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={agreeToTerms}
            onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
          />
          <label htmlFor="terms" className="text-sm text-slate-600 leading-tight cursor-pointer">
            I agree to the{" "}
            <a href="#" className="text-blue-600 hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </label>
        </div>

        <Button
          type="submit"
          disabled={isBusy || !passwordStrength.isValid}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white h-12 text-base"
        >
          {auth.isSubmitting ? "Creating Account..." : "Create Account"}
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
        onClick={handleGoogleSignup}
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
        {auth.isGoogleSubmitting ? "Redirecting..." : "Sign up with Google"}
      </Button>

      <p className="text-center text-sm text-slate-600 mt-6">
        Already have an account?{" "}
        <Link href={loginHref} className="text-blue-600 hover:underline font-medium">
          Log in
        </Link>
      </p>
    </AuthFormLayout>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthPageLoading text="Loading sign up..." />}>
      <SignupPageContent />
    </Suspense>
  );
}
