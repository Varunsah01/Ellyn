"use client";

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  illustration?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  illustration,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center min-h-[400px] p-8"
    >
      <Card className="max-w-md w-full p-8 text-center border-dashed">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="flex flex-col items-center gap-6"
        >
          {illustration || (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="w-10 h-10 text-primary" />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>

          {action && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {action.href ? (
                <Button asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button onClick={action.onClick}>{action.label}</Button>
              )}
            </motion.div>
          )}
        </motion.div>
      </Card>
    </motion.div>
  );
}

// Pre-built empty states for common scenarios
export function EmptyContacts({ onAddContact }: { onAddContact?: () => void }) {
  const { Users } = require("lucide-react");
  return (
    <EmptyState
      icon={Users}
      title="No contacts yet"
      description="Start building your network by adding your first contact from LinkedIn or manually."
      action={{
        label: "Add Your First Contact",
        onClick: onAddContact,
      }}
    />
  );
}

export function EmptySequences() {
  const { Zap } = require("lucide-react");
  return (
    <EmptyState
      icon={Zap}
      title="No email templates yet"
      description="Create your first email template to streamline your outreach efforts."
      action={{
        label: "Create Template",
        href: "/compose",
      }}
    />
  );
}

export function EmptyDrafts() {
  const { Mail } = require("lucide-react");
  return (
    <EmptyState
      icon={Mail}
      title="No drafts yet"
      description="Extract contact information to generate personalized email drafts."
      action={{
        label: "Find Contacts",
        href: "/dashboard/contacts",
      }}
    />
  );
}

export function EmptyAnalytics() {
  const { BarChart3 } = require("lucide-react");
  return (
    <EmptyState
      icon={BarChart3}
      title="No data to display"
      description="Start sending emails to see your analytics and performance metrics."
      action={{
        label: "View Contacts",
        href: "/dashboard/contacts",
      }}
    />
  );
}

export function EmptySearch({ searchQuery }: { searchQuery?: string }) {
  const { Search } = require("lucide-react");
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        searchQuery
          ? `No results found for "${searchQuery}". Try a different search term.`
          : "Try adjusting your search or filters to find what you're looking for."
      }
    />
  );
}
