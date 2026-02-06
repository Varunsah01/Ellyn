export const chartColors = {
  primary: "#3B82F6", // Blue
  secondary: "#8B5CF6", // Purple
  success: "#10B981", // Green
  warning: "#F59E0B", // Orange
  danger: "#EF4444", // Red
  neutral: "#6B7280", // Gray
  accent: "#EC4899", // Pink
  info: "#06B6D4", // Cyan
};

export const chartTheme = {
  light: {
    text: "#1F2937",
    grid: "#E5E7EB",
    background: "#FFFFFF",
    tooltip: {
      background: "#FFFFFF",
      border: "#E5E7EB",
      text: "#1F2937",
    },
  },
  dark: {
    text: "#F9FAFB",
    grid: "#374151",
    background: "#1F2937",
    tooltip: {
      background: "#1F2937",
      border: "#374151",
      text: "#F9FAFB",
    },
  },
};

export const defaultChartConfig = {
  margin: { top: 5, right: 30, left: 20, bottom: 5 },
  animationDuration: 300,
  gridStrokeDasharray: "3 3",
  tooltipCursor: { fill: "rgba(0, 0, 0, 0.05)" },
};

export function getColorByIndex(index: number): string {
  const colors = Object.values(chartColors);
  return colors[index % colors.length];
}
