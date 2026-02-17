"use client";

import { AlertCircle, Gauge, MessageCircleReply, Send, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface TrackerCompanyMetric {
  company: string;
  sent: number;
  replied: number;
  replyRate: number;
}

interface TrackerPerformanceData {
  totalTracked: number;
  drafted: number;
  sent: number;
  replied: number;
  noResponse: number;
  followUpNeeded: number;
  replyRate: number;
  topCompanies: TrackerCompanyMetric[];
}

interface TrackerPerformanceProps {
  data: TrackerPerformanceData | null;
  loading?: boolean;
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

/**
 * Render the TrackerPerformance component.
 * @param {TrackerPerformanceProps} props - Component props.
 * @returns {unknown} JSX output for TrackerPerformance.
 * @example
 * <TrackerPerformance />
 */
export function TrackerPerformance({ data, loading }: TrackerPerformanceProps) {
  if (!data && !loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tracker Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniMetric label="Tracked Contacts" value={data?.totalTracked || 0} icon={Users} />
              <MiniMetric label="Reply Rate" value={`${data?.replyRate || 0}%`} icon={Gauge} />
              <MiniMetric label="Replied" value={data?.replied || 0} icon={MessageCircleReply} />
              <MiniMetric label="Needs Follow-up" value={data?.followUpNeeded || 0} icon={AlertCircle} />
            </div>

            <div className="rounded-lg border bg-background/60 p-3">
              <h4 className="mb-2 text-sm font-semibold">Tracker Funnel</h4>
              <div className="grid gap-2 text-sm sm:grid-cols-4">
                <p className="rounded border px-2 py-1">Drafted: {data?.drafted || 0}</p>
                <p className="rounded border px-2 py-1">Sent: {data?.sent || 0}</p>
                <p className="rounded border px-2 py-1">No response: {data?.noResponse || 0}</p>
                <p className="rounded border px-2 py-1">Replied: {data?.replied || 0}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Best Companies by Reply Rate</h4>
              </div>
              {!data?.topCompanies?.length ? (
                <p className="text-sm text-muted-foreground">Not enough tracker activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.topCompanies.map((item) => (
                    <div key={item.company} className="flex items-center justify-between text-sm">
                      <span>{item.company}</span>
                      <span className="text-muted-foreground">
                        {item.replyRate}% ({item.replied}/{item.sent})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

