import { cache } from "react";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityEvents,
  defaultSplits,
  expensePayers,
  expenseSplits,
  expenses,
  friendships,
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

const SQLITE_IN_CHUNK = 500;

async function selectByIds<T>(
  ids: string[],
  query: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += SQLITE_IN_CHUNK) {
    const chunk = ids.slice(i, i + SQLITE_IN_CHUNK);
    results.push(...(await query(chunk)));
  }
  return results;
}

export async function requireUserId(userId: string | undefined) {
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export const getGroupOrThrow = cache(async (groupId: string) => {
  const group = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .get();
  if (!group || group.deletedAt) throw new Error("Group not found");
  return group;
});

export const assertGroupMember = cache(
  async (groupId: string, userId: string) => {
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
);

export async function assertGroupOwner(groupId: string, userId: string) {
  const member = await assertGroupMember(groupId, userId);
  if (member.role !== "OWNER") throw new Error("Only the group owner can do that");
  return member;
}

export const assertFriendshipMember = cache(
  async (friendshipId: string, userId: string) => {
    const friendship = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          isNull(friendships.deletedAt),
          eq(friendships.status, "ACCEPTED"),
          or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))
        )
      )
      .get();
    if (!friendship) throw new Error("Not a friendship member");
    return friendship;
  }
);

export const getGroupMembers = cache(async (groupId: string) => {
  return db
    .select({
      id: groupMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarId: users.avatarId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .all();
});

export const getGroupExpenseBundle = cache(async (groupId: string) => {
  const activeExpenses = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))
    .all();

  const expenseIds = activeExpenses.map((e) => e.id);
  const [allSplits, allPayers, activeSettlements] = await Promise.all([
    selectByIds(expenseIds, (chunk) =>
      db
        .select()
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, chunk))
        .all()
    ),
    selectByIds(expenseIds, (chunk) =>
      db
        .select()
        .from(expensePayers)
        .where(inArray(expensePayers.expenseId, chunk))
        .all()
    ),
    db
      .select()
      .from(settlements)
      .where(and(eq(settlements.groupId, groupId), isNull(settlements.deletedAt)))
      .all(),
  ]);

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
});

export const getGroupBalances = cache(
  async (groupId: string): Promise<BalanceSummary[]> => {
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
);

export const getNotificationsForUser = cache(
  async (userId: string, limit = 12, offset = 0) => {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all();
  }
);

export const getPendingInviteIdsForEmail = cache(async (email: string) => {
  return (
    await db
      .select({ id: groupInvites.id })
      .from(groupInvites)
      .where(
        and(eq(groupInvites.email, email), eq(groupInvites.status, "PENDING"))
      )
      .all()
  ).map((i) => i.id);
});

export const getPendingFriendIdsForUser = cache(async (userId: string) => {
  return (
    await db
      .select()
      .from(friendships)
      .where(
        and(
          isNull(friendships.deletedAt),
          eq(friendships.status, "PENDING"),
          or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))
        )
      )
      .all()
  )
    .filter((f) => f.requestedBy !== userId)
    .map((f) => f.id);
});

export async function createNotification(input: {
  userId: string;
  groupId?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string;
}) {
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
  return db
    .select()
    .from(defaultSplits)
    .where(eq(defaultSplits.groupId, groupId))
    .all();
}

export async function getPendingInvites(groupId: string) {
  return db
    .select()
    .from(groupInvites)
    .where(
      and(eq(groupInvites.groupId, groupId), eq(groupInvites.status, "PENDING"))
    )
    .all();
}

export type TransferRow = {
  id: string;
  amount: number;
  currency: string;
  date: Date;
  note: string | null;
  fromUserId: string;
  toUserId: string;
  otherUserId: string;
  otherName: string;
  groupId: string | null;
  groupName: string | null;
};

export const getTransfersForUser = cache(
  async (
    userId: string,
    opts: {
      direction: "sent" | "received";
      groupId?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const limit = opts.limit ?? 25;
    const offset = opts.offset ?? 0;
    const directionFilter =
      opts.direction === "sent"
        ? eq(settlements.fromUserId, userId)
        : eq(settlements.toUserId, userId);
    const otherJoin =
      opts.direction === "sent"
        ? eq(users.id, settlements.toUserId)
        : eq(users.id, settlements.fromUserId);
    const where = and(
      directionFilter,
      isNull(settlements.deletedAt),
      opts.groupId ? eq(settlements.groupId, opts.groupId) : undefined
    );

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: settlements.id,
          amount: settlements.amount,
          currency: settlements.currency,
          date: settlements.date,
          note: settlements.note,
          fromUserId: settlements.fromUserId,
          toUserId: settlements.toUserId,
          otherUserId: users.id,
          otherName: users.name,
          groupId: settlements.groupId,
          groupName: groups.name,
        })
        .from(settlements)
        .innerJoin(users, otherJoin)
        .leftJoin(groups, eq(groups.id, settlements.groupId))
        .where(where)
        .orderBy(desc(settlements.date), desc(settlements.createdAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(settlements)
        .where(where)
        .get(),
    ]);

    return { rows: rows as TransferRow[], total: totalRow?.value ?? 0 };
  }
);

export { selectByIds };
