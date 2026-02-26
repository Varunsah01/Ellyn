"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, Download, ExternalLink, GitBranch, TrendingUp } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"
import { showToast } from "@/lib/toast"
import { cn } from "@/lib/utils"

interface SequencePerformance {
  id: string
  name: string
  enrolled: number
  sent: number
  opened: number
  replied: number
  replyRate: number
  openRate: number
  status?: string
}

interface SequencePerformanceTableProps {
  data: SequencePerformance[]
  loading?: boolean
  persona?: "job_seeker" | "smb_sales"
}

type SortKey = "replyRate" | "openRate" | "sent" | "enrolled"

const STATUS_BADGE: Record<string, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
}

function getPerformanceBadge(rate: number) {
  if (rate >= 40) return <Badge className="bg-green-500 text-white">Excellent</Badge>
  if (rate >= 25) return <Badge className="bg-blue-500 text-white">Good</Badge>
  if (rate >= 15) return <Badge className="bg-yellow-500 text-white">Average</Badge>
  return <Badge variant="secondary">Low</Badge>
}

export function SequencePerformanceTable({
  data,
  loading,
  persona,
}: SequencePerformanceTableProps) {
  const router = useRouter()
  const [sortBy, setSortBy] = useState<SortKey>("replyRate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const handleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortOrder("desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    const mul = sortOrder === "asc" ? 1 : -1
    return (a[sortBy] - b[sortBy]) * mul
  })

  const exportToCSV = () => {
    const headers = [
      "Sequence",
      "Status",
      "Enrolled",
      "Sent",
      "Opened",
      "Replied",
      "Open Rate",
      "Reply Rate",
    ]
    const rows = sortedData.map((r) => [
      r.name,
      r.status ?? "",
      r.enrolled,
      r.sent,
      r.opened,
      r.replied,
      `${r.openRate.toFixed(1)}%`,
      `${r.replyRate.toFixed(1)}%`,
    ])
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sequence-performance-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast.success("CSV exported successfully")
  }

  const SortButton = ({ col, label }: { col: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-1"
      onClick={() => handleSort(col)}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "ml-1 h-3 w-3 transition-colors",
          sortBy === col ? "text-foreground" : "text-muted-foreground"
        )}
      />
    </Button>
  )

  const emptyStateLabel =
    persona === "smb_sales"
      ? "No sales sequences yet"
      : "No sequences yet"
  const emptyStateIcon = persona === "smb_sales" ? TrendingUp : GitBranch

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Sequence Performance</CardTitle>
            <CardDescription>
              {persona === "smb_sales"
                ? "Sales campaign metrics"
                : "Job search outreach metrics"}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={loading ?? data.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {(() => {
              const Icon = emptyStateIcon
              return <Icon className="mb-3 h-8 w-8 text-muted-foreground/30" />
            })()}
            <p className="text-sm font-medium text-muted-foreground">
              {emptyStateLabel}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a sequence to start tracking performance
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sequence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <SortButton col="enrolled" label="Enrolled" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton col="sent" label="Sent" />
                  </TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Replied</TableHead>
                  <TableHead className="text-right">
                    <SortButton col="openRate" label="Open Rate" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton col="replyRate" label="Reply Rate" />
                  </TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() =>
                      router.push(`/dashboard/sequences/${row.id}`)
                    }
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {row.status && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 text-[10px] capitalize",
                            STATUS_BADGE[row.status] ?? STATUS_BADGE.draft
                          )}
                        >
                          {row.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{row.enrolled}</TableCell>
                    <TableCell className="text-right">{row.sent}</TableCell>
                    <TableCell className="text-right">{row.opened}</TableCell>
                    <TableCell className="text-right">{row.replied}</TableCell>
                    <TableCell className="text-right">
                      {row.openRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.replyRate.toFixed(1)}%
                    </TableCell>
                    <TableCell>{getPerformanceBadge(row.replyRate)}</TableCell>
                    <TableCell>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
