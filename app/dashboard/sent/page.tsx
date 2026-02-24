"use client";

import { useSequences } from "@/lib/hooks/useSequences";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export default function SentPage() {
  const { drafts, loading } = useSequences();
  const sentEmails = drafts.filter((d) => d.status === "sent");

  if (loading) {
    return (
      <DashboardShell loading={true}>
        <div />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Sent"
        description="History of your outreach. Good luck!"
      />

      {sentEmails.length > 0 ? (
        <div className="grid gap-4">
          {sentEmails.map((email) => (
            <Card key={email.id} className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">
                        {email.subject || "(No Subject)"}
                      </span>
                      {email.contact_id ? (
                        <Link
                          href={`/dashboard/contacts/${email.contact_id}`}
                          className="text-muted-foreground text-sm hover:text-foreground hover:underline"
                        >
                          to {email.contacts?.full_name || "Unknown"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          to {email.contacts?.full_name || "Unknown"}
                        </span>
                      )}
                    </div>
                    <div className="bg-secondary/30 p-3 rounded-md mb-3 mt-2">
                       <p className="text-muted-foreground text-sm line-clamp-3 font-dm-sans">
                        {email.body}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Sent</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(email.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Future: View Thread Button */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center min-h-[400px] p-8"
          >
            <Card className="max-w-md w-full p-8 text-center border-dashed">
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-10 h-10 text-primary" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No emails sent yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Your sent emails will appear here. Start your first outreach!
                  </p>
                </div>

                <Button asChild>
                  <Link href="/compose">Write First Email</Link>
                </Button>
              </div>
            </Card>
          </motion.div>
      )}
    </DashboardShell>
  );
}
