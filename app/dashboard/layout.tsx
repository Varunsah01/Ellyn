import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PersonaOnboardingGate } from "@/components/dashboard/PersonaOnboardingGate";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { DashboardTour } from "@/components/DashboardTour";
import { PersonaProvider } from "@/context/PersonaContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { createClient } from "@/lib/supabase/server";

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
    redirect("/auth/login");
  }

  return (
    <SubscriptionProvider>
      <PersonaProvider>
        <DashboardShell withChrome>{children}</DashboardShell>
        <PersonaOnboardingGate />
        <DashboardTour />
        <OnboardingChecklist />
      </PersonaProvider>
    </SubscriptionProvider>
  );
}
