import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { ExpenseForm } from "@/components/expense-form";
import { BalanceList } from "@/components/balance-list";
import { Button } from "@/components/ui/button";
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
import { selectByIds } from "@/lib/group-data";
import { formatMoney } from "@/lib/utils";

const PAGE_SIZE = 25;

export default async function FriendshipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
  const [me, other] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)).get(),
    db.select().from(users).where(eq(users.id, otherId)).get(),
  ]);
  if (!me || !other) notFound();

  const members = [
    { userId: me.id, name: me.name },
    { userId: other.id, name: other.name },
  ];
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const allFriendExpenses = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.friendshipId, id), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.date))
    .all();

  const expenseIds = allFriendExpenses.map((e) => e.id);
  const [allPayers, allSplits] = await Promise.all([
    selectByIds(expenseIds, (chunk) =>
      db
        .select()
        .from(expensePayers)
        .where(inArray(expensePayers.expenseId, chunk))
        .all()
    ),
    selectByIds(expenseIds, (chunk) =>
      db
        .select()
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, chunk))
        .all()
    ),
  ]);

  const expensePayload = allFriendExpenses.map((e) => ({
    currency: e.currency,
    payers: allPayers
      .filter((p) => p.expenseId === e.id)
      .map((p) => ({ userId: p.userId, amount: p.amount })),
    splits: allSplits
      .filter((s) => s.expenseId === e.id)
      .map((s) => ({ userId: s.userId, amount: s.amount })),
  }));

  const balances = summarizeBalances(
    computeNetBalances(expensePayload, [], []),
    false,
    computePairwiseDebts(expensePayload, [], [])
  );

  const friendExpenses = allFriendExpenses.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < allFriendExpenses.length;
  const defaultCurrency = allFriendExpenses[0]?.currency ?? "INR";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-ink">With {other.name}</h1>
      <Card>
        <h2 className="mb-2 font-semibold">Balances</h2>
        <BalanceList
          summaries={balances}
          nameById={nameById}
          currentUserId={session.user.id}
          memberIds={members.map((m) => m.userId)}
          friendshipId={id}
        />
      </Card>
      <ExpenseForm
        groupId={null}
        friendshipId={id}
        members={members}
        defaultCurrency={defaultCurrency}
        currentUserId={session.user.id}
      />
      <Card>
        <h2 className="mb-3 font-semibold">Expenses</h2>
        <ul className="space-y-2 text-sm">
          {friendExpenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3">
              <Link
                href={`/friends/${id}/expenses/${e.id}`}
                className="min-w-0 flex-1 hover:text-primary"
              >
                <p className="font-medium">{e.description}</p>
                <p className="text-xs text-muted">
                  Added by {nameById[e.createdById] ?? "someone"}
                </p>
              </Link>
              <span className="money shrink-0">
                {formatMoney(e.amount, e.currency)}
              </span>
              {e.createdById === session.user.id && (
                <Link href={`/friends/${id}/expenses/${e.id}/edit`}>
                  <Button type="button" variant="ghost" size="sm">
                    Edit
                  </Button>
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          {page > 1 && (
            <Link href={`/friends/${id}?page=${page - 1}`}>
              <Button variant="secondary" size="sm">
                Previous
              </Button>
            </Link>
          )}
          {hasMore && (
            <Link href={`/friends/${id}?page=${page + 1}`}>
              <Button variant="secondary" size="sm">
                Next
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
