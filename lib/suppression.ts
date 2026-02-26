import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Check whether a single email is suppressed for a given user.
 */
export async function isSuppressed(userId: string, email: string): Promise<boolean> {
  const supabase = await createServiceRoleClient()

  const { data } = await supabase
    .from('suppression_list')
    .select('email')
    .eq('user_id', userId)
    .eq('email', email.toLowerCase())
    .maybeSingle()

  return data !== null
}

/**
 * Check multiple emails at once.
 * Returns an array with a `suppressed` flag for each input email.
 */
export async function filterSuppressed(
  userId: string,
  emails: string[]
): Promise<{ email: string; suppressed: boolean }[]> {
  if (emails.length === 0) return []

  const normalised = emails.map((e) => e.toLowerCase())

  const supabase = await createServiceRoleClient()

  const { data } = await supabase
    .from('suppression_list')
    .select('email')
    .eq('user_id', userId)
    .in('email', normalised)

  const suppressedSet = new Set((data ?? []).map((r: { email: string }) => r.email))

  return normalised.map((email) => ({
    email,
    suppressed: suppressedSet.has(email),
  }))
}
