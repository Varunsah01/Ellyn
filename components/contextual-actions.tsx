"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface QuickAction {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  variant?: "default" | "outline" | "secondary";
}

interface ContextualActionsProps {
  actions: QuickAction[];
  className?: string;
}

export function ContextualActions({ actions, className }: ContextualActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn("grid gap-4", className)}>
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <Card key={index} className="border-dashed hover:border-primary/50 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{action.title}</h4>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </div>
              <Button
                variant={action.variant || "default"}
                size="sm"
                asChild
              >
                <Link href={action.href}>Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface SmartQuickActionsProps {
  totalContacts: number;
  totalSequences: number;
  className?: string;
}

export function SmartQuickActions({
  totalContacts,
  totalSequences,
  className,
}: SmartQuickActionsProps) {
  const actions: QuickAction[] = [];

  // Dynamic actions based on current state
  if (totalContacts === 0) {
    const { UserPlus } = require("lucide-react");
    actions.push({
      icon: UserPlus,
      title: "Add your first contact",
      description: "Start building your network by adding contacts",
      href: "/dashboard/contacts",
      variant: "default",
    });
  }

  if (totalSequences === 0 && totalContacts > 0) {
    const { Zap } = require("lucide-react");
    actions.push({
      icon: Zap,
      title: "Create your first email template",
      description: "Build templates for personalized outreach",
      href: "/compose",
      variant: "default",
    });
  }

  if (actions.length === 0) return null;

  return <ContextualActions actions={actions} className={className} />;
}
