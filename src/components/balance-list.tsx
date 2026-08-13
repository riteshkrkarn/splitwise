"use client";

import { useActionState, useEffect, useState } from "react";
import { createSettlementAction } from "@/actions/settlements";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import type { BalanceSummary, LedgerEntry } from "@/lib/balances";

type PairRow = {
  aId: string;
  bId: string;
  fromUserId: string | null;
  toUserId: string | null;
  amount: number;
};

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function allMemberPairs(
  memberIds: string[],
  pairwise: LedgerEntry[]
): PairRow[] {
  const debtByPair = new Map<string, LedgerEntry>();
  for (const d of pairwise) {
    debtByPair.set(pairKey(d.fromUserId, d.toUserId), d);
  }

  const ids = [...new Set(memberIds)];
  const rows: PairRow[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const aId = ids[i];
      const bId = ids[j];
      const debt = debtByPair.get(pairKey(aId, bId));
      rows.push({
        aId,
        bId,
        fromUserId: debt?.fromUserId ?? null,
        toUserId: debt?.toUserId ?? null,
        amount: debt?.amount ?? 0,
      });
    }
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

export function BalanceList({
  summaries,
  nameById,
  currentUserId,
  memberIds,
  groupId,
}: {
  summaries: BalanceSummary[];
  nameById: Record<string, string>;
  currentUserId?: string;
  memberIds?: string[];
  groupId?: string;
}) {
  if (summaries.length === 0) {
    return (
      <p className="text-sm text-muted">No balances yet — add an expense.</p>
    );
  }

  return (
    <div className="space-y-5">
      {summaries.map((s) => {
        const pairwise = s.pairwiseDebts ?? s.debts;
        const ids =
          memberIds && memberIds.length > 0
            ? memberIds
            : [
                ...new Set([
                  ...(currentUserId ? [currentUserId] : []),
                  ...pairwise.flatMap((d) => [d.fromUserId, d.toUserId]),
                ]),
              ];
        const pairs = allMemberPairs(ids, pairwise);
        const mine = currentUserId
          ? pairwise.filter(
              (d) =>
                d.fromUserId === currentUserId || d.toUserId === currentUserId
            )
          : [];
        const youOwe = mine.filter((d) => d.fromUserId === currentUserId);
        const owedToYou = mine.filter((d) => d.toUserId === currentUserId);

        return (
          <div key={s.currency} className="space-y-4">
            {currentUserId && (
              <div className="rounded-xl bg-bg px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Your position · {s.currency}
                </p>
                {youOwe.length === 0 && owedToYou.length === 0 ? (
                  <p className="mt-1 text-lg money text-muted">Settled up</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    <PositionGroup
                      label="You owe"
                      tone="owe"
                      currency={s.currency}
                      entries={youOwe}
                      nameById={nameById}
                      otherId={(d) => d.toUserId}
                    />
                    <PositionGroup
                      label="You’re owed"
                      tone="owed"
                      currency={s.currency}
                      entries={owedToYou}
                      nameById={nameById}
                      otherId={(d) => d.fromUserId}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Every pair
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {pairs.length === 0 && (
                  <li className="px-3 py-3 text-sm text-muted">
                    Everyone is even.
                  </li>
                )}
                {pairs.map((pair) => (
                  <li
                    key={pairKey(pair.aId, pair.bId)}
                    className="bg-bg px-3 py-3"
                  >
                    <PairRow
                      pair={pair}
                      currency={s.currency}
                      nameById={nameById}
                      groupId={groupId}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PairRow({
  pair,
  currency,
  nameById,
  groupId,
}: {
  pair: PairRow;
  currency: string;
  nameById: Record<string, string>;
  groupId?: string;
}) {
  const [paying, setPaying] = useState(false);
  const aName = nameById[pair.aId] ?? "Someone";
  const bName = nameById[pair.bId] ?? "Someone";
  const settled = pair.amount < 0.01 || !pair.fromUserId || !pair.toUserId;
  const fromName = pair.fromUserId
    ? (nameById[pair.fromUserId] ?? "Someone")
    : aName;
  const toName = pair.toUserId ? (nameById[pair.toUserId] ?? "Someone") : bName;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink">
            <span className="font-medium">{aName}</span>
            <span className="text-muted"> · </span>
            <span className="font-medium">{bName}</span>
          </p>
          {settled ? (
            <p className="mt-0.5 text-sm text-muted">Settled</p>
          ) : (
            <p className="mt-0.5 text-sm">
              <span className="font-medium">{fromName}</span>{" "}
              <span className="text-muted">owes</span>{" "}
              <span className="font-medium">{toName}</span>{" "}
              <span className="money">{formatMoney(pair.amount, currency)}</span>
            </p>
          )}
        </div>
        {groupId && !settled && pair.fromUserId && pair.toUserId && !paying && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPaying(true)}
          >
            Pay
          </Button>
        )}
      </div>
      {groupId && paying && pair.fromUserId && pair.toUserId && (
        <PayControl
          groupId={groupId}
          fromUserId={pair.fromUserId}
          toUserId={pair.toUserId}
          remaining={pair.amount}
          currency={currency}
          onCancel={() => setPaying(false)}
        />
      )}
    </div>
  );
}

function PayControl({
  groupId,
  fromUserId,
  toUserId,
  remaining,
  currency,
  onCancel,
}: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  remaining: number;
  currency: string;
  onCancel: () => void;
}) {
  const bound = createSettlementAction.bind(null, groupId);
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    bound,
    {}
  );

  useEffect(() => {
    if (state.success) onCancel();
  }, [state.success, onCancel]);

  return (
    <form action={action} className="space-y-2 rounded-lg bg-surface p-3">
      <input type="hidden" name="fromUserId" value={fromUserId} />
      <input type="hidden" name="toUserId" value={toUserId} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="stay" value="1" />
      <input
        type="hidden"
        name="date"
        value={new Date().toISOString().slice(0, 10)}
      />
      <input type="hidden" name="note" value="Partial payment" />
      <Input
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        defaultValue={remaining.toFixed(2)}
        aria-label="Payment amount"
        required
      />
      <p className="text-xs text-muted">
        Remaining {formatMoney(remaining, currency)}. A smaller payment leaves
        the rest on this pair.
      </p>
      {state.error && (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Record"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PositionGroup({
  label,
  tone,
  currency,
  entries,
  nameById,
  otherId,
}: {
  label: string;
  tone: "owe" | "owed";
  currency: string;
  entries: LedgerEntry[];
  nameById: Record<string, string>;
  otherId: (d: LedgerEntry) => string;
}) {
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, d) => sum + d.amount, 0);
  return (
    <div>
      <p className={`text-lg money ${tone === "owe" ? "text-owe" : "text-owed"}`}>
        {label} {formatMoney(total, currency)}
      </p>
      <ul className="mt-1 space-y-1">
        {entries.map((d) => (
          <li
            key={`${d.fromUserId}-${d.toUserId}`}
            className="flex justify-between gap-3 text-sm text-muted"
          >
            <span>{nameById[otherId(d)] ?? "Someone"}</span>
            <span className="money">{formatMoney(d.amount, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
