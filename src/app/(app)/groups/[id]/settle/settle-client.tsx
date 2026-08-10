"use client";

import { useActionState, useState } from "react";
import { createSettlementAction } from "@/actions/settlements";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = {};

export default function SettleClient({
  groupId,
  members,
  currency,
  suggestions,
}: {
  groupId: string;
  members: { userId: string; name: string }[];
  currency: string;
  suggestions: { fromUserId: string; toUserId: string; amount: number }[];
}) {
  const bound = createSettlementAction.bind(null, groupId);
  const [state, action, pending] = useActionState(bound, initial);
  const [fromUserId, setFrom] = useState(suggestions[0]?.fromUserId ?? members[0]?.userId);
  const [toUserId, setTo] = useState(suggestions[0]?.toUserId ?? members[1]?.userId);
  const [amount, setAmount] = useState(String(suggestions[0]?.amount ?? ""));

  return (
    <Card className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-ink">Settle up</h1>
      <p className="text-sm text-muted">
        Record a simple transfer: A transferred amount to B.
      </p>
      {suggestions.length > 0 && (
        <div className="rounded-xl bg-surface p-3 text-sm">
          <p className="mb-2 font-medium">Suggested</p>
          <ul className="space-y-1">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="text-left text-ink underline"
                  onClick={() => {
                    setFrom(s.fromUserId);
                    setTo(s.toUserId);
                    setAmount(String(s.amount));
                  }}
                >
                  {members.find((m) => m.userId === s.fromUserId)?.name} →{" "}
                  {members.find((m) => m.userId === s.toUserId)?.name}: {s.amount}{" "}
                  {currency}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form action={action} className="space-y-4">
        <input type="hidden" name="currency" value={currency} />
        <div>
          <Label>From (who paid)</Label>
          <select
            name="fromUserId"
            value={fromUserId}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 w-full rounded-xl border px-3 text-sm"
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>To (who received)</Label>
          <select
            name="toUserId"
            value={toUserId}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 w-full rounded-xl border px-3 text-sm"
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" placeholder="Optional" />
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          Record transfer
        </Button>
      </form>
    </Card>
  );
}
