import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { getDodoClient } from "@/lib/dodo";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ProfileRow = {
  stripe_customer_id: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load profile" }, { status: 500 });
    }

    const customerId = profile?.stripe_customer_id?.trim() || null;
    if (!customerId) {
      return NextResponse.json({ error: "No customer found" }, { status: 400 });
    }

    const session = await getDodoClient().customers.customerPortal.create(customerId);

    if (!session.link) {
      return NextResponse.json({ error: "Could not create portal link" }, { status: 500 });
    }

    return NextResponse.json({ link: session.link });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create customer portal link" },
      { status: 500 }
    );
  }
}
