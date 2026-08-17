import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray, isNotNull, isNull, like, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { sendPaymentRemindersAction } from "@/actions/notifications";
import { AvatarDisplay } from "@/components/avatar-display";
import { BalanceList } from "@/components/balance-list";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/pagination-nav";
import { db } from "@/db";
import { expensePayers, expenses, users } from "@/db/schema";
import { CATEGORIES } from "@/lib/utils";
import {
  assertGroupMember,
  getGroupBalances,
  getGroupMembers,
  getGroupOrThrow,
  getPendingInvites,
  getTransfersForUser,
} from "@/lib/group-data";
import { TransferList } from "@/components/transfer-list";
import {
  DEFAULT_PAGE_SIZE,
  SMALL_PAGE_SIZE,
  hasNextPage,
  pageOffset,
  parsePage,
  withPageParam,
} from "@/lib/pagination";
import { formatMoney } from "@/lib/utils";
import { InviteForm } from "./group-forms";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    addedBy?: string;
    paidBy?: string;
    page?: string;
    settlementsPage?: string;
    deletedPage?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    await assertGroupMember(id, session.user.id);
  } catch {
    notFound();
  }

  const page = parsePage(sp.page);
  const settlementsPage = parsePage(sp.settlementsPage);
  const deletedPage = parsePage(sp.deletedPage);
  const offset = pageOffset(page, DEFAULT_PAGE_SIZE);
  const settlementsOffset = pageOffset(settlementsPage, SMALL_PAGE_SIZE);
  const deletedOffset = pageOffset(deletedPage, SMALL_PAGE_SIZE);

  const [group, members, balances, invites] = await Promise.all([
    getGroupOrThrow(id),
    getGroupMembers(id),
    getGroupBalances(id),
    getPendingInvites(id),
  ]);
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const filterExtra = {
    q: sp.q,
    category: sp.category,
    addedBy: sp.addedBy,
    paidBy: sp.paidBy,
    settlementsPage:
      settlementsPage > 1 ? String(settlementsPage) : undefined,
    deletedPage: deletedPage > 1 ? String(deletedPage) : undefined,
  };

  const conditions = [eq(expenses.groupId, id)];
  if (sp.q) conditions.push(like(expenses.description, `%${sp.q}%`));
  if (sp.category) conditions.push(eq(expenses.category, sp.category));
  if (sp.addedBy) conditions.push(eq(expenses.createdById, sp.addedBy));
  if (sp.paidBy) {
    const paidRows = await db
      .select({ expenseId: expensePayers.expenseId })
      .from(expensePayers)
      .innerJoin(expenses, eq(expenses.id, expensePayers.expenseId))
      .where(
        and(
          eq(expensePayers.userId, sp.paidBy),
          eq(expenses.groupId, id),
          isNull(expenses.deletedAt)
        )
      )
      .all();
    const paidIds = [...new Set(paidRows.map((r) => r.expenseId))];
    conditions.push(
      paidIds.length > 0
        ? inArray(expenses.id, paidIds)
        : eq(expenses.id, "__none__")
    );
  }

  const deletedWhere = and(
    eq(expenses.groupId, id),
    isNotNull(expenses.deletedAt)
  );

  const [
    active,
    totalRow,
    sentTransfers,
    receivedTransfers,
    deleted,
    deletedTotalRow,
  ] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(and(...conditions, isNull(expenses.deletedAt)))
      .orderBy(desc(expenses.date))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(offset)
      .all(),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(expenses)
      .where(and(...conditions, isNull(expenses.deletedAt)))
      .get(),
    getTransfersForUser(session.user.id, {
      direction: "sent",
      groupId: id,
      limit: SMALL_PAGE_SIZE,
      offset: settlementsOffset,
    }),
    getTransfersForUser(session.user.id, {
      direction: "received",
      groupId: id,
      limit: SMALL_PAGE_SIZE,
      offset: 0,
    }),
    db
      .select()
      .from(expenses)
      .where(deletedWhere)
      .orderBy(desc(expenses.deletedAt))
      .limit(SMALL_PAGE_SIZE)
      .offset(deletedOffset)
      .all(),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(expenses)
      .where(deletedWhere)
      .get(),
  ]);

  const total = totalRow?.value ?? 0;
  const settlementTotal = sentTransfers.total;
  const deletedTotal = deletedTotalRow?.value ?? 0;

  const payerRows =
    active.length === 0
      ? []
      : await db
          .select()
          .from(expensePayers)
          .where(
            inArray(
              expensePayers.expenseId,
              active.map((e) => e.id)
            )
          )
          .all();
  const creatorIds = [...new Set(active.map((e) => e.createdById))];
  const creatorRows =
    creatorIds.length === 0
      ? []
      : await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, creatorIds))
          .all();
  const creatorNameById = {
    ...nameById,
    ...Object.fromEntries(creatorRows.map((u) => [u.id, u.name])),
  };
  const payersByExpense = new Map<string, string[]>();
  for (const p of payerRows) {
    const list = payersByExpense.get(p.expenseId) ?? [];
    list.push(creatorNameById[p.userId] ?? nameById[p.userId] ?? "Someone");
    payersByExpense.set(p.expenseId, list);
  }

  function pageHref(nextPage: number) {
    return withPageParam(`/groups/${id}`, nextPage, filterExtra);
  }

  function settlementsHref(nextPage: number) {
    return withPageParam(`/groups/${id}`, page, {
      ...filterExtra,
      settlementsPage: String(nextPage),
    });
  }

  function deletedHref(nextPage: number) {
    return withPageParam(`/groups/${id}`, page, {
      ...filterExtra,
      deletedPage: String(nextPage),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <AvatarDisplay
            avatarId={group.coverAvatarId}
            name={group.name}
            size={56}
          />
          <div className="min-w-0">
            <h1 className="page-title">{group.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {members.length}/5 members · {group.currency}
              {group.simplifyDebts ? " · debts simplified" : ""}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link href={`/groups/${id}/expenses/new`} className="sm:inline-flex">
            <Button className="w-full sm:w-auto">Add expense</Button>
          </Link>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href={`/groups/${id}/settings`} className="min-w-0">
              <Button variant="outline" className="w-full sm:w-auto">
                Settings
              </Button>
            </Link>
            <Link href={`/groups/${id}/export?format=csv`} className="min-w-0">
              <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                Export
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-muted">Balances</h2>
          <BalanceList
            summaries={balances}
            nameById={nameById}
            currentUserId={session.user.id}
            memberIds={members.map((m) => m.userId)}
            groupId={id}
          />
          <form
            action={async () => {
              "use server";
              await sendPaymentRemindersAction(id);
            }}
            className="mt-4"
          >
            <Button type="submit" variant="ghost" size="sm">
              Nudge people who owe
            </Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-muted">Members</h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 text-sm">
                <AvatarDisplay avatarId={m.avatarId} name={m.name} size={28} />
                <span className="font-medium">{m.name}</span>
                {m.role === "OWNER" && (
                  <span className="text-xs text-muted">owner</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-border pt-4">
            <InviteForm groupId={id} />
            {invites.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                {invites.length} pending invite{invites.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
          <h2 className="font-semibold">Expenses</h2>
          <form className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_minmax(0,10rem)_minmax(0,10rem)_auto]">
            <Input
              name="q"
              placeholder="Search…"
              defaultValue={sp.q}
              className="w-full min-w-0"
            />
            <Select
              name="category"
              defaultValue={sp.category ?? ""}
              className="h-11 w-full min-w-0"
              aria-label="Category"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              name="addedBy"
              defaultValue={sp.addedBy ?? ""}
              className="h-11 w-full min-w-0"
              aria-label="Added by"
            >
              <option value="">Anyone added</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  Added by {m.name}
                </option>
              ))}
            </Select>
            <Select
              name="paidBy"
              defaultValue={sp.paidBy ?? ""}
              className="h-11 w-full min-w-0"
              aria-label="Paid by"
            >
              <option value="">Anyone paid</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  Paid by {m.name}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto lg:self-stretch"
            >
              Filter
            </Button>
          </form>
        </div>
        {active.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={
                sp.q || sp.category || sp.addedBy || sp.paidBy
                  ? "No matching expenses"
                  : "No expenses yet"
              }
              description={
                sp.q || sp.category || sp.addedBy || sp.paidBy
                  ? "Try clearing a filter or searching a different name."
                  : "Add the first shared cost so balances stay accurate."
              }
              action={
                <Link href={`/groups/${id}/expenses/new`}>
                  <Button size="sm">Add expense</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((e) => (
              <li key={e.id}>
                <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
                  <Link
                    href={`/groups/${id}/expenses/${e.id}`}
                    className="min-w-0 flex-1 transition-colors hover:text-primary"
                  >
                    <p className="wrap-break-word font-medium sm:truncate">
                      {e.description}
                    </p>
                    <p className="text-sm text-ink">
                      Added by {creatorNameById[e.createdById] ?? "someone"}
                    </p>
                    <p className="text-xs text-muted">
                      {e.category} · {new Date(e.date).toLocaleDateString()}
                      {payersByExpense.get(e.id)?.length
                        ? ` · paid by ${payersByExpense.get(e.id)!.join(", ")}`
                        : ""}
                    </p>
                  </Link>
                  <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                    <p className="money">
                      {formatMoney(e.amount, e.currency)}
                    </p>
                    {e.createdById === session.user.id && (
                      <Link href={`/groups/${id}/expenses/${e.id}/edit`}>
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
        )}
        <PaginationNav
          className="border-t border-border px-5 py-3"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={
            hasNextPage(page, DEFAULT_PAGE_SIZE, total)
              ? pageHref(page + 1)
              : null
          }
        />
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted">Your transfers</h2>
          <Link href="/transfers" className="text-xs font-medium text-accent">
            All transfers
          </Link>
        </div>
        <TransferList
          transfers={sentTransfers.rows}
          empty="No payments from you in this group yet."
          direction="sent"
        />
        <PaginationNav
          prevHref={
            settlementsPage > 1 ? settlementsHref(settlementsPage - 1) : null
          }
          nextHref={
            hasNextPage(settlementsPage, SMALL_PAGE_SIZE, settlementTotal)
              ? settlementsHref(settlementsPage + 1)
              : null
          }
        />
        {receivedTransfers.total > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-muted">
              Paid to you
            </h3>
            <TransferList
              transfers={receivedTransfers.rows}
              empty=""
              direction="received"
            />
          </div>
        )}
      </Card>

      {deletedTotal > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-muted">Deleted</h2>
          <ul className="space-y-2 text-sm">
            {deleted.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-2"
              >
                <span className="min-w-0 wrap-break-word text-muted">
                  {e.description}
                </span>
                {e.createdById === session.user.id && (
                  <Link
                    className="shrink-0 font-medium text-accent"
                    href={`/groups/${id}/expenses/${e.id}`}
                  >
                    Restore
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <PaginationNav
            prevHref={
              deletedPage > 1 ? deletedHref(deletedPage - 1) : null
            }
            nextHref={
              hasNextPage(deletedPage, SMALL_PAGE_SIZE, deletedTotal)
                ? deletedHref(deletedPage + 1)
                : null
            }
          />
        </Card>
      )}
    </div>
  );
}
