"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface TopItem {
  name: string;
  count: number;
}

interface SourceBreakdown {
  source: string;
  count: number;
  percentage: string;
}

interface ContactInsightsProps {
  topCompanies: TopItem[];
  topRoles: TopItem[];
  sourceBreakdown: SourceBreakdown[];
  topTags: TopItem[];
  loading?: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)",
  "hsl(48, 96%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(14, 100%, 57%)",
];

/**
 * Render the ContactInsights component.
 * @param {ContactInsightsProps} props - Component props.
 * @returns {unknown} JSX output for ContactInsights.
 * @example
 * <ContactInsights />
 */
export function ContactInsights({
  topCompanies,
  topRoles,
  sourceBreakdown,
  topTags,
  loading,
}: ContactInsightsProps) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Top Companies */}
      <Card>
        <CardHeader>
          <CardTitle>Top Companies</CardTitle>
          <CardDescription>Companies with the most contacts</CardDescription>
        </CardHeader>
        <CardContent>
          {topCompanies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No company data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCompanies.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Roles */}
      <Card>
        <CardHeader>
          <CardTitle>Top Job Titles</CardTitle>
          <CardDescription>Most common roles in your contacts</CardDescription>
        </CardHeader>
        <CardContent>
          {topRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No role data available
            </div>
          ) : (
            <div className="space-y-4">
              {topRoles.slice(0, 8).map((role) => {
                const total = topRoles.reduce((sum, r) => sum + r.count, 0);
                const percentage = (role.count / total) * 100;

                return (
                  <div key={role.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate flex-1">{role.name}</span>
                      <span className="text-muted-foreground ml-2">{role.count}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Source</CardTitle>
          <CardDescription>Where your contacts come from</CardDescription>
        </CardHeader>
        <CardContent>
          {sourceBreakdown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No source data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sourceBreakdown}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {sourceBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tags Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Tags</CardTitle>
          <CardDescription>Most frequently used tags</CardDescription>
        </CardHeader>
        <CardContent>
          {topTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tags data available
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {topTags.map((tag) => (
                <div
                  key={tag.name}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20"
                >
                  <span className="font-medium text-sm">{tag.name}</span>
                  <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                    {tag.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
