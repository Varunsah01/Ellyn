"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { DashboardTour } from "@/components/dashboard-tour";
import { DashboardWrapper } from "@/components/dashboard-wrapper";
import { usePathname, useRouter } from "next/navigation";
import { getOnboardingState } from "@/lib/onboarding";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useResponsive } from "@/hooks/useResponsive";
import { cn } from "@/lib/utils";

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
  const isTrackerRoute =
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
          <main className="flex-1 overflow-y-auto">
            <div
              className={cn(
                "p-3 sm:p-4 lg:p-5",
                isTrackerRoute ? "max-w-none" : "container mx-auto max-w-7xl"
              )}
            >
              {children}
            </div>
          </main>
        </div>
        <DashboardTour />
      </div>
    </DashboardWrapper>
  );
}
