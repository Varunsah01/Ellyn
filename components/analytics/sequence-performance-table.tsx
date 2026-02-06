"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { showToast } from "@/lib/toast";

interface SequencePerformance {
  id: string;
  name: string;
  enrolled: number;
  sent: number;
  opened: number;
  replied: number;
  replyRate: number;
  openRate: number;
}

interface SequencePerformanceTableProps {
  data: SequencePerformance[];
  loading?: boolean;
}

export function SequencePerformanceTable({ data, loading }: SequencePerformanceTableProps) {
  const [sortBy, setSortBy] = useState<"replyRate" | "openRate" | "sent">("replyRate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const multiplier = sortOrder === "asc" ? 1 : -1;
    return (a[sortBy] - b[sortBy]) * multiplier;
  });

  const exportToCSV = () => {
    const headers = ["Sequence", "Enrolled", "Sent", "Opened", "Replied", "Open Rate", "Reply Rate"];
    const rows = sortedData.map((row) => [
      row.name,
      row.enrolled,
      row.sent,
      row.opened,
      row.replied,
      `${row.openRate}%`,
      `${row.replyRate}%`,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sequence-performance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast.success("CSV exported successfully");
  };

  const getPerformanceBadge = (rate: number) => {
    if (rate >= 40) return <Badge className="bg-green-500">Excellent</Badge>;
    if (rate >= 25) return <Badge className="bg-blue-500">Good</Badge>;
    if (rate >= 15) return <Badge className="bg-yellow-500">Average</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sequence Performance</CardTitle>
            <CardDescription>Detailed performance metrics for each sequence</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={loading || data.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No sequence data available for the selected period
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sequence</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => handleSort("sent")}
                    >
                      Sent
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Replied</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => handleSort("openRate")}
                    >
                      Open Rate
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => handleSort("replyRate")}
                    >
                      Reply Rate
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.enrolled}</TableCell>
                    <TableCell className="text-right">{row.sent}</TableCell>
                    <TableCell className="text-right">{row.opened}</TableCell>
                    <TableCell className="text-right">{row.replied}</TableCell>
                    <TableCell className="text-right">{row.openRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-bold">{row.replyRate.toFixed(1)}%</TableCell>
                    <TableCell>{getPerformanceBadge(row.replyRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
