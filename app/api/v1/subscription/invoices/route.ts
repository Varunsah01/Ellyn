import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { getDodoClient } from "@/lib/dodo";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ProfileRow = {
  stripe_customer_id: string | null;
};

type DodoPayment = {
  payment_id?: string;
  id?: string;
  created_at?: string;
  total_amount?: number;
  amount?: number;
  currency?: string;
  status?: string;
  receipt_url?: string;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      return NextResponse.json({ error: profileError.message || "Failed to fetch profile" }, { status: 500 });
    }

    const customerId = profile?.stripe_customer_id?.trim() || null;
    if (!customerId) {
      return NextResponse.json({ invoices: [] });
    }

    const dodoClient = getDodoClient();
    const paymentResponse = await dodoClient.payments.list({ customer_id: customerId });
    const rawItems = (paymentResponse as unknown as { items?: unknown[] }).items;
    const items = Array.isArray(rawItems) ? rawItems : [];

    const invoices = items.map((entry) => {
      const payment = entry as DodoPayment;
      return {
        id: payment.payment_id ?? payment.id ?? "",
        date: payment.created_at ?? null,
        amount: typeof payment.total_amount === "number" ? payment.total_amount : payment.amount ?? null,
        currency: payment.currency ?? "USD",
        status: payment.status ?? null,
        download_url: payment.receipt_url ?? null,
      };
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
