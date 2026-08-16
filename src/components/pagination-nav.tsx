import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PaginationNav({
  prevHref,
  nextHref,
  className = "mt-4 flex flex-wrap gap-2",
}: {
  prevHref?: string | null;
  nextHref?: string | null;
  className?: string;
}) {
  if (!prevHref && !nextHref) return null;
  return (
    <div className={className}>
      {prevHref ? (
        <Link href={prevHref}>
          <Button variant="secondary" size="sm">
            Previous
          </Button>
        </Link>
      ) : null}
      {nextHref ? (
        <Link href={nextHref}>
          <Button variant="secondary" size="sm">
            Next
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
