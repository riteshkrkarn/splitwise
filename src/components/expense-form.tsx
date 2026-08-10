"use client";

import { useActionState, useMemo, useState } from "react";
import { createExpenseAction } from "@/actions/expenses";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CURRENCIES } from "@/lib/utils";

const initial: ActionResult = {};

type Member = { userId: string; name: string };

export function ExpenseForm({
  groupId,
  friendshipId,
  members,
  defaultCurrency,
  defaultSplitMode = "EQUAL",
  defaultSplitValues = {},
  currentUserId,
}: {
  groupId: string | null;
  friendshipId: string | null;
  members: Member[];
  defaultCurrency: string;
  defaultSplitMode?: string;
  defaultSplitValues?: Record<string, number>;
  currentUserId: string;
}) {
  const bound = createExpenseAction.bind(null, groupId, friendshipId);
  const [state, action, pending] = useActionState(bound, initial);
  const [splitMode, setSplitMode] = useState(defaultSplitMode);
  const [multiPayer, setMultiPayer] = useState(false);
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.userId));

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-ink">Add expense</h1>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" name="currency" defaultValue={defaultCurrency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={today} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" defaultValue="General">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" />
        </div>

        <div>
          <Label>Split among</Label>
          <div className="mt-2 space-y-2">
            {members.map((m) => (
              <label key={m.userId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="participantIds"
                  value={m.userId}
                  checked={selected.includes(m.userId)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, m.userId]
                        : prev.filter((id) => id !== m.userId)
                    );
                  }}
                />
                {m.name}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="splitMode">Split mode</Label>
          <Select
            id="splitMode"
            name="splitMode"
            value={splitMode}
            onChange={(e) => setSplitMode(e.target.value)}
          >
            <option value="EQUAL">Equal</option>
            <option value="EXACT">Exact amounts</option>
            <option value="PERCENTAGE">Percentages</option>
            <option value="SHARES">Shares</option>
          </Select>
        </div>

        {splitMode !== "EQUAL" && (
          <div className="space-y-2 rounded-xl bg-bg p-3">
            {selected.map((uid) => {
              const name = members.find((m) => m.userId === uid)?.name ?? uid;
              const field =
                splitMode === "EXACT"
                  ? `exact_${uid}`
                  : splitMode === "PERCENTAGE"
                    ? `percent_${uid}`
                    : `shares_${uid}`;
              const def = defaultSplitValues[uid];
              return (
                <div key={uid} className="flex items-center gap-2">
                  <span className="w-28 truncate text-sm">{name}</span>
                  <Input
                    name={field}
                    type="number"
                    step="0.01"
                    defaultValue={def}
                    required
                  />
                </div>
              );
            })}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="multiPayer"
            checked={multiPayer}
            onChange={(e) => setMultiPayer(e.target.checked)}
          />
          Multiple people paid
        </label>

        {!multiPayer ? (
          <div>
            <Label htmlFor="payerId">Paid by</Label>
            <Select id="payerId" name="payerId" defaultValue={currentUserId}>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl bg-bg p-3">
            {selected.map((uid) => {
              const name = members.find((m) => m.userId === uid)?.name ?? uid;
              return (
                <div key={uid} className="flex items-center gap-2">
                  <span className="w-28 truncate text-sm">{name} paid</span>
                  <Input name={`payer_${uid}`} type="number" step="0.01" defaultValue={0} />
                </div>
              );
            })}
          </div>
        )}

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          Save expense
        </Button>
      </form>
    </Card>
  );
}
