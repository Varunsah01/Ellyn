"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { UserPlus, Mail, MessageSquare, Zap, Inbox, ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { usePersona } from "@/context/PersonaContext";
import { getPersonaCopy } from "@/lib/persona-copy";

type ActivityType =
  | "contact_added"
  | "contact_updated"
  | "email_sent"
  | "reply_received"
  | "sequence_created"
  | "email_replied"
  | "template_created";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date | string;
  metadata?: {
    contactName?: string;
    sequenceName?: string;
    company?: string;
  };
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

/**
 * Render the ActivityFeed component.
 * @param {ActivityFeedProps} props - Component props.
 * @returns {unknown} JSX output for ActivityFeed.
 * @example
 * <ActivityFeed />
 */
export function ActivityFeed({
  activities,
  onLoadMore,
  hasMore = false,
  loading = false,
}: ActivityFeedProps) {
  const { persona } = usePersona();
  const copy = getPersonaCopy(persona);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "contact_added":
      case "contact_updated":
        return <UserPlus className="h-4 w-4" />;
      case "email_sent":
        return <Mail className="h-4 w-4" />;
      case "reply_received":
      case "email_replied":
        return <MessageSquare className="h-4 w-4" />;
      case "sequence_created":
        return <Zap className="h-4 w-4" />;
      case "template_created":
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "contact_added":
      case "contact_updated":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "email_sent":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "reply_received":
      case "email_replied":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "sequence_created":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "template_created":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <p className="text-base font-medium text-slate-900">No activity yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your outreach activity will appear here as you send emails and update {copy.contacts.toLowerCase()}.
              </p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/contacts">{copy.addContactCTA}</Link>
              </Button>
            </div>
          ) : (
            <>
              {activities.map((activity, index) => (
                <div key={activity.id} className="relative">
                  {index !== activities.length - 1 && (
                    <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                  )}
                  <div className="flex gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border z-10",
                        getActivityColor(activity.type)
                      )}
                    >
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{activity.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.description}
                          </p>
                          {activity.metadata && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {activity.metadata.contactName && (
                                <Badge variant="secondary" className="text-xs">
                                  {activity.metadata.contactName}
                                </Badge>
                              )}
                              {activity.metadata.company && (
                                <Badge variant="outline" className="text-xs">
                                  {activity.metadata.company}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(
                            activity.timestamp instanceof Date
                              ? activity.timestamp
                              : new Date(activity.timestamp),
                            { addSuffix: true }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {hasMore && onLoadMore && (
                <Button variant="outline" onClick={onLoadMore} className="w-full">
                  Load More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
