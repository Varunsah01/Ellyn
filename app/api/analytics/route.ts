import { NextRequest, NextResponse } from "next/server";
import { subDays, format } from "date-fns";
import { getAuthenticatedUser } from "@/lib/auth/helpers";
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createServiceRoleClient>>

/**
 * Handle GET requests for `/api/analytics`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/analytics request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/analytics
 * fetch('/api/analytics')
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createServiceRoleClient();
    const searchParams = request.nextUrl.searchParams;
    const metric = searchParams.get("metric");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const compareWith = searchParams.get("compareWith"); // 'previous_period'

    // Default to last 30 days if no date range specified
    const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate) : new Date();

    switch (metric) {
      case "overview":
        return await getOverviewMetrics(supabase, start, end, compareWith === "previous_period", user.id);

      case "contacts_over_time":
        return await getContactsOverTime(supabase, start, end, user.id);

      case "sequence_performance":
        return await getSequencePerformance(supabase, start, end, user.id);

      case "contact_insights":
        return await getContactInsights(supabase, start, end, user.id);

      case "email_patterns":
        return await getEmailPatterns(supabase, start, end, user.id);

      case "activity_heatmap":
        return await getActivityHeatmap(supabase, start, end, user.id);

      case "tracker_performance":
        return await getTrackerPerformance(supabase, start, end, user.id);

      case "top_performing":
        return await getTopPerforming(supabase, start, end, user.id);

      default:
        return NextResponse.json(
          { error: "Invalid metric parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Analytics API] Error:", error);
    captureApiException(error, { route: '/api/analytics', method: 'GET' })
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}

// Overview Metrics
async function getOverviewMetrics(
  supabase: SupabaseClient,
  start: Date,
  end: Date,
  withComparison: boolean,
  userId: string
): Promise<NextResponse> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Total contacts
  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  // Total drafts
  const { count: totalDrafts } = await supabase
    .from("drafts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  // Emails sent (from outreach table)
  const { count: _emailsSent } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("sent_at", startStr)
    .lte("sent_at", endStr)
    .not("sent_at", "is", null);

  // Reply rate calculation
  const { data: outreachData } = await supabase
    .from("outreach")
    .select("status")
    .eq("user_id", userId)
    .gte("sent_at", startStr)
    .lte("sent_at", endStr)
    .not("sent_at", "is", null);

  const outreachTotalSent = outreachData?.length || 0;
  const outreachReplied = outreachData?.filter((o) => o.status === "replied").length || 0;

  // Check email_tracking_events for more accurate counts (preferred over outreach table)
  const { data: trackingData } = await supabase
    .from("email_tracking_events")
    .select("event_type")
    .eq("user_id", userId)
    .gte("occurred_at", startStr)
    .lte("occurred_at", endStr);

  const trackingSent = trackingData?.filter((e) => e.event_type === "sent").length ?? 0;
  const trackingReplied = trackingData?.filter((e) => e.event_type === "replied").length ?? 0;

  // Use tracking events if available, outreach fallback otherwise
  const totalSent = trackingSent > 0 ? trackingSent : outreachTotalSent;
  const repliedCount = trackingSent > 0 ? trackingReplied : outreachReplied;
  // Return null when no emails sent so the UI can show "—" instead of "0%"
  const replyRate = totalSent > 0 ? ((repliedCount / totalSent) * 100).toFixed(1) : null;

  // Best performing sequence
  const sequencePerfResponse = await getSequencePerformance(supabase, start, end, userId);
  const sequencePerfPayload = await sequencePerfResponse.json();
  const sequencePerf = Array.isArray(sequencePerfPayload?.data)
    ? sequencePerfPayload.data[0]
    : null;

  // Most active day/time
  const { data: activityData } = await supabase
    .from("outreach")
    .select("sent_at")
    .eq("user_id", userId)
    .gte("sent_at", startStr)
    .lte("sent_at", endStr)
    .not("sent_at", "is", null);

  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};

  activityData?.forEach((item) => {
    if (item.sent_at) {
      const date = new Date(item.sent_at);
      const day = format(date, "EEEE");
      const hour = date.getHours();

      dayCount[day] = (dayCount[day] || 0) + 1;
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    }
  });

  const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  const mostActiveHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  let comparison = null;
  if (withComparison) {
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = subDays(start, daysDiff);
    const prevEnd = subDays(end, daysDiff);

    const prevMetrics = await getOverviewMetrics(supabase, prevStart, prevEnd, false, userId);
    const prevData = await prevMetrics.json();

    comparison = {
      contacts: (totalContacts || 0) - (prevData.data.totalContacts || 0),
      drafts: (totalDrafts || 0) - (prevData.data.totalDrafts || 0),
      emailsSent: totalSent - (prevData.data.emailsSent || 0),
      replyRate: parseFloat(replyRate || "0") - parseFloat(prevData.data.replyRate || "0"),
    };
  }

  return NextResponse.json({
    data: {
      totalContacts: totalContacts ?? 0,
      totalDrafts: totalDrafts ?? 0,
      emailsSent: totalSent,
      // null signals "no data" — UI renders "—" instead of "0%" or fake rate
      replyRate,
      bestPerformingSequence: sequencePerf?.name ?? null,
      bestPerformingReplyRate:
        typeof sequencePerf?.replyRate === "number" && sequencePerf.sent > 0
          ? sequencePerf.replyRate.toFixed(1)
          : null,
      mostActiveDay: mostActiveDay !== "N/A" ? mostActiveDay : null,
      mostActiveHour: mostActiveHour !== "N/A" ? `${mostActiveHour}:00` : null,
    },
    comparison,
  });
}

// Contacts Over Time
async function getContactsOverTime(supabase: SupabaseClient, start: Date, end: Date, userId: string) {
  const { data, error } = await supabase
    .from("contacts")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", format(start, "yyyy-MM-dd"))
    .lte("created_at", format(end, "yyyy-MM-dd"))
    .order("created_at");

  if (error) throw error;

  // Group by date
  const dateCount: Record<string, number> = {};
  data?.forEach((contact) => {
    const date = format(new Date(contact.created_at), "yyyy-MM-dd");
    dateCount[date] = (dateCount[date] || 0) + 1;
  });

  const result = Object.entries(dateCount).map(([date, count]) => ({
    date,
    count,
    label: format(new Date(date), "MMM d"),
  }));

  return NextResponse.json({ data: result });
}

// Sequence Performance
async function getSequencePerformance(supabase: SupabaseClient, start: Date, end: Date, userId: string) {
  const { data: sequences } = await supabase
    .from("sequences")
    .select("id, name, status, created_at")
    .eq("user_id", userId);

  if (!sequences) {
    return NextResponse.json({ data: [] });
  }

  const performance = await Promise.all(
    sequences.map(async (seq) => {
      const { data: outreach } = await supabase
        .from("outreach")
        .select("status, sent_at")
        .eq("sequence_id", seq.id)
        .eq("user_id", userId)
        .gte("sent_at", format(start, "yyyy-MM-dd"))
        .lte("sent_at", format(end, "yyyy-MM-dd"))
        .not("sent_at", "is", null);

      const enrolled = outreach?.length || 0;
      const sent = outreach?.filter((o) => o.sent_at).length || 0;
      const replied = outreach?.filter((o) => o.status === "replied").length || 0;
      const opened = outreach?.filter((o) => o.status === "opened" || o.status === "replied").length || 0;

      const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";
      const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0.0";

      return {
        id: seq.id,
        name: seq.name,
        status: (seq as Record<string, unknown>).status as string | undefined,
        enrolled,
        sent,
        opened,
        replied,
        replyRate: parseFloat(replyRate),
        openRate: parseFloat(openRate),
      };
    })
  );

  // Sort by reply rate descending
  performance.sort((a, b) => b.replyRate - a.replyRate);

  return NextResponse.json({ data: performance });
}

// Contact Insights
async function getContactInsights(supabase: SupabaseClient, start: Date, end: Date, userId: string) {
  // Top companies
  const { data: contacts } = await supabase
    .from("contacts")
    .select("company, role, source, tags, confirmed_email, inferred_email")
    .eq("user_id", userId)
    .gte("created_at", format(start, "yyyy-MM-dd"))
    .lte("created_at", format(end, "yyyy-MM-dd"));

  if (!contacts) {
    return NextResponse.json({ data: {} });
  }

  // Company counts
  const companyCount: Record<string, number> = {};
  contacts.forEach((c) => {
    const company = c.company || "Unknown";
    companyCount[company] = (companyCount[company] || 0) + 1;
  });
  const topCompanies = Object.entries(companyCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([company, count]) => ({ company, count }));

  // Role counts
  const roleCount: Record<string, number> = {};
  contacts.forEach((c) => {
    const role = c.role || "Unknown";
    roleCount[role] = (roleCount[role] || 0) + 1;
  });
  const topRoles = Object.entries(roleCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([role, count]) => ({ role, count }));

  // Source breakdown
  const sourceCount: Record<string, number> = {};
  contacts.forEach((c) => {
    const source = c.source || "Unknown";
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  });
  const sourceBreakdown = Object.entries(sourceCount).map(([source, count]) => ({
    source,
    count,
    percentage: ((count / contacts.length) * 100).toFixed(1),
  }));

  // Tags distribution
  const tagCount: Record<string, number> = {};
  contacts.forEach((c) => {
    const tags = c.tags || [];
    tags.forEach((tag: string) => {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return NextResponse.json({
    data: {
      topCompanies,
      topRoles,
      sourceBreakdown,
      topTags,
    },
  });
}

// Email Patterns
async function getEmailPatterns(supabase: SupabaseClient, start: Date, end: Date, userId: string) {
  const { data: contacts } = await supabase
    .from("contacts")
    .select("confirmed_email, inferred_email, inference_pattern, confidence_score")
    .eq("user_id", userId)
    .gte("created_at", format(start, "yyyy-MM-dd"))
    .lte("created_at", format(end, "yyyy-MM-dd"));

  if (!contacts) {
    return NextResponse.json({ data: {} });
  }

  // Pattern success rates
  const patternStats: Record<
    string,
    { total: number; confirmed: number; avgConfidence: number }
  > = {};

  contacts.forEach((c) => {
    const pattern = c.inference_pattern || "Unknown";
    if (!patternStats[pattern]) {
      patternStats[pattern] = { total: 0, confirmed: 0, avgConfidence: 0 };
    }

    patternStats[pattern].total += 1;
    if (c.confirmed_email) {
      patternStats[pattern].confirmed += 1;
    }
    patternStats[pattern].avgConfidence += c.confidence_score || 0;
  });

  const patternPerformance = Object.entries(patternStats).map(([pattern, stats]) => ({
    pattern,
    total: stats.total,
    confirmed: stats.confirmed,
    successRate: ((stats.confirmed / stats.total) * 100).toFixed(1),
    avgConfidence: (stats.avgConfidence / stats.total).toFixed(1),
  }));

  // Email provider breakdown
  const providerCount: Record<string, number> = {};
  contacts.forEach((c) => {
    const email = c.confirmed_email || c.inferred_email;
    if (email) {
      const domain = email.split("@")[1]?.toLowerCase() || "";
      let provider = "Other";

      if (domain.includes("gmail")) provider = "Gmail";
      else if (domain.includes("outlook") || domain.includes("hotmail")) provider = "Outlook";
      else if (domain.includes("yahoo")) provider = "Yahoo";
      else if (domain.endsWith(".edu")) provider = "Education";
      else if (!domain.includes(".com") && !domain.includes(".net")) provider = "Company";

      providerCount[provider] = (providerCount[provider] || 0) + 1;
    }
  });

  const providerBreakdown = Object.entries(providerCount).map(([provider, count]) => ({
    provider,
    count,
    percentage: ((count / contacts.length) * 100).toFixed(1),
  }));

  return NextResponse.json({
    data: {
      patternPerformance,
      providerBreakdown,
    },
  });
}

// Activity Heatmap
async function getActivityHeatmap(supabase: SupabaseClient, start: Date, end: Date, userId: string) {
  const { data } = await supabase
    .from("outreach")
    .select("sent_at")
    .eq("user_id", userId)
    .gte("sent_at", format(start, "yyyy-MM-dd"))
    .lte("sent_at", format(end, "yyyy-MM-dd"))
    .not("sent_at", "is", null);

  // Return empty array when there is no outreach data so the component shows its empty state
  if (!data || data.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Create heatmap data: day of week (0-6) × hour (0-23)
  const heatmap: number[][] = Array(7)
    .fill(0)
    .map(() => Array(24).fill(0));

  data.forEach((item) => {
    if (item.sent_at) {
      const date = new Date(item.sent_at);
      const day = date.getDay(); // 0 = Sunday
      const hour = date.getHours();
      const row = heatmap[day];
      if (row) {
        row[hour] = (row[hour] ?? 0) + 1;
      }
    }
  });

  // Format for frontend
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result = heatmap.map((hours, dayIndex) => ({
    day: days[dayIndex],
    dayIndex,
    hours: hours.map((count, hourIndex) => ({
      hour: hourIndex,
      count,
    })),
  }));

  return NextResponse.json({ data: result });
}

// Top Performing (Best sequences, templates, etc.)
async function getTopPerforming(supabase: SupabaseClient, start: Date, end: Date, userId: string) {
  // Get top 3 sequences by reply rate
  const { data: sequencePerf } = await supabase
    .from("sequences")
    .select("id, name")
    .eq("user_id", userId);

  if (!sequencePerf) {
    return NextResponse.json({ data: {} });
  }

  const sequenceStats = await Promise.all(
    sequencePerf.map(async (seq) => {
      const { data: outreach } = await supabase
        .from("outreach")
        .select("status")
        .eq("sequence_id", seq.id)
        .eq("user_id", userId)
        .gte("sent_at", format(start, "yyyy-MM-dd"))
        .lte("sent_at", format(end, "yyyy-MM-dd"))
        .not("sent_at", "is", null);

      const total = outreach?.length || 0;
      const replied = outreach?.filter((o) => o.status === "replied").length || 0;
      const replyRate = total > 0 ? (replied / total) * 100 : 0;

      return { ...seq, total, replied, replyRate };
    })
  );

  const topSequences = sequenceStats
    .filter((s) => s.total > 0)
    .sort((a, b) => b.replyRate - a.replyRate)
    .slice(0, 3);

  return NextResponse.json({
    data: {
      topSequences,
    },
  });
}

async function getTrackerPerformance(supabase: SupabaseClient, start: Date, end: Date, userId: string) {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, company, status, created_at, updated_at, last_contacted_at")
    .eq("user_id", userId)
    .gte("created_at", format(start, "yyyy-MM-dd"))
    .lte("created_at", format(end, "yyyy-MM-dd"));

  if (error) throw error;

  const safeContacts = contacts || [];
  if (safeContacts.length === 0) {
    return NextResponse.json({
      data: {
        totalTracked: 0,
        drafted: 0,
        sent: 0,
        replied: 0,
        noResponse: 0,
        followUpNeeded: 0,
        replyRate: 0,
        topCompanies: [],
      },
    });
  }

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const drafted = safeContacts.filter((contact) => contact.status === "new").length;
  const replied = safeContacts.filter((contact) => contact.status === "replied").length;
  const noResponse = safeContacts.filter((contact) => contact.status === "no_response").length;
  const sent = safeContacts.filter((contact) =>
    ["contacted", "replied", "no_response"].includes(contact.status || "")
  ).length;
  const followUpNeeded = safeContacts.filter((contact) => {
    if (!["contacted", "no_response"].includes(contact.status || "")) return false;
    if (!contact.last_contacted_at) return false;
    const contactedAt = new Date(contact.last_contacted_at).getTime();
    if (Number.isNaN(contactedAt)) return false;
    return (now - contactedAt) / oneDayMs > 7;
  }).length;
  const replyRate = sent > 0 ? Number(((replied / sent) * 100).toFixed(1)) : 0;

  const companyMap = new Map<string, { sent: number; replied: number }>();
  for (const contact of safeContacts) {
    const company = (contact.company || "Unknown").trim() || "Unknown";
    const existing = companyMap.get(company) || { sent: 0, replied: 0 };
    if (["contacted", "replied", "no_response"].includes(contact.status || "")) {
      existing.sent += 1;
    }
    if (contact.status === "replied") {
      existing.replied += 1;
    }
    companyMap.set(company, existing);
  }

  const topCompanies = [...companyMap.entries()]
    .map(([company, stats]) => ({
      company,
      sent: stats.sent,
      replied: stats.replied,
      replyRate: stats.sent > 0 ? Number(((stats.replied / stats.sent) * 100).toFixed(1)) : 0,
    }))
    .filter((item) => item.sent > 0)
    .sort((a, b) => b.replyRate - a.replyRate || b.replied - a.replied)
    .slice(0, 5);

  return NextResponse.json({
    data: {
      totalTracked: safeContacts.length,
      drafted,
      sent,
      replied,
      noResponse,
      followUpNeeded,
      replyRate,
      topCompanies,
    },
  });
}
