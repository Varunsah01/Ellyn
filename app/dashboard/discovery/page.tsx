"use client";

import { Search, TableProperties } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmailDiscoveryForm } from "@/components/EmailDiscoveryForm";
import { LeadsTable } from "@/components/LeadsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

export default function DiscoveryPage() {
  const searchParams = useSearchParams();
  const defaultTab =
    searchParams.get("tab") === "leads" ? "leads" : "discover";

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-fraunces font-bold">Discovery</h1>
          <p className="text-muted-foreground mt-1">
            Discover professional emails and manage saved leads.
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="discover" className="gap-2">
              <Search className="h-4 w-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2">
              <TableProperties className="h-4 w-4" />
              Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover">
            <EmailDiscoveryForm />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

