import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { captureApiException } from "@/lib/monitoring/sentry";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const WEEK_DAYS = new Set([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

type ScheduleDbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface ScheduleReportPayload {
  email?: unknown;
  dayOfWeek?: unknown;
  timeOfDay?: unknown;
}

function extractBearerToken(headers: Headers): string | null {
  const rawAuth = headers.get("authorization");
  if (!rawAuth) return null;

  const match = rawAuth.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function createRequestScopedSupabaseClient(
  request: Pick<Request, "headers">
): Promise<ScheduleDbClient> {
  const token = extractBearerToken(request.headers);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (token && supabaseUrl && supabaseAnonKey) {
    return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }) as unknown as ScheduleDbClient;
  }

  return createServerSupabaseClient();
}

/**
 * Handle POST requests for `/api/v1/analytics/schedule-report`.
 * @param {NextRequest} request - Request input.
 * @returns {Promise<NextResponse>} JSON response for scheduling weekly report delivery.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * fetch('/api/v1/analytics/schedule-report', {
 *   method: 'POST',
 *   body: JSON.stringify({ email: 'user@example.com', dayOfWeek: 'Monday', timeOfDay: '09:00' }),
 * })
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const body = (await request.json().catch(() => null)) as ScheduleReportPayload | null;

    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const dayOfWeek =
      typeof body?.dayOfWeek === "string" ? body.dayOfWeek.trim() : "";
    const timeOfDay =
      typeof body?.timeOfDay === "string" ? body.timeOfDay.trim() : "";

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!WEEK_DAYS.has(dayOfWeek)) {
      return NextResponse.json(
        { success: false, error: "A valid day of week is required." },
        { status: 400 }
      );
    }

    if (!TIME_REGEX.test(timeOfDay)) {
      return NextResponse.json(
        { success: false, error: "A valid time is required (HH:mm)." },
        { status: 400 }
      );
    }

    const schedule = {
      email,
      dayOfWeek,
      timeOfDay,
      enabled: true,
      updatedAt: new Date().toISOString(),
    };

    const supabase = await createRequestScopedSupabaseClient(request);
    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          email_report_schedule: schedule,
        },
        { onConflict: "id" }
      );

    if (error) {
      if (error.code === "42703") {
        return NextResponse.json(
          {
            success: false,
            error:
              "email_report_schedule column is missing. Run migration 007_email_report_schedule.sql.",
          },
          { status: 503 }
        );
      }

      console.error("[analytics/schedule-report] Save error:", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { success: false, error: "Failed to save weekly report schedule." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Weekly report scheduled.",
      schedule,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.error("[analytics/schedule-report] Unexpected error:", error);
    captureApiException(error, {
      route: "/api/v1/analytics/schedule-report",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, error: "Failed to schedule weekly report." },
      { status: 500 }
    );
  }
}
