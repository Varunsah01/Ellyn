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

const PLAN_LIMITS: Record<PlanType, { email: number; ai: number }> = {
  free: { email: 50, ai: 0 },
  starter: { email: 500, ai: 150 },
  pro: { email: 1500, ai: 500 },
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parsePlanType(value: unknown): PlanType | null {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === "free" || normalized === "starter" || normalized === "pro") {
    return normalized;
  }
  return null;
}

function extractEventIdentifiers(eventData: Record<string, unknown>) {
  const metadata = toRecord(eventData.metadata);

  const metadataUserId = asString(metadata.user_id) ?? asString(metadata.userId);
  const metadataPlan = parsePlanType(metadata.plan_type) ?? parsePlanType(metadata.plan);

  const nestedCustomer = toRecord(eventData.customer);
  const customerId =
    asString(eventData.customer_id) ??
    asString(nestedCustomer.customer_id) ??
    asString(eventData.customer);

  const subscriptionId = asString(eventData.subscription_id) ?? asString(eventData.id);
  const productId = asString(eventData.product_id);

  return {
    metadataUserId,
    metadataPlan,
    customerId,
    subscriptionId,
    productId,
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
    const { data } = await supabase
      .from("user_profiles")
      .select("id, plan_type")
      .eq("id", ids.metadataUserId)
      .maybeSingle<ProfileLookupRow>();

    if (data?.id) {
      return data;
    }
  }

  if (ids.subscriptionId) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, plan_type")
      .eq("stripe_subscription_id", ids.subscriptionId)
      .maybeSingle<ProfileLookupRow>();

    if (data?.id) {
      return data;
    }
  }

  if (ids.customerId) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, plan_type")
      .eq("stripe_customer_id", ids.customerId)
      .maybeSingle<ProfileLookupRow>();

    if (data?.id) {
      return data;
    }
  }

  return null;
}

async function ensureQuotaRow(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("ensure_user_quota", { p_user_id: userId });
  if (!error) {
    return;
  }

  const { error: insertError } = await supabase.from("user_quotas").insert({ user_id: userId });
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }
}

async function applyActivePlanAndQuota(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  planType: PlanType,
  customerId: string | null,
  subscriptionId: string | null,
  productId: string | null
): Promise<void> {
  const limits = PLAN_LIMITS[planType];

  await supabase
    .from("user_profiles")
    .update({
      plan_type: planType,
      subscription_status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      dodo_product_id: productId,
    })
    .eq("id", userId);

  await ensureQuotaRow(supabase, userId);

  await supabase
    .from("user_quotas")
    .update({
      email_lookups_limit: limits.email,
      ai_draft_generations_limit: limits.ai,
    })
    .eq("user_id", userId);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let eventType = "unknown";
  let resolvedUserId: string | null = null;
  let eventPayload: Record<string, unknown> = {};

  try {
    const client = getDodoClient();
    const parsedEvent = client.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      },
      key: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
    });

    eventType = asString((parsedEvent as { type?: unknown }).type) ?? "unknown";
    eventPayload = toRecord(parsedEvent);

    const eventData = toRecord((parsedEvent as { data?: unknown }).data);
    const identifiers = extractEventIdentifiers(eventData);

    const supabase = await createServiceRoleClient();
    const profile = await resolveProfile(supabase, {
      metadataUserId: identifiers.metadataUserId,
      customerId: identifiers.customerId,
      subscriptionId: identifiers.subscriptionId,
    });

    resolvedUserId = profile?.id ?? identifiers.metadataUserId;

    // Persist raw event for replay/debugging.
    await supabase.from("dodo_webhook_events").insert({
      event_type: eventType,
      user_id: resolvedUserId,
      raw_payload: eventPayload,
    });

    if (!resolvedUserId) {
      console.warn("[dodo-webhook] No user could be resolved for event", {
        eventType,
        identifiers,
      });
      return NextResponse.json({ received: true });
    }

    switch (eventType) {
      case "subscription.active":
      case "subscription.renewed": {
        const inferredPlan =
          identifiers.metadataPlan ??
          parsePlanType(profile?.plan_type) ??
          resolvePlanTypeFromProductId(identifiers.productId);

        await applyActivePlanAndQuota(
          supabase,
          resolvedUserId,
          inferredPlan,
          identifiers.customerId,
          identifiers.subscriptionId,
          identifiers.productId
        );
        break;
      }

      case "subscription.on_hold": {
        await supabase
          .from("user_profiles")
          .update({ subscription_status: "past_due" })
          .eq("id", resolvedUserId);
        break;
      }

      case "subscription.cancelled":
      case "subscription.expired": {
        await supabase
          .from("user_profiles")
          .update({
            plan_type: "free",
            subscription_status: "cancelled",
            stripe_subscription_id: null,
            dodo_product_id: null,
          })
          .eq("id", resolvedUserId);

        await ensureQuotaRow(supabase, resolvedUserId);
        await supabase
          .from("user_quotas")
          .update({
            email_lookups_limit: PLAN_LIMITS.free.email,
            ai_draft_generations_limit: PLAN_LIMITS.free.ai,
          })
          .eq("user_id", resolvedUserId);
        break;
      }

      case "subscription.failed": {
        await supabase
          .from("user_profiles")
          .update({
            plan_type: "free",
            subscription_status: "cancelled",
            stripe_subscription_id: null,
            dodo_product_id: null,
          })
          .eq("id", resolvedUserId);

        await ensureQuotaRow(supabase, resolvedUserId);
        await supabase
          .from("user_quotas")
          .update({
            email_lookups_limit: PLAN_LIMITS.free.email,
            ai_draft_generations_limit: PLAN_LIMITS.free.ai,
          })
          .eq("user_id", resolvedUserId);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[dodo-webhook] processing error", {
      eventType,
      userId: resolvedUserId,
      error,
    });

    // Best effort event persistence even when verification/processing fails.
    try {
      const supabase = await createServiceRoleClient();
      const fallbackPayload = (() => {
        if (Object.keys(eventPayload).length > 0) {
          return eventPayload;
        }

        try {
          const parsed = JSON.parse(rawBody) as unknown;
          return toRecord(parsed);
        } catch {
          return { raw_body: rawBody };
        }
      })();

      await supabase.from("dodo_webhook_events").insert({
        event_type: eventType,
        user_id: resolvedUserId,
        raw_payload: fallbackPayload,
      });
    } catch (persistenceError) {
      console.error("[dodo-webhook] failed to persist error payload", persistenceError);
    }
  }

  // Always return 200 so Dodo does not repeatedly retry while app handles errors internally.
  return NextResponse.json({ received: true });
}
