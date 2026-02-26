"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAllUserTags(): string[] {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("contacts")
      .select("tags")
      .then(({ data }) => {
        if (!data) return;
        const all = [
          ...new Set(
            data.flatMap((c) => (c.tags as string[] | null) ?? []).filter(Boolean)
          ),
        ].sort();
        setTags(all);
      });
  }, []);

  return tags;
}
