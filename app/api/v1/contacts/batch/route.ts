import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { delete as deleteCache } from "@/lib/cache/redis"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { checkApiRateLimit, rateLimitExceeded } from "@/lib/rate-limit"

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

interface CsvBatchResult {
  imported: number
  skipped: number
  errors: { row: number; reason: string }[]
}

const BulkOperationSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(200),
  op: z.enum(["add_tag", "set_status", "delete", "export"]),
  payload: z.record(z.string(), z.unknown()).optional(),
})

const AddTagPayloadSchema = z.object({
  tag: z.string().trim().min(1).max(20),
})

const SetStatusPayloadSchema = z.object({
  status: z.enum(["new", "contacted", "replied", "no_response"]),
})

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return Array.from(
    new Set(
      tags
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter((tag) => tag.length > 0)
    )
  )
}

function invalidateTagCache(userId: string) {
  void deleteCache(`contact-tags:${userId}`).catch((error) => {
    console.error("[contacts/batch] Failed to invalidate contact-tags cache", error)
  })
}

async function handleCsvImport(contacts: ContactInput[], userId: string) {
  const supabase = await createServiceRoleClient()
  const result: CsvBatchResult = { imported: 0, skipped: 0, errors: [] }

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
      user_id: userId,
      first_name: c.first_name.trim(),
      last_name: c.last_name.trim(),
      company: c.company.trim(),
      role: c.role?.trim() || null,
      inferred_email: c.email?.trim() || null,
      linkedin_url: c.linkedin_url?.trim() || null,
      notes: c.notes?.trim() || null,
      tags: Array.isArray(c.tags) ? c.tags.filter(Boolean).slice(0, 10) : [],
      source: "csv_import",
      status: "new",
    })
  }

  if (validRows.length === 0) {
    return result
  }

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
      const inserted = data?.length ?? 0
      result.imported += inserted
      result.skipped += chunk.length - inserted
    }
  }

  return result
}

async function handleBulkOperation(body: z.infer<typeof BulkOperationSchema>, userId: string) {
  const supabase = await createServiceRoleClient()

  if (body.op === "add_tag") {
    const payload = AddTagPayloadSchema.safeParse(body.payload ?? {})
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.flatten() }, { status: 400 })
    }

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, tags")
      .eq("user_id", userId)
      .in("id", body.contactIds)

    if (contactsError) throw contactsError

    let affected = 0
    for (const contact of contacts ?? []) {
      const tags = normalizeTags(contact.tags)
      if (tags.includes(payload.data.tag) || tags.length >= 10) {
        continue
      }

      const { data: updated, error: updateError } = await supabase
        .from("contacts")
        .update({
          tags: [...tags, payload.data.tag],
          updated_at: new Date().toISOString(),
        })
        .eq("id", contact.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle()

      if (updateError) throw updateError
      if (updated) affected += 1
    }

    invalidateTagCache(userId)
    return NextResponse.json({ affected, op: "add_tag" })
  }

  if (body.op === "set_status") {
    const payload = SetStatusPayloadSchema.safeParse(body.payload ?? {})
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("contacts")
      .update({
        status: payload.data.status,
        updated_at: new Date().toISOString(),
      })
      .in("id", body.contactIds)
      .eq("user_id", userId)
      .select("id")

    if (error) throw error
    return NextResponse.json({ affected: data?.length ?? 0, op: "set_status" })
  }

  if (body.op === "delete") {
    const { data, error } = await supabase
      .from("contacts")
      .delete()
      .in("id", body.contactIds)
      .eq("user_id", userId)
      .select("id")

    if (error) throw error
    if ((data?.length ?? 0) > 0) {
      invalidateTagCache(userId)
    }
    return NextResponse.json({ affected: data?.length ?? 0, op: "delete" })
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("first_name, last_name, company, role, inferred_email, status, tags, created_at")
    .in("id", body.contactIds)
    .eq("user_id", userId)

  if (error) throw error
  return NextResponse.json({
    affected: data?.length ?? 0,
    op: "export",
    contacts: data ?? [],
  })
}

// POST /api/v1/contacts/batch
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    // Rate limit: 20 batch operations/hour per user
    const rl = await checkApiRateLimit(`batch:${user.id}`, 20, 3600)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

    const body = (await request.json()) as {
      contacts?: unknown[]
      contactIds?: unknown
      op?: unknown
      payload?: unknown
    }

    if (Array.isArray(body.contacts)) {
      const result = await handleCsvImport(body.contacts as ContactInput[], user.id)
      return NextResponse.json(result)
    }

    const parsed = BulkOperationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    return await handleBulkOperation(parsed.data, user.id)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[contacts/batch POST]", err)
    return NextResponse.json({ error: "Batch operation failed" }, { status: 500 })
  }
}
