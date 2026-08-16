import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  restoreExpenseAction,
  softDeleteExpenseAction,
} from "@/actions/expenses";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";
import { db } from "@/db";
import {
  expenseComments,
  expenseHistory,
  expensePayers,
  expenseSplits,
  expenses,
  users,
} from "@/db/schema";
import { assertFriendshipMember } from "@/lib/group-data";
import {
  SMALL_PAGE_SIZE,
  hasNextPage,
  pageOffset,
  parsePage,
  withPageParam,
} from "@/lib/pagination";
import { formatMoney } from "@/lib/utils";
import { CommentForm } from "@/app/(app)/groups/[id]/expenses/[expenseId]/expense-forms";

export default async function FriendExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; expenseId: string }>;
  searchParams: Promise<{ commentsPage?: string; historyPage?: string }>;
}) {
  const { id, expenseId } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let friendship;
  try {
    friendship = await assertFriendshipMember(id, session.user.id);
  } catch {
    notFound();
  }

  const commentsPage = parsePage(sp.commentsPage);
  const historyPage = parsePage(sp.historyPage);
  const commentsOffset = pageOffset(commentsPage, SMALL_PAGE_SIZE);
  const historyOffset = pageOffset(historyPage, SMALL_PAGE_SIZE);
  const basePath = `/friends/${id}/expenses/${expenseId}`;

  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense || expense.friendshipId !== id) notFound();

  const [
    userA,
    userB,
    splits,
    payers,
    comments,
    commentsTotalRow,
    history,
    historyTotalRow,
  ] = await Promise.all([
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
    db
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
      .limit(SMALL_PAGE_SIZE)
      .offset(commentsOffset)
      .all(),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(expenseComments)
      .where(eq(expenseComments.expenseId, expenseId))
      .get(),
    db
      .select()
      .from(expenseHistory)
      .where(eq(expenseHistory.expenseId, expenseId))
      .orderBy(desc(expenseHistory.createdAt))
      .limit(SMALL_PAGE_SIZE)
      .offset(historyOffset)
      .all(),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(expenseHistory)
      .where(eq(expenseHistory.expenseId, expenseId))
      .get(),
  ]);

  const nameById = Object.fromEntries(
    [userA, userB].filter(Boolean).map((u) => [u!.id, u!.name])
  );
  const isCreator = expense.createdById === session.user.id;
  const commentsTotal = commentsTotalRow?.value ?? 0;
  const historyTotal = historyTotalRow?.value ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/friends/${id}`} className="text-sm text-accent">
        ← Back to friendship
      </Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{expense.description}</h1>
            <p className="text-muted">
              {formatMoney(expense.amount, expense.currency)} · {expense.category}
            </p>
            <p className="mt-1 text-sm text-ink">
              Added by {nameById[expense.createdById] ?? "someone"}
            </p>
          </div>
          <div className="flex gap-2">
            {!expense.deletedAt && isCreator && (
              <>
                <Link href={`/friends/${id}/expenses/${expenseId}/edit`}>
                  <Button type="button" variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await softDeleteExpenseAction(expenseId);
                  }}
                >
                  <Button type="submit" variant="danger" size="sm">
                    Delete
                  </Button>
                </form>
              </>
            )}
            {expense.deletedAt && isCreator && (
              <form
                action={async () => {
                  "use server";
                  await restoreExpenseAction(expenseId);
                }}
              >
                <Button type="submit" variant="secondary" size="sm">
                  Restore
                </Button>
              </form>
            )}
          </div>
        </div>
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
        <PaginationNav
          prevHref={
            commentsPage > 1
              ? withPageParam(basePath, 1, {
                  commentsPage: String(commentsPage - 1),
                  historyPage:
                    historyPage > 1 ? String(historyPage) : undefined,
                })
              : null
          }
          nextHref={
            hasNextPage(commentsPage, SMALL_PAGE_SIZE, commentsTotal)
              ? withPageParam(basePath, 1, {
                  commentsPage: String(commentsPage + 1),
                  historyPage:
                    historyPage > 1 ? String(historyPage) : undefined,
                })
              : null
          }
        />
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
        <PaginationNav
          prevHref={
            historyPage > 1
              ? withPageParam(basePath, 1, {
                  historyPage: String(historyPage - 1),
                  commentsPage:
                    commentsPage > 1 ? String(commentsPage) : undefined,
                })
              : null
          }
          nextHref={
            hasNextPage(historyPage, SMALL_PAGE_SIZE, historyTotal)
              ? withPageParam(basePath, 1, {
                  historyPage: String(historyPage + 1),
                  commentsPage:
                    commentsPage > 1 ? String(commentsPage) : undefined,
                })
              : null
          }
        />
      </Card>
    </div>
  );
}
