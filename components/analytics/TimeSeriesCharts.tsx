"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TimeSeriesData {
  date: string;
  count: number;
  label: string;
}

interface TimeSeriesChartsProps {
  contactsData: TimeSeriesData[];
  loading?: boolean;
}

/**
 * Render the TimeSeriesCharts component.
 * @param {TimeSeriesChartsProps} props - Component props.
 * @returns {unknown} JSX output for TimeSeriesCharts.
 * @example
 * <TimeSeriesCharts />
 */
export function TimeSeriesCharts({ contactsData, loading }: TimeSeriesChartsProps) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contacts Added Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] animate-pulse bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contacts Added Over Time</CardTitle>
          <CardDescription>Daily contact acquisition trend</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={contactsData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorCount)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

interface TrendData {
  label: string;
  sent: number;
  replied: number;
}

interface EmailTrendChartsProps {
  data: TrendData[];
  loading?: boolean;
}

/**
 * Render the EmailTrendCharts component.
 * @param {EmailTrendChartsProps} props - Component props.
 * @returns {unknown} JSX output for EmailTrendCharts.
 * @example
 * <EmailTrendCharts />
 */
export function EmailTrendCharts({ data, loading }: EmailTrendChartsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Activity Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Activity Trend</CardTitle>
        <CardDescription>Emails sent and replies received</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="sent"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Sent"
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="replied"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              name="Replied"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
