"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Trophy, Target } from "lucide-react";

interface GoalTrackerProps {
  currentContacts: number;
  currentEmails: number;
  currentReplyRate: number;
}

/**
 * Render the GoalTracker component.
 * @param {GoalTrackerProps} props - Component props.
 * @returns {unknown} JSX output for GoalTracker.
 * @example
 * <GoalTracker />
 */
export function GoalTracker({
  currentContacts,
  currentEmails,
  currentReplyRate,
}: GoalTrackerProps) {
  const achievements = [
    currentContacts >= 10 && { label: "First 10 Contacts" },
    currentContacts >= 50 && { label: "50 Contacts" },
    currentEmails >= 50 && { label: "50 Emails Sent" },
    currentEmails >= 100 && { label: "100 Emails Sent" },
    currentReplyRate >= 20 && { label: "20% Reply Rate" },
    currentReplyRate >= 30 && { label: "30% Reply Rate" },
  ].filter(Boolean) as Array<{ label: string }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Goal Tracking
        </CardTitle>
        <CardDescription>Track your progress towards your goals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Empty state — goals feature coming soon */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <Target className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Goal setting coming soon</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You&apos;ll be able to set custom targets for contacts, emails, and reply rate.
          </p>
        </div>

        {/* Achievements — always shown when earned */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-3">Achievements</div>
          {achievements.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => (
                <Badge key={a.label} variant="outline" className="gap-1">
                  <Trophy className="h-3 w-3 text-yellow-500" />
                  {a.label}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keep going! Achievements will appear here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
