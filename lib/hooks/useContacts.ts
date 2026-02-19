'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRefreshListener } from '@/lib/context/AppRefreshContext';
import { createClient } from '@/lib/supabase/client';
import { supabaseAuthedFetch } from '@/lib/auth/client-fetch';

export interface Contact {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  role?: string;
  confirmed_email?: string;
  inferred_email?: string;
  email_confidence?: number;
  status: 'new' | 'contacted' | 'replied' | 'no_response';
  linkedin_url?: string;
  notes?: string;
  tags?: string[];
  source?: string;
  company_domain?: string;
  company_industry?: string;
  company_size?: string;
  created_at: string;
  updated_at: string;
}

export interface UseContactsResult {
  contacts: Contact[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseContactsOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Custom hook for contacts.
 * @param {UseContactsOptions} options - Options input.
 * @returns {UseContactsResult} Hook state and actions for contacts.
 * @example
 * const state = useContacts()
 */
export function useContacts(options: UseContactsOptions = {}): UseContactsResult {
  const {
    page = 1,
    limit = 20,
    search = '',
    status = '',
    source = '',
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (source) params.append('source', source);

      const response = await supabaseAuthedFetch(`/api/v1/contacts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch contacts`);
      }

      const data = await response.json();

      if (data.success) {
        setContacts(data.contacts || []);
        setTotalCount(data.totalCount || data.pagination?.total || 0);
      } else {
        throw new Error(data.error || 'Failed to fetch contacts');
      }
    } catch (err) {
      console.error('[useContacts] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setContacts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, source]);

  // Initial fetch
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchContacts();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchContacts]);

  // Re-fetch when any contacts mutation fires a refresh event
  useRefreshListener('contacts', fetchContacts);

  // Realtime — re-fetch immediately when a new contact is inserted
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('useContacts:contacts-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contacts' },
        () => { void fetchContacts(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchContacts]);

  return {
    contacts,
    totalCount,
    loading,
    error,
    refresh: fetchContacts,
  };
}

// Hook for getting contact stats
export interface ContactStats {
  total: number;
  new: number;
  contacted: number;
  replied: number;
  no_response: number;
}

/**
 * Custom hook for contact stats.
 * @returns {unknown} Hook state and actions for contact stats.
 * @example
 * const state = useContactStats()
 */
export function useContactStats() {
  const [stats, setStats] = useState<ContactStats>({
    total: 0,
    new: 0,
    contacted: 0,
    replied: 0,
    no_response: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all contacts to calculate stats
      const response = await supabaseAuthedFetch('/api/v1/contacts?limit=1000');

      if (!response.ok) {
        throw new Error('Failed to fetch contact stats');
      }

      const data = await response.json();

      if (data.success) {
        const contacts = data.contacts || [];
        const newStats: ContactStats = {
          total: contacts.length,
          new: contacts.filter((c: Contact) => c.status === 'new').length,
          contacted: contacts.filter((c: Contact) => c.status === 'contacted').length,
          replied: contacts.filter((c: Contact) => c.status === 'replied').length,
          no_response: contacts.filter((c: Contact) => c.status === 'no_response').length,
        };

        setStats(newStats);
      }
    } catch (err) {
      console.error('[useContactStats] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
