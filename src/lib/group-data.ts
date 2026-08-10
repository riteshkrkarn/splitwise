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
  summarizeBalances,
  type BalanceSummary,
} from "@/lib/balances";
import { createId } from "@/lib/id";

migrate();

export async function requireUserId(userId: string | undefined) {
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export function getGroupOrThrow(groupId: string) {
  const group = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group || group.deletedAt) throw new Error("Group not found");
  return group;
}

export function assertGroupMember(groupId: string, userId: string) {
  const member = db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    )
    .get();
  if (!member) throw new Error("Not a group member");
  return member;
}

export function getGroupMembers(groupId: string) {
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

export function getGroupExpenseBundle(groupId: string) {
  const activeExpenses = db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))
    .all();

  const expenseIds = activeExpenses.map((e) => e.id);
  const allSplits =
    expenseIds.length === 0
      ? []
      : db.select().from(expenseSplits).all().filter((s) => expenseIds.includes(s.expenseId));
  const allPayers =
    expenseIds.length === 0
      ? []
      : db.select().from(expensePayers).all().filter((p) => expenseIds.includes(p.expenseId));

  const activeSettlements = db
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

export function getGroupBalances(groupId: string): BalanceSummary[] {
  const group = getGroupOrThrow(groupId);
  const { expensePayload, settlements } = getGroupExpenseBundle(groupId);
  const net = computeNetBalances(
    expensePayload,
    settlements.map((s) => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount,
      currency: s.currency,
    })),
    []
  );
  return summarizeBalances(net, group.simplifyDebts);
}

export function createNotification(input: {
  userId: string;
  groupId?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string;
}) {
  db.insert(notifications)
    .values({
      id: createId("ntf"),
      userId: input.userId,
      groupId: input.groupId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      read: false,
      createdAt: new Date(),
    })
    .run();
}

export function createActivity(input: {
  userId: string;
  groupId?: string | null;
  type: string;
  message: string;
  meta?: unknown;
}) {
  db.insert(activityEvents)
    .values({
      id: createId("act"),
      userId: input.userId,
      groupId: input.groupId ?? null,
      type: input.type,
      message: input.message,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: new Date(),
    })
    .run();
}

export function getDefaultSplits(groupId: string) {
  return db
    .select()
    .from(defaultSplits)
    .where(eq(defaultSplits.groupId, groupId))
    .all();
}

export function getPendingInvites(groupId: string) {
  return db
    .select()
    .from(groupInvites)
    .where(
      and(eq(groupInvites.groupId, groupId), eq(groupInvites.status, "PENDING"))
    )
    .all();
}
