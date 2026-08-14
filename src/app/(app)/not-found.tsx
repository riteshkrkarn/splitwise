import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-sm text-muted">
        That page does not exist, or you do not have access to it.
      </p>
      <Link href="/dashboard">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
