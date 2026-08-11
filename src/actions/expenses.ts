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
  assertGroupMember,
  createActivity,
  createNotification,
  getGroupMembers,
} from "@/lib/group-data";
import { createId } from "@/lib/id";
import {
  computeSplits,
  validatePayers,
  type SplitMode,
} from "@/lib/split-validator";

function parseParticipants(formData: FormData) {
  const participantIds = formData.getAll("participantIds").map(String);
  return participantIds;
}

export async function createExpenseAction(
  groupId: string | null,
  friendshipId: string | null,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  if (groupId) await assertGroupMember(groupId, session.user.id);

  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const currency = String(formData.get("currency") ?? "INR");
  const category = String(formData.get("category") ?? "General");
  const notes = String(formData.get("notes") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  const splitMode = String(formData.get("splitMode") ?? "EQUAL") as SplitMode;
  const date = dateStr ? new Date(dateStr) : new Date();

  if (!description || !(amount > 0)) {
    return { error: "Description and positive amount are required." };
  }

  const participantIds = parseParticipants(formData);
  if (participantIds.length === 0) {
    return { error: "Select at least one participant." };
  }

  // Payers: either single payerId or multiple payer_<userId>
  let payers: { userId: string; amount: number }[] = [];
  const multi = formData.get("multiPayer") === "on";
  if (multi) {
    for (const uid of participantIds) {
      const raw = formData.get(`payer_${uid}`);
      if (raw == null || raw === "") continue;
      const val = Number(raw);
      if (val > 0) payers.push({ userId: uid, amount: val });
    }
  } else {
    const payerId = String(formData.get("payerId") ?? session.user.id);
    payers = [{ userId: payerId, amount }];
  }

  try {
    validatePayers(amount, payers);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid payers" };
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

  let splits;
  try {
    splits = computeSplits(amount, splitMode, splitInputs);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid splits" };
  }

  const expenseId = createId("exp");
  await db.insert(expenses)
    .values({
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
    })
    ;

  for (const s of splits) {
    await db.insert(expenseSplits)
      .values({
        id: createId("spl"),
        expenseId,
        userId: s.userId,
        amount: s.amount,
        shares: s.shares ?? null,
        percent: s.percent ?? null,
      })
      ;
  }
  for (const p of payers) {
    await db.insert(expensePayers)
      .values({
        id: createId("pay"),
        expenseId,
        userId: p.userId,
        amount: p.amount,
      })
      ;
  }

  await db.insert(expenseHistory)
    .values({
      id: createId("hist"),
      expenseId,
      userId: session.user.id,
      action: "CREATED",
      snapshot: JSON.stringify({ description, amount, currency, splits, payers }),
      createdAt: new Date(),
    })
    ;

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

export async function softDeleteExpenseAction(expenseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).get();
  if (!expense) throw new Error("Not found");
  if (expense.groupId) await assertGroupMember(expense.groupId, session.user.id);

  await db.update(expenses)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(expenses.id, expenseId))
    ;

  await db.insert(expenseHistory)
    .values({
      id: createId("hist"),
      expenseId,
      userId: session.user.id,
      action: "DELETED",
      snapshot: JSON.stringify({ deletedAt: new Date() }),
      createdAt: new Date(),
    })
    ;

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
}

export async function restoreExpenseAction(expenseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).get();
  if (!expense?.groupId) throw new Error("Not found");
  await assertGroupMember(expense.groupId, session.user.id);

  await db.update(expenses)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(expenses.id, expenseId))
    ;

  await createActivity({
    userId: session.user.id,
    groupId: expense.groupId,
    type: "EXPENSE_RESTORED",
    message: `${session.user.name} restored “${expense.description}”`,
  });
  revalidatePath(`/groups/${expense.groupId}`);
  redirect(`/groups/${expense.groupId}`);
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

  const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).get();
  if (!expense) return { error: "Expense not found" };
  if (expense.groupId) await assertGroupMember(expense.groupId, session.user.id);

  await db.insert(expenseComments)
    .values({
      id: createId("cmt"),
      expenseId,
      userId: session.user.id,
      body,
      createdAt: new Date(),
    })
    ;

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
  return { success: "Comment added" };
}
