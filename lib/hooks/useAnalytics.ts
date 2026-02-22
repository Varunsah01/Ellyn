'use client';

import { useState, useEffect, useCallback } from 'react';
import { Contact } from './useContacts';
import { Draft } from './useSequences';
import { createClient } from '@/lib/supabase/client';
import { useRefreshListener } from '@/lib/context/AppRefreshContext';

export interface DashboardStats {
  totalContacts: number;
  totalSequences: number;
  emailsSent: number;
  responseRate: number;
  hasEmailData: boolean;
  newContactsThisWeek: number;
  emailsSentThisWeek: number;
}

export interface ActivityItem {
  id: string;
  type: 'contact_added' | 'contact_updated' | 'email_sent' | 'email_replied' | 'reply_received' | 'sequence_created' | 'template_created';
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    contactName?: string;
    sequenceName?: string;
    company?: string;
  };
}

export interface AnalyticsData {
  contactsByStatus: {
    new: number;
    contacted: number;
    replied: number;
    no_response: number;
  };
  emailsByDay: Array<{
    date: string;
    sent: number;
    replied: number;
  }>;
  topCompanies: Array<{
    company: string;
    count: number;
  }>;
}

/**
 * Custom hook for dashboard stats.
 * @returns {unknown} Hook state and actions for dashboard stats.
 * @example
 * const state = useDashboardStats()
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    totalSequences: 0,
    emailsSent: 0,
    responseRate: 0,
    hasEmailData: false,
    newContactsThisWeek: 0,
    emailsSentThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch contacts and templates via existing API routes
      const [contactsRes, templatesRes] = await Promise.all([
        fetch('/api/v1/contacts?limit=1000'),
        fetch('/api/v1/templates'),
      ]);

      if (!contactsRes.ok || !templatesRes.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const [contactsData, templatesData] = await Promise.all([
        contactsRes.json(),
        templatesRes.json(),
      ]);

      const contacts: Contact[] = contactsData.contacts || [];
      const templates = templatesData.templates || [];

      // Start of current ISO week (Monday at 00:00:00 local time)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + diffToMonday);
      weekStart.setHours(0, 0, 0, 0);

      const newContactsThisWeek = contacts.filter(
        (c) => new Date(c.created_at) >= weekStart
      ).length;

      // Query outreach table directly for email sent counts
      const { data: outreachRows } = user
        ? await supabase
            .from('outreach')
            .select('status, created_at')
            .eq('user_id', user.id)
            .in('status', ['contacted', 'sent'])
        : { data: [] as { status: string; created_at: string }[] };

      const outreach = outreachRows ?? [];

      // Also count sequence enrollments via contact_id (sequences have no user_id column)
      const contactIds = contacts.map((c) => c.id);
      const { data: enrollmentRows } =
        user && contactIds.length > 0
          ? await supabase
              .from('sequence_enrollments')
              .select('start_date')
              .in('contact_id', contactIds)
          : { data: [] as { start_date: string }[] };

      const enrollments = enrollmentRows ?? [];

      const emailsSent = outreach.length + enrollments.length;
      const emailsSentThisWeek =
        outreach.filter((o) => new Date(o.created_at) >= weekStart).length +
        enrollments.filter((e) => new Date(e.start_date) >= weekStart).length;

      const repliedContacts = contacts.filter((c) => c.status === 'replied').length;
      const contactedContacts = contacts.filter(
        (c) => c.status === 'contacted' || c.status === 'replied'
      ).length;

      const responseRate =
        contactedContacts > 0 ? (repliedContacts / contactedContacts) * 100 : 0;

      setStats({
        totalContacts: contacts.length,
        totalSequences: templates.length,
        emailsSent,
        responseRate: Math.round(responseRate * 10) / 10,
        hasEmailData: emailsSent > 0,
        newContactsThisWeek,
        emailsSentThisWeek,
      });
    } catch (err) {
      console.error('[useDashboardStats] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Re-fetch when contacts are mutated or stats are explicitly invalidated
  useRefreshListener(['contacts', 'stats'], fetchStats);

  // Realtime — re-fetch immediately when a new contact is inserted
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('useDashboardStats:contacts-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contacts' },
        () => { void fetchStats(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}

/**
 * Custom hook for recent activity.
 * @param {number} limit - Limit input.
 * @returns {unknown} Hook state and actions for recent activity.
 * @example
 * const state = useRecentActivity()
 */
export function useRecentActivity(limit: number = 10) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (dbError) throw dbError;

      const titleByType: Record<string, string> = {
        contact_added: 'Contact Added',
        contact_updated: 'Contact Updated',
        sequence_created: 'Sequence Created',
        contacts_enrolled: 'Contacts Enrolled',
        email_sent: 'Email Sent',
        email_replied: 'Email Replied',
        reply_received: 'Reply Received',
        template_created: 'Template Created',
      };

      setActivities(
        (data ?? []).map((row) => ({
          id: row.id as string,
          type: row.type as ActivityItem['type'],
          title: titleByType[row.type as string] ?? (row.type as string),
          description: row.description as string,
          timestamp: row.created_at as string,
          metadata: (row.metadata as ActivityItem['metadata']) ?? undefined,
        }))
      );
    } catch (err) {
      console.error('[useRecentActivity] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, error, refresh: fetchActivities };
}

/**
 * Custom hook for analytics.
 * @returns {unknown} Hook state and actions for analytics.
 * @example
 * const state = useAnalytics()
 */
export function useAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    contactsByStatus: {
      new: 0,
      contacted: 0,
      replied: 0,
      no_response: 0,
    },
    emailsByDay: [],
    topCompanies: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [contactsRes, draftsRes] = await Promise.all([
        fetch('/api/v1/contacts?limit=1000'),
        fetch('/api/v1/drafts'),
      ]);

      if (!contactsRes.ok || !draftsRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const [contactsData, draftsData] = await Promise.all([
        contactsRes.json(),
        draftsRes.json(),
      ]);

      const contacts: Contact[] = contactsData.contacts || [];
      const drafts: Draft[] = draftsData.drafts || [];

      // Contacts by status
      const contactsByStatus = {
        new: contacts.filter((c) => c.status === 'new').length,
        contacted: contacts.filter((c) => c.status === 'contacted').length,
        replied: contacts.filter((c) => c.status === 'replied').length,
        no_response: contacts.filter((c) => c.status === 'no_response').length,
      };

      // Emails by day (last 7 days)
      const emailsByDay: Array<{ date: string; sent: number; replied: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0] ?? '';

        const sentCount = drafts.filter(
          (d) =>
            d.status === 'sent' &&
            d.updated_at.startsWith(dateStr)
        ).length;

        const repliedCount = contacts.filter(
          (c) =>
            c.status === 'replied' &&
            c.updated_at.startsWith(dateStr)
        ).length;

        emailsByDay.push({
          date: dateStr,
          sent: sentCount,
          replied: repliedCount,
        });
      }

      // Top companies
      const companyMap = new Map<string, number>();
      contacts.forEach((c) => {
        if (c.company) {
          companyMap.set(c.company, (companyMap.get(c.company) || 0) + 1);
        }
      });

      const topCompanies = Array.from(companyMap.entries())
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setAnalytics({
        contactsByStatus,
        emailsByDay,
        topCompanies,
      });
    } catch (err) {
      console.error('[useAnalytics] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, error, refresh: fetchAnalytics };
}
