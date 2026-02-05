"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailDiscoveryForm } from "@/components/email-discovery-form";
import { LeadsTable } from "@/components/leads-table";
import { SettingsForm } from "@/components/settings-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users, Settings, Inbox, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/50 backdrop-blur-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="h-6 w-6 text-electric-rose" />
              <h1 className="text-2xl font-fraunces font-bold">Email Discovery</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden md:block">
                Welcome back!
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-dm-sans font-medium text-canvas-white">
                Total Searches
              </CardTitle>
              <Search className="h-4 w-4 text-electric-rose" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Start discovering emails
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-dm-sans font-medium text-canvas-white">
                Verified Emails
              </CardTitle>
              <Users className="h-4 w-4 text-electric-rose" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                No emails verified yet
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-dm-sans font-medium text-canvas-white">
                Success Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-electric-rose" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">
                No data available
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="discover" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-fit">
            <TabsTrigger value="discover">
              <Search className="mr-2 h-4 w-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Users className="mr-2 h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-fraunces">Discover Email Addresses</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Enter a person&apos;s name and company to find their email address
                </CardDescription>
              </CardHeader>
              <CardContent className="max-w-md mx-auto">
                <EmailDiscoveryForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-fraunces">Your Leads</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Manage and export your discovered email addresses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeadsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <SettingsForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
