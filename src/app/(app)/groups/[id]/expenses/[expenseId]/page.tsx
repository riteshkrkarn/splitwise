import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
  restoreExpenseAction,
  softDeleteExpenseAction,
} from "@/actions/expenses";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import {
  expenseComments,
  expenseHistory,
  expensePayers,
  expenseSplits,
  expenses,
  receiptItems,
  receipts,
  users,
} from "@/db/schema";
import { assertGroupMember, getGroupMembers } from "@/lib/group-data";
import { formatMoney } from "@/lib/utils";
import { CommentForm, ReceiptForm } from "./expense-forms";

migrate();

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  try {
    assertGroupMember(id, session.user.id);
  } catch {
    notFound();
  }

  const expense = db.select().from(expenses).where(eq(expenses.id, expenseId)).get();
  if (!expense || expense.groupId !== id) notFound();

  const members = getGroupMembers(id);
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const splits = db
    .select()
    .from(expenseSplits)
    .where(eq(expenseSplits.expenseId, expenseId))
    .all();
  const payers = db
    .select()
    .from(expensePayers)
    .where(eq(expensePayers.expenseId, expenseId))
    .all();
  const comments = db
    .select({
      id: expenseComments.id,
      body: expenseComments.body,
      createdAt: expenseComments.createdAt,
      name: users.name,
      avatarId: users.avatarId,
    })
    .from(expenseComments)
    .innerJoin(users, eq(users.id, expenseComments.userId))
    .where(eq(expenseComments.expenseId, expenseId))
    .orderBy(desc(expenseComments.createdAt))
    .all();
  const history = db
    .select()
    .from(expenseHistory)
    .where(eq(expenseHistory.expenseId, expenseId))
    .orderBy(desc(expenseHistory.createdAt))
    .all();
  const receipt = db
    .select()
    .from(receipts)
    .where(eq(receipts.expenseId, expenseId))
    .get();
  const items = receipt
    ? db.select().from(receiptItems).where(eq(receiptItems.receiptId, receipt.id)).all()
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/groups/${id}`} className="text-sm text-accent">
        ← Back to group
      </Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">
              {expense.description}
            </h1>
            <p className="text-muted">
              {formatMoney(expense.amount, expense.currency)} · {expense.category}
            </p>
            {expense.deletedAt && (
              <p className="mt-1 text-sm text-danger">Deleted</p>
            )}
          </div>
          <div className="flex gap-2">
            {!expense.deletedAt ? (
              <form action={softDeleteExpenseAction.bind(null, expenseId)}>
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            ) : (
              <form action={restoreExpenseAction.bind(null, expenseId)}>
                <Button type="submit" variant="secondary" size="sm">
                  Restore
                </Button>
              </form>
            )}
          </div>
        </div>
        {expense.notes && <p className="mt-3 text-sm text-muted">{expense.notes}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold">Paid by</h2>
            <ul className="mt-1 text-sm">
              {payers.map((p) => (
                <li key={p.id}>
                  {nameById[p.userId]} — {formatMoney(p.amount, expense.currency)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Split</h2>
            <ul className="mt-1 text-sm">
              {splits.map((s) => (
                <li key={s.id}>
                  {nameById[s.userId]} — {formatMoney(s.amount, expense.currency)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Comments</h2>
        <ul className="mb-4 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <AvatarDisplay avatarId={c.avatarId} name={c.name} size={28} />
              <div>
                <p className="font-medium">{c.name}</p>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <CommentForm expenseId={expenseId} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Receipt & itemization</h2>
        {receipt && (
          <div className="mb-3 text-sm">
            <p>Merchant: {receipt.merchant ?? "—"}</p>
            <p>Scanned total: {receipt.total}</p>
            {receipt.filePath && (
              <a className="text-accent underline" href={receipt.filePath}>
                View file
              </a>
            )}
            <ul className="mt-2">
              {items.map((i) => (
                <li key={i.id}>
                  {i.name} × {i.quantity} — {i.price}
                  {i.assignedToUserId
                    ? ` → ${nameById[i.assignedToUserId] ?? i.assignedToUserId}`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ReceiptForm expenseId={expenseId} members={members} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Edit history</h2>
        <ul className="space-y-1 text-sm text-muted">
          {history.map((h) => (
            <li key={h.id}>
              {h.action} · {new Date(h.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
