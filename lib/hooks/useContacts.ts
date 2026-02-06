'use client';

import { useState, useEffect, useCallback } from 'react';

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
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useContacts(options: UseContactsOptions = {}): UseContactsResult {
  const {
    page = 1,
    limit = 20,
    search = '',
    status = '',
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

      const response = await fetch(`/api/contacts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch contacts`);
      }

      const data = await response.json();

      if (data.success) {
        setContacts(data.contacts || []);
        setTotalCount(data.totalCount || 0);
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
  }, [page, limit, search, status]);

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
      const response = await fetch('/api/contacts?limit=1000');

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
