'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Contact } from '@/lib/supabase/types';
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

  const addContact = useCallback(
    (contact: Contact) => {
      setContacts((previous) => upsertInMemoryContact(previous, contact, limit));
    },
    [limit]
  );

  const updateContact = useCallback(
    (contact: Contact) => {
      setContacts((previous) => upsertInMemoryContact(previous, contact, limit));
    },
    [limit]
  );

  const removeContact = useCallback((contactId: string) => {
    setContacts((previous) => previous.filter((contact) => contact.id !== contactId));
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsLive(false);
      return;
    }

    void fetchContacts();

    const channel = supabase
      .channel('contacts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addContact(payload.new as Contact);
          }
          if (payload.eventType === 'UPDATE') {
            updateContact(payload.new as Contact);
          }
          if (payload.eventType === 'DELETE') {
            removeContact(String(payload.old.id ?? ''));
          }
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      setIsLive(false);
      void supabase.removeChannel(channel);
    };
  }, [addContact, fetchContacts, removeContact, supabase, updateContact, userId]);

  return {
    contacts,
    loading,
    error,
    isLive,
    refresh: fetchContacts,
  };
}
