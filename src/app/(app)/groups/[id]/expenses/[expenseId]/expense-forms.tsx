"use client";

import { useActionState, useState } from "react";
import { addCommentAction } from "@/actions/expenses";
import { attachReceiptAction } from "@/actions/advanced";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function CommentForm({ expenseId }: { expenseId: string }) {
  const bound = addCommentAction.bind(null, expenseId);
  const [state, action, pending] = useActionState(bound, initial);
  return (
    <form action={action} className="flex gap-2">
      <Input name="body" placeholder="Add a comment" required />
      <Button type="submit" disabled={pending} size="sm">
        Post
      </Button>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function ReceiptForm({
  expenseId,
  members,
}: {
  expenseId: string;
  members: { userId: string; name: string }[];
}) {
  const [items, setItems] = useState([
    { name: "", price: "", assignedToUserId: members[0]?.userId ?? "" },
  ]);
  const [message, setMessage] = useState("");

  async function onSubmit(formData: FormData) {
    formData.set(
      "itemsJson",
      JSON.stringify(
        items
          .filter((i) => i.name && i.price)
          .map((i) => ({
            name: i.name,
            price: Number(i.price),
            assignedToUserId: i.assignedToUserId || undefined,
          }))
      )
    );
    const res = await attachReceiptAction(expenseId, formData);
    setMessage(res.error ?? res.success ?? "");
  }

  return (
    <form action={onSubmit} className="space-y-3 text-sm">
      <Input name="merchant" placeholder="Merchant" />
      <Input name="receipt" type="file" accept="image/*,.pdf,.txt" />
      <div className="space-y-2">
        <p className="font-medium">Line items</p>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Item"
              value={item.name}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, name: e.target.value };
                setItems(next);
              }}
            />
            <Input
              placeholder="Price"
              type="number"
              step="0.01"
              value={item.price}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, price: e.target.value };
                setItems(next);
              }}
            />
            <select
              className="h-11 rounded-xl border px-2"
              value={item.assignedToUserId}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, assignedToUserId: e.target.value };
                setItems(next);
              }}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setItems([
              ...items,
              { name: "", price: "", assignedToUserId: members[0]?.userId ?? "" },
            ])
          }
        >
          Add line
        </Button>
      </div>
      {message && <p className="text-accent">{message}</p>}
      <Button type="submit" size="sm">
        Save receipt
      </Button>
    </form>
  );
}
