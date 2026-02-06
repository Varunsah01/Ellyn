"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  MoreHorizontal,
  Play,
  Pause,
  Edit,
  Copy,
  Download,
  Trash,
  Users,
  Mail,
  Eye,
  Reply,
  AlertCircle,
  UserMinus,
  TrendingUp,
  Clock,
} from "lucide-react";
import { mockSequences } from "@/lib/data/mock-sequences";
import {
  getStatusColor,
  getStatusLabel,
  calculateOpenRate,
  calculateReplyRate,
  calculateBounceRate,
} from "@/lib/utils/sequence-utils";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";

export default function SequenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sequenceId = params.id as string;

  // Find sequence from mock data
  const [sequence, setSequence] = useState(
    mockSequences.find((s) => s.id === sequenceId)
  );

  if (!sequence) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <h2 className="text-2xl font-bold mb-2">Sequence not found</h2>
          <p className="text-muted-foreground mb-4">
            The sequence you're looking for doesn't exist.
          </p>
          <Button onClick={() => router.push("/dashboard/sequences")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sequences
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const statusColors = getStatusColor(sequence.status);
  const openRate = calculateOpenRate(sequence.stats);
  const replyRate = calculateReplyRate(sequence.stats);
  const bounceRate = calculateBounceRate(sequence.stats);

  const toggleStatus = () => {
    if (sequence.status === "active") {
      setSequence({ ...sequence, status: "paused" });
    } else if (sequence.status === "paused") {
      setSequence({ ...sequence, status: "active" });
    }
  };

  // Mock contact data for table
  const mockContactData = [
    {
      id: "1",
      name: "John Smith",
      email: "john.smith@google.com",
      company: "Google",
      currentStep: 2,
      status: "in_progress" as const,
      lastActivity: "2024-02-05T10:00:00Z",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah.j@meta.com",
      company: "Meta",
      currentStep: 3,
      status: "completed" as const,
      lastActivity: "2024-02-04T15:30:00Z",
    },
    {
      id: "3",
      name: "Michael Chen",
      email: "m.chen@microsoft.com",
      company: "Microsoft",
      currentStep: 1,
      status: "in_progress" as const,
      lastActivity: "2024-02-06T09:15:00Z",
    },
  ];

  // Mock activity timeline
  const mockTimeline = [
    {
      id: "1",
      type: "replied" as const,
      contactName: "Sarah Johnson",
      stepNumber: 2,
      timestamp: "2024-02-06T14:30:00Z",
      details: "Positive response, interested in connecting",
    },
    {
      id: "2",
      type: "opened" as const,
      contactName: "Michael Chen",
      stepNumber: 1,
      timestamp: "2024-02-06T09:15:00Z",
    },
    {
      id: "3",
      type: "sent" as const,
      contactName: "John Smith",
      stepNumber: 2,
      timestamp: "2024-02-05T10:00:00Z",
    },
    {
      id: "4",
      type: "bounced" as const,
      contactName: "David Wilson",
      stepNumber: 1,
      timestamp: "2024-02-04T16:45:00Z",
      details: "Invalid email address",
    },
  ];

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/sequences")}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sequences
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-fraunces font-bold">{sequence.name}</h1>
            <Badge
              variant="outline"
              className={cn(
                "font-medium",
                statusColors.bg,
                statusColors.text,
                statusColors.border
              )}
            >
              {getStatusLabel(sequence.status)}
            </Badge>
          </div>
          {sequence.description && (
            <p className="text-muted-foreground mt-2">{sequence.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(sequence.status === "active" || sequence.status === "paused") && (
            <Button
              variant="outline"
              onClick={toggleStatus}
            >
              {sequence.status === "active" ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              )}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/sequences/${sequence.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Sequence
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Total Contacts"
          value={sequence.stats.totalContacts}
          icon={Users}
          description={`${sequence.stats.inProgress} in progress`}
        />
        <StatCard
          title="Emails Sent"
          value={sequence.stats.emailsSent}
          icon={Mail}
          description="across all steps"
        />
        <StatCard
          title="Open Rate"
          value={`${openRate}%`}
          change={openRate > 50 ? 12 : -5}
          trend={openRate > 50 ? "up" : "down"}
          icon={Eye}
          description={`${sequence.stats.opened} opened`}
        />
        <StatCard
          title="Reply Rate"
          value={`${replyRate}%`}
          change={replyRate > 20 ? 8 : -3}
          trend={replyRate > 20 ? "up" : "down"}
          icon={Reply}
          description={`${sequence.stats.replied} replied`}
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Bounce Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bounceRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {sequence.stats.bounced} bounced emails
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-red-500" />
              Unsubscribed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sequence.stats.unsubscribed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              contacts opted out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sequence.steps.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              email steps configured
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="steps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="space-y-4">
          {sequence.steps.map((step, index) => (
            <Card key={step.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Step {step.order}: {step.delay_days === 0 ? "Immediate" : `Day ${step.delay_days}`}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Subject: {step.subject}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>{Math.round(sequence.stats.emailsSent / sequence.steps.length)} sent</div>
                    <div>{Math.round(sequence.stats.opened / sequence.steps.length)} opened</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono text-sm">
                  {step.body}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockContactData.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-right">
                        <p className="font-medium">Step {contact.currentStep}</p>
                        <p className="text-muted-foreground capitalize">
                          {contact.status.replace("_", " ")}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockTimeline.map((event) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex-shrink-0">
                      {event.type === "sent" && (
                        <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-blue-500" />
                        </div>
                      )}
                      {event.type === "opened" && (
                        <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <Eye className="h-4 w-4 text-purple-500" />
                        </div>
                      )}
                      {event.type === "replied" && (
                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Reply className="h-4 w-4 text-green-500" />
                        </div>
                      )}
                      {event.type === "bounced" && (
                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {event.contactName}{" "}
                        <span className="text-muted-foreground font-normal">
                          {event.type} Step {event.stepNumber}
                        </span>
                      </p>
                      {event.details && (
                        <p className="text-sm text-muted-foreground">{event.details}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
