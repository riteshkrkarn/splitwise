import { formatMoney } from "@/lib/utils";
import type { BalanceSummary } from "@/lib/balances";

export function BalanceList({
  summaries,
  nameById,
  currentUserId,
}: {
  summaries: BalanceSummary[];
  nameById: Record<string, string>;
  currentUserId?: string;
}) {
  if (summaries.length === 0) {
    return (
      <p className="text-sm text-muted">No balances yet — add an expense.</p>
    );
  }

  return (
    <div className="space-y-5">
      {summaries.map((s) => {
        const myNet = currentUserId ? s.netByUser[currentUserId] ?? 0 : 0;
        return (
          <div key={s.currency} className="space-y-3">
            {currentUserId && (
              <div className="rounded-xl bg-bg px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Your position · {s.currency}
                </p>
                <p
                  className={`mt-1 text-lg money ${
                    myNet > 0.009
                      ? "text-owed"
                      : myNet < -0.009
                        ? "text-owe"
                        : "text-muted"
                  }`}
                >
                  {Math.abs(myNet) < 0.01
                    ? "Settled up"
                    : myNet > 0
                      ? `You’re owed ${formatMoney(myNet, s.currency)}`
                      : `You owe ${formatMoney(Math.abs(myNet), s.currency)}`}
                </p>
              </div>
            )}
            <ul className="space-y-2">
              {s.debts.length === 0 && (
                <li className="text-sm text-muted">Everyone is even.</li>
              )}
              {s.debts.map((d, i) => (
                <li
                  key={`${d.fromUserId}-${d.toUserId}-${i}`}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-ink">
                    <span className="font-medium">
                      {nameById[d.fromUserId] ?? "Someone"}
                    </span>{" "}
                    <span className="text-muted">owes</span>{" "}
                    <span className="font-medium">
                      {nameById[d.toUserId] ?? "someone"}
                    </span>
                  </span>
                  <span className="money shrink-0 text-ink">
                    {formatMoney(d.amount, d.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
