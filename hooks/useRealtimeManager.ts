'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppRefresh } from '@/lib/context/AppRefreshContext'

/**
 * Manages ALL Supabase Realtime subscriptions for the dashboard in one place.
 * Mount once in the dashboard layout after the user session is confirmed.
 * Feature pages should read data reactively via useRefreshListener rather than
 * maintaining their own supabase channels.
 */
export function useRealtimeManager(userId: string) {
  const supabase = createClient()
  const triggerRefresh = useAppRefresh()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`user-${userId}-all`)

    // Contacts changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contacts', filter: `user_id=eq.${userId}` },
      () => triggerRefresh('contacts')
    )

    // Sequence enrollment changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sequence_enrollments', filter: `user_id=eq.${userId}` },
      () => triggerRefresh('sequences')
    )

    // Deal pipeline changes (SMB persona)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deals', filter: `user_id=eq.${userId}` },
      () => triggerRefresh('deals')
    )

    // Application stage changes (Job Seeker persona)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_stages', filter: `user_id=eq.${userId}` },
      () => triggerRefresh('stages')
    )

    channelRef.current = channel
    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
}
