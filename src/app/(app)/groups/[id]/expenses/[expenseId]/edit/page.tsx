import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { ExpenseForm } from "@/components/expense-form";
import { db } from "@/db";
import { expensePayers, expenseSplits, expenses } from "@/db/schema";
import { assertGroupMember, getGroupMembers } from "@/lib/group-data";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  try {
    await assertGroupMember(id, session.user.id);
  } catch {
    notFound();
  }

  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense || expense.groupId !== id || expense.deletedAt) notFound();
  if (expense.createdById !== session.user.id) notFound();

  const members = await getGroupMembers(id);
  const splits = await db
    .select()
    .from(expenseSplits)
    .where(eq(expenseSplits.expenseId, expenseId))
    .all();
  const payers = await db
    .select()
    .from(expensePayers)
    .where(eq(expensePayers.expenseId, expenseId))
    .all();

  return (
    <ExpenseForm
      groupId={id}
      friendshipId={null}
      members={members}
      defaultCurrency={expense.currency}
      defaultSplitMode={expense.splitMode}
      currentUserId={session.user.id}
      initialExpense={{
        expenseId,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        notes: expense.notes,
        date: expense.date,
        splitMode: expense.splitMode,
        participantIds: splits.map((s) => s.userId),
        payers: payers.map((p) => ({ userId: p.userId, amount: p.amount })),
        splits: splits.map((s) => ({
          userId: s.userId,
          amount: s.amount,
          shares: s.shares,
          percent: s.percent,
        })),
      }}
    />
  );
}
