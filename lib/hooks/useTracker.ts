"use client";

import { useCallback, useEffect, useState } from "react";
import { countContactsNeedingFollowUp, type ContactLikeForTracker } from "@/lib/tracker-integration";

interface ContactsApiResponse {
  success?: boolean;
  contacts?: ContactLikeForTracker[];
}

/**
 * Custom hook for tracker follow up count.
 * @returns {unknown} Hook state and actions for tracker follow up count.
 * @example
 * const state = useTrackerFollowUpCount()
 */
export function useTrackerFollowUpCount() {
  const [followUpCount, setFollowUpCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/contacts?limit=500&includeOutreach=true");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ContactsApiResponse;
      const contacts = Array.isArray(data.contacts) ? data.contacts : [];
      setFollowUpCount(countContactsNeedingFollowUp(contacts));
    } catch {
      setFollowUpCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    followUpCount,
    loading,
    refresh,
  };
}


