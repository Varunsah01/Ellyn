"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-xl border-[#E6E4F2] bg-white">
        <CardHeader>
          <CardTitle className="text-xl text-[#2D2B55]">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Something went wrong. Please refresh the page or try again.
          </p>
          <Button type="button" onClick={reset}>
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
