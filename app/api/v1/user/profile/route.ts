import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { err, unauthorized, validationError } from "@/lib/api/response";

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
      return validationError(parsed.error.issues);
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

    if (error) return err(error.message || "Failed to update profile", 500);

    return NextResponse.json({ profile: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to update profile", 500);
  }
}
