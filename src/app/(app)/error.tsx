"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted">
        We hit an unexpected error. Try again, or go back to the dashboard.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <a href="/dashboard">
          <Button type="button" variant="secondary">
            Dashboard
          </Button>
        </a>
      </div>
    </div>
  );
}
