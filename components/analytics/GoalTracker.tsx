"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Trophy, Target } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";

interface GoalTrackerProps {
  currentContacts: number;
  currentEmails: number;
  currentReplyRate: number;
}

interface GoalTargets {
  targetContacts: number;
  targetEmailsSent: number;
  targetReplyRate: number;
}

const GOALS_STORAGE_KEY = "ellyn.analytics.goal-targets.v1";

const DEFAULT_GOALS: GoalTargets = {
  targetContacts: 50,
  targetEmailsSent: 100,
  targetReplyRate: 20,
};

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeGoals(value: Partial<GoalTargets>): GoalTargets {
  const contacts = Number(value.targetContacts);
  const emails = Number(value.targetEmailsSent);
  const replyRate = Number(value.targetReplyRate);

  return {
    targetContacts: Number.isFinite(contacts)
      ? Math.max(0, Math.round(contacts))
      : DEFAULT_GOALS.targetContacts,
    targetEmailsSent: Number.isFinite(emails)
      ? Math.max(0, Math.round(emails))
      : DEFAULT_GOALS.targetEmailsSent,
    targetReplyRate: Number.isFinite(replyRate)
      ? Math.min(100, Math.max(0, replyRate))
      : DEFAULT_GOALS.targetReplyRate,
  };
}

function parseGoals(value: unknown): GoalTargets | null {
  const obj = toObject(value);
  if (!obj) return null;

  if (
    !("targetContacts" in obj) &&
    !("targetEmailsSent" in obj) &&
    !("targetReplyRate" in obj)
  ) {
    return null;
  }

  return normalizeGoals({
    targetContacts: obj.targetContacts as number | undefined,
    targetEmailsSent: obj.targetEmailsSent as number | undefined,
    targetReplyRate: obj.targetReplyRate as number | undefined,
  });
}

function extractGoalsFromSettingsPayload(payload: unknown): GoalTargets | null {
  const root = toObject(payload);
  if (!root) return null;

  const data = toObject(root.data);
  const settings = toObject(root.settings);

  const candidates: unknown[] = [
    root.analyticsGoals,
    root.analytics_goals,
    data?.analyticsGoals,
    data?.analytics_goals,
    settings?.analyticsGoals,
    settings?.analytics_goals,
  ];

  for (const candidate of candidates) {
    const parsed = parseGoals(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function loadGoalsFromStorage(): GoalTargets | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(GOALS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parseGoals(parsed);
  } catch {
    return null;
  }
}

function saveGoalsToStorage(goals: GoalTargets): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // Best-effort fallback.
  }
}

function getProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

/**
 * Render the GoalTracker component.
 * @param {GoalTrackerProps} props - Component props.
 * @returns {unknown} JSX output for GoalTracker.
 * @example
 * <GoalTracker />
 */
