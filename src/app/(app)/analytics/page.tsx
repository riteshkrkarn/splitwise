import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import AnalyticsChartsLoader from "./analytics-charts-loader";
import { db } from "@/db";
import { expenses, groupMembers, groups, users } from "@/db/schema";
import { getGroupBalances } from "@/lib/group-data";
import { formatMoney } from "@/lib/utils";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const memberships = await db
    .select({ groupId: groups.id, currency: groups.currency })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), isNull(groups.deletedAt)))
    .all();

  const groupIds = memberships.map((m) => m.groupId);
  const displayCurrency = memberships[0]?.currency ?? "INR";

  const categoryRows =
    groupIds.length === 0
      ? []
      : await db
          .select({
            category: expenses.category,
            currency: expenses.currency,
            total: sql<number>`sum(${expenses.amount})`.mapWith(Number),
          })
          .from(expenses)
          .where(
            and(inArray(expenses.groupId, groupIds), isNull(expenses.deletedAt))
          )
          .groupBy(expenses.category, expenses.currency)
          .all();

  const monthRows =
    groupIds.length === 0
      ? []
      : await db
          .select({
            month: sql<string>`strftime('%Y-%m', ${expenses.date} / 1000, 'unixepoch')`,
            currency: expenses.currency,
            total: sql<number>`sum(${expenses.amount})`.mapWith(Number),
          })
          .from(expenses)
          .where(
            and(inArray(expenses.groupId, groupIds), isNull(expenses.deletedAt))
          )
          .groupBy(
            sql`strftime('%Y-%m', ${expenses.date} / 1000, 'unixepoch')`,
            expenses.currency
          )
          .all();

  const byCategory = categoryRows
    .filter((r) => r.currency === displayCurrency)
    .map((r) => ({ name: r.category, total: r.total }));

  const byMonth = monthRows
    .filter((r) => r.currency === displayCurrency)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ name: r.month, total: r.total }));

  const balanceResults = await Promise.all(
    memberships.map((m) => getGroupBalances(m.groupId))
  );

  const friendNets = new Map<string, { net: number; currency: string }>();
  for (const balances of balanceResults) {
    for (const summary of balances) {
      if (summary.currency !== displayCurrency) continue;
      for (const d of summary.pairwiseDebts ?? summary.debts) {
        if (d.fromUserId === userId) {
          const prev = friendNets.get(d.toUserId);
          friendNets.set(d.toUserId, {
            currency: d.currency,
            net: (prev?.net ?? 0) - d.amount,
          });
        } else if (d.toUserId === userId) {
          const prev = friendNets.get(d.fromUserId);
          friendNets.set(d.fromUserId, {
            currency: d.currency,
            net: (prev?.net ?? 0) + d.amount,
          });
        }
      }
    }
  }

  const friendIds = [...friendNets.keys()];
  const friendUsers =
    friendIds.length === 0
      ? []
      : await db.select().from(users).where(inArray(users.id, friendIds)).all();
  const nameById = Object.fromEntries(friendUsers.map((u) => [u.id, u.name]));

  const crossGroup = [...friendNets.entries()].map(([id, v]) => ({
    name: nameById[id] ?? id,
    net: v.net,
    currency: v.currency,
    label: formatMoney(Math.abs(v.net), v.currency),
  }));

  return (
    <AnalyticsChartsLoader
      byCategory={byCategory}
      byMonth={byMonth}
      crossGroup={crossGroup}
      currency={displayCurrency}
    />
  );
}
