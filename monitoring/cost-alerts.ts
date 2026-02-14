import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type AlertLevel = "CRITICAL" | "WARNING" | "INFO"

type CostSummary = {
  dailyCost: number
  weeklyCost: number
  monthlyCost: number
  projectedMonthlyCost: number
  generatedAtUtc: string
}

type AlertEvent = {
  level: AlertLevel
  message: string
  metric: "daily" | "weekly" | "monthly" | "projection"
  valueUsd: number
  thresholdUsd: number
}

type AnalyticsRpcRow = {
  total_cost_usd: number
}

const COST_THRESHOLDS = {
  daily: toNumberEnv("COST_THRESHOLD_DAILY", 50),
  weekly: toNumberEnv("COST_THRESHOLD_WEEKLY", 300),
  monthly: toNumberEnv("COST_THRESHOLD_MONTHLY", 1000),
}

const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || "alerts@ellyn.app"
const ALERT_EMAIL_TO = (process.env.ALERT_EMAIL_TO || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

export async function checkCostsAndAlert() {
  const supabase = createSupabaseServiceClient()

  const [dailyCost, weeklyCost, monthlyCost] = await Promise.all([
    getPeriodCost(supabase, "day"),
    getPeriodCost(supabase, "week"),
    getPeriodCost(supabase, "month"),
  ])

  const projectedMonthlyCost = roundTo(Math.max(dailyCost * 30, (weeklyCost / 7) * 30), 6)
  const generatedAtUtc = new Date().toISOString()

  const summary: CostSummary = {
    dailyCost,
    weeklyCost,
    monthlyCost,
    projectedMonthlyCost,
    generatedAtUtc,
  }

  const alerts = evaluateThresholds(summary)
  for (const alert of alerts) {
    await sendAlert(alert.level, alert.message, {
      ...summary,
      alert,
    })
  }

  return {
    ...summary,
    thresholds: COST_THRESHOLDS,
    alertsSent: alerts.length,
    alerts,
  }
}

export async function runCostAlertCheck() {
  return checkCostsAndAlert()
}

async function getPeriodCost(
  supabase: SupabaseClient,
  period: "day" | "week" | "month"
): Promise<number> {
  const rpc = await supabase.rpc("get_admin_analytics", { p_period: period })
  if (!rpc.error) {
    const row = (Array.isArray(rpc.data) ? rpc.data[0] : rpc.data) as AnalyticsRpcRow | undefined
    if (row) {
      return roundTo(Number(row.total_cost_usd || 0), 6)
    }
  } else if (!isMissingDbObjectError(rpc.error)) {
    console.error("[cost-alerts] get_admin_analytics RPC failed:", {
      code: rpc.error.code,
      message: rpc.error.message,
      period,
    })
  }

  return fallbackPeriodCostFromTable(supabase, period)
}

async function fallbackPeriodCostFromTable(
  supabase: SupabaseClient,
  period: "day" | "week" | "month"
): Promise<number> {
  const days = period === "day" ? 1 : period === "week" ? 7 : 30
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("api_costs")
    .select("cost_usd, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(100000)

  if (error) {
    throw new Error(
      `[cost-alerts] Failed querying api_costs fallback (${period}): ${error.code} ${error.message}`
    )
  }

  const total = (Array.isArray(data) ? data : []).reduce((sum, row) => {
    return sum + Number(row.cost_usd || 0)
  }, 0)

  return roundTo(total, 6)
}

function evaluateThresholds(summary: CostSummary): AlertEvent[] {
  const alerts: AlertEvent[] = []

  if (summary.dailyCost > COST_THRESHOLDS.daily) {
    alerts.push({
      level: "CRITICAL",
      metric: "daily",
      valueUsd: summary.dailyCost,
      thresholdUsd: COST_THRESHOLDS.daily,
      message: `Daily API cost exceeded: $${summary.dailyCost.toFixed(6)} (threshold: $${COST_THRESHOLDS.daily.toFixed(2)})`,
    })
  }

  if (summary.weeklyCost > COST_THRESHOLDS.weekly) {
    alerts.push({
      level: "WARNING",
      metric: "weekly",
      valueUsd: summary.weeklyCost,
      thresholdUsd: COST_THRESHOLDS.weekly,
      message: `Weekly API cost exceeded: $${summary.weeklyCost.toFixed(6)} (threshold: $${COST_THRESHOLDS.weekly.toFixed(2)})`,
    })
  }

  if (summary.monthlyCost > COST_THRESHOLDS.monthly) {
    alerts.push({
      level: "CRITICAL",
      metric: "monthly",
      valueUsd: summary.monthlyCost,
      thresholdUsd: COST_THRESHOLDS.monthly,
      message: `Monthly API cost exceeded: $${summary.monthlyCost.toFixed(6)} (threshold: $${COST_THRESHOLDS.monthly.toFixed(2)})`,
    })
  }

  if (summary.projectedMonthlyCost > COST_THRESHOLDS.monthly) {
    alerts.push({
      level: "INFO",
      metric: "projection",
      valueUsd: summary.projectedMonthlyCost,
      thresholdUsd: COST_THRESHOLDS.monthly,
      message: `Projected monthly cost is high: $${summary.projectedMonthlyCost.toFixed(6)} (budget: $${COST_THRESHOLDS.monthly.toFixed(2)})`,
    })
  }

  return alerts
}

async function sendAlert(level: AlertLevel, message: string, context: Record<string, unknown>) {
  const payload = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  }

  console.log("[cost-alerts] Alert:", payload)

  await Promise.allSettled([
    sendSlackAlert(payload),
    sendWebhookAlert(payload),
    sendEmailAlert(payload),
  ])
}

async function sendSlackAlert(payload: Record<string, unknown>) {
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim()
  if (!webhook) return

  const level = String(payload.level || "INFO")
  const color = level === "CRITICAL" ? "#dc2626" : level === "WARNING" ? "#f59e0b" : "#2563eb"

  const body = {
    attachments: [
      {
        color,
        title: `[${level}] Ellyn Cost Alert`,
        text: String(payload.message || ""),
        fields: [
          {
            title: "Context",
            value: "```" + JSON.stringify(payload.context || {}, null, 2) + "```",
            short: false,
          },
        ],
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`[cost-alerts] Slack alert failed with status ${response.status}`)
  }
}

async function sendWebhookAlert(payload: Record<string, unknown>) {
  const webhook = process.env.COST_ALERT_WEBHOOK_URL?.trim()
  if (!webhook) return

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`[cost-alerts] Generic webhook alert failed with status ${response.status}`)
  }
}

async function sendEmailAlert(payload: Record<string, unknown>) {
  const sendGridApiKey = process.env.SENDGRID_API_KEY?.trim()
  if (!sendGridApiKey || ALERT_EMAIL_TO.length === 0) return

  const subject = `[${String(payload.level || "INFO")}] Ellyn API Cost Alert`
  const text = `${String(payload.message || "")}\n\nContext:\n${JSON.stringify(payload.context || {}, null, 2)}`

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendGridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: ALERT_EMAIL_TO.map((email) => ({ email })) }],
      from: { email: ALERT_EMAIL_FROM },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  })

  if (!response.ok) {
    throw new Error(`[cost-alerts] SendGrid alert failed with status ${response.status}`)
  }
}

function createSupabaseServiceClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) for cost alerts")
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for cost alerts")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((Number(value) || 0) * factor) / factor
}

function toNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === "42P01" || code === "PGRST202" || code === "42883"
}

if (process.argv[1]?.includes("cost-alerts")) {
  checkCostsAndAlert()
    .then((result) => {
      console.log("[cost-alerts] Completed:", result)
      process.exitCode = 0
    })
    .catch((error) => {
      console.error("[cost-alerts] Failed:", error)
      process.exitCode = 1
    })
}
