"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface AuthFormLayoutProps {
  title: string;
  subtitle: string;
  isSupabaseConfigured: boolean;
  errorMessage?: string;
  successMessage?: string;
  isBusy?: boolean;
  children: ReactNode;
}

/**
 * Render the AuthFormLayout component.
 * @param {AuthFormLayoutProps} props - Component props.
 * @returns {unknown} JSX output for AuthFormLayout.
 * @example
 * <AuthFormLayout />
 */
export function AuthFormLayout({
  title,
  subtitle,
  isSupabaseConfigured,
  errorMessage,
  successMessage,
  isBusy = false,
  children,
}: AuthFormLayoutProps) {
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
          <CardTitle className="text-3xl font-bold text-slate-900">{title}</CardTitle>
          <p className="text-slate-600 mt-2">{subtitle}</p>
        </CardHeader>

        <CardContent aria-busy={isBusy}>
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

          <div className={isBusy ? "pointer-events-none opacity-80 transition-opacity" : ""}>
            {children}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AuthPageLoadingProps {
  text: string;
}

/**
 * Render the AuthPageLoading component.
 * @param {AuthPageLoadingProps} props - Component props.
 * @returns {unknown} JSX output for AuthPageLoading.
 * @example
 * <AuthPageLoading />
 */
export function AuthPageLoading({ text }: AuthPageLoadingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-white flex items-center justify-center p-4">
      <div className="text-sm text-slate-600">{text}</div>
    </div>
  );
}
