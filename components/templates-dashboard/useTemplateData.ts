import { useCallback, useState } from "react";

import { showToast } from "@/lib/toast";
import { TemplateRecord } from "./types";

function parseErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const raw = payload as { error?: unknown; data?: { error?: unknown } };
    if (typeof raw.error === "string" && raw.error.trim()) return raw.error;
    if (typeof raw.data?.error === "string" && raw.data.error.trim()) return raw.data.error;
  }
  return fallback;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export function useTemplateData() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/email-templates", { cache: "no-store" });
      const payload = await parseJson(response);
      if (!response.ok) throw new Error(parseErrorMessage(payload, "Failed to load templates"));
      const rows = (payload as { templates?: unknown }).templates;
      setTemplates(Array.isArray(rows) ? (rows as TemplateRecord[]) : []);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { templates, setTemplates, isLoading, fetchTemplates };
}
