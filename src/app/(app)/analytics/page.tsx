import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import AnalyticsCharts from "./analytics-charts";
import { db } from "@/db";
import { expenses, groupMembers, groups, users } from "@/db/schema";
import { getGroupBalances, getGroupMembers } from "@/lib/group-data";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const memberships = await db
    .select({ groupId: groups.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), isNull(groups.deletedAt)))
    .all();

  const allExpenses = (
    await Promise.all(
      memberships.map((m) =>
        db
          .select()
          .from(expenses)
          .where(and(eq(expenses.groupId, m.groupId), isNull(expenses.deletedAt)))
          .all()
      )
    )
  ).flat();

  const catMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  for (const e of allExpenses) {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + e.amount);
  }

  const friendNets = new Map<string, number>();
  for (const m of memberships) {
    const members = await getGroupMembers(m.groupId);
    const balances = await getGroupBalances(m.groupId);
    for (const summary of balances) {
      const myNet = summary.netByUser[userId] ?? 0;
      // distribute rough pairwise via debts involving me
      for (const d of summary.debts) {
        if (d.fromUserId === userId) {
          friendNets.set(
            d.toUserId,
            (friendNets.get(d.toUserId) ?? 0) - d.amount
          );
        } else if (d.toUserId === userId) {
          friendNets.set(
            d.fromUserId,
            (friendNets.get(d.fromUserId) ?? 0) + d.amount
          );
        }
      }
      void myNet;
      void members;
    }
  }

  const crossGroup = await Promise.all(
    [...friendNets.entries()].map(async ([id, net]) => {
      const u = await db.select().from(users).where(eq(users.id, id)).get();
      return { name: u?.name ?? id, net };
    })
  );

  return (
    <AnalyticsCharts
      byCategory={[...catMap.entries()].map(([name, total]) => ({ name, total }))}
      byMonth={[...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, total]) => ({ name, total }))}
      crossGroup={crossGroup}
    />
  );
}
