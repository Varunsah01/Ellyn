import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ProfileRow = {
  plan_type: "free" | "starter" | "pro" | null;
  subscription_status: string | null;
};

type QuotaRow = {
  email_lookups_used: number | null;
  email_lookups_limit: number | null;
  ai_draft_generations_used: number | null;
  ai_draft_generations_limit: number | null;
  reset_date: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("plan_type, subscription_status")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      return NextResponse.json({ error: profileError.message || "Failed to fetch profile" }, { status: 500 });
    }

    const { data: quota, error: quotaError } = await supabase
      .from("user_quotas")
      .select(
        "email_lookups_used, email_lookups_limit, ai_draft_generations_used, ai_draft_generations_limit, reset_date"
      )
      .eq("user_id", user.id)
      .maybeSingle<QuotaRow>();

    if (quotaError) {
      return NextResponse.json({ error: quotaError.message || "Failed to fetch quota" }, { status: 500 });
    }

    return NextResponse.json({
      plan_type: profile?.plan_type ?? "free",
      subscription_status: profile?.subscription_status ?? "active",
      email_lookups_used: quota?.email_lookups_used ?? 0,
      email_lookups_limit: quota?.email_lookups_limit ?? 50,
      ai_draft_generations_used: quota?.ai_draft_generations_used ?? 0,
      ai_draft_generations_limit: quota?.ai_draft_generations_limit ?? 0,
      reset_date: quota?.reset_date ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscription status" },
      { status: 500 }
    );
  }
}
