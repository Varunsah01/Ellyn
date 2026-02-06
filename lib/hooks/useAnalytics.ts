'use client';

import { useState, useEffect, useCallback } from 'react';
import { Contact } from './useContacts';
import { Draft } from './useSequences';

export interface DashboardStats {
  totalContacts: number;
  totalSequences: number;
  emailsSent: number;
  responseRate: number;
  newContactsThisWeek: number;
  emailsSentThisWeek: number;
}

export interface ActivityItem {
  id: string;
  type: 'contact_added' | 'email_sent' | 'email_replied' | 'template_created';
  title: string;
  description: string;
  timestamp: string;
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

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    totalSequences: 0,
    emailsSent: 0,
    responseRate: 0,
    newContactsThisWeek: 0,
    emailsSentThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data
      const [contactsRes, templatesRes, draftsRes] = await Promise.all([
        fetch('/api/contacts?limit=1000'),
        fetch('/api/templates'),
        fetch('/api/drafts'),
      ]);

      if (!contactsRes.ok || !templatesRes.ok || !draftsRes.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const [contactsData, templatesData, draftsData] = await Promise.all([
        contactsRes.json(),
        templatesRes.json(),
        draftsRes.json(),
      ]);

      const contacts: Contact[] = contactsData.contacts || [];
      const templates = templatesData.templates || [];
      const drafts: Draft[] = draftsData.drafts || [];

      // Calculate stats
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const newContactsThisWeek = contacts.filter(
        (c) => new Date(c.created_at) > oneWeekAgo
      ).length;

      const sentDrafts = drafts.filter((d) => d.status === 'sent');
      const emailsSentThisWeek = sentDrafts.filter(
        (d) => new Date(d.updated_at) > oneWeekAgo
      ).length;

      const repliedContacts = contacts.filter((c) => c.status === 'replied').length;
      const contactedContacts = contacts.filter(
        (c) => c.status === 'contacted' || c.status === 'replied'
      ).length;

      const responseRate =
        contactedContacts > 0 ? (repliedContacts / contactedContacts) * 100 : 0;

      setStats({
        totalContacts: contacts.length,
        totalSequences: templates.length,
        emailsSent: sentDrafts.length,
        responseRate: Math.round(responseRate),
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

  return { stats, loading, error, refresh: fetchStats };
}

export function useRecentActivity(limit: number = 10) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch recent contacts and drafts
      const [contactsRes, draftsRes, templatesRes] = await Promise.all([
        fetch(`/api/contacts?limit=${limit}`),
        fetch('/api/drafts'),
        fetch('/api/templates'),
      ]);

      if (!contactsRes.ok || !draftsRes.ok || !templatesRes.ok) {
        throw new Error('Failed to fetch activity data');
      }

      const [contactsData, draftsData, templatesData] = await Promise.all([
        contactsRes.json(),
        draftsRes.json(),
        templatesRes.json(),
      ]);

      const contacts: Contact[] = contactsData.contacts || [];
      const drafts: Draft[] = draftsData.drafts || [];
      const templates = templatesData.templates || [];

      // Build activity feed
      const activityItems: ActivityItem[] = [];

      // Add contact activities
      contacts.forEach((contact) => {
        activityItems.push({
          id: `contact-${contact.id}`,
          type: 'contact_added',
          title: 'Contact Added',
          description: `${contact.full_name} from ${contact.company || 'Unknown'}`,
          timestamp: contact.created_at,
        });
      });

      // Add draft activities
      drafts.forEach((draft) => {
        if (draft.status === 'sent') {
          activityItems.push({
            id: `draft-${draft.id}`,
            type: 'email_sent',
            title: 'Email Sent',
            description: draft.contacts
              ? `To ${draft.contacts.full_name}`
              : draft.subject,
            timestamp: draft.updated_at,
          });
        }
      });

      // Add template activities (only custom ones)
      templates
        .filter((t: any) => !t.is_default)
        .forEach((template: any) => {
          activityItems.push({
            id: `template-${template.id}`,
            type: 'template_created',
            title: 'Template Created',
            description: template.name,
            timestamp: template.created_at,
          });
        });

      // Sort by timestamp (most recent first) and limit
      activityItems.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activityItems.slice(0, limit));
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
        fetch('/api/contacts?limit=1000'),
        fetch('/api/drafts'),
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
        const dateStr = date.toISOString().split('T')[0];

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
