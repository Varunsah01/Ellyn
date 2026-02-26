"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"

// Purple gradient scale: Contacts → Replied
const STAGE_COLORS = ["#6366F1", "#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD"]

interface OutreachFunnelProps {
  contactsFound: number
  emailsSent: number
  opened: number
  clicked: number
  replied: number
  loading?: boolean
}

interface FunnelRow {
  stage: string
  value: number
  key: string
  pct: string
}

const STAGE_KEYS = ["contacts", "sent", "opened", "clicked", "replied"] as const

export function OutreachFunnel({
  contactsFound,
  emailsSent,
  opened,
  clicked,
  replied,
  loading,
}: OutreachFunnelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const stages: FunnelRow[] = [
    { stage: "Contacts Found", value: contactsFound, key: "contacts", pct: "100%" },
    {
      stage: "Emails Sent",
      value: emailsSent,
      key: "sent",
      pct: contactsFound > 0 ? `${Math.round((emailsSent / contactsFound) * 100)}%` : "0%",
    },
    {
      stage: "Opened",
      value: opened,
      key: "opened",
      pct: emailsSent > 0 ? `${Math.round((opened / emailsSent) * 100)}%` : "0%",
    },
    {
      stage: "Clicked",
      value: clicked,
      key: "clicked",
      pct: opened > 0 ? `${Math.round((clicked / opened) * 100)}%` : "0%",
    },
    {
      stage: "Replied",
      value: replied,
      key: "replied",
      pct: emailsSent > 0 ? `${Math.round((replied / emailsSent) * 100)}%` : "0%",
    },
  ]

  const handleBarClick = (data: unknown) => {
    const row = data as { activePayload?: { payload: FunnelRow }[] }
    const key = row.activePayload?.[0]?.payload?.key
    if (!key) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("filter", key)
    router.push(`/dashboard/contacts?${params.toString()}`)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outreach Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    )
  }

  const hasData = emailsSent > 0

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outreach Funnel</CardTitle>
          <CardDescription>
            Contacts Found → Sent → Opened → Clicked → Replied
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
            <Mail className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Send your first email to start tracking
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Outreach Funnel</CardTitle>
        <CardDescription>Click a bar to filter contacts by stage</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            layout="vertical"
            data={stages}
            margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
            onClick={handleBarClick}
            style={{ cursor: "pointer" }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              width={100}
              tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              // Recharts' Formatter type is overly strict about undefined; cast to silence it
              formatter={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((value: number, _: unknown, item: { payload: FunnelRow }) =>
                  [`${(value ?? 0).toLocaleString()} (${item?.payload?.pct ?? ""})`, "Count"]
                ) as any // eslint-disable-line @typescript-eslint/no-explicit-any
              }
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              animationDuration={800}
              animationBegin={0}
              label={{
                position: "right",
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter: ((_v: unknown, _n: unknown, _p: unknown, _i: unknown, _pl: unknown, index: unknown) =>
                  stages[index as number]?.pct ?? ""
                ) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              }}
            >
              {stages.map((_, i) => (
                <Cell
                  key={STAGE_KEYS[i] ?? i}
                  fill={STAGE_COLORS[i] ?? STAGE_COLORS[STAGE_COLORS.length - 1]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
