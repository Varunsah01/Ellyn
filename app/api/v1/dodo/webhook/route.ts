import { NextRequest, NextResponse } from "next/server";

import { getDodoClient } from "@/lib/dodo";
import { resolvePlanTypeFromProductId } from "@/lib/pricing-config";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PlanType = "free" | "starter" | "pro";

type ProfileLookupRow = {
  id: string;
  plan_type: PlanType | null;
};

type UpdateRow = {
  id: string;
};

const PLAN_LIMITS: Record<PlanType, { email: number; ai: number }> = {
  free: { email: 50, ai: 0 },
  starter: { email: 500, ai: 150 },
  pro: { email: 1500, ai: 500 },
};

function logWebhook(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>
) {
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  method(`[dodo-webhook] ${message}`, context);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractEventIdentifiers(eventData: Record<string, unknown>) {
  const metadata = toRecord(eventData.metadata);

  const metadataUserId = asString(metadata.user_id) ?? asString(metadata.userId);
  const metadataPlan = asString(metadata.plan_type) ?? asString(metadata.plan);
  const nestedCustomer = toRecord(eventData.customer);

  return {
    metadataUserId,
    metadataPlan,
    customerId:
      asString(eventData.customer_id) ??
      asString(nestedCustomer.customer_id) ??
      asString(eventData.customer),
    subscriptionId: asString(eventData.subscription_id) ?? asString(eventData.id),
    productId: asString(eventData.product_id),
  };
}

async function resolveProfile(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  ids: {
    metadataUserId: string | null;
    customerId: string | null;
    subscriptionId: string | null;
  }
): Promise<ProfileLookupRow | null> {
  if (ids.metadataUserId) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, plan_type")
      .eq("id", ids.metadataUserId)
      .maybeSingle<ProfileLookupRow>();
    if (error) throw error;
    if (data?.id) return data;
  }

  if (ids.subscriptionId) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, plan_type")
      .eq("stripe_subscription_id", ids.subscriptionId)
      .maybeSingle<ProfileLookupRow>();
    if (error) throw error;
    if (data?.id) return data;
  }

  if (ids.customerId) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, plan_type")
      .eq("stripe_customer_id", ids.customerId)
      .maybeSingle<ProfileLookupRow>();
    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
}

async function ensureQuotaRow(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("ensure_user_quota", { p_user_id: userId });
  if (!error) return;

  const { error: insertError } = await supabase.from("user_quotas").insert({ user_id: userId });
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }
}

async function updateUserProfile(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  values: Record<string, unknown>
): Promise<void> {
  const { data, error } = await supabase
    .from("user_profiles")
    .update(values)
    .eq("id", userId)
    .select("id")
    .maybeSingle<UpdateRow>();

  if (error) throw error;
  if (!data?.id) {
    throw new Error("Profile update affected 0 rows");
  }
}

async function updateUserQuotas(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  values: Record<string, unknown>
): Promise<void> {
  const { data, error } = await supabase
    .from("user_quotas")
    .update(values)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle<{ user_id: string }>();

  if (error) throw error;
  if (!data?.user_id) {
    throw new Error("Quota update affected 0 rows");
  }
}

async function applyActivePlanAndQuota(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  planType: Exclude<PlanType, "free">,
  customerId: string | null,
  subscriptionId: string | null,
  productId: string
): Promise<void> {
  const limits = PLAN_LIMITS[planType];

  await updateUserProfile(supabase, userId, {
    plan_type: planType,
    subscription_status: "active",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    dodo_product_id: productId,
  });

  await ensureQuotaRow(supabase, userId);
  await updateUserQuotas(supabase, userId, {
    email_lookups_limit: limits.email,
    ai_draft_generations_limit: limits.ai,
  });
}

async function downgradeToFree(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  subscriptionStatus: "cancelled" | "past_due"
): Promise<void> {
  await updateUserProfile(supabase, userId, {
    plan_type: "free",
    subscription_status: subscriptionStatus,
    stripe_subscription_id: null,
    dodo_product_id: null,
  });

  await ensureQuotaRow(supabase, userId);
  await updateUserQuotas(supabase, userId, {
    email_lookups_limit: PLAN_LIMITS.free.email,
    ai_draft_generations_limit: PLAN_LIMITS.free.ai,
  });
}

async function persistWebhookEvent(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  eventType: string,
  userId: string | null,
  rawPayload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("dodo_webhook_events").insert({
    event_type: eventType,
    user_id: userId,
    raw_payload: rawPayload,
  });

  if (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();

  if (!webhookKey) {
    logWebhook("error", "webhook key is not configured", {
      route: "/api/v1/dodo/webhook",
    });
    return NextResponse.json({ error: "Webhook key is not configured" }, { status: 503 });
  }

  let parsedEvent: Record<string, unknown>;
  try {
    parsedEvent = toRecord(
      getDodoClient().webhooks.unwrap(rawBody, {
        headers: {
          "webhook-id": request.headers.get("webhook-id") ?? "",
          "webhook-signature": request.headers.get("webhook-signature") ?? "",
          "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
        },
        key: webhookKey,
      })
    );
  } catch (error) {
    logWebhook("warn", "signature verification failed", {
      route: "/api/v1/dodo/webhook",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const eventType = asString(parsedEvent.type) ?? "unknown";
  const eventData = toRecord(parsedEvent.data);
  const identifiers = extractEventIdentifiers(eventData);

  try {
    const supabase = await createServiceRoleClient();
    const profile = await resolveProfile(supabase, {
      metadataUserId: identifiers.metadataUserId,
      customerId: identifiers.customerId,
      subscriptionId: identifiers.subscriptionId,
    });
    const resolvedUserId = profile?.id ?? identifiers.metadataUserId;

    await persistWebhookEvent(supabase, eventType, resolvedUserId, parsedEvent);

    if (!resolvedUserId) {
      logWebhook("warn", "no user could be resolved for event", {
        eventType,
        customerId: identifiers.customerId,
        subscriptionId: identifiers.subscriptionId,
      });
      return NextResponse.json({ received: true });
    }

    switch (eventType) {
      case "subscription.active":
      case "subscription.activated":
      case "subscription.renewed": {
        const inferredPlan = resolvePlanTypeFromProductId(identifiers.productId);
        if (!inferredPlan) {
          logWebhook("warn", "unknown or missing product id; skipping paid-plan activation", {
            eventType,
            userId: resolvedUserId,
            productId: identifiers.productId,
            metadataPlan: identifiers.metadataPlan,
          });
          return NextResponse.json({ received: true });
        }

        await applyActivePlanAndQuota(
          supabase,
          resolvedUserId,
          inferredPlan,
          identifiers.customerId,
          identifiers.subscriptionId,
          identifiers.productId!
        );
        break;
      }

      case "subscription.on_hold": {
        await updateUserProfile(supabase, resolvedUserId, {
          subscription_status: "past_due",
        });
        break;
      }

      case "subscription.cancelled":
      case "subscription.expired": {
        await downgradeToFree(supabase, resolvedUserId, "cancelled");
        break;
      }

      case "subscription.failed":
      case "payment.failed": {
        await downgradeToFree(supabase, resolvedUserId, "past_due");
        break;
      }

      default:
        logWebhook("info", "ignored unsupported event type", {
          eventType,
          userId: resolvedUserId,
        });
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logWebhook("error", "processing failed", {
      eventType,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
