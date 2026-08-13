import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { ExpenseForm } from "@/components/expense-form";
import { BalanceList } from "@/components/balance-list";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import {
  expensePayers,
  expenseSplits,
  expenses,
  friendships,
  users,
} from "@/db/schema";
import {
  computeNetBalances,
  computePairwiseDebts,
  summarizeBalances,
} from "@/lib/balances";
import { formatMoney } from "@/lib/utils";

export default async function FriendshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const friendship = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.id, id),
        isNull(friendships.deletedAt),
        eq(friendships.status, "ACCEPTED")
      )
    )
    .get();
  if (
    !friendship ||
    (friendship.userAId !== session.user.id &&
      friendship.userBId !== session.user.id)
  ) {
    notFound();
  }

  const otherId =
    friendship.userAId === session.user.id
      ? friendship.userBId
      : friendship.userAId;
  const other = (await db
    .select()
    .from(users)
    .where(eq(users.id, otherId))
    .get())!;
  const me = (await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get())!;

  const members = [
    { userId: me.id, name: me.name },
    { userId: other.id, name: other.name },
  ];
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));

  const friendExpenses = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.friendshipId, id), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.date))
    .all();

  const expensePayload = await Promise.all(
    friendExpenses.map(async (e) => ({
      currency: e.currency,
      payers: (
        await db
          .select()
          .from(expensePayers)
          .where(eq(expensePayers.expenseId, e.id))
          .all()
      ).map((p) => ({ userId: p.userId, amount: p.amount })),
      splits: (
        await db
          .select()
          .from(expenseSplits)
          .where(eq(expenseSplits.expenseId, e.id))
          .all()
      ).map((s) => ({ userId: s.userId, amount: s.amount })),
    }))
  );

  const balances = summarizeBalances(
    computeNetBalances(expensePayload, [], []),
    true,
    computePairwiseDebts(expensePayload, [], [])
  );

  // Cross-group totals: also include shared group expenses between the two
  // (simplified: friendship-only here; group cross-total on analytics)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-ink">
        With {other.name}
      </h1>
      <Card>
        <h2 className="mb-2 font-semibold">Balances</h2>
        <BalanceList
          summaries={balances}
          nameById={nameById}
          currentUserId={session.user.id}
          memberIds={members.map((m) => m.userId)}
        />
      </Card>
      <ExpenseForm
        groupId={null}
        friendshipId={id}
        members={members}
        defaultCurrency="INR"
        currentUserId={session.user.id}
      />
      <Card>
        <h2 className="mb-3 font-semibold">Expenses</h2>
        <ul className="space-y-2 text-sm">
          {friendExpenses.map((e) => (
            <li key={e.id} className="flex justify-between">
              <span>{e.description}</span>
              <span>{formatMoney(e.amount, e.currency)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
