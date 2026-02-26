"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { DashboardTour } from "@/components/DashboardTour";
import { DashboardWrapper } from "@/components/DashboardWrapper";
import { usePathname, useRouter } from "next/navigation";
import { getOnboardingState } from "@/lib/onboarding";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useResponsive } from "@/hooks/useResponsive";
import { cn } from "@/lib/utils";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { QuotaWarningBanner } from "@/components/subscription/QuotaWarningBanner";
import { AppRefreshProvider } from "@/lib/context/AppRefreshContext";
import { PersonaProvider } from "@/context/PersonaContext";
import { PersonaOnboardingGate } from "@/components/dashboard/PersonaOnboardingGate";
import type { Session } from "@supabase/supabase-js";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isTablet } = useResponsive();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isFullWidthWorkspaceRoute =
    pathname === "/tracker" ||
    pathname === "/dashboard/tracker" ||
    pathname.startsWith("/dashboard/tracker/");

  useEffect(() => {
    let isMounted = true;
    const configuredExtensionId =
      process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID?.trim() || "";

    const resolveExtensionId = () => {
      if (configuredExtensionId) return configuredExtensionId;
      try {
        return localStorage.getItem("ellyn_extension_id")?.trim() || "";
      } catch {
        return "";
      }
    };

    const getChromeRuntime = () =>
      (window as Window & {
        chrome?: { runtime?: { sendMessage?: unknown; lastError?: unknown } };
      }).chrome?.runtime;

    const sendSessionToExtension = async (session: Session) => {
      const extensionId = resolveExtensionId();
      if (!extensionId) return;

      const accessToken = session.access_token?.trim() || "";
      const refreshToken = session.refresh_token?.trim() || "";
      if (!accessToken || !refreshToken) return;

      const runtime = getChromeRuntime();
      if (typeof runtime?.sendMessage !== "function") return;

      await new Promise<void>((resolve) => {
        (runtime.sendMessage as (
          id: string,
          msg: unknown,
          cb: (response: unknown) => void
        ) => void)(
          extensionId,
          {
            type: "ELLYN_SET_SESSION",
            session: {
              access_token: accessToken,
              refresh_token: refreshToken,
            },
          },
          () => {
            void runtime.lastError;
            resolve();
          }
        );
      });

      try {
        localStorage.setItem("ellyn_extension_id", extensionId);
      } catch {
        // localStorage may be unavailable in some contexts
      }
    };

    const sendLogoutToExtension = () => {
      const extensionId = resolveExtensionId();
      if (!extensionId) return;

      const runtime = getChromeRuntime();
      if (typeof runtime?.sendMessage !== "function") return;

      (runtime.sendMessage as (
        id: string,
        msg: unknown,
        cb: (response: unknown) => void
      ) => void)(extensionId, { type: "AUTH_LOGOUT" }, () => {
        void runtime.lastError;
      });
    };

    const checkAuth = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setIsAuthenticated(true);
          setAuthChecking(false);
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error || !data.session) {
        setIsAuthenticated(false);
        setAuthChecking(false);
        router.replace("/auth/login?next=/dashboard");
        return;
      }

      setIsAuthenticated(true);
      setAuthChecking(false);
      void sendSessionToExtension(data.session);
    };

    checkAuth();

    if (!isSupabaseConfigured) {
      return () => {
        isMounted = false;
      };
    }

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session) {
        setIsAuthenticated(false);
        sendLogoutToExtension();

        router.replace("/auth/login?next=/dashboard");
        return;
      }

      setIsAuthenticated(true);
      void sendSessionToExtension(session);
    });

    return () => {
      isMounted = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const state = getOnboardingState();
    if (!state.completed && !state.dismissed) {
      router.replace("/onboarding");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true);
    }
  }, [isTablet]);

  if (authChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Checking your session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardWrapper>
      <AppRefreshProvider>
      <SubscriptionProvider>
      <PersonaProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Sidebar - Hidden on mobile, shown on tablet/desktop */}
          <div className="hidden sm:flex">
            <Sidebar
              collapsed={isTablet ? true : sidebarCollapsed}
              onToggleCollapse={() => {
                if (isTablet) return;
                setSidebarCollapsed(!sidebarCollapsed);
              }}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <QuotaWarningBanner />
            <main className="flex-1 overflow-y-auto">
              <div
                className={cn(
                  isFullWidthWorkspaceRoute
                    ? "max-w-none p-0"
                    : "container mx-auto max-w-7xl p-3 sm:p-4 lg:p-5"
                )}
              >
                {children}
              </div>
            </main>
          </div>
          <DashboardTour />
          <PersonaOnboardingGate />
        </div>
      </PersonaProvider>
      </SubscriptionProvider>
      </AppRefreshProvider>
    </DashboardWrapper>
  );
}
