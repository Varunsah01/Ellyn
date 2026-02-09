import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { startOfDay, endOfDay, subDays, format, startOfWeek, endOfWeek } from "date-fns";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || '';

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables." },
      { status: 503 }
    );
  }

  try {
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
        return await getOverviewMetrics(start, end, compareWith === "previous_period");

      case "contacts_over_time":
        return await getContactsOverTime(start, end);

      case "sequence_performance":
        return await getSequencePerformance(start, end);

      case "contact_insights":
        return await getContactInsights(start, end);

      case "email_patterns":
        return await getEmailPatterns(start, end);

      case "activity_heatmap":
        return await getActivityHeatmap(start, end);

      case "top_performing":
        return await getTopPerforming(start, end);

      default:
        return NextResponse.json(
          { error: "Invalid metric parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}

// Overview Metrics
async function getOverviewMetrics(start: Date, end: Date, withComparison: boolean): Promise<NextResponse> {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Total contacts
  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  // Total drafts
  const { count: totalDrafts } = await supabase
    .from("drafts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  // Emails sent (from outreach table)
  const { count: emailsSent } = await supabase
    .from("outreach")
    .select("*", { count: "exact", head: true })
    .gte("sent_at", startStr)
    .lte("sent_at", endStr)
    .not("sent_at", "is", null);

  // Reply rate calculation
  const { data: outreachData } = await supabase
    .from("outreach")
    .select("status")
    .gte("sent_at", startStr)
    .lte("sent_at", endStr)
    .not("sent_at", "is", null);

  const totalSent = outreachData?.length || 0;
  const repliedCount = outreachData?.filter((o) => o.status === "replied").length || 0;
  const replyRate = totalSent > 0 ? ((repliedCount / totalSent) * 100).toFixed(1) : "0.0";

  // Best performing sequence
  const { data: sequencePerfData } = await supabase.rpc("get_sequence_performance", {
    start_date: startStr,
    end_date: endStr,
  }).limit(1).single();

  const sequencePerf = sequencePerfData as any;

  // Most active day/time
  const { data: activityData } = await supabase
    .from("outreach")
    .select("sent_at")
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

    const prevMetrics = await getOverviewMetrics(prevStart, prevEnd, false);
    const prevData = await prevMetrics.json();

    comparison = {
      contacts: (totalContacts || 0) - (prevData.data.totalContacts || 0),
      drafts: (totalDrafts || 0) - (prevData.data.totalDrafts || 0),
      emailsSent: (emailsSent || 0) - (prevData.data.emailsSent || 0),
      replyRate: parseFloat(replyRate || "0") - parseFloat(prevData.data.replyRate || "0"),
    };
  }

  return NextResponse.json({
    data: {
      totalContacts,
      totalDrafts,
      emailsSent,
      replyRate,
      bestPerformingSequence: sequencePerf?.name || "N/A",
      bestPerformingReplyRate: sequencePerf?.reply_rate?.toFixed(1) || "0.0",
      mostActiveDay,
      mostActiveHour: mostActiveHour !== "N/A" ? `${mostActiveHour}:00` : "N/A",
    },
    comparison,
  });
}

// Contacts Over Time
async function getContactsOverTime(start: Date, end: Date) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("created_at")
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
async function getSequencePerformance(start: Date, end: Date) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: sequences } = await supabase
    .from("sequences")
    .select("id, name, created_at");

  if (!sequences) {
    return NextResponse.json({ data: [] });
  }

  const performance = await Promise.all(
    sequences.map(async (seq) => {
      const { data: outreach } = await supabase
        .from("outreach")
        .select("status, sent_at")
        .eq("sequence_id", seq.id)
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
async function getContactInsights(start: Date, end: Date) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  // Top companies
  const { data: contacts } = await supabase
    .from("contacts")
    .select("company, role, source, tags, confirmed_email, inferred_email")
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
async function getEmailPatterns(start: Date, end: Date) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("confirmed_email, inferred_email, inference_pattern, confidence_score")
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
async function getActivityHeatmap(start: Date, end: Date) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data } = await supabase
    .from("outreach")
    .select("sent_at")
    .gte("sent_at", format(start, "yyyy-MM-dd"))
    .lte("sent_at", format(end, "yyyy-MM-dd"))
    .not("sent_at", "is", null);

  if (!data) {
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
      heatmap[day][hour] += 1;
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
async function getTopPerforming(start: Date, end: Date) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  // Get top 3 sequences by reply rate
  const { data: sequencePerf } = await supabase
    .from("sequences")
    .select("id, name");

  if (!sequencePerf) {
    return NextResponse.json({ data: {} });
  }

  const sequenceStats = await Promise.all(
    sequencePerf.map(async (seq) => {
      const { data: outreach } = await supabase
        .from("outreach")
        .select("status")
        .eq("sequence_id", seq.id)
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
