import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/server";

const SignupSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Full name is required"),
});

function isDuplicateEmailError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;

  const message = String(error.message ?? "").toLowerCase();
  const code = String(error.code ?? "").toLowerCase();

  return (
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("duplicate")
  );
}

export async function POST(request: NextRequest) {
  try {
    const parsed = SignupSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleClient();

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;
    const full_name = parsed.data.full_name.trim();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (error) {
      if (isDuplicateEmailError(error)) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }

      return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
