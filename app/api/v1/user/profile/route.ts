import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const ProfilePatchSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
});

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  updated_at: string | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const parsed = ProfilePatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid profile payload" },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          full_name: parsed.data.full_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id, full_name, email, avatar_url, updated_at")
      .single<ProfileRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}
