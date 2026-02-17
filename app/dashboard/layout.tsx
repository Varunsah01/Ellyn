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
  const isContactsWorkspaceRoute =
    pathname === "/dashboard/contacts" ||
    pathname.startsWith("/dashboard/contacts/") ||
    pathname === "/tracker" ||
    pathname === "/dashboard/tracker" ||
    pathname.startsWith("/dashboard/tracker/");

  useEffect(() => {
    let isMounted = true;

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
        router.replace("/auth/login?next=/dashboard");
      }
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
      <SubscriptionProvider>
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
                  isContactsWorkspaceRoute
                    ? "max-w-none p-0"
                    : "container mx-auto max-w-7xl p-3 sm:p-4 lg:p-5"
                )}
              >
                {children}
              </div>
            </main>
          </div>
          <DashboardTour />
        </div>
      </SubscriptionProvider>
    </DashboardWrapper>
  );
}
