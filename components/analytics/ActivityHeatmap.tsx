"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface HeatmapData {
  day: string;
  dayIndex: number;
  hours: Array<{ hour: number; count: number }>;
}

interface ActivityHeatmapProps {
  data: HeatmapData[];
  loading?: boolean;
}

/**
 * Render the ActivityHeatmap component.
 * @param {ActivityHeatmapProps} props - Component props.
 * @returns {unknown} JSX output for ActivityHeatmap.
 * @example
 * <ActivityHeatmap />
 */
export function ActivityHeatmap({ data, loading }: ActivityHeatmapProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Heatmap</CardTitle>
          <CardDescription>Email activity by day of week and hour</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
            <p className="text-sm text-muted-foreground">Send emails to see your activity heatmap.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find max count for color scaling
  const maxCount = Math.max(
    ...data.flatMap((day) => day.hours.map((hour) => hour.count)),
    1
  );

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-slate-100 dark:bg-slate-800";
    const intensity = count / maxCount;
    if (intensity > 0.75) return "bg-green-600";
    if (intensity > 0.5) return "bg-green-500";
    if (intensity > 0.25) return "bg-green-400";
    return "bg-green-300";
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Heatmap</CardTitle>
        <CardDescription>Email activity by day of week and hour</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Hour labels */}
          <div className="flex">
            <div className="w-12" /> {/* Space for day labels */}
            <div className="flex-1 grid grid-cols-24 gap-1">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-xs text-center text-muted-foreground"
                  style={{ fontSize: "10px" }}
                >
                  {hour % 6 === 0 ? hour : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap grid */}
          {data.map((dayData) => (
            <div key={dayData.day} className="flex items-center gap-2">
              <div className="w-12 text-sm font-medium text-muted-foreground">
                {dayData.day}
              </div>
              <div className="flex-1 grid grid-cols-24 gap-1">
                {dayData.hours.map((hourData) => (
                  <div
                    key={hourData.hour}
                    className={cn(
                      "aspect-square rounded-sm transition-colors cursor-pointer hover:ring-2 hover:ring-primary",
                      getHeatmapColor(hourData.count)
                    )}
                    title={`${dayData.day} ${hourData.hour}:00 - ${hourData.count} emails`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 pt-4 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded-sm bg-slate-100 dark:bg-slate-800" />
              <div className="w-4 h-4 rounded-sm bg-green-300" />
              <div className="w-4 h-4 rounded-sm bg-green-400" />
              <div className="w-4 h-4 rounded-sm bg-green-500" />
              <div className="w-4 h-4 rounded-sm bg-green-600" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
