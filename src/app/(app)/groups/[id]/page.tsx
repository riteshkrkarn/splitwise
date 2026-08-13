import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull, isNull, like } from "drizzle-orm";
import { auth } from "@/auth";
import { sendPaymentRemindersAction } from "@/actions/notifications";
import { AvatarDisplay } from "@/components/avatar-display";
import { BalanceList } from "@/components/balance-list";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import {
  assertGroupMember,
  getGroupBalances,
  getGroupExpenseBundle,
  getGroupMembers,
  getGroupOrThrow,
  getPendingInvites,
} from "@/lib/group-data";
import { formatMoney } from "@/lib/utils";
import { InviteForm } from "./group-forms";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    await assertGroupMember(id, session.user.id);
  } catch {
    notFound();
  }

  const group = await getGroupOrThrow(id);
  const members = await getGroupMembers(id);
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const balances = await getGroupBalances(id);
  const invites = await getPendingInvites(id);

  const conditions = [eq(expenses.groupId, id)];
  if (sp.q) conditions.push(like(expenses.description, `%${sp.q}%`));
  if (sp.category) conditions.push(eq(expenses.category, sp.category));

  const active = await db
    .select()
    .from(expenses)
    .where(and(...conditions, isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.date))
    .all();

  const deleted = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, id), isNotNull(expenses.deletedAt)))
    .orderBy(desc(expenses.deletedAt))
    .limit(10)
    .all();

  const { settlements } = await getGroupExpenseBundle(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AvatarDisplay avatarId={group.coverAvatarId} name={group.name} size={56} />
          <div>
            <h1 className="page-title">{group.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {members.length}/5 members · {group.currency}
              {group.simplifyDebts ? " · debts simplified" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/groups/${id}/expenses/new`}>
            <Button>Add expense</Button>
          </Link>
          <Link href={`/groups/${id}/settle`}>
            <Button variant="secondary">Settle up</Button>
          </Link>
          <Link href={`/groups/${id}/settings`}>
            <Button variant="outline">Settings</Button>
          </Link>
          <Link href={`/groups/${id}/export?format=csv`}>
            <Button variant="ghost" size="sm">
              Export
            </Button>
          </Link>
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

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-semibold">Expenses</h2>
          <form className="flex flex-wrap gap-2">
            <Input name="q" placeholder="Search…" defaultValue={sp.q} className="w-40" />
            <Input
              name="category"
              placeholder="Category"
              defaultValue={sp.category}
              className="w-36"
            />
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
        </div>
        {active.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No expenses yet"
              description="Add the first shared cost so balances stay accurate."
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
                <Link
                  href={`/groups/${id}/expenses/${e.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-bg"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="text-xs text-muted">
                      {e.category} · {new Date(e.date).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="money shrink-0">{formatMoney(e.amount, e.currency)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-muted">Settlements</h2>
        <ul className="space-y-2 text-sm">
          {settlements.length === 0 && (
            <li className="text-muted">No transfers recorded yet.</li>
          )}
          {settlements.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2">
              <span>
                <span className="font-medium">{nameById[s.fromUserId] ?? "Someone"}</span>
                {" transferred "}
                <span className="money">{formatMoney(s.amount, s.currency)}</span>
                {" to "}
                <span className="font-medium">{nameById[s.toUserId] ?? "someone"}</span>
                {s.note ? (
                  <span className="text-muted"> — {s.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {deleted.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-muted">
            Deleted
          </h2>
          <ul className="space-y-2 text-sm">
            {deleted.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="text-muted">{e.description}</span>
                <Link
                  className="font-medium text-accent"
                  href={`/groups/${id}/expenses/${e.id}`}
                >
                  Restore
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
