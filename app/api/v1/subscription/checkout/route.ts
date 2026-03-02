import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { getDodoClient } from "@/lib/dodo";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ProfileRow = {
  email: string | null;
  full_name: string | null;
  stripe_customer_id: string | null;
};

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
  billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
});

function resolveProductId(plan: "starter" | "pro", billingCycle: "monthly" | "quarterly" | "yearly") {
  const envKey = `DODO_${plan.toUpperCase()}_PRODUCT_ID_GLOBAL_${billingCycle.toUpperCase()}`;
  const productId = process.env[envKey]?.trim();
  return productId || null;
}

function getAppBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const body = await request.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const productId = resolveProductId(parsed.data.plan, parsed.data.billingCycle);
    if (!productId) {
      return NextResponse.json({ error: "Product not configured" }, { status: 500 });
    }

    const supabase = await createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("email, full_name, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      return NextResponse.json({ error: profileError.message || "Failed to load profile" }, { status: 500 });
    }

    const dodoClient = getDodoClient();
    let customerId = profile?.stripe_customer_id?.trim() || null;

    if (!customerId) {
      const email = (user.email ?? profile?.email ?? "").trim();
      const metadataName =
        user.user_metadata && typeof user.user_metadata === "object"
          ? String((user.user_metadata as Record<string, unknown>).full_name ?? "").trim()
          : "";
      const fullName = (profile?.full_name ?? metadataName).trim() || email;

      if (!email) {
        return NextResponse.json({ error: "Account email is required for checkout" }, { status: 400 });
      }

      const customer = await dodoClient.customers.create({
        email,
        name: fullName,
      });

      customerId = customer.customer_id;

      const { error: updateCustomerError } = await supabase
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateCustomerError) {
        return NextResponse.json({ error: updateCustomerError.message || "Failed to save customer" }, { status: 500 });
      }
    }

    const returnUrl = `${getAppBaseUrl(request)}/dashboard?upgraded=true`;

    const subscription = await dodoClient.subscriptions.create({
      product_id: productId,
      quantity: 1,
      customer: { customer_id: customerId },
      payment_link: true,
      return_url: returnUrl,
      billing: { country: "US" },
      metadata: {
        user_id: user.id,
        plan: parsed.data.plan,
        billing_cycle: parsed.data.billingCycle,
      },
    });

    const paymentLink = subscription.payment_link ?? null;
    if (!paymentLink) {
      return NextResponse.json({ error: "Could not create payment link" }, { status: 500 });
    }

    const { error: updateSubscriptionError } = await supabase
      .from("user_profiles")
      .update({
        stripe_subscription_id: subscription.subscription_id,
        dodo_product_id: productId,
      })
      .eq("id", user.id);

    if (updateSubscriptionError) {
      return NextResponse.json(
        { error: updateSubscriptionError.message || "Failed to save subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ payment_link: paymentLink });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
