import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

interface ContactInput {
  first_name: string
  last_name: string
  company: string
  role?: string | null
  email?: string | null
  linkedin_url?: string | null
  location?: string | null
  tags?: string[] | null
  notes?: string | null
}

interface BatchResult {
  imported: number
  skipped: number
  errors: { row: number; reason: string }[]
}

// POST /api/v1/contacts/batch
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const body = (await request.json()) as { contacts?: unknown[] }

    if (!body.contacts || !Array.isArray(body.contacts)) {
      return NextResponse.json(
        { error: "contacts array is required" },
        { status: 400 }
      )
    }

    const contacts = body.contacts as ContactInput[]
    const result: BatchResult = { imported: 0, skipped: 0, errors: [] }

    // Validate each row server-side and build insert rows
    const validRows: {
      user_id: string
      first_name: string
      last_name: string
      company: string
      role: string | null
      inferred_email: string | null
      linkedin_url: string | null
      notes: string | null
      tags: string[]
      source: string
      status: string
    }[] = []

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i]!
      const row = i + 1

      if (!c.first_name?.trim()) {
        result.errors.push({ row, reason: "Missing first_name" })
        continue
      }
      if (!c.last_name?.trim()) {
        result.errors.push({ row, reason: "Missing last_name" })
        continue
      }
      if (!c.company?.trim()) {
        result.errors.push({ row, reason: "Missing company" })
        continue
      }

      validRows.push({
        user_id: user.id,
        first_name: c.first_name.trim(),
        last_name: c.last_name.trim(),
        company: c.company.trim(),
        role: c.role?.trim() || null,
        inferred_email: c.email?.trim() || null,
        linkedin_url: c.linkedin_url?.trim() || null,
        notes: c.notes?.trim() || null,
        tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
        source: "csv_import",
        status: "new",
      })
    }

    if (validRows.length === 0) {
      return NextResponse.json(result)
    }

    // Insert in batches of 50 using ON CONFLICT DO NOTHING
    // The unique constraint is unique_user_contact (user_id, first_name, last_name, company)
    const BATCH = 50
    for (let start = 0; start < validRows.length; start += BATCH) {
      const chunk = validRows.slice(start, start + BATCH)

      const { error, data } = await supabase
        .from("contacts")
        .upsert(chunk, {
          onConflict: "user_id,first_name,last_name,company",
          ignoreDuplicates: true,
        })
        .select("id")

      if (error) {
        // If the constraint name is different, fall back to insert with individual error capture
        // Try individual inserts to collect per-row errors
        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j]!
          const { error: rowError } = await supabase
            .from("contacts")
            .insert(row)
            .select("id")
            .single()

          if (rowError) {
            if (
              rowError.code === "23505" ||
              rowError.message?.includes("duplicate") ||
              rowError.message?.includes("unique")
            ) {
              result.skipped++
            } else {
              result.errors.push({
                row: start + j + 1,
                reason: rowError.message,
              })
            }
          } else {
            result.imported++
          }
        }
      } else {
        // data contains the successfully inserted rows
        const inserted = data?.length ?? 0
        result.imported += inserted
        result.skipped += chunk.length - inserted
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[contacts/batch POST]", err)
    return NextResponse.json(
      { error: "Batch import failed" },
      { status: 500 }
    )
  }
}
