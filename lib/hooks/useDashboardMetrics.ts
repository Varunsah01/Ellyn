'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface DashboardMetrics {
  totalContacts: number;
  emailTemplates: number;
  emailsSent: number;
  discoveredLeads: number;
  newContactsThisWeek: number;
  emailsSentThisWeek: number;
  responseRate: number;
}

const DEFAULT_METRICS: DashboardMetrics = {
  totalContacts: 0,
  emailTemplates: 0,
  emailsSent: 0,
  discoveredLeads: 0,
  newContactsThisWeek: 0,
  emailsSentThisWeek: 0,
  responseRate: 0,
};

function toSafeCount(value: number | null): number {
  return typeof value === 'number' ? value : 0;
}

function getWeekStartIsoTimestamp(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString();
}

export function useDashboardMetrics(userId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(
    async (silent: boolean = false) => {
      if (!userId) {
        setMetrics(DEFAULT_METRICS);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);

        const weekStartIso = getWeekStartIsoTimestamp();

        const [
          totalContactsRes,
          templatesRes,
          emailsSentRes,
          discoveredLeadsRes,
          newContactsThisWeekRes,
          emailsSentThisWeekRes,
          contactedRes,
          repliedRes,
        ] = await Promise.all([
          supabase
            .from('contacts')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId),
          supabase
            .from('email_templates')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId),
          supabase
            .from('drafts')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId)
            .eq('status', 'sent'),
          supabase
            .from('contacts')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId)
            .eq('source', 'extension'),
          supabase
            .from('contacts')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId)
            .gte('created_at', weekStartIso),
          supabase
            .from('drafts')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId)
            .eq('status', 'sent')
            .gte('created_at', weekStartIso),
          supabase
            .from('contacts')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId)
            .in('status', ['contacted', 'replied']),
          supabase
            .from('contacts')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', userId)
            .eq('status', 'replied'),
        ]);

        const queryError =
          totalContactsRes.error ??
          templatesRes.error ??
          emailsSentRes.error ??
          discoveredLeadsRes.error ??
          newContactsThisWeekRes.error ??
          emailsSentThisWeekRes.error ??
          contactedRes.error ??
          repliedRes.error;

        if (queryError) {
          throw queryError;
        }

        const contactedCount = toSafeCount(contactedRes.count);
        const repliedCount = toSafeCount(repliedRes.count);
        const responseRate =
          contactedCount > 0 ? Math.round((repliedCount / contactedCount) * 1000) / 10 : 0;

        setMetrics({
          totalContacts: toSafeCount(totalContactsRes.count),
          emailTemplates: toSafeCount(templatesRes.count),
          emailsSent: toSafeCount(emailsSentRes.count),
          discoveredLeads: toSafeCount(discoveredLeadsRes.count),
          newContactsThisWeek: toSafeCount(newContactsThisWeekRes.count),
          emailsSentThisWeek: toSafeCount(emailsSentThisWeekRes.count),
          responseRate,
        });
      } catch (fetchError) {
        console.error('[useDashboardMetrics] Error fetching dashboard metrics:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch metrics');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [supabase, userId]
  );

  useEffect(() => {
    void fetchMetrics(false);
  }, [fetchMetrics]);

  useEffect(() => {
    if (!userId) return;

    const contactsChannel = supabase
      .channel(`dashboard-metrics:contacts:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchMetrics(true);
        }
      )
      .subscribe();

    const templatesChannel = supabase
      .channel(`dashboard-metrics:templates:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_templates',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchMetrics(true);
        }
      )
      .subscribe();

    const draftsChannel = supabase
      .channel(`dashboard-metrics:drafts:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drafts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchMetrics(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(contactsChannel);
      void supabase.removeChannel(templatesChannel);
      void supabase.removeChannel(draftsChannel);
    };
  }, [fetchMetrics, supabase, userId]);

  return {
    metrics,
    loading,
    error,
    refresh: () => fetchMetrics(false),
  };
}
