import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const ChangePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
    password: z.string().min(8, "New password must be at least 8 characters").optional(),
  })
  .refine((value) => Boolean(value.newPassword || value.password), {
    path: ["newPassword"],
    message: "newPassword is required",
  });

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const parsed = ChangePasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const newPassword = parsed.data.newPassword ?? parsed.data.password;
    if (!newPassword) {
      return NextResponse.json({ error: "newPassword is required" }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update password" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update password" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
