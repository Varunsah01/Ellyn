'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Contact } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';

export interface UseRealtimeContactsResult {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  isLive: boolean;
  refresh: () => Promise<void>;
}

function sortContactsByCreatedAtDesc(items: Contact[]): Contact[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function upsertInMemoryContact(list: Contact[], incoming: Contact, limit: number): Contact[] {
  const next = list.filter((contact) => contact.id !== incoming.id);
  next.unshift(incoming);
  return sortContactsByCreatedAtDesc(next).slice(0, limit);
}

function applyRealtimePayload(
  previous: Contact[],
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  limit: number
): Contact[] {
  switch (payload.eventType) {
    case 'INSERT':
      return upsertInMemoryContact(previous, payload.new as unknown as Contact, limit);
    case 'UPDATE':
      return upsertInMemoryContact(previous, payload.new as unknown as Contact, limit);
    case 'DELETE':
      return previous.filter((contact) => contact.id !== String(payload.old.id ?? ''));
    default:
      return previous;
  }
}

export function useRealtimeContacts(
  userId: string | null,
  limit: number = 50
): UseRealtimeContactsResult {
  const supabase = useMemo(() => createClient(), []);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!userId) {
      setContacts([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (queryError) {
        throw queryError;
      }

      setContacts((data ?? []) as Contact[]);
    } catch (fetchError) {
      console.error('[useRealtimeContacts] Error fetching contacts:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [limit, supabase, userId]);

  useEffect(() => {
    if (!userId) {
      setIsLive(false);
      return;
    }

    void fetchContacts();

    const channel = supabase
      .channel(`contacts-realtime:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setContacts((previous) => applyRealtimePayload(previous, payload, limit));
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      setIsLive(false);
      void supabase.removeChannel(channel);
    };
  }, [fetchContacts, limit, supabase, userId]);

  return {
    contacts,
    loading,
    error,
    isLive,
    refresh: fetchContacts,
  };
}