export function GoalTracker({
  currentContacts,
  currentEmails,
  currentReplyRate,
}: GoalTrackerProps) {
  const [goals, setGoals] = useState<GoalTargets>(DEFAULT_GOALS);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [saveHint, setSaveHint] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadGoals() {
      setIsLoadingGoals(true);
      let loadedGoals: GoalTargets | null = null;

      try {
        const response = await supabaseAuthedFetch("/api/v1/settings");
        if (response.ok) {
          const payload = (await response.json().catch(() => null)) as unknown;
          loadedGoals = extractGoalsFromSettingsPayload(payload);
        }
      } catch {
        // If settings API is not available, local storage fallback is used.
      }

      if (!loadedGoals) {
        loadedGoals = loadGoalsFromStorage();
      }

      if (isMounted && loadedGoals) {
        setGoals(loadedGoals);
      }

      if (isMounted) {
        setIsLoadingGoals(false);
      }
    }

    void loadGoals();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveGoals = useCallback(async () => {
    const normalized = normalizeGoals(goals);
    setGoals(normalized);
    setIsSavingGoals(true);
    setSaveHint("");

    try {
      const response = await supabaseAuthedFetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyticsGoals: normalized }),
      });

      if (response.ok) {
        saveGoalsToStorage(normalized);
        setSaveHint("Goals saved.");
        return;
      }

      saveGoalsToStorage(normalized);
      setSaveHint(
        response.status === 404
          ? "Goals saved locally."
          : "Saved locally (settings API unavailable)."
      );
    } catch {
      saveGoalsToStorage(normalized);
      setSaveHint("Goals saved locally.");
    } finally {
      setIsSavingGoals(false);
    }
  }, [goals]);

  const goalProgress = useMemo(
    () => [
      {
        key: "contacts",
        label: "Contacts",
        currentLabel: currentContacts.toLocaleString(),
        targetLabel: goals.targetContacts.toLocaleString(),
        progress: getProgress(currentContacts, goals.targetContacts),
      },
      {
        key: "emails",
        label: "Emails Sent",
        currentLabel: currentEmails.toLocaleString(),
        targetLabel: goals.targetEmailsSent.toLocaleString(),
        progress: getProgress(currentEmails, goals.targetEmailsSent),
      },
      {
        key: "reply-rate",
        label: "Reply Rate",
        currentLabel: `${currentReplyRate.toFixed(1)}%`,
        targetLabel: `${goals.targetReplyRate.toFixed(1)}%`,
        progress: getProgress(currentReplyRate, goals.targetReplyRate),
      },
    ],
    [currentContacts, currentEmails, currentReplyRate, goals]
  );

  const achievements = [
    currentContacts >= 10 && { label: "First 10 Contacts" },
    currentContacts >= 50 && { label: "50 Contacts" },
    currentEmails >= 50 && { label: "50 Emails Sent" },
    currentEmails >= 100 && { label: "100 Emails Sent" },
    currentReplyRate >= 20 && { label: "20% Reply Rate" },
    currentReplyRate >= 30 && { label: "30% Reply Rate" },
  ].filter(Boolean) as Array<{ label: string }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Goal Tracking
        </CardTitle>
        <CardDescription>Track your progress towards your goals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Target className="h-4 w-4 text-slate-500" />
            Set Your Targets
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="targetContacts">Target Contacts</Label>
              <Input
                id="targetContacts"
                type="number"
                min={0}
                value={goals.targetContacts}
                onChange={(event) =>
                  setGoals((prev) =>
                    normalizeGoals({
                      ...prev,
                      targetContacts: Number(event.target.value),
                    })
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetEmailsSent">Target Emails Sent</Label>
              <Input
                id="targetEmailsSent"
                type="number"
                min={0}
                value={goals.targetEmailsSent}
                onChange={(event) =>
                  setGoals((prev) =>
                    normalizeGoals({
                      ...prev,
                      targetEmailsSent: Number(event.target.value),
                    })
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetReplyRate">Target Reply Rate (%)</Label>
              <Input
                id="targetReplyRate"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={goals.targetReplyRate}
                onChange={(event) =>
                  setGoals((prev) =>
                    normalizeGoals({
                      ...prev,
                      targetReplyRate: Number(event.target.value),
                    })
                  )
                }
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {isLoadingGoals ? "Loading saved goals..." : saveHint || "Set your goals and click save."}
            </p>
            <Button type="button" onClick={() => void saveGoals()} disabled={isSavingGoals || isLoadingGoals}>
              {isSavingGoals ? "Saving..." : "Save Goals"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {goalProgress.map((goal) => (
            <div key={goal.key} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">{goal.label}</p>
                <p className="text-xs text-muted-foreground">
                  {goal.currentLabel} / {goal.targetLabel}
                </p>
              </div>
              <Progress value={goal.progress} className="h-2 bg-slate-200" />
              <p className="mt-1 text-right text-xs text-muted-foreground">{goal.progress.toFixed(1)}%</p>
            </div>
          ))}
        </div>

        {/* Achievements - always shown when earned */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-3">Achievements</div>
          {achievements.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => (
                <Badge key={a.label} variant="outline" className="gap-1">
                  <Trophy className="h-3 w-3 text-yellow-500" />
                  {a.label}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keep going! Achievements will appear here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
