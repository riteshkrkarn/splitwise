"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ActionResult } from "@/actions/auth";
import { db } from "@/db";
import {
  expenseComments,
  expenseHistory,
  expensePayers,
  expenseSplits,
  expenses,
} from "@/db/schema";
import {
  assertFriendshipMember,
  assertGroupMember,
  createActivity,
  createNotification,
  getGroupMembers,
} from "@/lib/group-data";
import { createId } from "@/lib/id";
import {
  computeSplits,
  validatePayers,
  type ComputedSplit,
  type PayerInput,
  type SplitMode,
} from "@/lib/split-validator";
import { CATEGORIES, CURRENCIES } from "@/lib/utils";

type ParsedExpense = {
  description: string;
  amount: number;
  currency: string;
  category: string;
  notes: string | null;
  date: Date;
  splitMode: SplitMode;
  payers: PayerInput[];
  splits: ComputedSplit[];
  participantIds: string[];
};

const splitModes = ["EQUAL", "EXACT", "PERCENTAGE", "SHARES"] as const;

function parseExpenseForm(
  formData: FormData,
  fallbackPayerId: string
): { ok: true; data: ParsedExpense } | { ok: false; error: string } {
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const currency = String(formData.get("currency") ?? "INR");
  const category = String(formData.get("category") ?? "General");
  const notes = String(formData.get("notes") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  const splitMode = String(formData.get("splitMode") ?? "EQUAL") as SplitMode;
  const date = dateStr ? new Date(dateStr) : new Date();

  if (!description || !(amount > 0)) {
    return { ok: false, error: "Description and positive amount are required." };
  }
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    return { ok: false, error: "Invalid currency." };
  }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: "Invalid category." };
  }
  if (!(splitModes as readonly string[]).includes(splitMode)) {
    return { ok: false, error: "Invalid split mode." };
  }

  const participantIds = formData.getAll("participantIds").map(String);
  if (participantIds.length === 0) {
    return { ok: false, error: "Select at least one participant." };
  }

  let payers: PayerInput[] = [];
  const multi = formData.get("multiPayer") === "on";
  if (multi) {
    for (const uid of participantIds) {
      const raw = formData.get(`payer_${uid}`);
      if (raw == null || raw === "") continue;
      const val = Number(raw);
      if (val > 0) payers.push({ userId: uid, amount: val });
    }
  } else {
    const payerId = String(formData.get("payerId") ?? fallbackPayerId);
    payers = [{ userId: payerId, amount }];
  }

  try {
    validatePayers(amount, payers);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid payers" };
  }

  const splitInputs = participantIds.map((userId) => ({
    userId,
    amount: formData.get(`exact_${userId}`)
      ? Number(formData.get(`exact_${userId}`))
      : undefined,
    percent: formData.get(`percent_${userId}`)
      ? Number(formData.get(`percent_${userId}`))
      : undefined,
    shares: formData.get(`shares_${userId}`)
      ? Number(formData.get(`shares_${userId}`))
      : undefined,
  }));

  try {
    return {
      ok: true,
      data: {
        description,
        amount,
        currency,
        category,
        notes,
        date,
        splitMode,
        payers,
        splits: computeSplits(amount, splitMode, splitInputs),
        participantIds,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid splits" };
  }
}

function assertAllowedUsers(
  allowed: Set<string>,
  payers: PayerInput[],
  splits: ComputedSplit[]
) {
  for (const p of payers) {
    if (!allowed.has(p.userId)) throw new Error("Payer is not a member.");
  }
  for (const s of splits) {
    if (!allowed.has(s.userId)) throw new Error("Participant is not a member.");
  }
}

async function allowedUserIdsForExpense(input: {
  groupId: string | null;
  friendshipId: string | null;
  userId: string;
}) {
  if (input.groupId && input.friendshipId) {
    throw new Error("Expense cannot belong to both a group and a friendship.");
  }
  if (input.groupId) {
    await assertGroupMember(input.groupId, input.userId);
    const members = await getGroupMembers(input.groupId);
    return new Set(members.map((m) => m.userId));
  }
  if (input.friendshipId) {
    const friendship = await assertFriendshipMember(
      input.friendshipId,
      input.userId
    );
    return new Set([friendship.userAId, friendship.userBId]);
  }
  throw new Error("Expense must belong to a group or friendship.");
}

export async function createExpenseAction(
  groupId: string | null,
  friendshipId: string | null,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  let allowed: Set<string>;
  try {
    allowed = await allowedUserIdsForExpense({
      groupId,
      friendshipId,
      userId: session.user.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }

  const parsed = parseExpenseForm(formData, session.user.id);
  if (!parsed.ok) return { error: parsed.error };
  const {
    description,
    amount,
    currency,
    category,
    notes,
    date,
    splitMode,
    payers,
    splits,
  } = parsed.data;

  try {
    assertAllowedUsers(allowed, payers, splits);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid members" };
  }

  const expenseId = createId("exp");

  await db.transaction(async (tx) => {
    await tx.insert(expenses).values({
      id: expenseId,
      groupId,
      friendshipId,
      description,
      amount,
      currency,
      category,
      notes,
      date,
      splitMode,
      createdById: session.user.id,
      isIou: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (splits.length) {
      await tx.insert(expenseSplits).values(
        splits.map((s) => ({
          id: createId("spl"),
          expenseId,
          userId: s.userId,
          amount: s.amount,
          shares: s.shares ?? null,
          percent: s.percent ?? null,
        }))
      );
    }
    if (payers.length) {
      await tx.insert(expensePayers).values(
        payers.map((p) => ({
          id: createId("pay"),
          expenseId,
          userId: p.userId,
          amount: p.amount,
        }))
      );
    }
    await tx.insert(expenseHistory).values({
      id: createId("hist"),
      expenseId,
      userId: session.user.id,
      action: "CREATED",
      snapshot: JSON.stringify({ description, amount, currency, splits, payers }),
      createdAt: new Date(),
    });
  });

  await createActivity({
    userId: session.user.id,
    groupId,
    type: "EXPENSE_CREATED",
    message: `${session.user.name} added “${description}”`,
  });

  if (groupId) {
    const members = await getGroupMembers(groupId);
    for (const m of members) {
      if (m.userId === session.user.id) continue;
      await createNotification({
        userId: m.userId,
        groupId,
        type: "EXPENSE_ADDED",
        title: "New expense",
        body: `${session.user.name} added ${description}`,
        href: `/groups/${groupId}/expenses/${expenseId}`,
      });
    }
    revalidatePath(`/groups/${groupId}`);
    redirect(`/groups/${groupId}`);
  }

  if (friendshipId) {
    revalidatePath(`/friends/${friendshipId}`);
    redirect(`/friends/${friendshipId}`);
  }

  return { success: "Expense added." };
}

export async function updateExpenseAction(
  expenseId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense || expense.deletedAt) return { error: "Expense not found." };
  if (expense.createdById !== session.user.id) {
    return { error: "You can only edit expenses you added." };
  }

  let allowed: Set<string>;
  try {
    allowed = await allowedUserIdsForExpense({
      groupId: expense.groupId,
      friendshipId: expense.friendshipId,
      userId: session.user.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }

  const parsed = parseExpenseForm(formData, session.user.id);
  if (!parsed.ok) return { error: parsed.error };
  const {
    description,
    amount,
    currency,
    category,
    notes,
    date,
    splitMode,
    payers,
    splits,
  } = parsed.data;

  try {
    assertAllowedUsers(allowed, payers, splits);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid members" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        description,
        amount,
        currency,
        category,
        notes,
        date,
        splitMode,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId));

    await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expenseId));

    if (splits.length) {
      await tx.insert(expenseSplits).values(
        splits.map((s) => ({
          id: createId("spl"),
          expenseId,
          userId: s.userId,
          amount: s.amount,
          shares: s.shares ?? null,
          percent: s.percent ?? null,
        }))
      );
    }
    if (payers.length) {
      await tx.insert(expensePayers).values(
        payers.map((p) => ({
          id: createId("pay"),
          expenseId,
          userId: p.userId,
          amount: p.amount,
        }))
      );
    }
    await tx.insert(expenseHistory).values({
      id: createId("hist"),
      expenseId,
      userId: session.user.id,
      action: "UPDATED",
      snapshot: JSON.stringify({ description, amount, currency, splits, payers }),
      createdAt: new Date(),
    });
  });

  if (expense.groupId) {
    await createActivity({
      userId: session.user.id,
      groupId: expense.groupId,
      type: "EXPENSE_UPDATED",
      message: `${session.user.name} updated “${description}”`,
    });
    revalidatePath(`/groups/${expense.groupId}`);
    revalidatePath(`/groups/${expense.groupId}/expenses/${expenseId}`);
    redirect(`/groups/${expense.groupId}/expenses/${expenseId}`);
  }

  if (expense.friendshipId) {
    revalidatePath(`/friends/${expense.friendshipId}`);
    revalidatePath(`/friends/${expense.friendshipId}/expenses/${expenseId}`);
    redirect(`/friends/${expense.friendshipId}/expenses/${expenseId}`);
  }

  return { success: "Expense updated." };
}

export async function softDeleteExpenseAction(
  expenseId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense) return { error: "Not found" };

  try {
    await allowedUserIdsForExpense({
      groupId: expense.groupId,
      friendshipId: expense.friendshipId,
      userId: session.user.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }

  if (expense.createdById !== session.user.id) {
    return { error: "You can only delete expenses you added." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(expenses.id, expenseId));
    await tx.insert(expenseHistory).values({
      id: createId("hist"),
      expenseId,
      userId: session.user.id,
      action: "DELETED",
      snapshot: JSON.stringify({ deletedAt: new Date() }),
      createdAt: new Date(),
    });
  });

  if (expense.groupId) {
    await createActivity({
      userId: session.user.id,
      groupId: expense.groupId,
      type: "EXPENSE_DELETED",
      message: `${session.user.name} deleted “${expense.description}”`,
    });
    revalidatePath(`/groups/${expense.groupId}`);
    redirect(`/groups/${expense.groupId}`);
  }
  if (expense.friendshipId) {
    revalidatePath(`/friends/${expense.friendshipId}`);
    redirect(`/friends/${expense.friendshipId}`);
  }
  return { success: "Expense deleted." };
}

export async function restoreExpenseAction(
  expenseId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense) return { error: "Not found" };

  try {
    await allowedUserIdsForExpense({
      groupId: expense.groupId,
      friendshipId: expense.friendshipId,
      userId: session.user.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }

  if (expense.createdById !== session.user.id) {
    return { error: "You can only restore expenses you added." };
  }

  await db
    .update(expenses)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(expenses.id, expenseId));

  if (expense.groupId) {
    await createActivity({
      userId: session.user.id,
      groupId: expense.groupId,
      type: "EXPENSE_RESTORED",
      message: `${session.user.name} restored “${expense.description}”`,
    });
    revalidatePath(`/groups/${expense.groupId}`);
    redirect(`/groups/${expense.groupId}`);
  }
  if (expense.friendshipId) {
    revalidatePath(`/friends/${expense.friendshipId}`);
    redirect(`/friends/${expense.friendshipId}`);
  }
  return { success: "Expense restored." };
}

export async function addCommentAction(
  expenseId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Comment required" };

  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense) return { error: "Expense not found" };

  try {
    await allowedUserIdsForExpense({
      groupId: expense.groupId,
      friendshipId: expense.friendshipId,
      userId: session.user.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }

  await db.insert(expenseComments).values({
    id: createId("cmt"),
    expenseId,
    userId: session.user.id,
    body,
    createdAt: new Date(),
  });

  if (expense.groupId) {
    await createActivity({
      userId: session.user.id,
      groupId: expense.groupId,
      type: "COMMENT",
      message: `${session.user.name} commented on “${expense.description}”`,
    });
    if (expense.createdById !== session.user.id) {
      await createNotification({
        userId: expense.createdById,
        groupId: expense.groupId,
        type: "COMMENT",
        title: "New comment",
        body: `${session.user.name}: ${body}`,
        href: `/groups/${expense.groupId}/expenses/${expenseId}`,
      });
    }
    revalidatePath(`/groups/${expense.groupId}/expenses/${expenseId}`);
  }
  if (expense.friendshipId) {
    revalidatePath(`/friends/${expense.friendshipId}/expenses/${expenseId}`);
  }
  return { success: "Comment added" };
}
