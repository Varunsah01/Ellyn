import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const PersonaSchema = z.object({
  persona: z.enum(["job_seeker", "smb_sales"]),
});

type PersonaValue = z.infer<typeof PersonaSchema>["persona"];

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from("user_profiles")
      .select("persona")
      .eq("id", user.id)
      .maybeSingle<{ persona: PersonaValue | null }>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to fetch persona" }, { status: 500 });
    }

    return NextResponse.json({
      persona: data?.persona ?? "job_seeker",
      profile_persona: data?.persona ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch persona" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const parsed = PersonaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid persona value" },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          persona: parsed.data.persona,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("persona")
      .single<{ persona: PersonaValue | null }>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update persona" }, { status: 500 });
    }

    return NextResponse.json({ persona: data?.persona ?? parsed.data.persona });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update persona" },
      { status: 500 }
    );
  }
}
