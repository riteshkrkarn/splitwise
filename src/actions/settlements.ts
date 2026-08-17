"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import type { ActionResult } from "@/actions/auth";
import { db } from "@/db";
import { settlements } from "@/db/schema";
import {
  assertGroupMember,
  createActivity,
  createNotification,
  getGroupBalances,
  getGroupMembers,
} from "@/lib/group-data";
import { createId } from "@/lib/id";
import { CURRENCIES, roundMoney } from "@/lib/utils";

const settlementSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
  date: z.string().optional(),
  stay: z.string().optional(),
});

export async function createSettlementAction(
  groupId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  await assertGroupMember(groupId, session.user.id);

  const parsed = settlementSchema.safeParse({
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
    amount: formData.get("amount"),
    currency: formData.get("currency") ?? "INR",
    note: String(formData.get("note") ?? "") || null,
    date: formData.get("date"),
    stay: formData.get("stay"),
  });
  if (!parsed.success) {
    return { error: "Pick two different people and a positive amount." };
  }

  const { fromUserId, toUserId, amount, currency, note, date: dateStr, stay } =
    parsed.data;
  const date = dateStr ? new Date(dateStr) : new Date();

  if (fromUserId === toUserId) {
    return { error: "Pick two different people and a positive amount." };
  }
  if (fromUserId !== session.user.id) {
    return { error: "You can only record a payment for a debt you owe." };
  }
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    return { error: "Invalid currency." };
  }

  const members = await getGroupMembers(groupId);
  const memberIds = new Set(members.map((m) => m.userId));
  if (!memberIds.has(fromUserId) || !memberIds.has(toUserId)) {
    return { error: "Both people must be group members." };
  }

  const balances = await getGroupBalances(groupId);
  const summary = balances.find((b) => b.currency === currency);
  const debts = summary?.pairwiseDebts ?? summary?.debts ?? [];
  const owed = debts.find(
    (d) => d.fromUserId === fromUserId && d.toUserId === toUserId
  );
  if (!owed) {
    return { error: "No outstanding debt in that currency between those people." };
  }
  if (roundMoney(amount) > roundMoney(owed.amount) + 0.009) {
    return {
      error: `Amount cannot exceed ${owed.amount.toFixed(2)} ${currency}.`,
    };
  }

  await db.insert(settlements).values({
    id: createId("set"),
    groupId,
    fromUserId,
    toUserId,
    amount: roundMoney(amount),
    currency,
    date,
    note,
    createdAt: new Date(),
  });

  await createActivity({
    userId: session.user.id,
    groupId,
    type: "SETTLEMENT",
    message: `Payment of ${currency} ${amount} recorded`,
  });

  if (toUserId !== session.user.id) {
    await createNotification({
      userId: toUserId,
      groupId,
      type: "SETTLEMENT",
      title: "Payment recorded",
      body: `${session.user.name} recorded a ${currency} ${amount} transfer to you`,
      href: `/groups/${groupId}`,
    });
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settle`);
  revalidatePath("/dashboard");
  revalidatePath("/transfers");
  if (stay === "1") return { success: "Payment recorded." };
  redirect(`/groups/${groupId}`);
}
