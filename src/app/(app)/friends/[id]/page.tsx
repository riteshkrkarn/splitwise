import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { ExpenseForm } from "@/components/expense-form";
import { BalanceList } from "@/components/balance-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";
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
import {
  DEFAULT_PAGE_SIZE,
  hasNextPage,
  pageOffset,
  parsePage,
  withPageParam,
} from "@/lib/pagination";
import { formatMoney } from "@/lib/utils";

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
  const page = parsePage(sp.page);
  const offset = pageOffset(page, DEFAULT_PAGE_SIZE);
  const expenseWhere = and(
    eq(expenses.friendshipId, id),
    isNull(expenses.deletedAt)
  );

  // Balance math needs the full ledger; list uses a separate paged query.
  const [allForBalances, friendExpenses, totalRow] = await Promise.all([
    db.select().from(expenses).where(expenseWhere).all(),
    db
      .select()
      .from(expenses)
      .where(expenseWhere)
      .orderBy(desc(expenses.date))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(offset)
      .all(),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(expenses)
      .where(expenseWhere)
      .get(),
  ]);

  const balanceIds = allForBalances.map((e) => e.id);
  const [allPayers, allSplits] = await Promise.all([
    selectByIds(balanceIds, (chunk) =>
      db
        .select()
        .from(expensePayers)
        .where(inArray(expensePayers.expenseId, chunk))
        .all()
    ),
    selectByIds(balanceIds, (chunk) =>
      db
        .select()
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, chunk))
        .all()
    ),
  ]);

  const expensePayload = allForBalances.map((e) => ({
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

  const total = totalRow?.value ?? 0;
  const defaultCurrency = friendExpenses[0]?.currency ?? "INR";

  return (
    <div className="space-y-6">
      <h1 className="page-title">With {other.name}</h1>
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
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {friendExpenses.map((e) => (
            <li key={e.id} className="bg-bg px-3 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Link
                  href={`/friends/${id}/expenses/${e.id}`}
                  className="min-w-0 flex-1 hover:text-primary"
                >
                  <p className="break-words font-medium">{e.description}</p>
                  <p className="text-xs text-muted">
                    Added by {nameById[e.createdById] ?? "someone"}
                  </p>
                </Link>
                <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                  <span className="money">
                    {formatMoney(e.amount, e.currency)}
                  </span>
                  {e.createdById === session.user.id && (
                    <Link href={`/friends/${id}/expenses/${e.id}/edit`}>
                      <Button type="button" variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <PaginationNav
          prevHref={
            page > 1 ? withPageParam(`/friends/${id}`, page - 1) : null
          }
          nextHref={
            hasNextPage(page, DEFAULT_PAGE_SIZE, total)
              ? withPageParam(`/friends/${id}`, page + 1)
              : null
          }
        />
      </Card>
    </div>
  );
}
