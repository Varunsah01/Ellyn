'use client';

import { useState, useEffect, useCallback } from 'react';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  category?: string | null;
  tags?: string[] | null;
  icon?: string | null;
  use_count?: number | null;
  last_used_at?: string | null;
  description?: string | null;
}

export interface Draft {
  id: string;
  contact_id: string;
  template_id?: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent';
  created_at: string;
  updated_at: string;
  contacts?: {
    full_name: string;
    confirmed_email?: string;
    inferred_email?: string;
  };
}

export interface UseSequencesResult {
  templates: EmailTemplate[];
  drafts: Draft[];
  loading: boolean;
  error: string | null;
  refreshTemplates: () => Promise<void>;
  refreshDrafts: () => Promise<void>;
}

/**
 * Custom hook for sequences.
 * @returns {UseSequencesResult} Hook state and actions for sequences.
 * @example
 * const state = useSequences()
 */
export function useSequences(): UseSequencesResult {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/templates');

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates || []);
      } else {
        throw new Error(data.error || 'Failed to fetch templates');
      }
    } catch (err) {
      console.error('[useSequences] Templates error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/drafts');

      if (!response.ok) {
        throw new Error('Failed to fetch drafts');
      }

      const data = await response.json();

      if (data.success) {
        setDrafts(data.drafts || []);
      } else {
        throw new Error(data.error || 'Failed to fetch drafts');
      }
    } catch (err) {
      console.error('[useSequences] Drafts error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([fetchTemplates(), fetchDrafts()]);
    } catch (err) {
      console.error('[useSequences] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetchTemplates, fetchDrafts]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    templates,
    drafts,
    loading,
    error,
    refreshTemplates: fetchTemplates,
    refreshDrafts: fetchDrafts,
  };
}

// Hook for sequence stats
export interface SequenceStats {
  totalTemplates: number;
  totalDrafts: number;
  sentEmails: number;
  pendingDrafts: number;
}

/**
 * Custom hook for sequence stats.
 * @returns {unknown} Hook state and actions for sequence stats.
 * @example
 * const state = useSequenceStats()
 */
export function useSequenceStats() {
  const [stats, setStats] = useState<SequenceStats>({
    totalTemplates: 0,
    totalDrafts: 0,
    sentEmails: 0,
    pendingDrafts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [templatesRes, draftsRes] = await Promise.all([
        fetch('/api/v1/templates'),
        fetch('/api/v1/drafts'),
      ]);

      if (!templatesRes.ok || !draftsRes.ok) {
        throw new Error('Failed to fetch sequence stats');
      }

      const [templatesData, draftsData] = await Promise.all([
        templatesRes.json(),
        draftsRes.json(),
      ]);

      if (templatesData.success && draftsData.success) {
        const templates = templatesData.templates || [];
        const drafts = draftsData.drafts || [];

        setStats({
          totalTemplates: templates.length,
          totalDrafts: drafts.length,
          sentEmails: drafts.filter((d: Draft) => d.status === 'sent').length,
          pendingDrafts: drafts.filter((d: Draft) => d.status === 'draft').length,
        });
      }
    } catch (err) {
      console.error('[useSequenceStats] Error:', err);
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

