"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createExpenseAction,
  updateExpenseAction,
} from "@/actions/expenses";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CURRENCIES } from "@/lib/utils";

const initial: ActionResult = {};

type Member = { userId: string; name: string };

export type ExpenseFormInitial = {
  expenseId: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  notes: string | null;
  date: Date | string;
  splitMode: string;
  participantIds: string[];
  payers: { userId: string; amount: number }[];
  splits: {
    userId: string;
    amount: number;
    shares: number | null;
    percent: number | null;
  }[];
};

export function ExpenseForm({
  groupId,
  friendshipId,
  members,
  defaultCurrency,
  defaultSplitMode = "EQUAL",
  defaultSplitValues = {},
  currentUserId,
  initialExpense,
}: {
  groupId: string | null;
  friendshipId: string | null;
  members: Member[];
  defaultCurrency: string;
  defaultSplitMode?: string;
  defaultSplitValues?: Record<string, number>;
  currentUserId: string;
  initialExpense?: ExpenseFormInitial;
}) {
  const editing = Boolean(initialExpense);
  const createBound = createExpenseAction.bind(null, groupId, friendshipId);
  const updateBound = initialExpense
    ? updateExpenseAction.bind(null, initialExpense.expenseId)
    : null;
  const [state, action, pending] = useActionState(
    updateBound ?? createBound,
    initial
  );
  const [splitMode, setSplitMode] = useState(
    initialExpense?.splitMode ?? defaultSplitMode
  );
  const [multiPayer, setMultiPayer] = useState(
    (initialExpense?.payers.length ?? 0) > 1
  );
  const [selected, setSelected] = useState<string[]>(
    initialExpense?.participantIds ?? members.map((m) => m.userId)
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateValue = initialExpense
    ? new Date(initialExpense.date).toISOString().slice(0, 10)
    : today;
  const defaultPayerId =
    initialExpense?.payers.length === 1
      ? initialExpense.payers[0].userId
      : currentUserId;
  const payerAmountById = Object.fromEntries(
    (initialExpense?.payers ?? []).map((p) => [p.userId, p.amount])
  );
  const splitById = Object.fromEntries(
    (initialExpense?.splits ?? []).map((s) => [s.userId, s])
  );

  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-ink">
        {editing ? "Edit expense" : "Add expense"}
      </h1>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            defaultValue={initialExpense?.description}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={initialExpense?.amount}
              required
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              name="currency"
              defaultValue={initialExpense?.currency ?? defaultCurrency}
            >
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
            <Input id="date" name="date" type="date" defaultValue={dateValue} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              name="category"
              defaultValue={initialExpense?.category ?? "General"}
            >
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
          <Input
            id="notes"
            name="notes"
            defaultValue={initialExpense?.notes ?? ""}
          />
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
              const existing = splitById[uid];
              const def =
                splitMode === "EXACT"
                  ? existing?.amount
                  : splitMode === "PERCENTAGE"
                    ? existing?.percent
                    : existing?.shares;
              return (
                <div key={uid} className="flex items-center gap-2">
                  <span className="w-28 truncate text-sm">{name}</span>
                  <Input
                    name={field}
                    type="number"
                    step="0.01"
                    defaultValue={def ?? defaultSplitValues[uid]}
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
            <Select id="payerId" name="payerId" defaultValue={defaultPayerId}>
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
                  <Input
                    name={`payer_${uid}`}
                    type="number"
                    step="0.01"
                    defaultValue={payerAmountById[uid] ?? 0}
                  />
                </div>
              );
            })}
          </div>
        )}

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending
            ? editing
              ? "Saving…"
              : "Adding…"
            : editing
              ? "Save changes"
              : "Save expense"}
        </Button>
      </form>
    </Card>
  );
}
