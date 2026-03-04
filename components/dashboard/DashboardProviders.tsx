"use client"

import { AppRefreshProvider } from "@/lib/context/AppRefreshContext"
import { SubscriptionProvider } from "@/context/SubscriptionContext"
import { PersonaProvider } from "@/context/PersonaContext"

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppRefreshProvider>
      <SubscriptionProvider>
        <PersonaProvider>
          {children}
        </PersonaProvider>
      </SubscriptionProvider>
    </AppRefreshProvider>
  )
}
