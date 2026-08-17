import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import type { TransferRow } from "@/lib/group-data";

export function TransferList({
  transfers,
  empty,
  direction,
  showGroup,
}: {
  transfers: TransferRow[];
  empty: string;
  direction: "sent" | "received";
  showGroup?: boolean;
}) {
  if (transfers.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {transfers.map((t) => (
        <li key={t.id} className="bg-bg px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-ink">
                {direction === "sent" ? (
                  <>
                    You paid{" "}
                    <span className="font-medium">{t.otherName}</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{t.otherName}</span> paid you
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {new Date(t.date).toLocaleDateString()}
                {showGroup && t.groupId && t.groupName ? (
                  <>
                    {" · "}
                    <Link
                      href={`/groups/${t.groupId}`}
                      className="hover:text-ink"
                    >
                      {t.groupName}
                    </Link>
                  </>
                ) : null}
                {t.note ? ` · ${t.note}` : ""}
              </p>
            </div>
            <p className="money shrink-0 text-sm">
              {formatMoney(t.amount, t.currency)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
