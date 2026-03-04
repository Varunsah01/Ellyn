import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

type PeriodKey = "7d" | "30d" | "90d" | "all";
type NormalizedStatus = "discovered" | "sent" | "replied" | "bounced";

type ContactRow = {
  id: string;
  status: string | null;
  company_name: string | null;
  role: string | null;
  created_at: string | null;
};

type SequenceRow = {
  id: string;
  name: string;
};

type EnrollmentRow = {
  id: string;
  sequence_id: string;
  started_at: string | null;
};

type EnrollmentStepRow = {
  enrollment_id: string;
  status: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
};

const PERIOD_DAYS: Record<Exclude<PeriodKey, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const STATUS_ORDER: NormalizedStatus[] = ["discovered", "sent", "replied", "bounced"];

function normalizeStatus(value: string | null | undefined): NormalizedStatus {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "sent" || raw === "contacted") return "sent";
  if (raw === "replied") return "replied";
  if (raw === "bounced") return "bounced";
  return "discovered";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Number(Math.min(100, value).toFixed(1));
}

function calculateRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clampPercent((numerator / denominator) * 100);
}

function calculatePercentChange(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function atStartOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolvePeriod(searchParams: URLSearchParams): PeriodKey {
  const period = searchParams.get("period")?.trim().toLowerCase();
  if (period === "7d" || period === "30d" || period === "90d" || period === "all") {
    return period;
  }
  return "30d";
}

function getPeriodStart(period: PeriodKey, now: Date): Date | null {
  if (period === "all") return null;
  return addUtcDays(now, -(PERIOD_DAYS[period] - 1));
}

function mapCounts<T extends string>(rows: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const row of rows) {
    counts[row] = (counts[row] ?? 0) + 1;
  }
  return counts;
}

function buildTopValues(values: Array<string | null>, topN = 10): Array<{ label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>();

  for (const rawValue of values) {
    const value = String(rawValue ?? "").trim();
    if (!value) continue;

    const normalized = value.toLowerCase();
    const current = counts.get(normalized);

    if (current) {
      current.count += 1;
    } else {
      counts.set(normalized, { label: value, count: 1 });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, topN);
}

function buildContactsOverTime(contacts: ContactRow[], periodStart: Date | null, now: Date): Array<{ date: string; count: number }> {
  const createdDates = contacts
    .map((contact) => {
      if (!contact.created_at) return null;
      const date = new Date(contact.created_at);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    })
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());

  if (createdDates.length === 0) {
    const fallbackStart = periodStart ?? addUtcDays(now, -29);
    const points: Array<{ date: string; count: number }> = [];

    let cursor = atStartOfUtcDay(fallbackStart);
    const end = atStartOfUtcDay(now);

    while (cursor.getTime() <= end.getTime()) {
      points.push({ date: toDateString(cursor), count: 0 });
      cursor = addUtcDays(cursor, 1);
    }

    return points;
  }

  const firstCreatedDate = createdDates[0]!;
  const start = atStartOfUtcDay(periodStart ?? firstCreatedDate);
  const end = atStartOfUtcDay(now);

  const countsByDate = new Map<string, number>();
  for (const date of createdDates) {
    const key = toDateString(date);
    countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
  }

  const points: Array<{ date: string; count: number }> = [];
  let running = 0;
  let cursor = start;

  while (cursor.getTime() <= end.getTime()) {
    const key = toDateString(cursor);
    running += countsByDate.get(key) ?? 0;
    points.push({ date: key, count: running });
    cursor = addUtcDays(cursor, 1);
  }

  return points;
}

