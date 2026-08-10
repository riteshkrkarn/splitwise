"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ActionResult } from "@/actions/auth";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { settlements } from "@/db/schema";
import {
  assertGroupMember,
  createActivity,
  createNotification,
} from "@/lib/group-data";
import { createId } from "@/lib/id";

migrate();

export async function createSettlementAction(
  groupId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  assertGroupMember(groupId, session.user.id);

  const fromUserId = String(formData.get("fromUserId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  const amount = Number(formData.get("amount"));
  const currency = String(formData.get("currency") ?? "INR");
  const note = String(formData.get("note") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  const date = dateStr ? new Date(dateStr) : new Date();

  if (!fromUserId || !toUserId || fromUserId === toUserId || !(amount > 0)) {
    return { error: "Pick two different people and a positive amount." };
  }

  db.insert(settlements)
    .values({
      id: createId("set"),
      groupId,
      fromUserId,
      toUserId,
      amount,
      currency,
      date,
      note,
      createdAt: new Date(),
    })
    .run();

  createActivity({
    userId: session.user.id,
    groupId,
    type: "SETTLEMENT",
    message: `Settlement recorded`,
  });

  createNotification({
    userId: toUserId,
    groupId,
    type: "SETTLEMENT",
    title: "Payment recorded",
    body: `Someone transferred ${currency} ${amount} to you`,
    href: `/groups/${groupId}`,
  });

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
