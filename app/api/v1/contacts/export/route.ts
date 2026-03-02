import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ExportRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  role: string | null;
  status: string | null;
  linkedin_url: string | null;
  created_at: string | null;
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatCsvDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, company_name, role, status, linkedin_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to export contacts" }, { status: 500 });
    }

    const rows = Array.isArray(data) ? (data as ExportRow[]) : [];
    const header = [
      "First Name",
      "Last Name",
      "Email",
      "Company",
      "Role",
      "Status",
      "LinkedIn URL",
      "Created At",
    ];

    const csvLines = [
      header.map(csvEscape).join(","),
      ...rows.map((row) =>
        [
          row.first_name ?? "",
          row.last_name ?? "",
          row.email ?? "",
          row.company_name ?? "",
          row.role ?? "",
          row.status ?? "",
          row.linkedin_url ?? "",
          formatCsvDate(row.created_at),
        ]
          .map(csvEscape)
          .join(",")
      ),
    ];

    const csv = csvLines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="contacts.csv"',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export contacts" },
      { status: 500 }
    );
  }
}