async function fetchEnrollmentSteps(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  enrollmentIds: string[]
): Promise<EnrollmentStepRow[]> {
  if (enrollmentIds.length === 0) return [];

  const chunkSize = 500;
  const allRows: EnrollmentStepRow[] = [];

  for (let index = 0; index < enrollmentIds.length; index += chunkSize) {
    const chunk = enrollmentIds.slice(index, index + chunkSize);

    const { data, error } = await supabase
      .from("sequence_enrollment_steps")
      .select("enrollment_id, status, sent_at, opened_at, replied_at")
      .in("enrollment_id", chunk);

    if (error) throw error;

    allRows.push(...((data ?? []) as EnrollmentStepRow[]));
  }

  return allRows;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const now = new Date();
    const period = resolvePeriod(request.nextUrl.searchParams);
    const periodStart = getPeriodStart(period, now);

    let contactsQuery = supabase
      .from("contacts")
      .select("id, status, company_name, role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (periodStart) {
      contactsQuery = contactsQuery.gte("created_at", periodStart.toISOString());
    }

    const { data: contactsData, error: contactsError } = await contactsQuery;
    if (contactsError) throw contactsError;

    const contacts = (contactsData ?? []) as ContactRow[];

    const normalizedStatuses = contacts.map((contact) => normalizeStatus(contact.status));
    const statusCounts = mapCounts(normalizedStatuses);

    const totalContacts = contacts.length;
    const totalSent = statusCounts.sent ?? 0;
    const totalReplied = statusCounts.replied ?? 0;
    const totalBounced = statusCounts.bounced ?? 0;
    const _replyRate = calculateRate(totalReplied, totalSent);

    // Augment with email_tracking_events (accurate) and email_history (Gmail sends) as fallbacks
    let trackingQuery = supabase
      .from("email_tracking_events")
      .select("event_type")
      .eq("user_id", user.id);

    let historyQuery = supabase
      .from("email_history")
      .select("status")
      .eq("user_id", user.id);

    if (periodStart) {
      trackingQuery = trackingQuery.gte("occurred_at", periodStart.toISOString());
      historyQuery = historyQuery.gte("created_at", periodStart.toISOString());
    }

    const [{ data: trackingEventsData }, { data: emailHistoryData }] = await Promise.all([
      trackingQuery,
      historyQuery,
    ]);

    const trackingRows = (trackingEventsData ?? []) as Array<{ event_type: string }>;
    const trackingSent = trackingRows.filter((r) => r.event_type === "sent").length;
    const trackingReplied = trackingRows.filter((r) => r.event_type === "replied").length;
    const trackingBounced = trackingRows.filter((r) => r.event_type === "bounced").length;

    const historySent = ((emailHistoryData ?? []) as Array<{ status: string | null }>)
      .filter((r) => r.status === "sent").length;

    // Priority: email_tracking_events > email_history > contact status counts
    const effectiveSent = trackingSent > 0 ? trackingSent : historySent > 0 ? historySent : totalSent;
    const effectiveReplied = trackingSent > 0 ? trackingReplied : totalReplied;
    const effectiveBounced = trackingSent > 0 ? trackingBounced : totalBounced;
    const effectiveReplyRate = calculateRate(effectiveReplied, effectiveSent);

    const contactsByStatus = STATUS_ORDER.map((status) => ({
      status,
      count: statusCounts[status] ?? 0,
    }));

    const contactsOverTime = buildContactsOverTime(contacts, periodStart, now);

    const topCompanies = buildTopValues(contacts.map((contact) => contact.company_name)).map((item) => ({
      company_name: item.label,
      count: item.count,
    }));

    const topRoles = buildTopValues(contacts.map((contact) => contact.role)).map((item) => ({
      role: item.label,
      count: item.count,
    }));

    const { data: sequencesData, error: sequencesError } = await supabase
      .from("sequences")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (sequencesError) throw sequencesError;

    const sequences = (sequencesData ?? []) as SequenceRow[];
    const sequenceIds = sequences.map((sequence) => sequence.id);

    let enrollments: EnrollmentRow[] = [];
    if (sequenceIds.length > 0) {
      let enrollmentsQuery = supabase
        .from("sequence_enrollments")
        .select("id, sequence_id, started_at")
        .in("sequence_id", sequenceIds);

      if (periodStart) {
        enrollmentsQuery = enrollmentsQuery.gte("started_at", periodStart.toISOString());
      }

      const { data: enrollmentsData, error: enrollmentsError } = await enrollmentsQuery;
      if (enrollmentsError) throw enrollmentsError;

      enrollments = (enrollmentsData ?? []) as EnrollmentRow[];
    }

    const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
    const enrollmentSteps = await fetchEnrollmentSteps(supabase, enrollmentIds);

    const stepsByEnrollment = new Map<string, EnrollmentStepRow[]>();
    for (const step of enrollmentSteps) {
      const list = stepsByEnrollment.get(step.enrollment_id) ?? [];
      list.push(step);
      stepsByEnrollment.set(step.enrollment_id, list);
    }

    const enrollmentsBySequence = new Map<string, EnrollmentRow[]>();
    for (const enrollment of enrollments) {
      const list = enrollmentsBySequence.get(enrollment.sequence_id) ?? [];
      list.push(enrollment);
      enrollmentsBySequence.set(enrollment.sequence_id, list);
    }

    const sequencePerformance = sequences.map((sequence) => {
      const sequenceEnrollments = enrollmentsBySequence.get(sequence.id) ?? [];

      let sent = 0;
      let opened = 0;
      let replied = 0;

      for (const enrollment of sequenceEnrollments) {
        const steps = stepsByEnrollment.get(enrollment.id) ?? [];

        for (const step of steps) {
          const isSent = Boolean(step.sent_at) || String(step.status ?? "").toLowerCase() === "sent";
          if (isSent) sent += 1;
          if (step.opened_at) opened += 1;
          if (step.replied_at) replied += 1;
        }
      }

      return {
        id: sequence.id,
        name: sequence.name,
        enrolled: sequenceEnrollments.length,
        sent,
        opened,
        replied,
        replyRate: calculateRate(replied, sent),
      };
    });

    // Backward-compatible fields still used in other dashboard modules.
    let previousContacts = 0;
    let previousSent = 0;
    let previousReplied = 0;

    if (period !== "all") {
      const periodDays = PERIOD_DAYS[period as Exclude<PeriodKey, "all">];
      const previousPeriodStart = addUtcDays(now, -(periodDays * 2 - 1));
      const previousPeriodEnd = addUtcDays(now, -(periodDays - 1));

      const { data: previousContactsData, error: previousError } = await supabase
        .from("contacts")
        .select("status")
        .eq("user_id", user.id)
        .gte("created_at", previousPeriodStart.toISOString())
        .lt("created_at", previousPeriodEnd.toISOString());

      if (previousError) throw previousError;

      for (const row of (previousContactsData ?? []) as Array<{ status: string | null }>) {
        const status = normalizeStatus(row.status);
        previousContacts += 1;
        if (status === "sent") previousSent += 1;
        if (status === "replied") previousReplied += 1;
      }
    }

    const payload = {
      overview: {
        totalContacts,
        totalSent: effectiveSent,
        totalReplied: effectiveReplied,
        totalBounced: effectiveBounced,
        replyRate: effectiveReplyRate,
      },
      contactsByStatus,
      contactsOverTime,
      topCompanies,
      topRoles,
      sequencePerformance,

      // Backward-compatible aliases
      totalContacts,
      totalSent: effectiveSent,
      totalReplied: effectiveReplied,
      replyRate: effectiveReplyRate,
      periodComparison: {
        contacts: calculatePercentChange(totalContacts, previousContacts),
        sent: calculatePercentChange(totalSent, previousSent),
      },
      previousPeriod: {
        contacts: previousContacts,
        sent: previousSent,
        replied: previousReplied,
        replyRate: calculateRate(previousReplied, previousSent),
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch analytics",
      },
      { status: 500 }
    );
  }
}

