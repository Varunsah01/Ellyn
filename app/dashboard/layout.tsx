"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { DashboardTour } from "@/components/dashboard-tour";
import { DashboardWrapper } from "@/components/dashboard-wrapper";
import { useRouter } from "next/navigation";
import { getOnboardingState } from "@/lib/onboarding";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const state = getOnboardingState();
    if (!state.completed && !state.dismissed) {
      router.replace("/onboarding");
    }
  }, [router]);

  return (
    <DashboardWrapper>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6 max-w-7xl">{children}</div>
          </main>
        </div>
        <DashboardTour />
      </div>
    </DashboardWrapper>
  );
}
