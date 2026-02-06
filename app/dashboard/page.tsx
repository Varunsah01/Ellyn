"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { TaskList } from "@/components/dashboard/task-list";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Mail, TrendingUp, Zap, Plus, BarChart3 } from "lucide-react";
import Link from "next/link";

// Mock data
const mockActivities = [
  { id: "1", type: "reply_received" as const, title: "New Reply from John Smith", description: "Replied to your Software Engineer outreach", timestamp: new Date(Date.now() - 1000 * 60 * 30), metadata: { contactName: "John Smith", company: "Google" } },
  { id: "2", type: "email_sent" as const, title: "Email Sent", description: "Outreach email sent to Sarah Johnson", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), metadata: { contactName: "Sarah Johnson", company: "Meta" } },
  { id: "3", type: "contact_added" as const, title: "Contact Added", description: "Michael Chen added to database", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), metadata: { contactName: "Michael Chen", company: "Microsoft" } },
  { id: "4", type: "sequence_created" as const, title: "Sequence Created", description: "New sequence: Product Manager Outreach", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), metadata: { sequenceName: "PM Outreach" } },
];

const mockTasks = [
  { id: "1", title: "Follow up with John Smith", description: "Send thank you email", type: "follow_up" as const, dueDate: new Date(), completed: false, priority: "high" as const },
  { id: "2", title: "Review Q1 sequence performance", description: "Check analytics dashboard", type: "review" as const, dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24), completed: false, priority: "medium" as const },
  { id: "3", title: "Update email templates", description: "Personalize cold outreach templates", type: "sequence" as const, completed: false, priority: "low" as const },
];

const mockRecentContacts = [
  { id: "1", name: "John Smith", company: "Google", email: "john@google.com", addedAt: new Date() },
  { id: "2", name: "Sarah Johnson", company: "Meta", email: "sarah@meta.com", addedAt: new Date() },
  { id: "3", name: "Michael Chen", company: "Microsoft", email: "michael@microsoft.com", addedAt: new Date() },
];

const mockTopSequences = [
  { id: "1", name: "Software Engineer Outreach", replyRate: 34.2, contactsEnrolled: 45 },
  { id: "2", name: "Product Manager Referral", replyRate: 42.8, contactsEnrolled: 12 },
  { id: "3", name: "Alumni Network", replyRate: 38.5, contactsEnrolled: 18 },
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState(mockTasks);

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-fraunces font-bold">{greeting}, John!</h1>
            <p className="text-muted-foreground mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild><Link href="/dashboard/contacts"><Plus className="mr-2 h-4 w-4" />Add Contact</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/sequences/create">Create Sequence</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</Link></Button>
          </div>
        </div>

        {/* Activity Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week's Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Contacts added</span><span className="font-bold">24</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Emails sent</span><span className="font-bold">89</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Replies received</span><span className="font-bold">28</span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Weekly Goal</span>
                    <span>70%</span>
                  </div>
                  <Progress value={70} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <StatCard title="Active Sequences" value={12} change={33} trend="up" icon={Zap} description="4 paused sequences" />
          <StatCard title="Pending Actions" value={tasks.filter((t) => !t.completed).length} icon={Mail} description="Tasks requiring attention" />
          <StatCard title="Performance Score" value={87} change={5} trend="up" icon={TrendingUp} description="Above average" />
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Activity Feed - 2/3 width */}
          <div className="md:col-span-2">
            <ActivityFeed activities={mockActivities} hasMore />
          </div>

          {/* Quick Stats - 1/3 width */}
          <div className="space-y-6">
            <TaskList tasks={tasks} onToggle={handleToggleTask} />
            <QuickStats recentContacts={mockRecentContacts} topSequences={mockTopSequences} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
