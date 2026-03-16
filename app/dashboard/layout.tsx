import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PersonaOnboardingGate } from "@/components/dashboard/PersonaOnboardingGate";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { DashboardTour } from "@/components/DashboardTour";
import { DashboardProviders } from "@/components/dashboard/DashboardProviders";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getImpersonationSession } from "@/lib/auth/admin-impersonation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    const [adminSession, impersonationSession] = await Promise.all([
      getAdminSession(),
      getImpersonationSession(),
    ]);

    if (!adminSession || !impersonationSession) {
      redirect("/auth/login");
    }
  }

  return (
    <DashboardProviders>
      <DashboardShell withChrome>{children}</DashboardShell>
      <PersonaOnboardingGate />
      <DashboardTour />
      <OnboardingChecklist />
    </DashboardProviders>
  );
}
