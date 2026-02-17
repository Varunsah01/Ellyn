"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { chartColors, defaultChartConfig } from "@/lib/utils/chart-config";
import { useTheme } from "next-themes";

interface DataSeries {
  name: string;
  dataKey: string;
  color?: string;
}

interface LineChartProps {
  title?: string;
  description?: string;
  data: any[];
  series: DataSeries[];
  xAxisKey: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
}

/**
 * Render the LineChart component.
 * @param {LineChartProps} props - Component props.
 * @returns {unknown} JSX output for LineChart.
 * @example
 * <LineChart />
 */
export function LineChart({
  title,
  description,
  data,
  series,
  xAxisKey,
  height = 300,
  showLegend = true,
  showGrid = true,
}: LineChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const textColor = isDark ? "#F9FAFB" : "#1F2937";
  const gridColor = isDark ? "#374151" : "#E5E7EB";

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsLineChart
            data={data}
            margin={defaultChartConfig.margin}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray={defaultChartConfig.gridStrokeDasharray}
                stroke={gridColor}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke={textColor}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={textColor}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
                border: `1px solid ${isDark ? "#374151" : "#E5E7EB"}`,
                borderRadius: "8px",
                color: textColor,
              }}
              cursor={defaultChartConfig.tooltipCursor}
            />
            {showLegend && (
              <Legend
                wrapperStyle={{ color: textColor }}
                iconType="line"
              />
            )}
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color || chartColors.primary}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
                animationDuration={defaultChartConfig.animationDuration}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
