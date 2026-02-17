"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Trophy, Target, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  period: string;
  icon: React.ElementType;
}

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
  // Define goals (these would typically come from user settings)
  const goals: Goal[] = [
    {
      id: "contacts",
      title: "Add Contacts",
      target: 50,
      current: currentContacts,
      unit: "contacts",
      period: "this month",
      icon: Target,
    },
    {
      id: "emails",
      title: "Send Emails",
      target: 100,
      current: currentEmails,
      unit: "emails",
      period: "this month",
      icon: TrendingUp,
    },
    {
      id: "reply_rate",
      title: "Reply Rate",
      target: 30,
      current: currentReplyRate,
      unit: "%",
      period: "target",
      icon: Zap,
    },
  ];

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-gray-500";
  };

  const getMilestone = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return { label: "Completed!", color: "bg-green-500" };
    if (percentage >= 75) return { label: "Almost there!", color: "bg-blue-500" };
    if (percentage >= 50) return { label: "Halfway!", color: "bg-yellow-500" };
    if (percentage >= 25) return { label: "Getting started", color: "bg-gray-500" };
    return { label: "Just started", color: "bg-gray-400" };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Goal Tracking
            </CardTitle>
            <CardDescription>Track your progress towards your goals</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            Edit Goals
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {goals.map((goal, index) => {
            const Icon = goal.icon;
            const percentage = Math.min((goal.current / goal.target) * 100, 100);
            const milestone = getMilestone(goal.current, goal.target);

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{goal.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {goal.current} / {goal.target} {goal.unit} {goal.period}
                      </div>
                    </div>
                  </div>
                  <Badge className={milestone.color}>{milestone.label}</Badge>
                </div>

                <Progress value={percentage} className={`h-3 ${getProgressColor(percentage)}`} />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{percentage.toFixed(0)}% complete</span>
                  {percentage < 100 && (
                    <span>{goal.target - goal.current} {goal.unit} remaining</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Achievement badges */}
        <div className="mt-6 pt-6 border-t">
          <div className="text-sm font-medium mb-3">Recent Achievements</div>
          <div className="flex flex-wrap gap-2">
            {currentContacts >= 10 && (
              <Badge variant="outline" className="gap-1">
                <Trophy className="h-3 w-3 text-yellow-500" />
                First 10 Contacts
              </Badge>
            )}
            {currentEmails >= 50 && (
              <Badge variant="outline" className="gap-1">
                <Trophy className="h-3 w-3 text-yellow-500" />
                50 Emails Sent
              </Badge>
            )}
            {currentReplyRate >= 20 && (
              <Badge variant="outline" className="gap-1">
                <Trophy className="h-3 w-3 text-yellow-500" />
                20% Reply Rate
              </Badge>
            )}
            {currentContacts < 10 && currentEmails < 50 && currentReplyRate < 20 && (
              <div className="text-sm text-muted-foreground">
                Keep going! Achievements will appear here.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
