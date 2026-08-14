import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { ExpenseForm } from "@/components/expense-form";
import { db } from "@/db";
import { expensePayers, expenseSplits, expenses, users } from "@/db/schema";
import { assertFriendshipMember } from "@/lib/group-data";

export default async function EditFriendExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let friendship;
  try {
    friendship = await assertFriendshipMember(id, session.user.id);
  } catch {
    notFound();
  }

  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense || expense.friendshipId !== id || expense.deletedAt) notFound();
  if (expense.createdById !== session.user.id) notFound();

  const [userA, userB, splits, payers] = await Promise.all([
    db.select().from(users).where(eq(users.id, friendship.userAId)).get(),
    db.select().from(users).where(eq(users.id, friendship.userBId)).get(),
    db
      .select()
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId))
      .all(),
    db
      .select()
      .from(expensePayers)
      .where(eq(expensePayers.expenseId, expenseId))
      .all(),
  ]);

  const members = [userA, userB]
    .filter(Boolean)
    .map((u) => ({ userId: u!.id, name: u!.name }));

  return (
    <ExpenseForm
      groupId={null}
      friendshipId={id}
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
