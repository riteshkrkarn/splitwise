import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import {
  activityEvents,
  defaultSplits,
  expensePayers,
  expenseSplits,
  expenses,
  groupInvites,
  groupMembers,
  groups,
  notifications,
  settlements,
  users,
} from "@/db/schema";
import {
  computeNetBalances,
  computePairwiseDebts,
  summarizeBalances,
  type BalanceSummary,
} from "@/lib/balances";
import { createId } from "@/lib/id";

export async function requireUserId(userId: string | undefined) {
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function getGroupOrThrow(groupId: string) {
  await migrate();
  const group = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .get();
  if (!group || group.deletedAt) throw new Error("Group not found");
  return group;
}

export async function assertGroupMember(groupId: string, userId: string) {
  await migrate();
  const member = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    )
    .get();
  if (!member) throw new Error("Not a group member");
  return member;
}

export async function getGroupMembers(groupId: string) {
  await migrate();
  return db
    .select({
      id: groupMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarId: users.avatarId,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .all();
}

export async function getGroupExpenseBundle(groupId: string) {
  await migrate();
  const activeExpenses = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))
    .all();

  const expenseIds = activeExpenses.map((e) => e.id);
  const allSplits =
    expenseIds.length === 0
      ? []
      : (await db.select().from(expenseSplits).all()).filter((s) =>
          expenseIds.includes(s.expenseId)
        );
  const allPayers =
    expenseIds.length === 0
      ? []
      : (await db.select().from(expensePayers).all()).filter((p) =>
          expenseIds.includes(p.expenseId)
        );

  const activeSettlements = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.groupId, groupId), isNull(settlements.deletedAt)))
    .all();

  const expensePayload = activeExpenses.map((e) => ({
    currency: e.currency,
    payers: allPayers
      .filter((p) => p.expenseId === e.id)
      .map((p) => ({ userId: p.userId, amount: p.amount })),
    splits: allSplits
      .filter((s) => s.expenseId === e.id)
      .map((s) => ({ userId: s.userId, amount: s.amount })),
  }));

  return {
    expenses: activeExpenses,
    splits: allSplits,
    payers: allPayers,
    settlements: activeSettlements,
    ious: [] as Array<{
      fromUserId: string;
      toUserId: string;
      amount: number;
      currency: string;
    }>,
    expensePayload,
  };
}

export async function getGroupBalances(groupId: string): Promise<BalanceSummary[]> {
  const group = await getGroupOrThrow(groupId);
  const { expensePayload, settlements } = await getGroupExpenseBundle(groupId);
  const settlementRows = settlements.map((s) => ({
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    amount: s.amount,
    currency: s.currency,
  }));
  const net = computeNetBalances(expensePayload, settlementRows, []);
  const pairwise = computePairwiseDebts(expensePayload, settlementRows, []);
  return summarizeBalances(net, group.simplifyDebts, pairwise);
}

export async function createNotification(input: {
  userId: string;
  groupId?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string;
}) {
  await migrate();
  await db.insert(notifications).values({
    id: createId("ntf"),
    userId: input.userId,
    groupId: input.groupId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    read: false,
    createdAt: new Date(),
  });
}

export async function createActivity(input: {
  userId: string;
  groupId?: string | null;
  type: string;
  message: string;
  meta?: unknown;
}) {
  await migrate();
  await db.insert(activityEvents).values({
    id: createId("act"),
    userId: input.userId,
    groupId: input.groupId ?? null,
    type: input.type,
    message: input.message,
    meta: input.meta ? JSON.stringify(input.meta) : null,
    createdAt: new Date(),
  });
}

export async function getDefaultSplits(groupId: string) {
  await migrate();
  return db
    .select()
    .from(defaultSplits)
    .where(eq(defaultSplits.groupId, groupId))
    .all();
}

export async function getPendingInvites(groupId: string) {
  await migrate();
  return db
    .select()
    .from(groupInvites)
    .where(
      and(eq(groupInvites.groupId, groupId), eq(groupInvites.status, "PENDING"))
    )
    .all();
}
